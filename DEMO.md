# ScheduleAI — Viva / Demo Script (5–7 min)

## Setup (before demo)
1. Ensure `.env.local` and `backend/.env` both set the **same** `BACKEND_API_KEY`
2. `cd backend && python seed_db.py`
3. From repo root: `.\start_servers.ps1`
4. Open http://localhost:3000

## Script
1. **Landing** — AI chat + voice input + ScheduleAI calendar (honest claims)
2. **Customer login** — `demo@scheduleai.com` / `demo1234`
3. **Multi-turn** — “haircut” → then “tomorrow afternoon” → service cards with slots
4. **Mic** (Chrome) — speak a request; transcript appears in the input
5. **Book** — pick a slot; confirmation says ScheduleAI calendar (not Google)
6. **Double-book** — try same slot again; show rejection
7. **My bookings** — cancel one; calendar refreshes
8. **Provider** — `thestylestudio@demo.com` / `demo1234` → week/day calendar, complete/cancel modal, availability overrides

## Architecture one-liner
LLM only at intent + response boundaries; Mongo `search_tags` + deterministic ranking for zero slot hallucination.
