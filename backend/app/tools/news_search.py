"""
News Search Tool (backend/app/tools/news_search.py)
Wraps Opportunity Radar market signal discovery for the Mission Orchestrator.
"""
from typing import Any, Dict
from backend.app.integrations.news_api import fetch_market_opportunities


def search_market_signals(query: str = "India manufacturing MSME Bengaluru") -> Dict[str, Any]:
    return fetch_market_opportunities(query=query)
