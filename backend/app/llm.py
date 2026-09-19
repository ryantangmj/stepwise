"""All OpenAI calls live here so the provider/model is easy to swap.

Structured outputs use the Responses API's `.parse()` helper with Pydantic
models. Every call site has a DEMO_MODE fallback (cached-by-image-hash for the
VLM, templated text for profile parsing / route explanations) so the demo
never dies on a flaky connection or a missing API key.
"""
from __future__ import annotations

import base64
import hashlib
import logging
from pathlib import Path
from typing import Literal

from openai import OpenAI
from pydantic import BaseModel, Field

from app import config
from app.schemas import HazardType, Passability

logger = logging.getLogger("stepwise.llm")

VLM_CACHE_DIR = config.DATA_DIR / "vlm_cache"
VLM_CACHE_DIR.mkdir(parents=True, exist_ok=True)

_client: OpenAI | None = None
_client_checked = False


def _get_client() -> OpenAI | None:
    global _client, _client_checked
    if not _client_checked:
        _client = OpenAI(api_key=config.OPENAI_API_KEY) if config.OPENAI_API_KEY else None
        _client_checked = True
    return _client


# ---------------------------------------------------------------------------
# Hazard photo analysis (VLM)
# ---------------------------------------------------------------------------


class HazardAnalysis(BaseModel):
    is_sidewalk_hazard_photo: bool
    hazard_type: HazardType
    severity: int = Field(ge=1, le=5)
    passability: Passability
    confidence: float = Field(ge=0.0, le=1.0)
    estimated_level_change_cm: float | None = None
    needs_better_photo: bool
    follow_up_question: str | None = None
    reason: str


HAZARD_ANALYSIS_PROMPT = """You are a sidewalk accessibility assessor helping route wheelchair, \
walker/rollator, and cane users around hazards. Look at this single photo of a path, \
sidewalk, or crossing and assess it.

Severity rubric for level changes (cracks, heaves, lips, gaps): roughly 0.6 cm (1/4 in) \
is the approximate threshold for barrier-free travel; roughly 1.3 cm (1/2 in) or more \
approximately needs a beveled edge and is a real obstacle for wheelchair casters. These \
are approximate guides, not exact cutoffs — use judgment.

Judging scale from a single photo is hard. If you cannot confidently judge the height of \
an edge, the width of a gap, or the steepness of a ramp, you MUST lower your confidence, \
set needs_better_photo to true, and give a specific follow_up_question (for example: \
"Can you take a side-on photo with your shoe next to the crack for scale?") instead of \
guessing.

Bias toward caution: if you are unsure between two passability levels for a profile, \
choose the more restrictive one.

If the photo is not a sidewalk, path, or crossing hazard at all, set \
is_sidewalk_hazard_photo to false and hazard_type to "none".

Respond with the structured fields only. reason must be one short, plain-language sentence."""


DEFAULT_VLM_FALLBACK = HazardAnalysis(
    is_sidewalk_hazard_photo=True,
    hazard_type="crack",
    severity=3,
    passability=Passability(wheelchair="difficult", walker="difficult", cane="passable"),
    confidence=0.4,
    estimated_level_change_cm=None,
    needs_better_photo=True,
    follow_up_question="Can you take a side-on photo with your shoe next to the hazard for scale?",
    reason="Demo cache fallback: couldn't reach the vision model, showing a placeholder assessment.",
)


def _image_hash(image_bytes: bytes) -> str:
    return hashlib.sha256(image_bytes).hexdigest()


def _vlm_cache_path(image_hash: str) -> Path:
    return VLM_CACHE_DIR / f"{image_hash}.json"


def _load_cached_analysis(image_hash: str) -> HazardAnalysis | None:
    path = _vlm_cache_path(image_hash)
    if not path.exists():
        return None
    try:
        return HazardAnalysis.model_validate_json(path.read_text())
    except ValueError:
        logger.warning("Corrupt VLM cache entry %s, ignoring", image_hash[:8])
        return None


def _save_cached_analysis(image_hash: str, analysis: HazardAnalysis) -> None:
    _vlm_cache_path(image_hash).write_text(analysis.model_dump_json())


def _call_vlm(image_bytes: bytes, note: str | None) -> HazardAnalysis:
    client = _get_client()
    if client is None:
        raise RuntimeError("No OPENAI_API_KEY configured")

    data_url = f"data:image/jpeg;base64,{base64.b64encode(image_bytes).decode()}"
    text = HAZARD_ANALYSIS_PROMPT
    if note:
        text += f"\n\nThe reporter added this note: {note!r}"

    response = client.responses.parse(
        model=config.VLM_MODEL,
        input=[
            {
                "role": "user",
                "content": [
                    {"type": "input_text", "text": text},
                    {"type": "input_image", "image_url": data_url},
                ],
            }
        ],
        text_format=HazardAnalysis,
        timeout=config.LLM_TIMEOUT_S if config.DEMO_MODE else None,
    )
    parsed = response.output_parsed
    if parsed is None:
        raise RuntimeError(f"VLM did not return parseable output: {getattr(response, 'output_text', None)!r}")
    return parsed


def analyze_hazard_photo(image_bytes: bytes, note: str | None = None) -> tuple[HazardAnalysis, bool]:
    """Returns (analysis, used_fallback)."""
    image_hash = _image_hash(image_bytes)

    for attempt in (1, 2):
        try:
            analysis = _call_vlm(image_bytes, note)
            _save_cached_analysis(image_hash, analysis)
            return analysis, False
        except Exception as exc:  # noqa: BLE001 - any failure triggers retry then fallback
            logger.warning("VLM call attempt %d failed: %s", attempt, exc)

    if not config.DEMO_MODE:
        raise RuntimeError("Vision model unavailable and DEMO_MODE is false")

    cached = _load_cached_analysis(image_hash)
    if cached is not None:
        logger.info("Using cached VLM response for image %s", image_hash[:8])
        return cached, True

    logger.info("No cached VLM response for image %s, using default fallback", image_hash[:8])
    return DEFAULT_VLM_FALLBACK, True


