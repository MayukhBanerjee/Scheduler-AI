"""
backend/agent.py
6-Node LangGraph Agent Workflow for Universal Service Booking
─────────────────────────────────────────────────────────────
Node 1: Intent Extractor (with conversation history merge)
Node 2: Goal Framer
Node 3: MongoDB Query Builder
Node 4: DB Retriever
Node 5: Ranking Engine
Node 6: Response Generator
"""

import os
import json
import re
from typing import TypedDict, Optional, List, Dict, Any
from dotenv import load_dotenv

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

api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    raise ValueError("GEMINI_API_KEY not found in .env file.")

llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", google_api_key=api_key, temperature=0.3)


class AgentState(TypedDict):
    user_message: str
    user_id: str
    conversation_id: str
    history: List[Dict[str, str]]

    intent: Optional[Dict[str, Any]]
    goal_frame: Optional[Dict[str, Any]]
    mongo_query: Optional[Dict[str, Any]]
    raw_services: Optional[List[Dict]]
    raw_providers: Optional[List[Dict]]
    availability_map: Optional[Dict[str, List[str]]]
    ranked_results: Optional[List[Dict]]
    response: Optional[str]
    needs_clarification: bool
    clarification_question: Optional[str]


INTENT_SYSTEM_PROMPT = """You are an intent extraction AI for a service booking system.

Today's date is {today}.

Merge the conversation history with the latest user message into ONE complete intent.
If an earlier turn mentioned a service (e.g. "haircut") and the latest turn only adds date/time
(e.g. "tomorrow afternoon"), keep the service_type from history and fill in the new fields.

Extract (return null if unknown after merging history):
- service_type: type of service (e.g. "haircut", "dental checkup", "massage")
- specific_service: exact service name if very specific
- provider_name: specific business or person name if mentioned
- date: YYYY-MM-DD preferred (resolve "today"/"tomorrow"/weekday names relative to {today}), or day name
- time: "3pm", "morning", "afternoon", or HH:MM
- urgency: "urgent", "soon", or "flexible"
- location: city or area

Return ONLY a valid JSON object. No markdown, no explanation.
Example: {{"service_type": "haircut", "date": "2026-04-13", "time": "afternoon", "urgency": "flexible", "provider_name": null, "specific_service": null, "location": null}}
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
        response = llm.invoke(messages)
        content = response.content.strip()
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
        q = (
            "I'd love to help! What kind of service are you looking for? "
            "(e.g., haircut, dental checkup, massage, fitness training)"
        )
        if "date" in missing:
            q = "What service do you need, and when would you like to book it?"
        return {
            **state,
            "goal_frame": None,
            "needs_clarification": True,
            "clarification_question": q,
        }

    category = infer_category(intent.get("service_type"), intent.get("specific_service"))
    if not category:
        category = "General"

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

    mongo_query: Dict[str, Any] = {
        "tags": tags,
        "category": goal.get("category"),
        "location_lower": filters["location"].lower() if filters.get("location") else None,
        "provider_name": filters.get("provider_name"),
    }

    return {**state, "mongo_query": mongo_query}


async def node_db_retriever(state: AgentState) -> AgentState:
    """Node 4: Fetch matching providers; never fall back to unavailable ones."""
    if state.get("needs_clarification"):
        return state

    from database import find_providers_by_tags

    query = state.get("mongo_query") or {}
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
    availability_map = {str(p.get("_id", "")): slots for p, slots in filtered}
    available_providers = [p for p, _ in filtered]

    # Only keep services whose providers survived availability filtering
    available_ids = {str(p.get("_id", "")) for p in available_providers}
    services = [s for s in services if s["provider_id"] in available_ids]

    return {
        **state,
        "raw_services": services,
        "raw_providers": available_providers,
        "availability_map": availability_map,
    }


def node_ranking_engine(state: AgentState) -> AgentState:
    """Node 5: Rank results by priorities, rating, and availability."""
    if state.get("needs_clarification"):
        return state

    services = state.get("raw_services") or []
    providers = state.get("raw_providers") or []
    intent = state.get("intent") or {}
    availability_map = state.get("availability_map") or {}
    goal = state.get("goal_frame") or {}
    priorities = goal.get("priorities") or ["rating", "availability", "price"]

    if not services or not providers:
        return {**state, "ranked_results": []}

    ranked = rank_results(services, providers, intent, availability_map, priorities=priorities)
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
    """Node 6: Generate final user-friendly response."""
    if state.get("needs_clarification"):
        cq = state.get(
            "clarification_question",
            "Could you tell me more about what service you're looking for?",
        )
        messages = [
            SystemMessage(content=CLARIFICATION_RESPONSE.format(
                user_message=state["user_message"],
                missing=state.get("intent", {}).get("missing_fields", ["service type"]),
            )),
            HumanMessage(content=state["user_message"]),
        ]
        try:
            resp = llm.invoke(messages)
            return {**state, "response": resp.content.strip()}
        except Exception:
            return {**state, "response": cq}

    ranked = state.get("ranked_results") or []
    intent = state.get("intent") or {}

    messages = [
        SystemMessage(content=RESPONSE_SYSTEM_PROMPT.format(
            user_message=state["user_message"],
            intent=json.dumps(intent, indent=2),
            results=json.dumps(ranked, indent=2) if ranked else "No results found",
        )),
        HumanMessage(content="Generate the response now."),
    ]

    try:
        resp = llm.invoke(messages)
        response_text = resp.content.strip()
    except Exception as e:
        print(f"[Response Generator] LLM error: {e}")
        if ranked:
            lines = [f"I found {len(ranked)} option(s) for you:\n"]
            for i, r in enumerate(ranked[:3], 1):
                slots = ", ".join(r.get("available_slots", [])[:3]) or "Flexible"
                lines.append(
                    f"{i}. **{r['provider_name']}** — {r['service_name']} "
                    f"(₹{r['price']}, {r['duration_minutes']} min)\n"
                    f"   {r['location']} | {r['rating']}★ | {slots}"
                )
            lines.append("\nWhich would you like to book?")
            response_text = "\n".join(lines)
        else:
            response_text = (
                "I couldn't find any services matching your request. "
                "Could you try rephrasing, or let me know a different service or day?"
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
        "mongo_query": None,
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
