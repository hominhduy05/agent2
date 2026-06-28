from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.database import init_db
from core.shared import engine_obj, model_loaded, device_name, model_format
from services.serial_scale_reader import get_serial_scale_status, start_serial_scale_reader

from routers.scada_router import router as scada_router
from routers.dataset_router import router as dataset_router

# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------
app = FastAPI(
    title="Durian Detection API",
    description="SCADA + Dataset endpoints",  
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_origin_regex=r"https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    init_db()
    start_serial_scale_reader()


@app.get("/health/")
def health_check():
    return {
        "status": "ok",
        "model_loaded": model_loaded,
        "device": getattr(engine_obj, "device", device_name),
        "model_format": model_format,
        "service": "scada",
        "serial_scale": get_serial_scale_status(),
    }


# Mount routers
app.include_router(scada_router)
app.include_router(dataset_router)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=9000, reload=False)
