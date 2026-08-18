"""
backend/supabase_client.py
Supabase Client Initializer for FastAPI backend
"""

import os
from typing import Optional
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL: str = os.getenv(
    "SUPABASE_URL", "https://angzyuunecacxqnuwvov.supabase.co"
)
SUPABASE_KEY: str = os.getenv(
    "SUPABASE_KEY", os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
)

_supabase_client: Optional[Client] = None


def get_supabase() -> Client:
    """
    Returns a singleton instance of the Supabase Client.
    """
    global _supabase_client
    if _supabase_client is None:
        if not SUPABASE_URL or not SUPABASE_KEY:
            raise ValueError(
                "SUPABASE_URL and SUPABASE_KEY must be set in backend/.env to connect to Supabase."
            )
        _supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)
    return _supabase_client
