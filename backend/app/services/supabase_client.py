from functools import lru_cache
from supabase import Client, create_client

# Hardcoded for now
SUPABASE_URL = "https://mrfpgqewajcaffujkhjk.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yZnBncWV3YWpjYWZmdWpraGprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjQ2NjQsImV4cCI6MjA4OTYwMDY2NH0.MUr2ddh3HCATXDYE65Hv8GSlgbHm9vO3_xI6qastago"

@lru_cache
def get_supabase() -> Client:
    return create_client(SUPABASE_URL, SUPABASE_KEY)