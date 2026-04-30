// MVEDA — login gate (prototype: any provider/email signs you in)
const { useState: useStateLogin } = React;

const PROVIDER_GLYPH = {
  github: (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8a8 8 0 0 0 5.47 7.59c.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/>
    </svg>
  ),
  google: (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.81 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.71H.92v2.33A9 9 0 0 0 9 18Z"/>
      <path fill="#FBBC05" d="M3.97 10.71a5.4 5.4 0 0 1 0-3.42V4.96H.92a9 9 0 0 0 0 8.08l3.05-2.33Z"/>
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59A9 9 0 0 0 9 0 9 9 0 0 0 .92 4.96l3.05 2.33C4.68 5.16 6.66 3.58 9 3.58Z"/>
    </svg>
  ),
  apple: (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M11.18 8.49c-.02-1.85 1.51-2.74 1.58-2.79-.86-1.26-2.2-1.43-2.68-1.45-1.13-.12-2.22.67-2.8.67-.59 0-1.47-.66-2.42-.64-1.24.02-2.4.72-3.04 1.84-1.3 2.25-.33 5.58.93 7.4.62.9 1.36 1.9 2.32 1.86.93-.04 1.28-.6 2.4-.6 1.12 0 1.45.6 2.43.58 1-.02 1.65-.91 2.27-1.81.72-1.04 1.01-2.05 1.03-2.1-.02-.01-1.97-.76-2-2.96Zm-1.86-5.43C9.84 2.43 10.21 1.55 10.1.66c-.76.03-1.69.5-2.24 1.13-.49.55-.92 1.45-.81 2.31.85.06 1.72-.43 2.27-1.04Z"/>
    </svg>
  ),
};

