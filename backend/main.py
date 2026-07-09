import os

import sentry_sdk
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from prometheus_fastapi_instrumentator import Instrumentator

from logging_config import configure_logging
from logging_middleware import RequestLoggingMiddleware
from rate_limiter import BodySizeLimitMiddleware, RateLimiterMiddleware, SecurityHeadersMiddleware
from routes.analyze import router as analyze_router
from routes.translate import router as translate_router
from routes.upload import router as upload_router
from routes.detect import router as detect_router
from routes.compare import router as compare_router
from routes.chat import router as chat_router
from routes.health import router as health_router

configure_logging()

sentry_dsn = os.getenv("SENTRY_DSN")
if sentry_dsn:
    sentry_sdk.init(
        dsn=sentry_dsn,
        traces_sample_rate=0.1,
        environment=os.getenv("ENVIRONMENT", "development"),
        send_default_pii=False,
    )

_raw_origins = os.getenv("ALLOWED_ORIGINS", "*")
allowed_origins = (
    [o.strip() for o in _raw_origins.split(",")]
    if _raw_origins != "*"
    else ["*"]
)

app = FastAPI()

app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(BodySizeLimitMiddleware)
app.add_middleware(RateLimiterMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
# Added last so it wraps every other middleware (outermost) and logs every
# request, including ones rejected by CORS, the rate limiter or body-size limit.
app.add_middleware(RequestLoggingMiddleware)

Instrumentator().instrument(app).expose(app, endpoint="/metrics", include_in_schema=False)

@app.get("/ping")
def ping():
    return {"status": "ok"}

app.include_router(health_router)
app.include_router(analyze_router)
app.include_router(translate_router)
app.include_router(upload_router)
app.include_router(detect_router)
app.include_router(compare_router)
app.include_router(chat_router)
