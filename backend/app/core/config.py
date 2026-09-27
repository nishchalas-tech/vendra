"""
Vendra Backend Configuration (backend/app/core/config.py)
Loads environment variables safely without requiring optional keys for startup.
"""
import os
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[2]
PROJECT_ROOT = Path(__file__).resolve().parents[3]

for _p in (str(BACKEND_ROOT), str(PROJECT_ROOT)):
    if _p not in sys.path:
        sys.path.append(_p)


def _load_dotenv_file() -> None:
    env_path = PROJECT_ROOT / ".env"
    if not env_path.exists():
        return
    try:
        for raw_line in env_path.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, val = line.split("=", 1)
            key = key.strip()
            val = val.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = val
    except Exception:
        pass


_load_dotenv_file()


def _resolve_sqlite_path(db_url: str) -> str:
    explicit = os.environ.get("VENDRA_SQLITE_PATH", "").strip()
    if explicit:
        return explicit
    if db_url.startswith("sqlite:///"):
        raw_path = db_url[len("sqlite:///") :].strip()
        if raw_path:
            p = Path(raw_path)
            if not p.is_absolute():
                p = (PROJECT_ROOT / p).resolve()
            return str(p)
    return str(PROJECT_ROOT / "vendra.db")


class Settings:
    SERVICE_NAME: str = "vendra-backend"
    BACKEND_PORT: int = int(
        os.environ.get("VENDRA_BACKEND_PORT")
        or os.environ.get("BACKEND_PORT")
        or "8001"
    )
    DATABASE_URL: str = os.environ.get(
        "DATABASE_URL",
        "sqlite:///./vendra.db",
    )
    SQLITE_PATH: str = _resolve_sqlite_path(DATABASE_URL)
    JWT_SECRET_KEY: str = (
        os.environ.get("JWT_SECRET_KEY", "").strip()
        or "vendra-server-auth-secret-key-hs256"
    )
    GEMINI_API_KEY: str = os.environ.get("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = os.environ.get("GEMINI_MODEL", "gemini-3.1-flash-lite-preview")
    INTERNAL_GEMINI_PROXY_URL: str = os.environ.get(
        "INTERNAL_GEMINI_PROXY_URL", "http://127.0.0.1:3000/internal/gemini"
    )
    NEWS_API_KEY: str = os.environ.get("NEWS_API_KEY", "")
    ELEVENLABS_API_KEY: str = os.environ.get("ELEVENLABS_API_KEY", "")
    N8N_BASE_URL: str = os.environ.get("N8N_BASE_URL", "")
    N8N_WEBHOOK_SECRET: str = os.environ.get("N8N_WEBHOOK_SECRET", "")
    RENDER_API_KEY: str = os.environ.get("RENDER_API_KEY", "")
    DODO_API_KEY: str = os.environ.get("DODO_API_KEY", "")
    BREETH_API_KEY: str = os.environ.get("BREETH_API_KEY", "")
    DEFAULT_CITY: str = "Bengaluru"
    DEFAULT_STATE: str = "Karnataka"
    DEFAULT_CURRENCY: str = "INR"


settings = Settings()
