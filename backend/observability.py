"""
backend/observability.py
Production Observability, Health Telemetry, and Noise Filtering for ScheduleAI
Author: Mayukh Banerjee
"""

import time
import uuid
import logging
import os
from typing import Dict, Any, List
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

# ─── Global Telemetry Store ───────────────────────────────────────────────────

class TelemetryStore:
    def __init__(self):
        self.start_time = time.time()
        self.total_requests = 0
        self.chat_requests = 0
        self.total_errors = 0
        self.active_requests = 0
        self._latencies: List[float] = []
        self._max_samples = 200

    def record_request(self, path: str, duration_ms: float, status_code: int):
        self.total_requests += 1
        if "/chat" in path:
            self.chat_requests += 1
        if status_code >= 400:
            self.total_errors += 1
        self._latencies.append(duration_ms)
        if len(self._latencies) > self._max_samples:
            self._latencies.pop(0)

    def get_stats(self) -> Dict[str, Any]:
        uptime_seconds = int(time.time() - self.start_time)
        hours, rem = divmod(uptime_seconds, 3600)
        minutes, seconds = divmod(rem, 60)
        uptime_str = f"{hours}h {minutes}m {seconds}s" if hours else f"{minutes}m {seconds}s"

        avg_latency = round(sum(self._latencies) / len(self._latencies), 2) if self._latencies else 0.0
        sorted_lat = sorted(self._latencies)
        p95_index = int(len(sorted_lat) * 0.95)
        p95_latency = round(sorted_lat[p95_index], 2) if sorted_lat else 0.0

        error_rate = (
            round((self.total_errors / self.total_requests) * 100, 2)
            if self.total_requests > 0
            else 0.0
        )

        return {
            "uptime_seconds": uptime_seconds,
            "uptime_formatted": uptime_str,
            "total_requests": self.total_requests,
            "chat_requests": self.chat_requests,
            "total_errors": self.total_errors,
            "error_rate_pct": error_rate,
            "active_requests": max(0, self.active_requests),
            "avg_latency_ms": avg_latency,
            "p95_latency_ms": p95_latency,
        }

telemetry = TelemetryStore()

# ─── Uvicorn Health Check Noise Filter ─────────────────────────────────────────

class HealthCheckFilter(logging.Filter):
    """
    Filters out repetitive 200 OK access logs from Render / load-balancer health checks
    (e.g., GET / HTTP/1.1 200 OK or GET /health HTTP/1.1 200 OK),
    keeping actual errors and real API activity prominent and readable.
    """
    def filter(self, record: logging.LogRecord) -> bool:
        msg = record.getMessage()
        # If it's a successful 200 OK ping to / or /health, suppress it from the log
        is_health_ping = (
            ('"GET / ' in msg or '"GET /health ' in msg or '"GET /ready ' in msg)
            and (" 200 " in msg or " 200 OK" in msg)
        )
        return not is_health_ping


def apply_health_check_filter():
    """Attach filter to uvicorn.access logger."""
    uvicorn_logger = logging.getLogger("uvicorn.access")
    uvicorn_logger.addFilter(HealthCheckFilter())


# ─── Observability & Request Timing Middleware ─────────────────────────────────

logger = logging.getLogger("scheduleai.observability")
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s", "%Y-%m-%d %H:%M:%S"))
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)


class ObservabilityMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        # Extract or generate Request ID
        req_id = request.headers.get("X-Request-ID") or f"req-{uuid.uuid4().hex[:8]}"
        request.state.request_id = req_id

        telemetry.active_requests += 1
        start_time = time.perf_counter()
        client_ip = request.client.host if request.client else "unknown"

        try:
            response = await call_next(request)
            duration_ms = (time.perf_counter() - start_time) * 1000.0

            # Record metrics
            telemetry.record_request(request.url.path, duration_ms, response.status_code)

            # Set tracking headers on response
            response.headers["X-Request-ID"] = req_id
            response.headers["X-Response-Time"] = f"{duration_ms:.2f}ms"

            # Suppress logging for routine 200 OK health pings
            is_routine_ping = request.url.path in ("/", "/health", "/ready") and response.status_code == 200

            if not is_routine_ping:
                status_emoji = "✅" if response.status_code < 400 else ("⚠️" if response.status_code < 500 else "❌")
                log_msg = (
                    f"{status_emoji} [{req_id}] {request.method} {request.url.path} "
                    f"-> {response.status_code} ({duration_ms:.1f}ms) | ip={client_ip}"
                )
                if response.status_code < 400:
                    logger.info(log_msg)
                elif response.status_code < 500:
                    logger.warning(log_msg)
                else:
                    logger.error(log_msg)

            return response
        except Exception as exc:
            duration_ms = (time.perf_counter() - start_time) * 1000.0
            telemetry.record_request(request.url.path, duration_ms, 500)
            logger.error(
                f"💥 [{req_id}] {request.method} {request.url.path} FAILED after {duration_ms:.1f}ms: {exc}",
                exc_info=True,
            )
            raise
        finally:
            telemetry.active_requests -= 1


# ─── Live Health & Diagnostics Helper ──────────────────────────────────────────

async def get_system_health(check_db: bool = True) -> Dict[str, Any]:
    """Inspect system health, DB ping latency, and LLM configuration."""
    db_status = {"status": "unverified", "latency_ms": None}
    if check_db:
        try:
            from database import get_supabase
            t0 = time.perf_counter()
            sb = get_supabase()
            sb.from_("services").select("id").limit(1).execute()
            db_status = {
                "status": "connected",
                "latency_ms": round((time.perf_counter() - t0) * 1000, 2),
            }
        except Exception as e:
            db_status = {"status": "error", "error": str(e)}

    bedrock_key = os.getenv("BEDROCK_API_KEY") or os.getenv("AWS_BEARER_TOKEN_BEDROCK")
    llm_provider = os.getenv("LLM_PROVIDER") or ("bedrock" if bedrock_key else "gemini")
    llm_model = (
        os.getenv("BEDROCK_MODEL_ID", "google.gemma-3-12b-it")
        if llm_provider == "bedrock"
        else os.getenv("GEMINI_MODEL", "gemini-3.6-flash")
    )

    stats = telemetry.get_stats()

    return {
        "status": "healthy" if db_status.get("status") != "error" else "degraded",
        "service": "ScheduleAI Universal Booking API",
        "version": "2.3.0",
        "environment": os.getenv("RENDER_SERVICE_NAME", "local-dev"),
        "database": db_status,
        "llm": {
            "provider": llm_provider,
            "model": llm_model,
            "region": os.getenv("AWS_REGION", "ap-south-1") if llm_provider == "bedrock" else "global",
        },
        "telemetry": stats,
    }
