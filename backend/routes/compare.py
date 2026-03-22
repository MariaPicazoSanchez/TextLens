import json
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, field_validator
from services.llm_service import compare_stream

router = APIRouter()

MIN_CHARS = 15


class CompareRequest(BaseModel):
    text1: str
    text2: str
    response_lang: str = "English"
    model: str = "fast"

    @field_validator("text1", "text2")
    @classmethod
    def validate_texts(cls, v):
        if len(v.strip()) < MIN_CHARS:
            raise ValueError(f"Each text must be at least {MIN_CHARS} characters.")
        return v


@router.post("/compare/stream")
def compare(req: CompareRequest):
    def event_stream():
        try:
            for chunk in compare_stream(req.text1, req.text2, req.response_lang, req.model):
                yield f"data: {json.dumps({'chunk': chunk})}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
