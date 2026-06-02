import uuid
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from app.core.config import settings
from app.schemas.schemas import (
    ReportGenerateRequest,
    ReportGenerateResponse,
    ReportListResponse,
    ReportItem,
)
from app.services.report_service import report_service

router = APIRouter(prefix="/api/report", tags=["Report"])


@router.post("/generate", response_model=ReportGenerateResponse)
async def generate_report(req: ReportGenerateRequest):
    formats = ["pdf", "docx", "html"] if req.format == "all" else [req.format]
    rid = f"rpt_{uuid.uuid4().hex[:8]}"
    results = []
    items = []

    for fmt in formats:
        try:
            method = getattr(report_service, f"generate_{fmt}")
            path = method(
                report_id=rid,
                title=req.title,
                content=req.content,
                analysis_type=req.analysis_type,
                metadata=req.metadata or {},
            )
            results.append((fmt, rid))
            items.append(
                ReportItem(
                    report_id=rid,
                    title=req.title,
                    analysis_type=req.analysis_type,
                    format=fmt,
                    created_at=str(path.stat().st_mtime),
                    size_bytes=path.stat().st_size,
                )
            )
        except Exception as e:
            pass

    return ReportGenerateResponse(
        reports=items,
        message=f"Generated {len(items)} report(s)",
    )


@router.get("/list", response_model=ReportListResponse)
async def list_reports():
    reports_dir = Path(settings.storage_path, "reports")
    if not reports_dir.exists():
        return ReportListResponse(reports=[], total=0)

    items = []
    seen = set()
    for f in sorted(reports_dir.iterdir(), key=lambda p: p.stat().st_mtime, reverse=True):
        if f.is_file():
            name = f.stem
            import os
            parent = os.path.basename(os.path.dirname(f))
            rid = name.rsplit(".", 1)[0] if "." in name else name
            if rid in seen:
                continue
            seen.add(rid)
            items.append(
                ReportItem(
                    report_id=rid,
                    title=rid,
                    analysis_type="unknown",
                    format=f.suffix.lstrip("."),
                    created_at=str(f.stat().st_mtime),
                    size_bytes=f.stat().st_size,
                )
            )

    return ReportListResponse(reports=items, total=len(items))


@router.get("/download/{report_id}")
async def download_report(report_id: str, fmt: str = "pdf"):
    reports_dir = Path(settings.storage_path, "reports")
    path = reports_dir / f"{report_id}.{fmt}"
    if not path.exists():
        raise HTTPException(404, f"Report '{report_id}.{fmt}' not found")
    media = {
        "pdf": "application/pdf",
        "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "html": "text/html",
    }
    return FileResponse(path, media_type=media.get(fmt, "application/octet-stream"), filename=path.name)
