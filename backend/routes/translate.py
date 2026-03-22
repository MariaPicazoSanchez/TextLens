from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from services.traslation_service import translate_text

router = APIRouter()

class TranslateRequest(BaseModel):
    text: str
    to_lang: str = "es"
    from_lang: Optional[str] = "auto"

@router.post("/translate")
def translate(request: TranslateRequest):
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")
    result = translate_text(request.text, to_lang=request.to_lang, from_lang=request.from_lang)
    return {"translation": result}
