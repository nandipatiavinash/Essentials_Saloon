import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import toast from "react-hot-toast";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionExpired = searchParams.get("expired") === "true";

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate("/dashboard");
    });
  }, [navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Welcome back");
      navigate("/dashboard");
    }
  };

  return (
    <div className="admin-login">
      <div className="login-card">
        <div className="login-logo">Toni & Guy Essensuals</div>
        <div className="login-sub" style={{ fontSize: "0.68rem", letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--gold)", margin: "0.4rem 0 1.5rem 0" }}>
          Internal Staff Portal — Gorantla Branch
        </div>

        {sessionExpired && (
          <div
            style={{
              margin: "0 0 1rem 0",
              padding: "0.75rem 1rem",
              background: "rgba(245, 158, 11, 0.12)",
              border: "1px solid rgba(245, 158, 11, 0.4)",
              borderRadius: "6px",
              color: "#f59e0b",
              fontSize: "0.78rem",
              lineHeight: 1.5,
              textAlign: "center",
            }}
          >
            ⚠️ Your session has expired. Please log in again to continue.
          </div>
        )}

        <form onSubmit={handleLogin} autoComplete="on">
          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "#aaa", marginBottom: "0.3rem", textAlign: "left" }}>
              Authorized Staff Email
            </label>
            <input
              className="login-input"
              type="email"
              name="staff-email"
              autoComplete="username"
              placeholder="staff@toniandguy-gorantla.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div style={{ marginBottom: "1.5rem" }}>
            <label style={{ display: "block", fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "#aaa", marginBottom: "0.3rem", textAlign: "left" }}>
              Staff Password
            </label>
            <input
              className="login-input"
              type="password"
              name="staff-password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button className="login-btn" type="submit" disabled={loading}>
            {loading ? "Authenticating..." : "Sign In to Staff Portal"}
          </button>
        </form>
        <div style={{ fontSize: "0.6rem", color: "#888", marginTop: "1.5rem", textAlign: "center" }}>
          Authorized Salon Staff Management System • Gorantla Guntur
        </div>
      </div>
    </div>
  );
}
