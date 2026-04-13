"""
backend/models.py
Pydantic data models for the Universal Service Booking AI System
"""

from typing import Optional, List, Dict
from pydantic import BaseModel, Field
from datetime import datetime


# ─── Request / Response Models ─────────────────────────────────────────────────

class ChatRequest(BaseModel):
    message: str
    user_id: str
    user_role: str = "user"
    conversation_id: Optional[str] = None


class ServiceResult(BaseModel):
    service_id: str
    service_name: str
    category: str
    provider_id: str
    provider_name: str
    provider_email: str
    location: str
    price: float
    duration_minutes: int
    available_slots: List[str]
    rating: float
    description: str
    tags: List[str]
    date: Optional[str] = None


class ChatResponse(BaseModel):
    reply: str
    services: Optional[List[ServiceResult]] = None
    needs_clarification: bool = False
    clarification_question: Optional[str] = None
    intent: Optional[Dict] = None



# ─── Agent State ──────────────────────────────────────────────────────────────

class ExtractedIntent(BaseModel):
    service_type: Optional[str] = None        # e.g. "haircut", "dental", "massage"
    specific_service: Optional[str] = None    # exact name if mentioned
    provider_name: Optional[str] = None       # if user specifies a provider
    date: Optional[str] = None               # YYYY-MM-DD
    time: Optional[str] = None               # HH:MM or "afternoon"
    urgency: Optional[str] = None            # "urgent", "flexible", "soon"
    location: Optional[str] = None
    is_complete: bool = False
    missing_fields: List[str] = []


class GoalFrame(BaseModel):
    category: str
    filters: Dict
    priorities: List[str]
    query_description: str
