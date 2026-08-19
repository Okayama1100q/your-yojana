# =============================================================
# vision_agent.py — AI Visual Assessment (Groq multimodal)
# Citizen photo → situation analysis → severity → Priority Agent
# =============================================================

import base64
import json
import os
import re

from dotenv import load_dotenv
from groq import Groq
from pydantic import BaseModel, ConfigDict, Field

load_dotenv()

client = Groq(api_key=os.getenv("GROQ_API_KEY"))

# Multimodal model (override via GROQ_VISION_MODEL in .env)
def _vision_model() -> str:
    return os.getenv("GROQ_VISION_MODEL", "qwen/qwen3.6-27b")

KNOWN_DETECTIONS = [
    "Pothole",
    "Road damage",
    "Standing water",
    "Garbage",
    "Blocked drain",
    "Broken streetlight",
    "Infrastructure damage",
    "Electrical hazard",
]


class VisionAssessment(BaseModel):
    model_config = ConfigDict(extra="forbid")

    detections: list[str] = Field(default_factory=list)
    situation_analysis: str = ""
    severity: str = "LOW"  # LOW | MEDIUM | HIGH | CRITICAL
    severity_score: int = 0  # 0–100 advisory
    confidence: float = 0.0  # 0–1
    recommended_category: str = "General"
    summary_for_priority: str = ""
    is_civic_issue: bool = True


def _normalize_data_url(image_input: str) -> str:
    """Accept raw base64, data URL, or http(s) image URL for Groq."""
    raw = (image_input or "").strip()
    if not raw:
        raise ValueError("Empty image payload")

    if raw.startswith("data:image/"):
        return raw

    if raw.startswith("http://") or raw.startswith("https://"):
        return raw

    # Assume jpeg if bare base64
    return f"data:image/jpeg;base64,{raw}"


def _extract_json(text: str) -> dict:
    text = (text or "").strip()
    if not text:
        raise ValueError("Empty vision model response")

    # Prefer fenced JSON if present
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if fence:
        text = fence.group(1).strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}")
        if start >= 0 and end > start:
            return json.loads(text[start : end + 1])
        raise


def assess_civic_images(
    images: list[str],
    complaint_text: str = "",
) -> VisionAssessment:
    """
    Analyse up to 3 citizen photos with a Groq vision model.
    Returns structured assessment for UI + Priority Agent enrichment.
    """
    if not images:
        raise ValueError("At least one image is required")

    images = images[:3]
    content: list[dict] = [
        {
            "type": "text",
            "text": f"""You are the Vision Agent for Your Yojana, a civic infrastructure platform.

Analyse the civic issue photo(s). Be factual — do not invent details you cannot see.

Citizen complaint text (may be empty):
{complaint_text or "(none provided)"}

Possible detections (use only if visibly present):
{", ".join(KNOWN_DETECTIONS)}

Return ONLY a JSON object with these exact keys:
{{
  "detections": ["list of detected issues from the allowed list, or empty"],
  "situation_analysis": "2-4 sentence factual description of what is visible",
  "severity": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "severity_score": 0-100,
  "confidence": 0.0-1.0,
  "recommended_category": "short civic category e.g. Roads, Sanitation, Electrical",
  "summary_for_priority": "one concise paragraph for the Priority Agent (include hazards, scale, urgency cues from the photo)",
  "is_civic_issue": true/false
}}

Severity guide:
- CRITICAL: immediate safety/health hazard (live wires, deep open pit in roadway, toxic overflow)
- HIGH: significant damage or hazard likely to cause injury or service failure soon
- MEDIUM: clear infrastructure defect needing timely repair
- LOW: minor cosmetic or low-urgency issue
""",
        }
    ]

    for img in images:
        content.append(
            {
                "type": "image_url",
                "image_url": {"url": _normalize_data_url(img)},
            }
        )

    create_kwargs = {
        "model": _vision_model(),
        "messages": [{"role": "user", "content": content}],
        "temperature": 0.1,
        "max_completion_tokens": 2048,
    }
    # Disable Qwen thinking on Groq so JSON content is returned reliably
    create_kwargs["reasoning_effort"] = "none"

    try:
        response = client.chat.completions.create(**create_kwargs)
    except Exception:
        create_kwargs.pop("reasoning_effort", None)
        response = client.chat.completions.create(**create_kwargs)

    msg = response.choices[0].message
    raw = msg.content or ""
    if not raw:
        raw = getattr(msg, "reasoning", None) or getattr(msg, "reasoning_content", None) or ""
    data = _extract_json(raw)

    # Clamp / normalise
    severity = str(data.get("severity", "LOW")).upper()
    if severity not in {"LOW", "MEDIUM", "HIGH", "CRITICAL"}:
        severity = "LOW"

    score = int(data.get("severity_score") or 0)
    score = max(0, min(100, score))

    conf = float(data.get("confidence") or 0)
    conf = max(0.0, min(1.0, conf))

    detections = data.get("detections") or []
    if not isinstance(detections, list):
        detections = []
    detections = [str(d) for d in detections][:12]

    return VisionAssessment(
        detections=detections,
        situation_analysis=str(data.get("situation_analysis") or "").strip(),
        severity=severity,
        severity_score=score,
        confidence=conf,
        recommended_category=str(
            data.get("recommended_category") or "General"
        ).strip()
        or "General",
        summary_for_priority=str(
            data.get("summary_for_priority") or ""
        ).strip(),
        is_civic_issue=bool(data.get("is_civic_issue", True)),
    )


def enrich_complaint_with_vision(
    complaint_text: str,
    vision: VisionAssessment,
) -> str:
    """Append vision findings so Understanding + Priority agents can use them."""
    parts = [complaint_text.strip()]
    parts.append("\n\n[AI Visual Assessment — advisory]")
    if vision.detections:
        parts.append("Detected: " + ", ".join(vision.detections))
    if vision.situation_analysis:
        parts.append("Situation: " + vision.situation_analysis)
    if vision.summary_for_priority:
        parts.append("Priority cues: " + vision.summary_for_priority)
    parts.append(
        f"Visual severity (advisory): {vision.severity} "
        f"({vision.severity_score}/100), confidence {vision.confidence:.2f}"
    )
    return "\n".join(parts)
