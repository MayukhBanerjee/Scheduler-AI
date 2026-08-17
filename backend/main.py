"""
backend/main.py
FastAPI backend for Universal Service Booking AI System
"""

import os
from fastapi import FastAPI, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from typing import Optional

from models import ChatRequest, ChatResponse
from agent import run_booking_agent
from database import get_db, close_db

load_dotenv()

BACKEND_API_KEY = os.getenv("BACKEND_API_KEY", "").strip()


def verify_api_key(x_api_key: Optional[str] = Header(default=None, alias="X-API-Key")):
    if not BACKEND_API_KEY:
        # Dev fallback: allow if key not configured (local only)
        print("[WARN] BACKEND_API_KEY not set — /chat is open. Set BACKEND_API_KEY for production.")
        return
    if not x_api_key or x_api_key != BACKEND_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("🚀 ScheduleAI backend starting up...")
    db = await get_db()
    print(f"✅ MongoDB connected: {db.name}")
    yield
    await close_db()
    print("👋 ScheduleAI backend shutting down.")


_cors_extra = [o.strip() for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()]
_cors_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    *_cors_extra,
]

app = FastAPI(
    title="ScheduleAI — Universal Service Booking API",
    description="AI-powered service booking backend with LangGraph agent",
    version="2.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", tags=["Health"])
async def health():
    return {
        "status": "ok",
        "service": "ScheduleAI Universal Booking API",
        "version": "2.1.0",
    }


@app.post("/chat", response_model=ChatResponse, tags=["Agent"], dependencies=[Depends(verify_api_key)])
async def chat(request: ChatRequest):
    """
    Main chat endpoint — runs the 6-node LangGraph booking agent.
    Requires X-API-Key matching BACKEND_API_KEY.
    """
    print(f"[/chat] user={request.user_id} | msg={request.message!r}")
    try:
        history = []
        if request.messages:
            history = [{"role": m.role, "content": m.content} for m in request.messages]

        result = await run_booking_agent(
            message=request.message,
            user_id=request.user_id,
            conversation_id=request.conversation_id or f"{request.user_id}-default",
            history=history,
        )
        return ChatResponse(
            reply=result["reply"],
            services=result.get("services") or [],
            needs_clarification=result.get("needs_clarification", False),
            clarification_question=result.get("clarification_question"),
            intent=result.get("intent"),
        )
    except Exception as e:
        print(f"[/chat] ERROR: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/services", tags=["Services"])
async def list_services(category: str = None, limit: int = 20):
    from database import find_services
    query = {}
    if category:
        query["category"] = {"$regex": category, "$options": "i"}
    services = await find_services(query, limit=limit)
    return {"services": services}


@app.get("/providers", tags=["Providers"])
async def list_providers(category: str = None, limit: int = 20):
    from database import find_providers
    query = {}
    if category:
        query["category"] = {"$regex": category, "$options": "i"}
    providers = await find_providers(query, limit=limit)
    return {"providers": providers}
