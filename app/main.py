from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, PlainTextResponse
from starlette.staticfiles import StaticFiles

from .db import Base, engine
from . import models  # ensure tables are registered
from .routers import tasks, events

app = FastAPI(title="Timely API")

# Create tables
Base.metadata.create_all(bind=engine)

# CORS (optional)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)

# Health
@app.get("/healthz", include_in_schema=False, response_class=PlainTextResponse)
def healthz():
    return "ok"

# Routers
app.include_router(tasks.router, prefix="/api/tasks", tags=["tasks"])
app.include_router(events.router, prefix="/api/events", tags=["events"])

# Static
STATIC_DIR = Path(__file__).resolve().parent / "static"
if not STATIC_DIR.exists():
    raise RuntimeError(f"Static dir not found: {STATIC_DIR}")

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

INDEX = STATIC_DIR / "index.html"

@app.get("/", include_in_schema=False)
def root_index():
    return FileResponse(INDEX)

# SPA fallback (serve index for non-API/static paths)
@app.get("/{path:path}", include_in_schema=False)
def spa_fallback(path: str):
    if path.startswith(("api/", "static/", "healthz")):
        raise HTTPException(status_code=404)
    return FileResponse(INDEX)
