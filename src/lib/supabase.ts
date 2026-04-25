import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anon) {
  // eslint-disable-next-line no-console
  console.warn(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY — auth will not work. Copy .env.example to .env and set them."
  );
}

export const supabase = createClient(url ?? "http://localhost", anon ?? "anon", {
  auth: { persistSession: true, autoRefreshToken: true },
});
