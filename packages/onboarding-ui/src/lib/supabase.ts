/**
 * Supabase client for the pricing-page sign-in flow (Phase F.1).
 *
 * Reads VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY from .env. If either is
 * missing, the auth widget on /pricing renders a "not configured" notice
 * and the Subscribe buttons are disabled.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (cached) return cached;
  const url = (import.meta as unknown as { env: Record<string, string> }).env.VITE_SUPABASE_URL;
  const anon = (import.meta as unknown as { env: Record<string, string> }).env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  cached = createClient(url, anon, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  return cached;
}

export function isSupabaseConfigured(): boolean {
  return getSupabase() !== null;
}
