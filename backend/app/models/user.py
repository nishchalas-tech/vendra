"""
User Model (backend/app/models/user.py)
"""
from dataclasses import dataclass, asdict
from typing import Dict, Any


@dataclass
class User:
    id: str
    full_name: str
    email: str
    password_hash: str
    phone: str = ""
    city: str = "Bengaluru"
    state: str = "Karnataka"
    is_demo_user: int = 0
    created_at: str = ""
    updated_at: str = ""

    def to_public_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data.pop("password_hash", None)
        data["is_demo_user"] = bool(self.is_demo_user)
        return data
