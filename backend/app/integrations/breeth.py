"""
Breeth Optional Integration (backend/app/integrations/breeth.py)
Clearly reports status without fake claims (Section 50 & 73).
"""
from typing import Any, Dict
from backend.app.core.config import settings


def is_breeth_configured() -> bool:
    return bool(settings.BREETH_API_KEY and settings.BREETH_API_KEY.strip())


def get_breeth_status() -> Dict[str, Any]:
    return {
        "integration": "Breeth",
        "configured": is_breeth_configured(),
        "status": "CONFIGURED" if is_breeth_configured() else "NOT_CONFIGURED",
    }
