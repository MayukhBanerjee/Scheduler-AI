# Mayukh's Contributions: AI & Backend Documentation

This document provides an in-depth mapping of the "Universal Service Booking AI" system. It explains the entire Agentic AI architecture, how FastAPI powers the backend, and exactly where artificial intelligence interfaces with the system.

---

## 1. The Core Backend Infrastructure

The backend is built using a modern, fully asynchronous **FastAPI** application operating under the `backend/` directory.

### `main.py`
This is the entry point. It sets up the ASGI application, configures CORS for the Next.js frontend, and manages the asynchronous MongoDB connection lifecycle (`@asynccontextmanager`). The primary intelligence gateway is the `POST /chat` endpoint, taking natural language questions and piping them strictly into the LangGraph Agent pipeline.

### `database.py`
Handles persistence asynchronously via Motor (async MongoDB driver). Notably, the schema relies on **denormalized multi-key indexing**. Service documents flatten their arrays inside `provider` objects, computing a root-level `search_tags` array. The backend bypasses slow LLM evaluations by directly scanning indexed semantic data with queries like `find_providers_by_tags()`.

### `models.py`
Contains the strict Pydantic models mapping data structures between the agent output and the FastAPI endpoints.

---

## 2. The Agentic AI Pipeline (`agent.py`)

The true intelligence of this project relies on a 6-node **StateGraph (LangGraph)**. Instead of one massive prompt, the system routes context through heavily isolated, specialized functions.

The Agent State (`AgentState`) carries variables like `user_message`, `intent`, `mongo_query`, `raw_providers`, `availability_map`, and `ranked_results` through the pipeline. 

### Node 1: Intent Extractor (`node_intent_extractor`)
- **AI Dependency**: HIGH  
- Takes the raw human phrase like *"I need a dentist tomorrow afternoon"* and forces an LLM (using Langchain) into generating strict, typed JSON representing the request variables (`service_type`, `date`, `time`, `provider_name`, etc.). Extracted values define the remainder of the session without needing further LLM guesses.

### Node 2: Goal Framer (`node_goal_framer`)
- **AI Dependency**: NONE (Algorithmic)  
- Reads the JSON from Node 1. If critical variables (like `service_type`) are missing, it short-circuits the graph and generates a clarification question (e.g., *"What service do you need?"*). If complete, it infers the underlying category (e.g., mapping *"teeth cleaning"* to `Dental`).

### Node 3: Search Expander (`node_search_expander`)
- **AI Dependency**: NONE (Algorithmic)  
- Generates precise MongoDB queries natively. Using the custom `extract_search_tags()` utility, it expands literal words into arrays covering complete nested matching synonyms without needing to invoke the LLM for translation.

### Node 4: DB Retriever (`node_db_retriever`)
- **AI Dependency**: NONE (Algorithmic)  
- Leverages the output of Node 3 to invoke efficient, precise asynchronous index scans against MongoDB via `database.py`. The node fetches the raw matching service providers and completely avoids mocked, hardcoded injections in production.

### Node 5: Ranking Engine (`node_ranking_engine` & `matching.py`)
- **AI Dependency**: NONE (Algorithmic)  
- Takes the retrieved MongoDB providers and ranks them. This heavily involves mapping exact `date` parameters (e.g. `2026-04-15`) requested by the user, dynamically filtering individual time slots via `filter_by_availability()`, and scoring them via `rank_results()`. It handles date overrides seamlessly over standard recurring week-days.

### Node 6: Response Generator (`node_response_generator`)
- **AI Dependency**: HIGH  
- The final node gathers the top 3-5 mathematically ranked `ranked_results` and passes them back to the LLM. The LLM translates the precise JSON match array back into a natural, warm, conversational response telling the user exactly who they can book.

---

## 3. Where is AI Actually Used?

A major triumph of this architecture is its optimization of Large Language Models to prevent slow API burn and high latency.

Instead of having the AI perform searches, evaluate criteria, or query the database directly, the AI is **isolated to the boundaries**:
1. **Understanding the Human**: (Node 1) Converting natural language unstructured strings into highly structured explicit JSON dictionaries.
2. **Speaking to the Human**: (Node 6) Reading completely computed, ranked, and structured result variables to produce a friendly conversation.

**Everything in between** (Nodes 2, 3, 4, 5) runs as traditional software code using advanced search indexing, ranking algorithms, and data parsing, leading to insanely fast retrieval speeds and perfectly deterministic output.

---

## 4. Source of Truth & Availability Sync

A significant upgrade to the backend schema is the prioritization and mapping of working hours.

### The Problem Solved
Historically, AI agents mock timestamps. In this system, the Agent only presents identical, exact slots verified inside MongoDB. 
Using `matching.py`, when Node 5 evaluates slots, it parses the requested date (like "Next Monday"), checks MongoDB, prioritizes explicit Date Overrides first, and only falls back on Recurring Monday rules if no explicit override exists. 

This enables the exact slots configured inside the React Next.js UI (in `/api/provider/profile`) to be natively understood and echoed by the LLM in real-time.