function LoginScreen({ onLogin }) {
  const [authing, setAuthing] = useStateLogin(null); // null | "github" | "google" | "apple" | "email"
  const [email, setEmail] = useStateLogin("");
  const [password, setPassword] = useStateLogin("");
  const [error, setError] = useStateLogin("");

  const finishAuth = (provider, user) => {
    setTimeout(() => onLogin({ ...user, via: provider, at: Date.now() }), 700);
  };

  const oauth = (provider) => {
    setAuthing(provider);
    setError("");
    finishAuth(provider, { name: "Greg O.", email: "greg@mveda.co" });
  };

  const submitEmail = (e) => {
    e.preventDefault();
    if (!email.includes("@")) { setError("Enter a valid email."); return; }
    if (password.length < 1) { setError("Password is required."); return; }
    setAuthing("email");
    setError("");
    const handle = email.split("@")[0];
    const name = handle.split(/[._-]/).map(w => w[0]?.toUpperCase() + w.slice(1)).join(" ");
    finishAuth("email", { name: name || "Operator", email });
  };

  const oauthBtn = (provider, label, dark) => (
    <button type="button" onClick={() => oauth(provider)} disabled={!!authing}
      style={{
        width: "100%", padding: "11px 14px", borderRadius: 6,
        border: "1px solid " + (dark ? "var(--ink)" : "var(--rule-strong)"),
        background: dark ? "var(--ink)" : "var(--paper)",
        color: dark ? "var(--paper)" : "var(--ink)",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
        fontSize: 13.5, fontWeight: 500, fontFamily: "var(--font-sans)",
        cursor: authing ? "not-allowed" : "pointer", opacity: authing && authing !== provider ? 0.5 : 1,
        transition: "all .15s ease",
      }}>
      <span style={{ display: "inline-flex", color: dark ? "var(--paper)" : provider === "google" ? "inherit" : "var(--ink)" }}>
        {PROVIDER_GLYPH[provider]}
      </span>
      <span>{authing === provider ? "Authorizing…" : label}</span>
    </button>
  );

  return (
    <div style={{
      minHeight: "100vh", height: "100vh", background: "var(--paper-2)",
      display: "grid", gridTemplateColumns: "1.1fr 1fr",
    }}>
      {/* Left — editorial brand panel */}
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
          <div className="mono" style={{ fontSize: 10.5, opacity: 0.55, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 18 }}>Welcome back</div>
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

        {/* Subtle decorative serif glyph */}
        <div aria-hidden="true" style={{ position: "absolute", right: -60, bottom: -100, fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 480, lineHeight: 1, color: "var(--paper)", opacity: 0.04, pointerEvents: "none" }}>F</div>
      </div>

      {/* Right — login form */}
      <div style={{ padding: "60px 56px", display: "flex", flexDirection: "column", justifyContent: "center", maxWidth: 460, margin: "0 auto", width: "100%" }}>
        <div style={{ marginBottom: 28 }}>
          <h2 className="serif" style={{ fontSize: 30, fontWeight: 500, letterSpacing: "-0.02em", margin: 0 }}>Sign in</h2>
          <div style={{ marginTop: 8, fontSize: 13, color: "var(--muted)" }}>New to FlowOS? <a href="#" onClick={e => e.preventDefault()} style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 500 }}>Request access</a></div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {oauthBtn("github", "Continue with GitHub", true)}
          {oauthBtn("google", "Continue with Google", false)}
          {oauthBtn("apple",  "Continue with Apple",  false)}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "22px 0", color: "var(--muted)" }}>
          <div style={{ flex: 1, height: 1, background: "var(--rule)" }}/>
          <span className="mono" style={{ fontSize: 10.5, letterSpacing: "0.14em", textTransform: "uppercase" }}>or with email</span>
          <div style={{ flex: 1, height: 1, background: "var(--rule)" }}/>
        </div>

        <form onSubmit={submitEmail} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <span className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Email</span>
            <input type="email" autoComplete="email" placeholder="you@brand.co"
              value={email} onChange={e => setEmail(e.target.value)} disabled={!!authing}
              style={{ padding: "10px 12px", border: "1px solid var(--rule-strong)", borderRadius: 5, fontSize: 13.5, fontFamily: "var(--font-sans)", background: "var(--paper)" }}/>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <span className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Password</span>
            <input type="password" autoComplete="current-password" placeholder="••••••••"
              value={password} onChange={e => setPassword(e.target.value)} disabled={!!authing}
              style={{ padding: "10px 12px", border: "1px solid var(--rule-strong)", borderRadius: 5, fontSize: 13.5, fontFamily: "var(--font-sans)", background: "var(--paper)" }}/>
          </label>

          {error && <div style={{ fontSize: 12, color: "var(--danger)", marginTop: 2 }}>{error}</div>}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--muted)" }}>
              <input type="checkbox" defaultChecked style={{ accentColor: "var(--ink)" }}/> Keep me signed in
            </label>
            <a href="#" onClick={e => e.preventDefault()} style={{ fontSize: 12, color: "var(--ink-2)", textDecoration: "none" }}>Forgot password?</a>
          </div>

          <button type="submit" disabled={!!authing}
            style={{
              marginTop: 8, padding: "11px 14px", borderRadius: 6,
              background: "var(--accent)", color: "var(--paper)",
              border: "1px solid var(--accent)", fontWeight: 500, fontSize: 13.5, fontFamily: "var(--font-sans)",
              cursor: authing ? "not-allowed" : "pointer", opacity: authing && authing !== "email" ? 0.5 : 1,
            }}>
            {authing === "email" ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div style={{ marginTop: 22, fontSize: 11, color: "var(--muted)", lineHeight: 1.6 }}>
          By continuing you agree to FlowOS's <a href="#" onClick={e => e.preventDefault()} style={{ color: "var(--ink-2)" }}>Terms</a> and <a href="#" onClick={e => e.preventDefault()} style={{ color: "var(--ink-2)" }}>Privacy notice</a>.
          This is a prototype — any provider or email signs you in.
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { LoginScreen });
