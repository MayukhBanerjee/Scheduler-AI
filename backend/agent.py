"""
backend/agent.py
6-Node LangGraph Agent Workflow for Universal Service Booking
─────────────────────────────────────────────────────────────
Node 1: Intent Extractor
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
)

load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    raise ValueError("GEMINI_API_KEY not found in .env file.")

# ─── LLM ──────────────────────────────────────────────────────────────────────

llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", google_api_key=api_key, temperature=0.3)


# ─── Agent State ──────────────────────────────────────────────────────────────

class AgentState(TypedDict):
    # Input
    user_message: str
    user_id: str
    conversation_id: str

    # Node 1 output
    intent: Optional[Dict[str, Any]]

    # Node 2 output
    goal_frame: Optional[Dict[str, Any]]

    # Node 3 output
    mongo_query: Optional[Dict[str, Any]]

    # Node 4 output
    raw_services: Optional[List[Dict]]
    raw_providers: Optional[List[Dict]]
    availability_map: Optional[Dict[str, List[str]]]

    # Node 5 output
    ranked_results: Optional[List[Dict]]

    # Node 6 output
    response: Optional[str]
    needs_clarification: bool
    clarification_question: Optional[str]


# ─── Node 1: Intent Extractor ─────────────────────────────────────────────────

INTENT_SYSTEM_PROMPT = """You are an intent extraction AI for a service booking system.

Extract the following fields from the user's message (return null if not mentioned):
- service_type: type of service (e.g. "haircut", "dental checkup", "massage", "personal training")
- specific_service: exact service name if very specific
- provider_name: specific business or person name if mentioned
- date: date in YYYY-MM-DD format (today is {today}), or day name like "tomorrow", "monday"
- time: time preference like "3pm", "morning", "afternoon", or HH:MM
- urgency: "urgent", "soon", "flexible" (infer from tone)
- location: city or area mentioned

Return ONLY a valid JSON object. No markdown, no explanation.
Example: {{"service_type": "haircut", "date": "2026-04-13", "time": "afternoon", "urgency": "flexible", "provider_name": null, "specific_service": null, "location": null}}
"""


def node_intent_extractor(state: AgentState) -> AgentState:
    """Node 1: Extract structured intent from natural language."""
    from datetime import date
    today = date.today().strftime("%Y-%m-%d")

    prompt = INTENT_SYSTEM_PROMPT.format(today=today)
    messages = [
        SystemMessage(content=prompt),
        HumanMessage(content=state["user_message"]),
    ]

    try:
        response = llm.invoke(messages)
        content = response.content.strip()
        # Strip markdown backticks if present
        content = re.sub(r"^```json\s*|\s*```$", "", content, flags=re.MULTILINE).strip()
        intent = json.loads(content)
    except (json.JSONDecodeError, Exception) as e:
        print(f"[Intent Extractor] Parse error: {e}")
        intent = {}

    # Determine if intent is complete enough
    missing = []
    if not intent.get("service_type") and not intent.get("specific_service"):
        missing.append("service_type")

    intent["is_complete"] = len(missing) == 0
    intent["missing_fields"] = missing

    return {**state, "intent": intent}


# ─── Node 2: Goal Framer ─────────────────────────────────────────────────────

def node_goal_framer(state: AgentState) -> AgentState:
    """Node 2: Convert intent into searchable goals with category + filters."""
    intent = state.get("intent") or {}

    # Check if we need clarification first
    if not intent.get("is_complete", False):
        missing = intent.get("missing_fields", ["service type"])
        q = f"I'd love to help! What kind of service are you looking for? (e.g., haircut, dental checkup, massage, fitness training)"
        if "date" in missing:
            q = "What service do you need, and when would you like to book it?"
        return {
            **state,
            "goal_frame": None,
            "needs_clarification": True,
            "clarification_question": q,
        }

    # Infer category
    category = infer_category(intent.get("service_type"), intent.get("specific_service"))
    if not category:
        category = "General"

    # Build filters
    filters = {}
    if intent.get("location"):
        filters["location"] = intent["location"]
    if intent.get("provider_name"):
        filters["provider_name"] = intent["provider_name"]

    # Priorities
    priorities = []
    urgency = intent.get("urgency", "flexible")
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

    return {**state, "goal_frame": goal_frame, "needs_clarification": False}


# ─── Node 3: MongoDB Query Builder ───────────────────────────────────────────

def node_query_builder(state: AgentState) -> AgentState:
    """Node 3: Build an efficient indexed query from the goal frame.

    Uses extract_search_tags() to expand the user's intent into a full list
    of normalized lowercase tags, then builds { search_tags: { $in: [...] } }.
    This is fully index-covered — no $elemMatch, no regex, no collection scan.
    """
    if state.get("needs_clarification"):
        return state

    goal    = state.get("goal_frame") or {}
    intent  = state.get("intent") or {}
    filters = goal.get("filters", {})

    # Expand intent into a full tag list (pure Python, zero LLM cost)
    tags = extract_search_tags(
        intent.get("service_type"),
        intent.get("specific_service"),
    )

    mongo_query: Dict[str, Any] = {
        "tags":           tags,
        "category":       goal.get("category"),          # None if "General"
        "location_lower": filters["location"].lower() if filters.get("location") else None,
        "provider_name":  filters.get("provider_name"),
    }

    return {**state, "mongo_query": mongo_query}


# ─── Node 4: DB Retriever ────────────────────────────────────────────────────

async def node_db_retriever(state: AgentState) -> AgentState:
    """Node 4: Fetch matching providers using the indexed search_tags query.

    Uses find_providers_by_tags() which issues { search_tags: { $in: [...] } }
    — fully index-covered, no collection scan, no regex.
    Providers with no services configured are skipped (not injected as mocks).
    """
    if state.get("needs_clarification"):
        return state

    from database import find_providers_by_tags

    query     = state.get("mongo_query") or {}
    goal      = state.get("goal_frame") or {}
    time_pref = goal.get("time_preference")

    providers = await find_providers_by_tags(
        tags           = query.get("tags", []),
        category       = query.get("category"),
        location_lower = query.get("location_lower"),
        provider_name  = query.get("provider_name"),
        limit          = 30,
    )

    # Flatten embedded services into a uniform list for the ranking engine.
    # Providers with no services configured are skipped — not ready to be booked.
    services = []
    for p in providers:
        pid               = str(p.get("_id", ""))
        p_category        = p.get("category", "General")
        embedded_services = p.get("services", [])

        if not embedded_services:
            continue  # Skip providers who haven't configured services yet

        for i, es in enumerate(embedded_services):
            services.append({
                "_id":              f"embedded_{pid}_{i}",
                "name":             es.get("name", "Service"),
                "category":         p_category,
                "provider_id":      pid,
                "duration_minutes": es.get("duration_minutes", 60),
                "price":            es.get("price", 0),
                "description":      es.get("description", ""),
                "tags":             es.get("tags", []),
            })

    # Build availability map and filter by time preference
    intent = state.get("intent") or {}
    date_str = intent.get("date")
    filtered            = filter_by_availability(providers, time_pref, date_str)
    availability_map    = {str(p.get("_id", "")): slots for p, slots in filtered}
    available_providers = [p for p, _ in filtered]

    return {
        **state,
        "raw_services":     services,
        "raw_providers":    available_providers if available_providers else providers,
        "availability_map": availability_map,
    }


# ─── Node 5: Ranking Engine ──────────────────────────────────────────────────

def node_ranking_engine(state: AgentState) -> AgentState:
    """Node 5: Rank results by availability, rating, and relevance."""
    if state.get("needs_clarification"):
        return state

    services = state.get("raw_services") or []
    providers = state.get("raw_providers") or []
    intent = state.get("intent") or {}
    availability_map = state.get("availability_map") or {}

    if not services or not providers:
        return {**state, "ranked_results": []}

    ranked = rank_results(services, providers, intent, availability_map)
    return {**state, "ranked_results": ranked}


# ─── Node 6: Response Generator ──────────────────────────────────────────────

RESPONSE_SYSTEM_PROMPT = """You are a friendly AI booking assistant for ScheduleAI.

