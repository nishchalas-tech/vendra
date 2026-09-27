"""
Vendra Python Backend Main Server & Router (backend/app/main.py)
Implements:
- Section 47: GET /health -> {"status": "ok", "service": "vendra-backend"}
- Section 48: Process management on BACKEND_PORT (8001 fallback if 8000 is occupied by container control plane),
  reusing if already running, clean SIGINT/SIGTERM handling, no duplicate processes or infinite respawn loops.
- Section 52: All REST API routes with authentication and ownership enforcement.
"""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import re
import signal
import socket
import sys
import urllib.request
from pathlib import Path
from typing import Any, Dict, Optional, Tuple
from urllib.parse import parse_qs, urlparse

for _p in (str(Path(__file__).resolve().parents[1]), str(Path(__file__).resolve().parents[2])):
    if _p not in sys.path:
        sys.path.append(_p)

from app.api.approvals import (
    handle_approve,
    handle_list_approvals,
    handle_reject,
)
from app.api.audit import handle_list_audit_events
from app.api.auth import (
    handle_login,
    handle_logout,
    handle_me,
    handle_signup,
)
from app.api.chat import (
    handle_chat_message,
    handle_get_chat_history,
    handle_live_supplier_search,
)
from app.api.missions import (
    handle_analyze_mission_requirements,
    handle_analyze_product,
    handle_ask_vendra,
    handle_cancel_mission,
    handle_create_mission,
    handle_discover_suppliers,
    handle_generate_rfqs,
    handle_get_mission,
    handle_launch_mission,
    handle_list_missions,
    handle_process_response,
    handle_simulate_delay,
    handle_update_mission,
    handle_update_mission_requirements,
    handle_voice_command,
)
from app.api.profile import handle_get_profile, handle_put_profile
from app.api.rfqs import (
    handle_create_rfq,
    handle_list_rfqs,
    handle_send_rfq,
    handle_update_rfq,
)
from app.api.risks import handle_list_risks
from app.api.suppliers import (
    handle_get_supplier,
    handle_list_sourcing_activities,
    handle_list_suppliers,
)
from app.api.webhooks import (
    handle_webhook_approval,
    handle_webhook_external_event,
    handle_webhook_supplier_response,
)
from app.core.config import settings
from app.core.logging import logger
from app.database.seed import seed_suppliers_catalog
from app.database.session import fetch_one, get_db, run_migrations
from app.integrations.breeth import get_breeth_status
from app.integrations.dodo import get_settlement_status
from app.integrations.elevenlabs import is_elevenlabs_configured
from app.integrations.gemini import is_gemini_configured
from app.integrations.n8n import is_n8n_configured
from app.integrations.news_api import fetch_market_opportunities, is_news_api_configured
from app.services.auth_service import (
    authenticate_user,
    get_user_by_session_token,
    register_user,
)
from app.services.mission_service import load_isolated_demo_scenario


def initialize_backend() -> None:
    run_migrations()
    seed_suppliers_catalog()


