"""
Vendra Database Session & Migration Runner (backend/app/database/session.py)
Provides thread-safe relational database connections with foreign-key enforcement
and automatic schema migration on initialization.
"""
import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Dict, Generator, List, Optional
from backend.app.core.config import settings


def get_db_path() -> str:
    explicit = os.environ.get("VENDRA_SQLITE_PATH", "").strip()
    if explicit:
        return explicit
    return settings.SQLITE_PATH


def _dict_factory(cursor: sqlite3.Cursor, row: tuple) -> Dict[str, Any]:
    return {col[0]: row[idx] for idx, col in enumerate(cursor.description)}


@contextmanager
def get_db() -> Generator[sqlite3.Connection, None, None]:
    db_path = get_db_path()
    conn = sqlite3.connect(db_path, timeout=15.0, check_same_thread=False)
    conn.row_factory = _dict_factory
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA journal_mode = WAL;")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def run_migrations() -> None:
    migration_file = (
        Path(__file__).resolve().parent / "migrations" / "001_initial_schema.sql"
    )
    sql_script = migration_file.read_text(encoding="utf-8")
    with get_db() as conn:
        conn.executescript(sql_script)
        for alter_sql in (
            "ALTER TABLE users ADD COLUMN company_name TEXT DEFAULT '';",
            "ALTER TABLE founder_profiles ADD COLUMN company_name TEXT DEFAULT '';",
            "ALTER TABLE missions ADD COLUMN requirements_json TEXT DEFAULT '[]';",
            "ALTER TABLE missions ADD COLUMN search_queries_json TEXT DEFAULT '[]';",
            "ALTER TABLE missions ADD COLUMN discovery_mode TEXT DEFAULT 'LIVE_WEB_SEARCH';",
            "ALTER TABLE suppliers ADD COLUMN website TEXT DEFAULT '';",
            "ALTER TABLE suppliers ADD COLUMN source_url TEXT DEFAULT '';",
            "ALTER TABLE suppliers ADD COLUMN source_title TEXT DEFAULT '';",
            "ALTER TABLE suppliers ADD COLUMN source_snippet TEXT DEFAULT '';",
            "ALTER TABLE suppliers ADD COLUMN discovery_source TEXT DEFAULT 'LIVE_WEB_SEARCH';",
            "ALTER TABLE suppliers ADD COLUMN verification_status TEXT DEFAULT 'PARTIAL_WEB_DATA_NEEDS_RFQ';",
            "ALTER TABLE suppliers ADD COLUMN search_query_used TEXT DEFAULT '';",
            "ALTER TABLE suppliers ADD COLUMN matched_requirement TEXT DEFAULT '';",
            "ALTER TABLE suppliers ADD COLUMN contact_info TEXT DEFAULT '';",
            "ALTER TABLE suppliers ADD COLUMN confidence_score REAL DEFAULT 0.85;",
            "ALTER TABLE suppliers ADD COLUMN moq_verified INTEGER DEFAULT 0;",
            "ALTER TABLE suppliers ADD COLUMN price_verified INTEGER DEFAULT 0;",
            "ALTER TABLE suppliers ADD COLUMN lead_time_verified INTEGER DEFAULT 0;",
            "ALTER TABLE suppliers ADD COLUMN supplier_type TEXT DEFAULT 'MANUFACTURER';",
        ):
            try:
                conn.execute(alter_sql)
            except Exception:
                pass

        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS sourcing_activities (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                mission_id TEXT DEFAULT NULL,
                requirement_name TEXT NOT NULL,
                requirement_type TEXT DEFAULT 'raw_material',
                queries_json TEXT DEFAULT '[]',
                queries_count INTEGER DEFAULT 0,
                sources_discovered INTEGER DEFAULT 0,
                suppliers_extracted INTEGER DEFAULT 0,
                status TEXT DEFAULT 'Completed',
                created_at TEXT NOT NULL
            );
            """
        )

        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS chat_messages (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                mission_id TEXT DEFAULT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                intent TEXT DEFAULT '',
                metadata_json TEXT DEFAULT '{}',
                created_at TEXT NOT NULL
            );
            """
        )
        # Ensure non-demo missions are set to LIVE_WEB_SEARCH and do not retain fallback demo links
        conn.execute(
            "UPDATE suppliers SET discovery_source = 'DEMO_CATALOG', verification_status = 'DEMO_ILLUSTRATIVE' WHERE demo_supplier = 1;"
        )
        conn.execute(
            "UPDATE missions SET discovery_mode = 'LIVE_WEB_SEARCH' WHERE is_demo = 0 AND discovery_mode = 'FALLBACK_CATALOG';"
        )
        conn.execute(
            """
            DELETE FROM mission_suppliers
            WHERE mission_id IN (SELECT id FROM missions WHERE is_demo = 0)
              AND supplier_id IN (
                  SELECT supplier_id FROM suppliers
                  WHERE demo_supplier = 1 OR discovery_source = 'FALLBACK_CATALOG'
              );
            """
        )
        conn.execute(
            """
            DELETE FROM suppliers
            WHERE demo_supplier = 0
              AND discovery_source = 'FALLBACK_CATALOG'
              AND supplier_id NOT IN (SELECT supplier_id FROM mission_suppliers)
              AND supplier_id NOT IN (SELECT supplier_id FROM rfqs)
              AND supplier_id NOT IN (SELECT supplier_id FROM supplier_responses);
            """
        )


def fetch_one(
    conn: sqlite3.Connection, query: str, params: tuple = ()
) -> Optional[Dict[str, Any]]:
    cur = conn.execute(query, params)
    return cur.fetchone()


def fetch_all(
    conn: sqlite3.Connection, query: str, params: tuple = ()
) -> List[Dict[str, Any]]:
    cur = conn.execute(query, params)
    return cur.fetchall()
