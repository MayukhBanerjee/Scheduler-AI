"""
backend/agent.py
6-Node LangGraph Agent Workflow for Universal Service Booking (Supabase-powered)
─────────────────────────────────────────────────────────────
Node 1: Intent Extractor (with conversation history merge)
Node 2: Goal Framer
Node 3: DB Query Builder
Node 4: DB Retriever
Node 5: Ranking Engine
Node 6: Response Generator
"""

import os
import sys
import json
import re
from typing import TypedDict, Optional, List, Dict, Any
from dotenv import load_dotenv

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from langchain_core.messages import SystemMessage, HumanMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.graph import StateGraph, END

from matching import (
    infer_category,
    extract_search_tags,
    filter_by_availability,
    rank_results,
    resolve_iso_date,
)
from models import ExtractedIntent

load_dotenv()

def _extract_text(content: Any) -> str:
    """Extract plain text from string or structured content list."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for item in content:
            if isinstance(item, str):
                parts.append(item)
            elif isinstance(item, dict) and "text" in item:
                parts.append(item["text"])
            elif hasattr(item, "text"):
                parts.append(item.text)
        return "".join(parts)
    return str(content)


def invoke_bedrock(messages: list) -> str:
    """Invoke Amazon Bedrock Mantle / Studio API using OpenAI-compatible schema."""
    api_key = os.getenv("BEDROCK_API_KEY") or os.getenv("AWS_BEARER_TOKEN_BEDROCK")
    if not api_key:
        raise ValueError("BEDROCK_API_KEY not found in environment.")

    region = os.getenv("AWS_REGION", "ap-south-1").strip()
    preferred = os.getenv("BEDROCK_MODEL_ID", "google.gemma-3-12b-it").strip()
    candidate_models = [preferred]
    for fallback_model in [
        "google.gemma-3-12b-it",
        "google.gemma-3-4b-it",
        "zai.glm-4.7-flash",
        "qwen.qwen3-32b",
    ]:
        if fallback_model not in candidate_models:
            candidate_models.append(fallback_model)

    # Format messages to OpenAI chat format
    openai_messages = []
    for msg in messages:
        content = getattr(msg, "content", "")
        if isinstance(content, list):
            content = _extract_text(content)
        role = "user"
        if isinstance(msg, SystemMessage):
            role = "system"
        elif isinstance(msg, HumanMessage):
            role = "user"
        openai_messages.append({"role": role, "content": str(content)})

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    import httpx
    endpoint = os.getenv(
        "BEDROCK_ENDPOINT",
        f"https://bedrock-mantle.{region}.api.aws/v1/chat/completions",
    ).strip()

    last_err = None
    with httpx.Client(timeout=25.0) as client:
        for model_id in candidate_models:
            try:
                payload = {
                    "model": model_id,
                    "messages": openai_messages,
                    "temperature": 0.2,
                }
                resp = client.post(endpoint, json=payload, headers=headers)
                if resp.status_code == 200:
                    data = resp.json()
                    choices = data.get("choices") or []
                    if choices and "message" in choices[0]:
                        return choices[0]["message"]["content"].strip()
                last_err = RuntimeError(f"Bedrock Mantle ({model_id}) HTTP {resp.status_code}: {resp.text}")
            except Exception as e:
                last_err = e
                continue

    raise last_err or RuntimeError("Bedrock Mantle model invocation failed.")


def invoke_gemini(messages: list) -> str:
    """Invoke Gemini model using GEMINI_API_KEY (strictly 1 LLM call per request)."""
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY not found in .env file.")

    models_to_try = []
    preferred = os.getenv("GEMINI_MODEL", "gemini-3.6-flash").strip()
    for m in [preferred, "gemini-3.6-flash"]:
        if m and m not in models_to_try:
            models_to_try.append(m)

    last_err = None
    for model_name in models_to_try:
        try:
            client = ChatGoogleGenerativeAI(model=model_name, google_api_key=api_key, temperature=0.3)
            resp = client.invoke(messages)
            return _extract_text(resp.content).strip()
        except Exception as e:
            last_err = e
            print(f"[LLM] Gemini '{model_name}' error: {e}")
            continue

    raise last_err or RuntimeError("Failed to invoke Gemini model.")


def invoke_llm(messages: list) -> str:
    """Invoke primary LLM (Bedrock or Gemini) with automatic fallback."""
    provider = os.getenv("LLM_PROVIDER", "").lower().strip()
    bedrock_key = os.getenv("BEDROCK_API_KEY") or os.getenv("AWS_BEARER_TOKEN_BEDROCK")

    # If Bedrock is explicitly requested or a Bedrock key is configured
    if provider == "bedrock" or (not provider and bedrock_key):
        try:
            return invoke_bedrock(messages)
        except Exception as e:
            print(f"[LLM] Bedrock invocation note: {e}. Falling back to Gemini...")

    return invoke_gemini(messages)


class AgentState(TypedDict):
    user_message: str
    user_id: str
    conversation_id: str
    history: List[Dict[str, str]]

    intent: Optional[Dict[str, Any]]
    goal_frame: Optional[Dict[str, Any]]
    db_query: Optional[Dict[str, Any]]
    raw_services: Optional[List[Dict]]
    raw_providers: Optional[List[Dict]]
    availability_map: Optional[Dict[str, List[str]]]
    date_map: Optional[Dict[str, str]]
    ranked_results: Optional[List[Dict]]
    response: Optional[str]
    needs_clarification: bool
    clarification_question: Optional[str]


INTENT_SYSTEM_PROMPT = """You are an expert intent extraction AI for ScheduleAI, a multi-category service booking platform.

