import json
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
from services.llm_service import (
    summarize, extract_keywords, analyze_sentiment, change_tone, answer_question,
    summarize_stream, change_tone_stream, answer_question_stream, MODELS, DEFAULT_MODEL,
)

router = APIRouter()

MIN_CHARS = 15
MAX_CHARS = 3000
VALID_TYPES  = {"summary_short", "summary_long", "keywords", "sentiment", "tone", "qa"}
STREAM_TYPES = {"summary_short", "summary_long", "tone", "qa"}
VALID_TONES  = {"formal", "casual", "positive", "negative", "persuasive", "simple"}


class AnalyzeRequest(BaseModel):
    text: str
    type: str
    tone: Optional[str] = None
    question: Optional[str] = None
    response_lang: Optional[str] = "English"
    model: Optional[str] = DEFAULT_MODEL


def validate_text(text: str):
    stripped = text.strip()
    if not stripped:
        raise HTTPException(400, "The text cannot be empty.")
    if len(stripped) < MIN_CHARS:
        raise HTTPException(400, f"Text is too short ({len(stripped)} characters). Minimum is {MIN_CHARS}.")
    if len(text) > MAX_CHARS:
        raise HTTPException(400, f"Text is too long ({len(text)} characters). Maximum is {MAX_CHARS}.")


def validate_type_extras(request: AnalyzeRequest):
    if request.type == "tone":
        if not request.tone:
            raise HTTPException(400, "A tone must be selected for this operation.")
        if request.tone not in VALID_TONES:
            raise HTTPException(400, f"Invalid tone '{request.tone}'. Valid options: {', '.join(VALID_TONES)}.")
    if request.type == "qa":
        if not request.question or not request.question.strip():
            raise HTTPException(400, "A question is required for Q&A.")


# ── Standard endpoint ─────────────────────────────────────────────────────────

@router.post("/analyze")
def analyze(request: AnalyzeRequest):
    validate_text(request.text)
    if request.type not in VALID_TYPES:
        raise HTTPException(400, f"Unknown analysis type '{request.type}'.")
    validate_type_extras(request)

    lang  = request.response_lang or "English"
    model = request.model if request.model in MODELS else DEFAULT_MODEL

    if request.type == "summary_short":  return summarize(request.text, "short", lang, model)
    if request.type == "summary_long":   return summarize(request.text, "long",  lang, model)
    if request.type == "keywords":       return extract_keywords(request.text, lang, model)
    if request.type == "sentiment":      return analyze_sentiment(request.text, lang, model)
    if request.type == "tone":           return change_tone(request.text, request.tone, lang, model)
    if request.type == "qa":             return answer_question(request.text, request.question, lang, model)


# ── Streaming endpoint ────────────────────────────────────────────────────────

@router.post("/analyze/stream")
def analyze_stream(request: AnalyzeRequest):
    validate_text(request.text)
    if request.type not in STREAM_TYPES:
        raise HTTPException(400, f"Type '{request.type}' does not support streaming.")
    validate_type_extras(request)

    lang  = request.response_lang or "English"
    model = request.model if request.model in MODELS else DEFAULT_MODEL

    if request.type == "summary_short":
        chunks = summarize_stream(request.text, "short", lang, model)
    elif request.type == "summary_long":
        chunks = summarize_stream(request.text, "long", lang, model)
    elif request.type == "tone":
        chunks = change_tone_stream(request.text, request.tone, lang, model)
    elif request.type == "qa":
        chunks = answer_question_stream(request.text, request.question, lang, model)

    def sse_generator():
        try:
            for chunk in chunks:
                yield f"data: {json.dumps({'chunk': chunk})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
        finally:
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        sse_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
