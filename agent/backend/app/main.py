from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.api import api_router
from app.core.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    from app.services.llm_service import llm_service

    await llm_service.close()


app = FastAPI(
    title="Vision Assistant API",
    description="AI-powered vision analysis for SCADA/IoT systems",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "model": settings.lm_model,
        "agent_models": {
            "vision_agent": settings.vision_agent_model,
            "chat_agent": settings.chat_agent_model,
            "report_agent": settings.report_agent_model,
        },
        "lm_studio_url": settings.lm_studio_url,
        "sfds_url": settings.sfds_base_url,
    }


@app.get("/")
async def root():
    return {
        "name": "Vision Assistant",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health",
    }

