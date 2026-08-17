# Deploy ScheduleAI (optional stretch)

Complete local acceptance first. Then:

## 1. MongoDB Atlas
- Confirm `MONGODB_URI` points at Atlas
- After seed (or on first booking API hit), unique index `unique_active_provider_slot` is created

## 2. FastAPI (Render / Railway)
- Root: `backend/`
- Start: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- Env:
  - `GEMINI_API_KEY`
  - `MONGODB_URI`
  - `MONGODB_DB_NAME=scheduleai`
  - `BACKEND_API_KEY` (strong random)
  - `CORS_ORIGINS=https://YOUR_VERCEL_DOMAIN`

## 3. Next.js (Vercel)
- Root: repo root
- Env:
  - `MONGODB_URI`
  - `MONGODB_DB_NAME`
  - `JWT_SECRET`
  - `BACKEND_URL=https://YOUR_FASTAPI_URL`
  - `BACKEND_API_KEY` (same as backend)
  - `NEXT_PUBLIC_BACKEND_URL` (optional, same as BACKEND_URL)

## 4. Smoke test
Run the 8 acceptance flows from README on the public URL.
