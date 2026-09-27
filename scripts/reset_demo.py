"""
Reset Demo Script (scripts/reset_demo.py)
Removes only isolated demo missions (is_demo = 1) while preserving all real user accounts and missions.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from backend.app.database.session import get_db, run_migrations


def main() -> None:
    run_migrations()
    with get_db() as conn:
        conn.execute("DELETE FROM missions WHERE is_demo = 1")
    print("Isolated demo missions cleared. Real user data preserved.")


if __name__ == "__main__":
    main()
