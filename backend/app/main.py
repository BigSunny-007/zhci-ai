from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.api.routes import admin, alerts, analytics, auth, market, portfolio
from app.core.config import get_settings
from app.services.scheduler import recommendation_scheduler

settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    if settings.enable_scheduler:
        recommendation_scheduler.start()
    try:
        yield
    finally:
        recommendation_scheduler.shutdown()


app = FastAPI(title=settings.app_name, version=__version__, lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(auth.router, prefix=settings.api_prefix)
app.include_router(market.router, prefix=settings.api_prefix)
app.include_router(portfolio.router, prefix=settings.api_prefix)
app.include_router(analytics.router, prefix=settings.api_prefix)
app.include_router(alerts.router, prefix=settings.api_prefix)
app.include_router(admin.router, prefix=settings.api_prefix)


@app.get("/health", tags=["系统"])
async def health() -> dict[str, str]:
    return {"status": "ok", "version": __version__}
