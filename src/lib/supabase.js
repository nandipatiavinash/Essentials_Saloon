import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");
}

// Custom fetch wrapper that intercepts 401 / JWT-expired responses.
// On detection it signs the user out and redirects to /login?expired=true
// so the Login page can display a clear "session expired" notice.
const jwtAwareFetch = async (input, init) => {
  const response = await fetch(input, init);

  if (response.status === 401) {
    // Clone the response so we can read the body without consuming it
    const cloned = response.clone();
    try {
      const json = await cloned.json();
      const msg = (json?.message || json?.error || "").toLowerCase();
      const isJwt =
        msg.includes("jwt") ||
        msg.includes("token") ||
        msg.includes("expired") ||
        msg.includes("invalid claim") ||
        msg.includes("unauthorized");

      if (isJwt) {
        // Sign out silently then redirect
        supabase.auth.signOut().catch(() => {});
        window.location.replace("/login?expired=true");
      }
    } catch (_) {
      // Body wasn't JSON – still treat 401 as expired
      supabase.auth.signOut().catch(() => {});
      window.location.replace("/login?expired=true");
    }
  }

  return response;
};

export const supabase = createClient(supabaseUrl ?? "", supabaseAnonKey ?? "", {
  global: { fetch: jwtAwareFetch },
});
