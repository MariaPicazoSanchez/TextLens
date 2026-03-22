import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes.analyze import router as analyze_router
from routes.translate import router as translate_router
from routes.upload import router as upload_router
from routes.detect import router as detect_router
from routes.compare import router as compare_router
from routes.chat import router as chat_router

app = FastAPI()

_raw_origins = os.getenv(
    "ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
)
_allowed_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(analyze_router)
app.include_router(translate_router)
app.include_router(upload_router)
app.include_router(detect_router)
app.include_router(compare_router)
app.include_router(chat_router)