-- ============================================================
-- 001_enable_extensions.sql
-- ScheduleAI — Supabase PostgreSQL Migration
-- Author: Mayukh Banerjee
-- ============================================================
-- Run this FIRST in the Supabase SQL Editor.
-- Enables all required PostgreSQL extensions.
-- ============================================================

-- UUID generation for all primary keys
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- pgvector: stores 1536-dim OpenAI/Gemini embeddings for semantic service search
-- Enables:  SELECT * FROM services ORDER BY embedding <=> $1 LIMIT 10;
CREATE EXTENSION IF NOT EXISTS vector;

-- btree_gist: required for the tsrange EXCLUDE constraint
-- that prevents double-booking a provider slot at DB level
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- pg_trgm: enables fast ILIKE full-text search on provider names, tags, locations
CREATE EXTENSION IF NOT EXISTS pg_trgm;