The user asked: "{user_message}"
Extracted intent: {intent}
Available service results: {results}

Your task:
1. If results are provided, present them in a clear, conversational format
2. List up to 3-5 options with key info (provider name, price, available time slots)
3. Ask the user which one they'd like to book
4. Be warm and concise

If no results found, apologize and suggest:
- Trying different keywords
- Checking back later
- Browsing other categories

Do NOT use markdown headers or bullet asterisks excessively. Keep it natural and readable.
"""

CLARIFICATION_RESPONSE = """You are a friendly AI booking assistant.
The user said: "{user_message}"
Their message is missing key information: {missing}.
Ask a single, clear follow-up question to get what you need. Be warm and brief.
"""


def node_response_generator(state: AgentState) -> AgentState:
    """Node 6: Generate final user-friendly response."""
    # Handle clarification case
    if state.get("needs_clarification"):
        cq = state.get("clarification_question", "Could you tell me more about what service you're looking for?")
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
                    f"   📍 {r['location']} | ⭐ {r['rating']} | 🕐 {slots}"
                )
            lines.append("\nWhich would you like to book?")
            response_text = "\n".join(lines)
        else:
            response_text = (
                "I couldn't find any services matching your request. "
                "Could you try rephrasing, or let me know a different service or location?"
            )

    return {**state, "response": response_text}


# ─── Build Graph ─────────────────────────────────────────────────────────────

def should_continue_after_framing(state: AgentState) -> str:
    if state.get("needs_clarification"):
        return "generate_response"
    return "build_query"


def should_continue_after_retrieval(state: AgentState) -> str:
    results = state.get("raw_services") or []
    if not results:
        return "generate_response"  # Skip ranking if no results
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


# ─── Public Interface ─────────────────────────────────────────────────────────

async def run_booking_agent(
    message: str,
    user_id: str = "anonymous",
    conversation_id: str = "default",
) -> Dict[str, Any]:
    """Run the full 6-node booking agent pipeline."""
    initial_state: AgentState = {
        "user_message": message,
        "user_id": user_id,
        "conversation_id": conversation_id,
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
        "intent": final_state.get("intent"),
    }