Today's date is {today}.

CRITICAL CONVERSATION CONTEXT RULES:
1. DISTINGUISH BETWEEN SLOT REFINEMENT vs TOPIC SWITCH:
   - SLOT REFINEMENT: If the user is continuing the SAME service (e.g. Turn 1: "I need a haircut", Turn 2: "tomorrow at 3pm"), KEEP the service and add the date/time/location.
   - TOPIC SWITCH / NEW REQUEST: If the user asks for a DIFFERENT service, category, or new request (e.g. Turn 1: "dentist in Indiranagar", Turn 2: "I need a lawyer meetup too", Turn 3: "what about tuition classes?", Turn 4: "I need something to do with education"):
     -> This is a NEW booking goal!
     -> RESET the previous service!
     -> RESET the previous location to null, unless the user explicitly re-specifies the location in their latest message!

2. SERVICE EXTRACTION & SYNONYMS:
   - service_type: The general domain (e.g. "lawyer", "dentist", "tuition", "education", "haircut", "massage", "doctor", "fitness trainer", "ac service")
   - specific_service: Specific topic/procedure if mentioned (e.g. "teeth cleaning", "lawyer meetup", "trademark filing", "coding class", "python mentorship", "swedish massage", "physician checkup")
   - provider_name: Business name or person name if mentioned (e.g. "City Dental Clinic", "The Style Studio", "Vanguard Legal")
   - date: YYYY-MM-DD (resolve "today", "tomorrow", or weekday names relative to {today})
   - time: "morning", "afternoon", "evening", or specific time like "2pm", "14:00"
   - urgency: "urgent", "soon", or "flexible"
   - location: Specific neighborhood or area (ONLY if explicitly mentioned for the CURRENT service)

