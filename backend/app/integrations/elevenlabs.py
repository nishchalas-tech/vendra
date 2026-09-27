"""
ElevenLabs Voice Integration (backend/app/integrations/elevenlabs.py)
Implements Section 32:
voice input -> interpretation -> structured command -> Mission Orchestrator -> Policy Engine -> action or approval -> voice response.
Gracefully reports availability when ELEVENLABS_API_KEY is not configured (Section 66).
"""
import base64
import json
import urllib.request
from typing import Any, Dict, Optional
from backend.app.core.config import settings
from backend.app.core.logging import logger


def is_elevenlabs_configured() -> bool:
    return bool(settings.ELEVENLABS_API_KEY and settings.ELEVENLABS_API_KEY.strip())


def synthesize_voice_response(text: str, voice_id: str = "21m00Tcm4TlvDq8ikWAM") -> Optional[str]:
    """
    Calls ElevenLabs TTS API if ELEVENLABS_API_KEY is configured.
    Returns base64-encoded MP3 audio or None if not configured / unreachable.
    """
    if not is_elevenlabs_configured():
        return None
    try:
        url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
        payload = json.dumps(
            {
                "text": text,
                "model_id": "eleven_monolingual_v1",
                "voice_settings": {"stability": 0.55, "similarity_boost": 0.75},
            }
        ).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=payload,
            headers={
                "Content-Type": "application/json",
                "xi-api-key": settings.ELEVENLABS_API_KEY,
                "Accept": "audio/mpeg",
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=8.0) as resp:
            audio_bytes = resp.read()
            return base64.b64encode(audio_bytes).decode("utf-8")
    except Exception as exc:
        logger.warning(f"ElevenLabs synthesis unavailable: {exc}")
        return None


def interpret_voice_command(transcript: str, mission: Dict[str, Any]) -> Dict[str, Any]:
    """
    Converts natural-language voice input into a structured command for the Mission Orchestrator.
    Never bypasses Policy, Approval, Audit, or Evidence (Section 32).
    """
    lower = transcript.lower()
    if any(k in lower for k in ["delay", "cannot deliver", "42 days", "next month", "late", "fail"]):
        return {
            "intent": "REPORT_SUPPLIER_DELAY_AND_RECOVER",
            "event_type": "DELIVERY_DELAY",
            "lead_time_days": 42,
            "location_preference": mission.get("preferred_sourcing_location", "Bengaluru"),
            "max_budget_inr": mission.get("maximum_budget", 300000),
            "requires_policy_check": True,
        }
    if any(k in lower for k in ["discover", "find supplier", "search supplier", "alternatives"]):
        return {
            "intent": "DISCOVER_SUPPLIERS",
            "location_preference": mission.get("preferred_sourcing_location", "Bengaluru"),
            "max_budget_inr": mission.get("maximum_budget", 300000),
            "requires_policy_check": True,
        }
    if any(k in lower for k in ["rfq", "quote", "request for quotation"]):
        return {
            "intent": "GENERATE_RFQ",
            "requires_policy_check": True,
        }
    return {
        "intent": "EVALUATE_MISSION_STATUS",
        "requires_policy_check": True,
    }
