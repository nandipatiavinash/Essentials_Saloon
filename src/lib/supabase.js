import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");
}

// Custom fetch wrapper that intercepts 401 / JWT-expired responses.
// On detection it signs the user out and dispatches a custom DOM event.
// RequireAuth in AdminApp.jsx listens for this event and navigates to
// /login?expired=true via React Router — no full-page reload, no blur.
let _jwtExpiredFiring = false;
const jwtAwareFetch = async (input, init) => {
  const response = await fetch(input, init);

  if (response.status === 401 && !_jwtExpiredFiring) {
    // Clone the response so we can read the body without consuming it
    const cloned = response.clone();
    const handleExpiry = () => {
      if (_jwtExpiredFiring) return;
      _jwtExpiredFiring = true;
      // Dispatch event first, then sign out (auth state change will trigger redirect)
      window.dispatchEvent(new CustomEvent("jwt-expired"));
      supabase.auth.signOut().catch(() => {});
      // Reset flag after a short delay so future logins work
      setTimeout(() => { _jwtExpiredFiring = false; }, 5000);
    };
    try {
      const json = await cloned.json();
      const msg = (json?.message || json?.error || "").toLowerCase();
      const isJwt =
        msg.includes("jwt") ||
        msg.includes("token") ||
        msg.includes("expired") ||
        msg.includes("invalid claim") ||
        msg.includes("unauthorized");
      if (isJwt) handleExpiry();
    } catch (_) {
      // Body wasn't JSON – still treat 401 as expired
      handleExpiry();
    }
  }

  return response;
};

export const supabase = createClient(supabaseUrl ?? "", supabaseAnonKey ?? "", {
  global: { fetch: jwtAwareFetch },
});