def dispatch_request(
    method: str,
    path: str,
    headers: Dict[str, str],
    body: Optional[Dict[str, Any]] = None,
) -> Tuple[int, Dict[str, Any]]:
    """
    Pure Python request dispatcher used by both the HTTP server and direct test suites.
    """
    parsed_url = urlparse(path)
    raw_route = parsed_url.path.rstrip("/") or "/"
    # Support both /api/* and unprefixed /auth/*, /missions/*, etc.
    if raw_route in ("/health", "/api/health"):
        route = "/health"
    elif raw_route.startswith("/api/"):
        route = raw_route
    else:
        route = f"/api{raw_route}" if raw_route != "/" else "/"

    query = parse_qs(parsed_url.query)
    payload = body or {}

    auth_header = headers.get("Authorization") or headers.get("authorization")
    webhook_secret = headers.get("X-N8N-Webhook-Secret") or headers.get("x-n8n-webhook-secret")

    # 1. Health check (Public)
    if method == "GET" and route == "/health":
        return 200, {
            "status": "ok",
            "service": "vendra-backend",
            "integrations": {
                "gemini": "CONFIGURED" if is_gemini_configured() else "OPTIONAL_NOT_CONFIGURED",
                "n8n": "CONFIGURED" if is_n8n_configured() else "OPTIONAL_NOT_CONFIGURED",
                "render_workflows": "IMPLEMENTED",
                "elevenlabs": "CONFIGURED" if is_elevenlabs_configured() else "OPTIONAL_NOT_CONFIGURED",
                "news_api": "CONFIGURED" if is_news_api_configured() else "OPTIONAL_NOT_CONFIGURED",
                "dodo_payments": get_settlement_status()["status"],
                "breeth": get_breeth_status()["status"],
            },
        }

    # 2. Public Authentication routes (Must NOT require Authorization header)
    if method == "POST" and route in ("/api/auth/signup", "/api/auth/register"):
        return handle_signup(payload)
    if method == "POST" and route == "/api/auth/login":
        return handle_login(payload)
    if method == "POST" and route == "/api/auth/logout":
        return handle_logout(auth_header)

    # Protected current-user session endpoint
    if method == "GET" and route == "/api/auth/me":
        return handle_me(auth_header)

    # 3. Isolated Demo Mode Loader (Explicit Demo Mode only)
    if method == "POST" and route == "/api/demo/load":
        current_user = get_user_by_session_token(auth_header)
        token = (auth_header or "").replace("Bearer ", "").strip()
        if not current_user or not current_user.get("is_demo_user"):
            demo_email = "demo.founder@vendra.in"
            demo_pass = "VendraDemo#2026"
            with get_db() as conn:
                existing_demo = fetch_one(
                    conn, "SELECT id FROM users WHERE email = ?", (demo_email,)
                )
            if existing_demo:
                current_user, token = authenticate_user(demo_email, demo_pass)
            else:
                current_user, token = register_user(
                    full_name="Demo Founder (Bengaluru)",
                    email=demo_email,
                    password=demo_pass,
                    phone="+91 98450 00000",
                    city="Bengaluru",
                    state="Karnataka",
                    company_name="Vendra Demo Sandbox",
                    is_demo_user=True,
                )
        demo_mission = load_isolated_demo_scenario(current_user["id"])
        return 200, {
            "user": current_user,
            "token": token,
            "mission": demo_mission,
            "is_demo": True,
        }

    # 4. Webhooks (Authenticate via session OR N8N_WEBHOOK_SECRET)
    current_user = get_user_by_session_token(auth_header)
    if method == "POST" and route == "/api/webhooks/supplier-response":
        return handle_webhook_supplier_response(current_user, webhook_secret, payload)
    if method == "POST" and route == "/api/webhooks/external-event":
        return handle_webhook_external_event(current_user, webhook_secret, payload)
    if method == "POST" and route == "/api/webhooks/approval":
        return handle_webhook_approval(current_user, webhook_secret, payload)

    # 5. All subsequent routes are Protected and require Authorization: Bearer <user_token>
    if not current_user:
        msg = "Please sign in to continue."
        return 401, {"error": msg, "detail": msg}

    # Profile routes
    if method == "GET" and route == "/api/profile":
        return handle_get_profile(current_user)
    if method == "PUT" and route == "/api/profile":
        return handle_put_profile(current_user, payload)

    # Missions collection routes
    if method == "GET" and route == "/api/missions":
        return handle_list_missions(current_user)
    if method == "POST" and route == "/api/missions":
        return handle_create_mission(current_user, payload)
    if method == "POST" and route == "/api/missions/analyze-product":
        return handle_analyze_product(current_user, payload)

    # Mission item routes
    m_detail = re.match(r"^/api/missions/([^/]+)$", route)
    if m_detail:
        mid = m_detail.group(1)
        if method == "GET":
            return handle_get_mission(current_user, mid)
        if method == "PUT":
            return handle_update_mission(current_user, mid, payload)

    m_action = re.match(r"^/api/missions/([^/]+)/([^/]+)$", route)
    if m_action:
        mid, sub = m_action.group(1), m_action.group(2)
        if method == "POST" and sub == "launch":
            return handle_launch_mission(current_user, mid)
        if method == "POST" and sub == "cancel":
            return handle_cancel_mission(current_user, mid)
        if method == "POST" and sub == "analyze-requirements":
            return handle_analyze_mission_requirements(current_user, mid)
        if method == "PUT" and sub == "requirements":
            return handle_update_mission_requirements(current_user, mid, payload)
        if method == "POST" and sub == "discover-suppliers":
            return handle_discover_suppliers(current_user, mid)
        if method == "POST" and sub == "generate-rfqs":
            return handle_generate_rfqs(current_user, mid, payload)
        if method == "POST" and sub == "process-response":
            return handle_process_response(current_user, mid, payload)
        if method == "POST" and sub == "simulate-delay":
            return handle_simulate_delay(current_user, mid, payload)
        if method == "POST" and sub == "ask":
            return handle_ask_vendra(current_user, mid, payload)
        if method == "POST" and sub == "voice-command":
            return handle_voice_command(current_user, mid, payload)
        if method == "GET" and sub == "rfqs":
            return handle_list_rfqs(current_user, mission_id=mid)
        if method == "POST" and sub == "rfqs":
            return handle_create_rfq(current_user, mid, payload)
        if method == "GET" and sub == "risks":
            return handle_list_risks(current_user, mission_id=mid)
        if method == "GET" and sub == "audit":
            return handle_list_audit_events(current_user, mission_id=mid)

    # Suppliers routes
    if method == "GET" and route == "/api/suppliers":
        inc_demo_param = query.get("include_demo", ["true"])[0].lower()
        include_demo = inc_demo_param not in ("false", "0", "no")
        return handle_list_suppliers(include_demo=include_demo)
    if method == "GET" and route == "/api/suppliers/activities":
        mid_filter = query.get("mission_id", [None])[0]
        return handle_list_sourcing_activities(current_user, mission_id=mid_filter)
    if method == "POST" and route == "/api/suppliers/discover":
        return handle_live_supplier_search(current_user, payload)
    m_sup = re.match(r"^/api/suppliers/([^/]+)$", route)
    if method == "GET" and m_sup:
        return handle_get_supplier(m_sup.group(1))

    # Vendra AI Chatbot routes
    if method == "POST" and route == "/api/chat":
        return handle_chat_message(current_user, payload)
    if method == "GET" and route == "/api/chat/history":
        mid_filter = query.get("mission_id", [None])[0]
        return handle_get_chat_history(current_user, mission_id=mid_filter)

    # RFQs routes
    if method == "GET" and route == "/api/rfqs":
        mid_filter = query.get("mission_id", [None])[0]
        return handle_list_rfqs(current_user, mission_id=mid_filter)
    m_rfq_item = re.match(r"^/api/rfqs/([^/]+)$", route)
    if method == "PUT" and m_rfq_item:
        return handle_update_rfq(current_user, m_rfq_item.group(1), payload)
    m_rfq_send = re.match(r"^/api/rfqs/([^/]+)/send$", route)
    if method == "POST" and m_rfq_send:
        return handle_send_rfq(current_user, m_rfq_send.group(1))

    # Approvals routes
    if method == "GET" and route == "/api/approvals":
        mid_filter = query.get("mission_id", [None])[0]
        return handle_list_approvals(current_user, mission_id=mid_filter)
    m_apr_action = re.match(r"^/api/approvals/([^/]+)/(approve|reject)$", route)
    if method == "POST" and m_apr_action:
        aid, act = m_apr_action.group(1), m_apr_action.group(2)
        if act == "approve":
            return handle_approve(current_user, aid, payload)
        return handle_reject(current_user, aid, payload)

    # Global user Risks & Audit routes
    if method == "GET" and route == "/api/risks":
        mid_filter = query.get("mission_id", [None])[0]
        return handle_list_risks(current_user, mission_id=mid_filter)
    if method == "GET" and route == "/api/audit":
        mid_filter = query.get("mission_id", [None])[0]
        return handle_list_audit_events(current_user, mission_id=mid_filter)

    # Opportunity Radar route
    if method == "GET" and route == "/api/opportunities":
        q_str = query.get("q", ["India startup funding D2C manufacturing consumer brand"])[0]
        try:
            refresh_idx = int(query.get("refresh", ["0"])[0])
        except Exception:
            refresh_idx = 0
        raw_exclude = query.get("exclude", [""])[0]
        exclude_ids = [x.strip() for x in raw_exclude.split(",") if x.strip()]
        return 200, fetch_market_opportunities(
            query=q_str, refresh_index=refresh_idx, exclude_ids=exclude_ids
        )

    return 404, {"error": f"Route {method} {route} not found."}


