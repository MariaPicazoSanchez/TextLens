from fastapi import APIRouter

from services.llm_service import get_health_status

router = APIRouter()


@router.get("/health")
def health():
    return {"status": "ok", "groq": get_health_status()}
