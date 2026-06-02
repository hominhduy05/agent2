import httpx
from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.schemas.schemas import SFDSEvent, SFDSProxyResponse
from app.services.sfds_event_store import sfds_event_store
from app.services.sfds_service import sfds_service

router = APIRouter(prefix="/api/sfds", tags=["SFDS"])


@router.get("/cameras")
async def proxy_cameras():
    try:
        data = await sfds_service.aget_cameras()
        return SFDSProxyResponse(source="sfds", data=data, status_code=200)
    except httpx.ConnectError:
        raise HTTPException(503, "Cannot connect to SFDS backend (is it running on port 9000?)")
    except httpx.HTTPStatusError as e:
        raise HTTPException(e.response.status_code, e.response.text)


@router.get("/stats")
async def proxy_stats():
    try:
        data = await sfds_service.aget_stats()
        return SFDSProxyResponse(source="sfds", data=data, status_code=200)
    except httpx.ConnectError:
        raise HTTPException(503, "Cannot connect to SFDS backend")
    except httpx.HTTPStatusError as e:
        raise HTTPException(e.response.status_code, e.response.text)


@router.post("/detection")
async def proxy_detection(file: UploadFile = File(...), conf: float = Form(0.25)):
    try:
        data = await sfds_service.adetect(await file.read(), conf=conf)
        return SFDSProxyResponse(source="sfds", data=data, status_code=200)
    except httpx.ConnectError:
        raise HTTPException(503, "Cannot connect to SFDS backend")
    except httpx.HTTPStatusError as e:
        raise HTTPException(e.response.status_code, e.response.text)


@router.get("/health")
async def sfds_health():
    try:
        data = await sfds_service.aget_health()
        return {"sfds_status": "online", "status_code": 200, "data": data}
    except httpx.ConnectError:
        return {"sfds_status": "offline", "status_code": None}


@router.post("/events")
async def ingest_event(event: SFDSEvent):
    stored = sfds_event_store.add(event)
    return {"ok": True, "event": stored}


@router.get("/events")
async def list_events(limit: int = 50, event_type: str | None = None):
    return {"events": sfds_event_store.list(limit=limit, event_type=event_type)}