class VendraRequestHandler(BaseHTTPRequestHandler):
    def log_message(self, format: str, *args: Any) -> None:
        pass

    def _send_cors_headers(self) -> None:
        origin = self.headers.get("Origin") or "http://localhost:3000"
        self.send_header("Access-Control-Allow-Origin", origin)
        self.send_header("Vary", "Origin")
        self.send_header("Access-Control-Allow-Credentials", "true")
        self.send_header(
            "Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS"
        )
        self.send_header(
            "Access-Control-Allow-Headers",
            "Content-Type, Authorization, X-N8N-Webhook-Secret",
        )

    def _handle_all(self, method: str) -> None:
        if method == "OPTIONS":
            self.send_response(204)
            self._send_cors_headers()
            self.end_headers()
            return

        content_len = int(self.headers.get("Content-Length", "0") or "0")
        body: Dict[str, Any] = {}
        if content_len > 0:
            raw_bytes = self.rfile.read(content_len)
            try:
                body = json.loads(raw_bytes.decode("utf-8"))
            except Exception:
                body = {}

        headers_dict = {k: v for k, v in self.headers.items()}
        try:
            status_code, response_data = dispatch_request(
                method=method,
                path=self.path,
                headers=headers_dict,
                body=body,
            )
        except Exception as exc:
            logger.error(f"Unhandled error in {method} {self.path}: {exc}")
            status_code = 500
            response_data = {"error": str(exc)}

        resp_bytes = json.dumps(response_data).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(resp_bytes)))
        self._send_cors_headers()
        self.end_headers()
        self.wfile.write(resp_bytes)

    def do_GET(self) -> None:
        self._handle_all("GET")

    def do_POST(self) -> None:
        self._handle_all("POST")

    def do_PUT(self) -> None:
        self._handle_all("PUT")

    def do_DELETE(self) -> None:
        self._handle_all("DELETE")

    def do_OPTIONS(self) -> None:
        self._handle_all("OPTIONS")


