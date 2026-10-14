"""
backend/main.py
FastAPI backend for Universal Service Booking AI System (Supabase-powered)
Author: Mayukh Banerjee
"""

import os
import time
from fastapi import FastAPI, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from typing import Optional

from models import ChatRequest, ChatResponse
from agent import run_booking_agent
from database import get_supabase, find_services, find_providers
from observability import (
    apply_health_check_filter,
    ObservabilityMiddleware,
    get_system_health,
    telemetry,
    logger,
)

load_dotenv()

BACKEND_API_KEY = os.getenv("BACKEND_API_KEY", "").strip()


def verify_api_key(x_api_key: Optional[str] = Header(default=None, alias="X-API-Key")):
    if not BACKEND_API_KEY:
        # Dev fallback: allow if key not configured (local only)
        logger.warning("BACKEND_API_KEY not set — /chat is open. Set BACKEND_API_KEY for production.")
        return
    if not x_api_key or x_api_key != BACKEND_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Silence repetitive 200 OK health check logs from Render / load-balancers
    apply_health_check_filter()
    logger.info("🚀 ScheduleAI backend starting up with Observability Telemetry enabled.")
    try:
        sb = get_supabase()
        logger.info("✅ Supabase client initialized and connected.")
    except Exception as e:
        logger.warning(f"⚠️ Supabase init note: {e}")
    yield
    logger.info("👋 ScheduleAI backend shutting down.")


_cors_extra = [o.strip() for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()]
_cors_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    *_cors_extra,
]

app = FastAPI(
    title="ScheduleAI — Universal Service Booking API",
    description="AI-powered service booking backend with LangGraph agent, Bedrock Mantle, and Supabase",
    version="2.3.0",
    lifespan=lifespan,
)

# Attach Observability & Request Timing Middleware
app.add_middleware(ObservabilityMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", tags=["Health"])
async def root_ping():
    """Lightweight root healthcheck for Render liveness probes."""
    return {
        "status": "ok",
        "service": "ScheduleAI Universal Booking API",
        "version": "2.3.0",
        "uptime": telemetry.get_stats().get("uptime_formatted"),
    }


@app.get("/health", tags=["Health"])
@app.get("/ready", tags=["Health"])
async def health_diagnostics():
    """Deep observability endpoint inspecting database latency, LLM status, and request metrics."""
    return await get_system_health(check_db=True)


@app.get("/metrics", tags=["Health"])
async def telemetry_metrics():
    """Fast in-memory telemetry metrics for monitoring."""
    return telemetry.get_stats()


@app.post("/chat", response_model=ChatResponse, tags=["Agent"], dependencies=[Depends(verify_api_key)])
async def chat(request: ChatRequest):
    """
    Main chat endpoint — runs the 6-node LangGraph booking agent.
    Requires X-API-Key matching BACKEND_API_KEY.
    """
    t0 = time.perf_counter()
    logger.info(
        f"💬 [/chat] user={request.user_id} | conv={request.conversation_id} | query={request.message!r}"
    )
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

        matched_services = result.get("services") or []
        duration_ms = (time.perf_counter() - t0) * 1000.0

        logger.info(
            f"✨ [/chat SUCCESS] user={request.user_id} ({duration_ms:.1f}ms) | "
            f"matched={len(matched_services)} services | clarification={result.get('needs_clarification', False)}"
        )

        return ChatResponse(
            reply=result["reply"],
            services=matched_services,
            needs_clarification=result.get("needs_clarification", False),
            clarification_question=result.get("clarification_question"),
            intent=result.get("intent"),
        )
    except Exception as e:
        duration_ms = (time.perf_counter() - t0) * 1000.0
        logger.error(f"❌ [/chat ERROR] after {duration_ms:.1f}ms: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/services", tags=["Services"])
async def list_services(category: str = None, limit: int = 20):
    query = {}
    if category:
        query["category"] = category
    services = await find_services(query, limit=limit)
    return {"services": services}


@app.get("/providers", tags=["Providers"])
async def list_providers(category: str = None, limit: int = 20):
    query = {}
    if category:
        query["category"] = category
    providers = await find_providers(query, limit=limit)
    return {"providers": providers}