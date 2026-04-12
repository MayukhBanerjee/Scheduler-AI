"""
backend/main.py
FastAPI backend for Universal Service Booking AI System
"""

import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from dotenv import load_dotenv

from models import ChatRequest, ChatResponse
from agent import run_booking_agent
from database import get_db, close_db

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("🚀 ScheduleAI backend starting up...")
    db = await get_db()
    print(f"✅ MongoDB connected: {db.name}")
    yield
    # Shutdown
    await close_db()
    print("👋 ScheduleAI backend shutting down.")


app = FastAPI(
    title="ScheduleAI — Universal Service Booking API",
    description="AI-powered service booking backend with LangGraph agent",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Health ───────────────────────────────────────────────────────────────────

@app.get("/", tags=["Health"])
async def health():
    return {
        "status": "ok",
        "service": "ScheduleAI Universal Booking API",
        "version": "2.0.0",
    }


# ─── Chat / Agent ─────────────────────────────────────────────────────────────

@app.post("/chat", response_model=ChatResponse, tags=["Agent"])
async def chat(request: ChatRequest):
    """
    Main chat endpoint — runs the 6-node LangGraph booking agent.
    Returns a natural language reply + structured service results list.
    """
    print(f"[/chat] user={request.user_id} | msg={request.message!r}")
    try:
        result = await run_booking_agent(
            message=request.message,
            user_id=request.user_id,
            conversation_id=request.conversation_id or f"{request.user_id}-default",
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


# ─── Services / Providers (for frontend browsing) ────────────────────────────

@app.get("/services", tags=["Services"])
async def list_services(category: str = None, limit: int = 20):
    """List all services, optionally filtered by category."""
    from database import find_services
    query = {}
    if category:
        query["category"] = {"$regex": category, "$options": "i"}
    services = await find_services(query, limit=limit)
    return {"services": services}


@app.get("/providers", tags=["Providers"])
async def list_providers(category: str = None, limit: int = 20):
    """List all service providers, optionally filtered by category."""
    from database import find_providers
    query = {}
    if category:
        query["category"] = {"$regex": category, "$options": "i"}
    providers = await find_providers(query, limit=limit)
    return {"providers": providers}