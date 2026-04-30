// FlowOS — login gate (Supabase Auth)
const { useState: useStateLogin } = React;

function LoginScreen() {
  const [mode, setMode]           = useStateLogin("signin"); // "signin" | "signup"
  const [email, setEmail]         = useStateLogin("");
  const [password, setPassword]   = useStateLogin("");
  const [name, setName]           = useStateLogin("");
  const [loading, setLoading]     = useStateLogin(false);
  const [error, setError]         = useStateLogin("");
  const [confirmSent, setConfirmSent] = useStateLogin(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.includes("@"))    { setError("Enter a valid email."); return; }
    if (password.length < 6)     { setError("Password must be at least 6 characters."); return; }

    setLoading(true);
    setError("");

    try {
      if (mode === "signup") {
        const { data, error: err } = await sb.auth.signUp({
          email,
          password,
          options: { data: { name: name.trim() || email.split("@")[0] } },
        });
        if (err) throw err;
        // If email confirmation is required, session will be null
        if (data.user && !data.session) { setConfirmSent(true); return; }
        // Otherwise onAuthStateChange in ChatOS handles it
      } else {
        const { error: err } = await sb.auth.signInWithPassword({ email, password });
        if (err) throw err;
        // onAuthStateChange in ChatOS handles the session
      }
    } catch (err) {
      setError(err.message || "Authentication failed. Check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  const leftPanel = (headline) => (
    <div style={{
      background: "var(--ink)", color: "var(--paper)",
      padding: "60px 56px", display: "flex", flexDirection: "column", justifyContent: "space-between",
      position: "relative", overflow: "hidden",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 6, background: "var(--paper)", color: "var(--ink)", display: "grid", placeItems: "center", fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 22 }}>F</div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 500, letterSpacing: "-0.01em" }}>FlowOS</div>
          <div className="mono" style={{ fontSize: 10, opacity: 0.6, letterSpacing: "0.14em", textTransform: "uppercase" }}>AI Marketing OS</div>
        </div>
      </div>
      <div>
        <div className="mono" style={{ fontSize: 10.5, opacity: 0.55, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 18 }}>{headline}</div>
        <h1 className="serif" style={{ fontSize: 52, lineHeight: 1.05, letterSpacing: "-0.025em", fontWeight: 400, margin: 0, fontStyle: "italic" }}>
          Every channel.<br/>In full flow.
        </h1>
        <p style={{ marginTop: 22, fontSize: 14.5, lineHeight: 1.65, opacity: 0.75, maxWidth: 380 }}>
          AI that creates, posts, and measures across every channel — one workspace, every platform, always in sync.
        </p>
      </div>
      <div style={{ display: "flex", gap: 14, fontSize: 11, opacity: 0.55, letterSpacing: "0.04em" }}>
        <span>SOC 2 Type II</span><span>·</span><span>EU & US data residency</span><span>·</span><span>SSO available</span>
      </div>
      <div aria-hidden="true" style={{ position: "absolute", right: -60, bottom: -100, fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 480, lineHeight: 1, color: "var(--paper)", opacity: 0.04, pointerEvents: "none" }}>F</div>
    </div>
  );

  // ── Confirm email screen ───────────────────────────────────────────────────
  if (confirmSent) {
    return (
      <div style={{ minHeight: "100vh", height: "100vh", background: "var(--paper-2)", display: "grid", gridTemplateColumns: "1.1fr 1fr" }}>
        {leftPanel("Almost there")}
        <div style={{ padding: "60px 56px", display: "flex", flexDirection: "column", justifyContent: "center", maxWidth: 460, margin: "0 auto", width: "100%" }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--accent-wash)", border: "1px solid var(--accent)", display: "grid", placeItems: "center", marginBottom: 24 }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <rect x="2" y="4" width="16" height="12" rx="2" stroke="var(--accent)" strokeWidth="1.5"/>
              <path d="M2 7l8 5 8-5" stroke="var(--accent)" strokeWidth="1.5"/>
            </svg>
          </div>
          <h2 className="serif" style={{ fontSize: 30, fontWeight: 500, letterSpacing: "-0.02em", margin: "0 0 12px" }}>Check your email</h2>
          <p style={{ fontSize: 13.5, color: "var(--muted)", lineHeight: 1.65, margin: "0 0 24px" }}>
            We sent a confirmation link to <strong style={{ color: "var(--ink)" }}>{email}</strong>. Click it to activate your account, then come back here to sign in.
          </p>
          <button onClick={() => { setConfirmSent(false); setMode("signin"); }} style={{
            padding: "11px 20px", borderRadius: 6, background: "transparent",
            border: "1px solid var(--rule-strong)", color: "var(--ink-2)", fontSize: 13.5,
            fontFamily: "var(--font-sans)", cursor: "pointer", alignSelf: "flex-start",
          }}>← Back to sign in</button>
        </div>
      </div>
    );
  }

  // ── Main sign in / sign up ─────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", height: "100vh", background: "var(--paper-2)", display: "grid", gridTemplateColumns: "1.1fr 1fr" }}>
      {leftPanel(mode === "signin" ? "Welcome back" : "Get started")}

      <div style={{ padding: "60px 56px", display: "flex", flexDirection: "column", justifyContent: "center", maxWidth: 460, margin: "0 auto", width: "100%" }}>
        <div style={{ marginBottom: 28 }}>
          <h2 className="serif" style={{ fontSize: 30, fontWeight: 500, letterSpacing: "-0.02em", margin: 0 }}>
            {mode === "signin" ? "Sign in" : "Create account"}
          </h2>
          <div style={{ marginTop: 8, fontSize: 13, color: "var(--muted)" }}>
            {mode === "signin"
              ? <>New to FlowOS?{" "}<button onClick={() => { setMode("signup"); setError(""); }} style={{ background: "none", border: "none", color: "var(--accent)", fontWeight: 500, cursor: "pointer", fontSize: 13, padding: 0 }}>Create an account</button></>
              : <>Already have an account?{" "}<button onClick={() => { setMode("signin"); setError(""); }} style={{ background: "none", border: "none", color: "var(--accent)", fontWeight: 500, cursor: "pointer", fontSize: 13, padding: 0 }}>Sign in</button></>
            }
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {mode === "signup" && (
            <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <span className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Your name</span>
              <input type="text" autoComplete="name" placeholder="e.g. Kabir Singh"
                value={name} onChange={e => setName(e.target.value)} disabled={loading}
                style={{ padding: "10px 12px", border: "1px solid var(--rule-strong)", borderRadius: 5, fontSize: 13.5, fontFamily: "var(--font-sans)", background: "var(--paper)", color: "var(--ink)", outline: "none" }}/>
            </label>
          )}

          <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <span className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Email</span>
            <input type="email" autoComplete="email" placeholder="you@brand.co"
              value={email} onChange={e => setEmail(e.target.value)} disabled={loading}
              style={{ padding: "10px 12px", border: "1px solid var(--rule-strong)", borderRadius: 5, fontSize: 13.5, fontFamily: "var(--font-sans)", background: "var(--paper)", color: "var(--ink)", outline: "none" }}/>
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <span className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Password</span>
            <input type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} placeholder="••••••••"
              value={password} onChange={e => setPassword(e.target.value)} disabled={loading}
              style={{ padding: "10px 12px", border: "1px solid var(--rule-strong)", borderRadius: 5, fontSize: 13.5, fontFamily: "var(--font-sans)", background: "var(--paper)", color: "var(--ink)", outline: "none" }}/>
          </label>

          {error && <div style={{ fontSize: 12, color: "var(--danger)", marginTop: 2 }}>{error}</div>}

          {mode === "signin" && (
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 2 }}>
              <button type="button" style={{ background: "none", border: "none", color: "var(--ink-2)", fontSize: 12, cursor: "pointer", padding: 0 }}>
                Forgot password?
              </button>
            </div>
          )}

          <button type="submit" disabled={loading} style={{
            marginTop: 8, padding: "11px 14px", borderRadius: 6,
            background: "var(--accent)", color: "var(--paper)",
            border: "1px solid var(--accent)", fontWeight: 500, fontSize: 13.5,
            fontFamily: "var(--font-sans)", cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.7 : 1, transition: "opacity .15s",
          }}>
            {loading
              ? (mode === "signup" ? "Creating account…" : "Signing in…")
              : (mode === "signup" ? "Create account →" : "Sign in →")}
          </button>
        </form>

        <div style={{ marginTop: 22, fontSize: 11, color: "var(--muted)", lineHeight: 1.6 }}>
          By continuing you agree to FlowOS's{" "}
          <a href="#" onClick={e => e.preventDefault()} style={{ color: "var(--ink-2)" }}>Terms</a> and{" "}
          <a href="#" onClick={e => e.preventDefault()} style={{ color: "var(--ink-2)" }}>Privacy notice</a>.
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { LoginScreen });