# ---------------------------------------------------------------------------
# Natural-language profile parsing
# ---------------------------------------------------------------------------


class ParsedProfile(BaseModel):
    base_profile: Literal["wheelchair", "walker", "cane"]
    max_comfortable_grade: float | None = Field(description="fraction, e.g. 0.05 for 5%")
    hard_max_grade: float | None
    max_continuous_walk_m: float | None
    avoid_uncontrolled_crossings: bool
    prefer_rest_points: bool
    notes: str
    summary: str = Field(description="One warm, plain-language sentence restating the profile for user confirmation")


PROFILE_PARSE_PROMPT = """A user described their mobility needs in their own words for a \
pedestrian routing app. Map their description onto the closest base_profile \
(wheelchair, walker, or cane) and extract any specifics they mentioned.

- max_comfortable_grade / hard_max_grade are fractions (5% = 0.05). Only set these if the \
user gave you a real reason to adjust from a typical value for their base_profile — \
otherwise leave them null and the app will use the base_profile's defaults.
- max_continuous_walk_m: distance in meters they can walk before needing to rest, if mentioned.
- avoid_uncontrolled_crossings: true if they mentioned disliking busy roads, traffic, or \
crossings without signals.
- prefer_rest_points: true if they mentioned getting tired, needing breaks, or fatigue.
- notes: a short free-text summary of anything else relevant.
- summary: one warm, plain sentence restating their profile back to them, e.g. "Using a \
rollator, comfortable up to about 200 meters before needing a rest, and preferring routes \
that avoid busy uncontrolled crossings."''"""


TEXT_FALLBACK_SUMMARY = "Using your custom profile as described (AI text parsing is unavailable right now)."


def parse_profile_text(text: str) -> tuple[ParsedProfile, bool]:
    """Returns (parsed_profile, used_fallback)."""
    client = _get_client()
    if client is not None:
        try:
            response = client.responses.parse(
                model=config.TEXT_MODEL,
                input=[
                    {
                        "role": "user",
                        "content": [{"type": "input_text", "text": f"{PROFILE_PARSE_PROMPT}\n\nUser description: {text!r}"}],
                    }
                ],
                text_format=ParsedProfile,
                timeout=config.LLM_TIMEOUT_S if config.DEMO_MODE else None,
            )
            if response.output_parsed is not None:
                return response.output_parsed, False
            logger.warning("Profile parse returned no parsed output")
        except Exception as exc:  # noqa: BLE001
            logger.warning("Profile parse call failed: %s", exc)

    if not config.DEMO_MODE:
        raise RuntimeError("Text model unavailable and DEMO_MODE is false")

    return (
        ParsedProfile(
            base_profile="cane",
            max_comfortable_grade=None,
            hard_max_grade=None,
            max_continuous_walk_m=None,
            avoid_uncontrolled_crossings=False,
            prefer_rest_points=False,
            notes=text,
            summary=TEXT_FALLBACK_SUMMARY,
        ),
        True,
    )


# ---------------------------------------------------------------------------
# Route explanation
# ---------------------------------------------------------------------------

ROUTE_EXPLANATION_PROMPT = """You write short, warm, plain-language explanations of walking \
route choices for an older adult or someone with a mobility limit. You will be given a JSON \
summary comparing a "Shortest" route and a chosen "Stepwise" route. Write 2 to 3 sentences \
explaining why the Stepwise route was chosen instead of the shortest one.

Rules:
- Always honestly state the trade-off (e.g. "This adds about 4 minutes").
- Never claim the route is guaranteed safe. If hazard data is community-reported and could \
be outdated or wrong, say so briefly.
- No technical jargon (no "grade percentage", "edge cost", etc.) — describe things like a \
helpful neighbor would ("a steep hill", "a curb without a ramp").
- If the two routes are nearly identical, say so plainly instead of inventing a difference."""


def _template_explanation(summary: dict) -> str:
    extra_m = round(summary.get("extra_distance_m", 0))
    extra_min = round(summary.get("extra_time_s", 0) / 60, 1)
    hazards_avoided = summary.get("hazards_avoided", 0)
    parts = [f"This route is about {extra_m}m longer (roughly {extra_min} extra minutes),"]
    if hazards_avoided:
        parts.append(f"but it avoids {hazards_avoided} reported hazard(s) along the shorter path.")
    else:
        parts.append("and it keeps hills and crossings closer to your comfort level.")
    parts.append("Conditions are based on community reports and estimates, so please stay alert.")
    return " ".join(parts)


def generate_route_explanation(summary: dict) -> tuple[str, bool]:
    """Returns (explanation, used_fallback). `summary` is a compact JSON-able dict
    of route differences (see routers/routes.py)."""
    client = _get_client()
    if client is not None:
        try:
            response = client.responses.create(
                model=config.TEXT_MODEL,
                input=[
                    {
                        "role": "user",
                        "content": [{"type": "input_text", "text": f"{ROUTE_EXPLANATION_PROMPT}\n\nRoute comparison JSON: {summary}"}],
                    }
                ],
                timeout=config.LLM_TIMEOUT_S if config.DEMO_MODE else None,
            )
            text = response.output_text
            if text:
                return text.strip(), False
        except Exception as exc:  # noqa: BLE001
            logger.warning("Route explanation call failed: %s", exc)

    if not config.DEMO_MODE:
        raise RuntimeError("Text model unavailable and DEMO_MODE is false")

    return _template_explanation(summary), True