class ReusableThreadingHTTPServer(ThreadingHTTPServer):
    allow_reuse_address = True


def is_port_in_use(host: str, port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.5)
        return s.connect_ex((host, port)) == 0


def is_vendra_backend_running(host: str, port: int) -> bool:
    try:
        req = urllib.request.Request(f"http://{host}:{port}/health", method="GET")
        with urllib.request.urlopen(req, timeout=0.8) as resp:
            if resp.status != 200:
                return False
            data = json.loads(resp.read().decode("utf-8"))
            return (
                data.get("status") == "ok"
                and data.get("service") == "vendra-backend"
            )
    except Exception:
        return False


def run_server() -> None:
    """
    Starts the single development backend process.
    Verifies whether the configured port is genuinely running vendra-backend vs
    occupied by a container system service (such as control-plane-agent on port 8000),
    falling back to port 8001 when port 8000 is occupied by another service.
    """
    initialize_backend()
    host = "127.0.0.1"
    port = settings.BACKEND_PORT

    if is_vendra_backend_running(host, port):
        logger.info(
            f"vendra-backend already running on {host}:{port}; reusing existing process without duplicate spawn."
        )
        return

    if is_port_in_use(host, port):
        logger.warning(
            f"Port {port} is occupied by a non-Vendra service (e.g. control-plane-agent); switching vendra-backend to port 8001."
        )
        port = 8001
        if is_vendra_backend_running(host, port):
            logger.info(
                f"vendra-backend already running on {host}:{port}; reusing existing process."
            )
            return

    server = ReusableThreadingHTTPServer((host, port), VendraRequestHandler)

    def _graceful_shutdown(signum: int, _frame: Any) -> None:
        logger.info(f"Received signal {signum}; shutting down vendra-backend cleanly.")
        server.shutdown()
        server.server_close()
        sys.exit(0)

    signal.signal(signal.SIGINT, _graceful_shutdown)
    signal.signal(signal.SIGTERM, _graceful_shutdown)

    logger.info(f"vendra-backend listening on http://{host}:{port}")
    try:
        server.serve_forever()
    finally:
        server.server_close()


if __name__ == "__main__":
    run_server()
