from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, field_validator
from services.llm_service import detect_language

router = APIRouter()


class DetectRequest(BaseModel):
    text: str

    @field_validator("text")
    @classmethod
    def validate_text(cls, v):
        if len(v.strip()) < 10:
            raise ValueError("Text too short for language detection.")
        return v


@router.post("/detect")
def detect(req: DetectRequest):
    return detect_language(req.text)
