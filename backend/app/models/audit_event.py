"""
AuditEvent Model (backend/app/models/audit_event.py)
Implements all Audit Ledger fields from Section 29.
"""
from dataclasses import dataclass, asdict
from typing import Dict, Any, Optional


@dataclass
class AuditEvent:
    id: str
    mission_id: Optional[str]
    user_id: str
    timestamp: str
    actor: str
    event_type: str
    action: str
    reason: str
    input_reference: str = ""
    output_reference: str = ""
    policy_decision: str = "AUTO_EXECUTE"
    result: str = "SUCCESS"

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)
