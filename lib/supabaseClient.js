import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Doesn't throw at import time (breaks the static export build) — surfaces the
  // problem the moment someone actually tries to use the client instead.
  console.warn(
    "Faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY. Revisá tu .env.local"
  );
}

export const supabase = createClient(url || "", anonKey || "");
