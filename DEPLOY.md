# Deploy ScheduleAI (Production)

## 1. Supabase PostgreSQL
- Create project at https://supabase.com
- Execute migrations `migrations/001` through `migrations/011` in SQL Editor
- Copy `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`

## 2. FastAPI (Render / Railway / Fly.io)
- Root: `backend/`
- Start: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- Env:
  - `GEMINI_API_KEY`
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `BACKEND_API_KEY` (strong random secret)
  - `CORS_ORIGINS=https://YOUR_VERCEL_DOMAIN`

## 3. Next.js (Vercel)
- Root: repo root
- Env:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `JWT_SECRET`
  - `BACKEND_URL=https://YOUR_FASTAPI_URL`
  - `BACKEND_API_KEY` (same as backend)
  - `NEXT_PUBLIC_BACKEND_URL`

## 4. Smoke test
Run the acceptance flows on the production URL.
