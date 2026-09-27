"""
Dodo Payments Optional Integration (backend/app/integrations/dodo.py)
Implements Section 50 & Section 66:
Optional future payment/settlement event where genuinely appropriate after human approval.
Clearly labelled as OPTIONAL / NOT CONFIGURED when DODO_API_KEY is absent.
"""
from typing import Any, Dict
from backend.app.core.config import settings


def is_dodo_configured() -> bool:
    return bool(settings.DODO_API_KEY and settings.DODO_API_KEY.strip())


def get_settlement_status() -> Dict[str, Any]:
    return {
        "integration": "Dodo Payments",
        "configured": is_dodo_configured(),
        "status": "CONFIGURED" if is_dodo_configured() else "OPTIONAL_NOT_CONFIGURED",
        "note": "Settlement triggers only after explicit human approval of a Purchase Order.",
    }
