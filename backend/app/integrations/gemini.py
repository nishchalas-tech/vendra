"""
Gemini AI Integration (backend/app/integrations/gemini.py)
Provides structured AI reasoning, extraction, RFQ drafting, chatbot reasoning,
and Google Search Grounding via the Google GenAI Python SDK (`from google import genai`).
Uses GEMINI_API_KEY from the backend environment only. Never exposes the key to the frontend.
Never corrupts mission state on failure (Section 67).
"""
import json
import re
from typing import Any, Dict, Optional
from app.core.config import settings
from app.core.logging import logger
from google import genai
from google.genai import types


def is_gemini_configured() -> bool:
    return bool(settings.GEMINI_API_KEY and settings.GEMINI_API_KEY != "MY_GEMINI_API_KEY")


def get_genai_client() -> Optional[genai.Client]:
    if not is_gemini_configured():
        return None
    return genai.Client(api_key=settings.GEMINI_API_KEY)


def _parse_json_safely(text: str) -> Optional[Dict[str, Any]]:
    if not text:
        return None
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    try:
        parsed = json.loads(cleaned)
        if isinstance(parsed, dict):
            return parsed
        if isinstance(parsed, list):
            return {"items": parsed}
    except Exception:
        pass
    m_obj = re.search(r"(\{[\s\S]*\})", cleaned)
    if m_obj:
        try:
            parsed = json.loads(m_obj.group(1))
            if isinstance(parsed, dict):
                return parsed
        except Exception:
            pass
    return None


def call_gemini_json(
    prompt: str,
    system_instruction: str = "",
    timeout_sec: float = 8.0,
) -> Optional[Dict[str, Any]]:
    """
    Calls Gemini via google.genai SDK for structured JSON output.
    Returns None safely if Gemini fails or is unavailable so mission workflows never corrupt.
    """
    client = get_genai_client()
    if not client:
        return None
    try:
        response = client.models.generate_content(
            model=settings.GEMINI_MODEL or "gemini-3.1-flash-lite-preview",
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                response_mime_type="application/json",
            ),
        )
        if response and response.text:
            return _parse_json_safely(response.text)
    except Exception as exc:
        logger.warning(f"Gemini structured call fallback triggered: {exc}")
    return None


def call_gemini_text(
    prompt: str,
    system_instruction: str = "",
    timeout_sec: float = 8.0,
) -> Optional[str]:
    client = get_genai_client()
    if not client:
        return None
    try:
        response = client.models.generate_content(
            model=settings.GEMINI_MODEL or "gemini-3.1-flash-lite-preview",
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
            ),
        )
        if response and response.text and isinstance(response.text, str):
            return response.text.strip()
    except Exception as exc:
        logger.warning(f"Gemini text call fallback triggered: {exc}")
    return None


def call_gemini_grounded_search(
    prompt: str,
    system_instruction: str = "",
    timeout_sec: float = 16.0,
) -> Optional[Dict[str, Any]]:
    """
    Calls Gemini via `from google import genai` and `from google.genai import types`
    with Google Search Grounding enabled (`types.Tool(google_search=types.GoogleSearch())`).
    Returns {"text": str, "grounding_chunks": list, "web_search_queries": list} or None.
    """
    client = get_genai_client()
    if not client:
        return None
    try:
        response = client.models.generate_content(
            model=settings.GEMINI_MODEL or "gemini-3.1-flash-lite-preview",
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                tools=[types.Tool(google_search=types.GoogleSearch())],
            ),
        )
        cand = response.candidates[0] if response.candidates else None
        gm = cand.grounding_metadata if cand else None
        gm_dict = gm.to_dict() if gm else {}
        return {
            "text": str(response.text or "").strip(),
            "grounding_chunks": gm_dict.get("groundingChunks") or [],
            "web_search_queries": gm_dict.get("webSearchQueries") or [],
            "model": response.model,
        }
    except Exception as exc:
        logger.warning(f"Gemini grounded search fallback triggered: {exc}")
    return None
