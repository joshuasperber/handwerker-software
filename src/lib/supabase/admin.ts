import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  getSupabaseServiceRoleKey,
  getSupabaseUrl,
} from "./env";

let adminClient: SupabaseClient | null = null;

/** Server-only Supabase client with service role (Auth Admin API). */
export function createSupabaseAdmin(): SupabaseClient {
  if (adminClient) return adminClient;
  adminClient = createClient(getSupabaseUrl(), getSupabaseServiceRoleKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  return adminClient;
}