Return ONLY a valid JSON object matching the schema. No markdown code blocks, no explanation.
Example: {{"service_type": "lawyer", "specific_service": "lawyer meetup", "provider_name": null, "date": null, "time": null, "urgency": "flexible", "location": null}}
"""


def _format_history(history: List[Dict[str, str]]) -> str:
    if not history:
        return "(no prior turns)"
    lines = []
    for turn in history[-8:]:
        role = turn.get("role", "user")
        content = (turn.get("content") or "").strip()
        if content:
            lines.append(f"{role}: {content}")
    return "\n".join(lines) if lines else "(no prior turns)"


def _validate_intent(raw: Dict[str, Any]) -> Dict[str, Any]:
    try:
        validated = ExtractedIntent.model_validate(raw)
        data = validated.model_dump()
    except Exception:
        data = {
            "service_type": raw.get("service_type"),
            "specific_service": raw.get("specific_service"),
            "provider_name": raw.get("provider_name"),
            "date": raw.get("date"),
            "time": raw.get("time"),
            "urgency": raw.get("urgency"),
            "location": raw.get("location"),
            "is_complete": False,
            "missing_fields": [],
        }

    missing = []
    if not data.get("service_type") and not data.get("specific_service"):
        missing.append("service_type")

    if data.get("date"):
        data["date"] = resolve_iso_date(data["date"]) or data["date"]

    data["is_complete"] = len(missing) == 0
    data["missing_fields"] = missing
    return data


def node_intent_extractor(state: AgentState) -> AgentState:
    """Node 1: Extract structured intent, merging conversation history."""
    from datetime import date

    today = date.today().strftime("%Y-%m-%d")
    prompt = INTENT_SYSTEM_PROMPT.format(today=today)
    history_block = _format_history(state.get("history") or [])

    human = (
        f"Conversation history:\n{history_block}\n\n"
        f"Latest user message:\n{state['user_message']}"
    )

    messages = [
        SystemMessage(content=prompt),
        HumanMessage(content=human),
    ]

    try:
        content = invoke_llm(messages)
        content = re.sub(r"^```json\s*|\s*```$", "", content, flags=re.MULTILINE).strip()
        intent_raw = json.loads(content)
        if not isinstance(intent_raw, dict):
            intent_raw = {}
    except (json.JSONDecodeError, Exception) as e:
        print(f"[Intent Extractor] Parse error: {e}")
        intent_raw = {}

    intent = _validate_intent(intent_raw)
    return {**state, "intent": intent}


def node_goal_framer(state: AgentState) -> AgentState:
    """Node 2: Convert intent into searchable goals with category + filters."""
    intent = state.get("intent") or {}

    if not intent.get("is_complete", False):
        missing = intent.get("missing_fields", ["service type"])
        msg = (state.get("user_message") or "").strip().lower()
        is_greeting = any(g in msg for g in ["hello", "hi", "hey", "good morning", "good evening", "how are you", "what's up", "sup"])
        if is_greeting or len(msg.split()) <= 2:
            return {
                **state,
                "goal_frame": None,
                "needs_clarification": True,
                "clarification_question": "Hey! So good to hear from you! How's your day going? What's on your mind today?",
            }
        q = (
            "I'd love to help! Tell me what you're thinking — or if you're looking for a fresh haircut, relaxing massage, dental checkup, or workout, I can recommend the top-rated spots in town!"
        )
        return {
            **state,
            "goal_frame": None,
            "needs_clarification": True,
            "clarification_question": q,
        }

    category = infer_category(intent.get("service_type"), intent.get("specific_service"))

    filters = {}
    if intent.get("location"):
        filters["location"] = intent["location"]
    if intent.get("provider_name"):
        filters["provider_name"] = intent["provider_name"]

    urgency = intent.get("urgency") or "flexible"
    if urgency == "urgent":
        priorities = ["earliest_slot", "availability", "rating"]
    elif urgency == "soon":
        priorities = ["availability", "rating", "price"]
    else:
        priorities = ["rating", "availability", "price"]

    goal_frame = {
        "category": category,
        "filters": filters,
        "priorities": priorities,
        "query_description": f"{intent.get('service_type', 'service')} in {category}",
        "time_preference": intent.get("time"),
        "date_preference": intent.get("date"),
    }

    return {**state, "goal_frame": goal_frame, "needs_clarification": False, "clarification_question": None}


def node_query_builder(state: AgentState) -> AgentState:
    """Node 3: Build indexed search_tags query from the goal frame."""
    if state.get("needs_clarification"):
        return state

    goal = state.get("goal_frame") or {}
    intent = state.get("intent") or {}
    filters = goal.get("filters", {})

    tags = extract_search_tags(
        intent.get("service_type"),
        intent.get("specific_service"),
    )

    db_query: Dict[str, Any] = {
        "tags": tags,
        "category": goal.get("category"),
        "location_lower": filters["location"].lower() if filters.get("location") else None,
        "provider_name": filters.get("provider_name"),
    }

    return {**state, "db_query": db_query}


async def node_db_retriever(state: AgentState) -> AgentState:
    """Node 4: Fetch matching providers; never fall back to unavailable ones."""
    if state.get("needs_clarification"):
        return state

    from database import find_providers_by_tags

    query = state.get("db_query") or {}
    goal = state.get("goal_frame") or {}
    time_pref = goal.get("time_preference")

    providers = await find_providers_by_tags(
        tags=query.get("tags", []),
        category=query.get("category"),
        location_lower=query.get("location_lower"),
        provider_name=query.get("provider_name"),
        limit=30,
    )

    services = []
    for p in providers:
        pid = str(p.get("_id", ""))
        p_category = p.get("category", "General")
        embedded_services = p.get("services", [])

        if not embedded_services:
            continue

        for i, es in enumerate(embedded_services):
            sid = es.get("id") or f"{pid}:{i}"
            services.append({
                "_id": sid,
                "name": es.get("name", "Service"),
                "category": p_category,
                "provider_id": pid,
                "duration_minutes": es.get("duration_minutes", 60),
                "price": es.get("price", 0),
                "description": es.get("description", ""),
                "tags": es.get("tags", []),
            })

    intent = state.get("intent") or {}
    date_str = intent.get("date")
    filtered = filter_by_availability(providers, time_pref, date_str)
    availability_map = {str(p.get("_id", "")): slots for p, slots, _ in filtered}
    date_map = {str(p.get("_id", "")): p_date for p, _, p_date in filtered}
    available_providers = [p for p, _, _ in filtered]

    # Only keep services whose providers survived availability filtering
    available_ids = {str(p.get("_id", "")) for p in available_providers}
    services = [s for s in services if s["provider_id"] in available_ids]

    return {
        **state,
        "raw_services": services,
        "raw_providers": available_providers,
        "availability_map": availability_map,
        "date_map": date_map,
    }


def node_ranking_engine(state: AgentState) -> AgentState:
    """Node 5: Rank results by priorities, rating, and availability."""
    if state.get("needs_clarification"):
        return state

    services = state.get("raw_services") or []
    providers = state.get("raw_providers") or []
    intent = state.get("intent") or {}
    availability_map = state.get("availability_map") or {}
    date_map = state.get("date_map") or {}
    goal = state.get("goal_frame") or {}
    priorities = goal.get("priorities") or ["rating", "availability", "price"]

    if not services or not providers:
        return {**state, "ranked_results": []}

    ranked = rank_results(
        services,
        providers,
        intent,
        availability_map,
        priorities=priorities,
        date_map=date_map,
    )
    return {**state, "ranked_results": ranked}


RESPONSE_SYSTEM_PROMPT = """You are a friendly AI booking assistant for ScheduleAI.

