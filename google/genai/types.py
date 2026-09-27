"""
Google GenAI Types (google/genai/types.py)
Provides types.Tool, types.GoogleSearch, types.GenerateContentConfig, and grounding metadata structures
compatible with `from google.genai import types`.
"""
from typing import Any, Dict, List, Optional


class GoogleSearch:
    def __init__(self, **kwargs: Any) -> None:
        self.kwargs = kwargs

    def to_dict(self) -> Dict[str, Any]:
        return dict(self.kwargs)


class Tool:
    def __init__(
        self,
        google_search: Optional[GoogleSearch] = None,
        **kwargs: Any,
    ) -> None:
        self.google_search = google_search
        self.kwargs = kwargs

    def to_dict(self) -> Dict[str, Any]:
        d: Dict[str, Any] = {}
        if self.google_search is not None:
            d["googleSearch"] = self.google_search.to_dict()
        d.update(self.kwargs)
        return d


class GenerateContentConfig:
    def __init__(
        self,
        system_instruction: Optional[str] = None,
        response_mime_type: Optional[str] = None,
        tools: Optional[List[Any]] = None,
        temperature: Optional[float] = None,
        **kwargs: Any,
    ) -> None:
        self.system_instruction = system_instruction
        self.response_mime_type = response_mime_type
        self.tools = tools or []
        self.temperature = temperature
        self.kwargs = kwargs


class GroundingChunkWeb:
    def __init__(self, uri: str = "", title: str = "", domain: str = "") -> None:
        self.uri = uri
        self.title = title
        self.domain = domain

    def to_dict(self) -> Dict[str, str]:
        return {"uri": self.uri, "title": self.title, "domain": self.domain}


class GroundingChunk:
    def __init__(self, web: Optional[GroundingChunkWeb] = None) -> None:
        self.web = web

    def to_dict(self) -> Dict[str, Any]:
        return {"web": self.web.to_dict() if self.web else None}


class GroundingMetadata:
    def __init__(
        self,
        web_search_queries: Optional[List[str]] = None,
        grounding_chunks: Optional[List[GroundingChunk]] = None,
    ) -> None:
        self.web_search_queries = web_search_queries or []
        self.grounding_chunks = grounding_chunks or []

    def to_dict(self) -> Dict[str, Any]:
        return {
            "webSearchQueries": self.web_search_queries,
            "groundingChunks": [c.to_dict() for c in self.grounding_chunks],
        }


class Candidate:
    def __init__(
        self,
        text: str = "",
        grounding_metadata: Optional[GroundingMetadata] = None,
    ) -> None:
        self.text = text
        self.grounding_metadata = grounding_metadata or GroundingMetadata()


class GenerateContentResponse:
    def __init__(
        self,
        text: str = "",
        candidates: Optional[List[Candidate]] = None,
        model: str = "gemini-3.1-flash-lite-preview",
    ) -> None:
        self.text = text
        self.candidates = candidates or [Candidate(text=text)]
        self.model = model
