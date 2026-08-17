"""
backend/models.py
Pydantic data models for the Universal Service Booking AI System
"""

from typing import Optional, List, Dict, Literal
from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    message: str
    user_id: str
    user_role: str = "user"
    conversation_id: Optional[str] = None
    messages: Optional[List[ChatMessage]] = Field(default=None, description="Prior turns for multi-turn intent merge")


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


class ExtractedIntent(BaseModel):
    service_type: Optional[str] = None
    specific_service: Optional[str] = None
    provider_name: Optional[str] = None
    date: Optional[str] = None
    time: Optional[str] = None
    urgency: Optional[str] = None
    location: Optional[str] = None
    is_complete: bool = False
    missing_fields: List[str] = []


class GoalFrame(BaseModel):
    category: str
    filters: Dict
    priorities: List[str]
    query_description: str
