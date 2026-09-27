"""
Vendra Database Base (backend/app/database/base.py)
Provides declarative metadata and UTC timestamp helpers.
"""
from datetime import datetime, timezone
import uuid


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"
