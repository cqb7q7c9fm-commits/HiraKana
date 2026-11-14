declare namespace App {
  interface Locals {
    user: import("@supabase/supabase-js").User | null;
    /** Supabase client created once per request in the middleware; null when Supabase is not configured. */
    supabase: import("@supabase/supabase-js").SupabaseClient | null;
  }
}