The user asked: "{user_message}"
Extracted intent: {intent}
Available service results: {results}

Your task:
1. If results are provided, present them in a clear, conversational format
2. List up to 3-5 options with key info (provider name, price, available time slots)
3. Ask the user which one they'd like to book
4. Be warm and concise

If no results found, apologize and suggest trying different keywords or another day.

Do NOT use markdown headers. Light **bold** for names is fine. Keep it natural.
"""

CLARIFICATION_RESPONSE = """You are a friendly AI booking assistant.
The user said: "{user_message}"
Their message is missing key information: {missing}.
Ask a single, clear follow-up question to get what you need. Be warm and brief.
"""


def node_response_generator(state: AgentState) -> AgentState:
    """Node 6: Generate final response deterministically (0 additional LLM calls)."""
    if state.get("needs_clarification"):
        cq = state.get(
            "clarification_question",
            "Could you tell me more about what service you're looking for?",
        )
        return {**state, "response": cq}

    ranked = state.get("ranked_results") or []
    intent = state.get("intent") or {}
    service_type = intent.get("specific_service") or intent.get("service_type") or "services"
    user_loc = (intent.get("location") or "").strip()

    if ranked:
        top_provider = ranked[0]
        p_name = top_provider.get("provider_name", "verified provider")
        p_loc = top_provider.get("location", "")
        date_val = top_provider.get("date", "")
        date_str = f" for {date_val}" if date_val else ""

        # Context-aware location handling
        if user_loc and user_loc.lower() not in p_loc.lower():
            response_text = (
                f"I found top-rated {service_type} nearby in **{p_loc}** ({p_name}){date_str}! "
                f"Here are the available time slots. Tap any slot to confirm your booking instantly:"
            )
        else:
            loc_str = f" in {p_loc}" if p_loc else ""
            response_text = (
                f"I found top-rated {service_type}{loc_str}{date_str}! "
                f"Here are the available booking slots with {p_name} and other matching providers below. "
                f"Tap any slot to confirm your booking instantly:"
            )
    else:
        loc_str = f" in {user_loc}" if user_loc else ""
        response_text = (
            f"I couldn't find any available {service_type}{loc_str} matching your request right now. "
            "Could you try a different time, date, or location?"
        )

    return {**state, "response": response_text}


def should_continue_after_framing(state: AgentState) -> str:
    if state.get("needs_clarification"):
        return "generate_response"
    return "build_query"


def should_continue_after_retrieval(state: AgentState) -> str:
    results = state.get("raw_services") or []
    if not results:
        return "generate_response"
    return "ranking_engine"


workflow = StateGraph(AgentState)

workflow.add_node("intent_extractor", node_intent_extractor)
workflow.add_node("goal_framer", node_goal_framer)
workflow.add_node("build_query", node_query_builder)
workflow.add_node("db_retriever", node_db_retriever)
workflow.add_node("ranking_engine", node_ranking_engine)
workflow.add_node("generate_response", node_response_generator)

workflow.set_entry_point("intent_extractor")
workflow.add_edge("intent_extractor", "goal_framer")
workflow.add_conditional_edges(
    "goal_framer",
    should_continue_after_framing,
    {"build_query": "build_query", "generate_response": "generate_response"},
)
workflow.add_edge("build_query", "db_retriever")
workflow.add_conditional_edges(
    "db_retriever",
    should_continue_after_retrieval,
    {"ranking_engine": "ranking_engine", "generate_response": "generate_response"},
)
workflow.add_edge("ranking_engine", "generate_response")
workflow.add_edge("generate_response", END)

agent_graph = workflow.compile()
print("✅ 6-Node LangGraph agent compiled and ready.")


async def run_booking_agent(
    message: str,
    user_id: str = "anonymous",
    conversation_id: str = "default",
    history: Optional[List[Dict[str, str]]] = None,
) -> Dict[str, Any]:
    """Run the full 6-node booking agent pipeline."""
    initial_state: AgentState = {
        "user_message": message,
        "user_id": user_id,
        "conversation_id": conversation_id,
        "history": history or [],
        "intent": None,
        "goal_frame": None,
        "db_query": None,
        "raw_services": None,
        "raw_providers": None,
        "availability_map": None,
        "ranked_results": None,
        "response": None,
        "needs_clarification": False,
        "clarification_question": None,
    }

    final_state = await agent_graph.ainvoke(initial_state)

    return {
        "reply": final_state.get("response", "I'm not sure how to help with that. Could you rephrase?"),
        "services": final_state.get("ranked_results") or [],
        "needs_clarification": final_state.get("needs_clarification", False),
        "clarification_question": final_state.get("clarification_question"),
        "intent": final_state.get("intent"),
    }
