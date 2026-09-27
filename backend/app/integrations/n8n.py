"""
n8n External Orchestration Integration (backend/app/integrations/n8n.py)
Implements Section 30:
n8n is an integration/orchestration layer. FastAPI/Python remains authoritative.
n8n never overrides Policy Engine, approves payments, or becomes the mission database.
"""
import json
import urllib.request
from typing import Any, Dict
from backend.app.core.config import settings
from backend.app.core.logging import logger


def is_n8n_configured() -> bool:
    return bool(settings.N8N_BASE_URL and settings.N8N_BASE_URL.strip())


def dispatch_n8n_event(event_name: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Dispatches an outbound notification/orchestration event to n8n if N8N_BASE_URL is configured.
    If n8n is unconfigured or fails, mission state remains persisted in the database (Section 67).
    """
    if not is_n8n_configured():
        return {
            "dispatched": False,
            "status": "OPTIONAL_NOT_CONFIGURED",
            "reason": "N8N_BASE_URL not configured; webhook endpoints remain active for inbound n8n events.",
        }
    try:
        url = f"{settings.N8N_BASE_URL.rstrip('/')}/webhook/{event_name}"
        headers = {"Content-Type": "application/json"}
        if settings.N8N_WEBHOOK_SECRET:
            headers["X-N8N-Webhook-Secret"] = settings.N8N_WEBHOOK_SECRET
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers=headers,
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=5.0) as resp:
            return {"dispatched": True, "status": "DELIVERED", "http_status": resp.status}
    except Exception as exc:
        logger.warning(f"n8n outbound webhook failed safely (state remains persisted): {exc}")
        return {"dispatched": False, "status": "FAILED_SAFELY", "error": str(exc)}
