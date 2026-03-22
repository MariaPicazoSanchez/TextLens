from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from services.llm_service import summarize, extract_keywords, analyze_sentiment, change_tone, answer_question

router = APIRouter()

MIN_CHARS = 15
MAX_CHARS = 3000
VALID_TYPES = {"summary_short", "summary_long", "keywords", "sentiment", "tone", "qa"}
VALID_TONES = {"formal", "casual", "positive", "negative", "persuasive", "simple"}


class AnalyzeRequest(BaseModel):
    text: str
    type: str
    tone: Optional[str] = None
    question: Optional[str] = None
    response_lang: Optional[str] = "English"


def validate_text(text: str):
    stripped = text.strip()
    if not stripped:
        raise HTTPException(status_code=400, detail="The text cannot be empty.")
    if len(stripped) < MIN_CHARS:
        raise HTTPException(
            status_code=400,
            detail=f"Text is too short ({len(stripped)} characters). Minimum is {MIN_CHARS}."
        )
    if len(text) > MAX_CHARS:
        raise HTTPException(
            status_code=400,
            detail=f"Text is too long ({len(text)} characters). Maximum is {MAX_CHARS}."
        )


@router.post("/analyze")
def analyze(request: AnalyzeRequest):
    validate_text(request.text)

    if request.type not in VALID_TYPES:
        raise HTTPException(status_code=400, detail=f"Unknown analysis type '{request.type}'.")

    lang = request.response_lang or "English"

    if request.type == "tone":
        if not request.tone:
            raise HTTPException(status_code=400, detail="A tone must be selected for this operation.")
        if request.tone not in VALID_TONES:
            raise HTTPException(status_code=400, detail=f"Invalid tone '{request.tone}'. Valid options: {', '.join(VALID_TONES)}.")
        return change_tone(request.text, request.tone, lang)

    if request.type == "summary_short":
        return summarize(request.text, "short", lang)
    if request.type == "summary_long":
        return summarize(request.text, "long", lang)
    if request.type == "keywords":
        return extract_keywords(request.text, lang)
    if request.type == "sentiment":
        return analyze_sentiment(request.text, lang)

    if request.type == "qa":
        if not request.question or not request.question.strip():
            raise HTTPException(status_code=400, detail="A question is required for Q&A.")
        return answer_question(request.text, request.question, lang)
