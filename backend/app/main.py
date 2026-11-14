import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import router

app = FastAPI(
    title="Pishran API",
    version="0.1.0",
    description="API foundation for Pishran feasibility platform",
)

origins = [item.strip() for item in os.getenv(
    "CORS_ORIGINS",
    "http://localhost:5173,https://nrazaniemail-ship-it.github.io"
).split(",") if item.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api/v1")

@app.get("/health")
def health():
    return {"status": "ok", "service": "pishran-api", "version": "0.1.0"}
