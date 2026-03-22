from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from services.traslation_service import translate_text

router = APIRouter()

MAX_CHARS = 500
VALID_LANGS = {
    "en", "es", "fr", "de", "it", "pt", "nl", "pl",
    "ru", "zh", "ja", "ko", "ar", "tr", "sv", "uk"
}


class TranslateRequest(BaseModel):
    text: str
    to_lang: str = "es"
    from_lang: Optional[str] = "auto"


@router.post("/translate")
def translate(request: TranslateRequest):
    stripped = request.text.strip()
    if not stripped:
        raise HTTPException(status_code=400, detail="The text cannot be empty.")
    if len(request.text) > MAX_CHARS:
        raise HTTPException(
            status_code=400,
            detail=f"Text is too long ({len(request.text)} characters). Maximum is {MAX_CHARS}."
        )
    if request.to_lang not in VALID_LANGS:
        raise HTTPException(status_code=400, detail=f"Unsupported language code '{request.to_lang}'.")

    result = translate_text(stripped, to_lang=request.to_lang, from_lang=request.from_lang)

    if result.startswith("Error en la traducción:"):
        raise HTTPException(status_code=502, detail="Translation service failed. Try again in a moment.")

    return {"translation": result}
