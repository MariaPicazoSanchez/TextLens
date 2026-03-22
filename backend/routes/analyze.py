from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from services.llm_service import summarize, extract_keywords, analyze_sentiment, change_tone

router = APIRouter()


class AnalyzeRequest(BaseModel):
    text: str
    type: str  # "summary_short" | "summary_long" | "keywords" | "sentiment" | "tone"
    tone: Optional[str] = None  # "formal" | "casual" | "positive" | "negative" | "persuasive" | "simple"


@router.post("/analyze")
def analyze(request: AnalyzeRequest):
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")

    t = request.type

    if t == "summary_short":
        return summarize(request.text, "short")

    elif t == "summary_long":
        return summarize(request.text, "long")

    elif t == "keywords":
        return extract_keywords(request.text)

    elif t == "sentiment":
        return analyze_sentiment(request.text)

    elif t == "tone":
        if not request.tone:
            raise HTTPException(status_code=400, detail="'tone' field is required for tone change")
        return change_tone(request.text, request.tone)

    else:
        raise HTTPException(status_code=400, detail=f"Unknown type: {t}")
