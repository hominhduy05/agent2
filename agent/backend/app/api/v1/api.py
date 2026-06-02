from fastapi import APIRouter

from app.agents import agent_router
from app.api.v1.endpoints import chat, report, sfds, vision

api_router = APIRouter()
api_router.include_router(vision.router)
api_router.include_router(report.router)
api_router.include_router(chat.router)
api_router.include_router(sfds.router)
api_router.include_router(agent_router)

