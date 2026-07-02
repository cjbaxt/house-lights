import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import text
from app.db import engine
from app.api.shows import router as shows_router
from app.api.venues import router as venues_router
from app.api.watchlist import router as watchlist_router
from app.api.calendar import router as calendar_router
from app.api.recommendations import router as recommendations_router
from app.api.publish import router as publish_router

app = FastAPI(title="house-lights", version="0.1.0")

_cors_origins = os.environ.get(
    "CORS_ORIGINS",
    "http://localhost:4321,http://127.0.0.1:4321,http://localhost:4322,http://localhost:4323",
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(shows_router, prefix="/api")
app.include_router(venues_router, prefix="/api")
app.include_router(watchlist_router, prefix="/api")
app.include_router(calendar_router, prefix="/api")
app.include_router(recommendations_router, prefix="/api")
app.include_router(publish_router)


@app.get("/health")
def health():
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    return {"status": "ok"}
