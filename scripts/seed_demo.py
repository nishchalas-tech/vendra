"""
Seed Demo Script (scripts/seed_demo.py)
Seeds the supplier catalog and optionally creates the isolated Demo Founder & Eco-friendly reusable bottles demo mission.
Never affects real user accounts.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from backend.app.main import dispatch_request, initialize_backend


def main() -> None:
    initialize_backend()
    status, data = dispatch_request("POST", "/api/demo/load", {}, {})
    print(f"Seed demo completed with status={status}, mission_id={data.get('mission', {}).get('id')}")


if __name__ == "__main__":
    main()
