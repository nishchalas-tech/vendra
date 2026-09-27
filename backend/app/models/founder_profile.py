"""
FounderProfile Model (backend/app/models/founder_profile.py)
"""
from dataclasses import dataclass, asdict
from typing import Dict, Any


@dataclass
class FounderProfile:
    id: str
    user_id: str
    full_name: str
    phone: str = ""
    city: str = "Bengaluru"
    state: str = "Karnataka"
    business_experience: str = ""
    skills: str = ""
    industry_interests: str = ""
    available_capital: float = 0.0
    preferred_product_categories: str = ""
    available_time: str = ""
    preferred_sourcing_location: str = "Bengaluru, Karnataka"
    created_at: str = ""
    updated_at: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)
