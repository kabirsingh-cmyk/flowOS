// MVEDA Chat-OS — main shell
const { useState: useStateChat, useEffect: useEffectChat, useRef: useRefChat, useMemo: useMemoChat } = React;

// ────────────────────────────── SPECIALIST AVATAR ──────────────────────────────
function SpecialistAvatar({ id, size = 28 }) {
  const sp = SPECIALISTS.find(s => s.id === id) || SPECIALISTS[0];
  return (
    <div title={sp.name} style={{
      width: size, height: size, borderRadius: 5,
      background: sp.color, color: "var(--paper)",
      display: "grid", placeItems: "center",
      fontFamily: "var(--font-serif)", fontSize: size * 0.5, fontWeight: 500,
      flexShrink: 0,
    }}>{sp.glyph}</div>
  );
}

function UserAvatar({ name, src, size = 28 }) {
  if (src) {
    return (
      <img src={src} alt={name} style={{
        width: size, height: size, borderRadius: 5,
        objectFit: "cover", border: "1px solid var(--rule)", flexShrink: 0,
      }}/>
    );
  }
  const initials = name.split(/\s+/).map(s => s[0]).slice(0,2).join("");
  return (
    <div style={{
      width: size, height: size, borderRadius: 5,
      background: "var(--paper-3)", color: "var(--ink)",
      border: "1px solid var(--rule)",
      display: "grid", placeItems: "center",
      fontSize: size * 0.42, fontWeight: 500, letterSpacing: "-0.01em",
      flexShrink: 0,
    }}>{initials}</div>
  );
}

// ────────────────────────────── ARTIFACT CARDS (in-thread) ─────────────────────
// ────────────────────────────── DRAFT CREATED CARD ──────────────────────────────
const PLATFORM_ACCENT = {
  instagram: "oklch(56% 0.18 325)",
  tiktok:    "var(--ink)",
  linkedin:  "oklch(48% 0.14 235)",
  facebook:  "oklch(50% 0.18 265)",
  x:         "var(--ink)",
  twitter:   "var(--ink)",
  pinterest: "oklch(56% 0.18 25)",
  youtube:   "oklch(54% 0.22 25)",
  email:     "oklch(52% 0.16 240)",
  sms:       "oklch(54% 0.15 145)",
  reddit:    "oklch(58% 0.22 30)",
  snapchat:  "oklch(88% 0.18 100)",
  snap:      "oklch(88% 0.18 100)",
  threads:   "var(--ink)",
  bluesky:   "oklch(56% 0.18 240)",
};

function DraftCreatedCard({ artifact, onOpen }) {
  const [queued, setQueued] = useStateChat(false);
  const accent = PLATFORM_ACCENT[(artifact.platform || "").toLowerCase()] || "var(--accent)";
  const platformLabel = (artifact.platform || "").charAt(0).toUpperCase() + (artifact.platform || "").slice(1);

  const handleSendToQueue = () => {
    onOpen({ kind: "queue_draft", data: artifact });
    setQueued(true);
  };

  return (
    <div data-testid="draft-card" style={{
      marginTop: 10,
      border: "1px solid var(--rule-strong)",
      borderRadius: 6,
      background: "var(--paper)",
      overflow: "hidden",
    }}>
      {/* Header strip */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "9px 12px",
        borderBottom: "1px solid var(--rule)",
        background: "var(--paper-2)",
      }}>
        <Icon name="edit" size={12}/>
        <span className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase", flex: 1 }}>
          {platformLabel} · {artifact.contentType || "Post"}
        </span>
        <Chip tone="accent">draft</Chip>
      </div>

      {/* Copy body */}
      <div style={{
        padding: "12px 14px 12px 17px",
        borderLeft: `3px solid ${accent}`,
        fontSize: 13, lineHeight: 1.65,
        color: "var(--ink)",
        whiteSpace: "pre-wrap",
      }}>
        {artifact.copy}
      </div>

      {/* Image prompt (if present) */}
      {artifact.imagePrompt && (
        <div style={{
          margin: "0 12px 10px",
          padding: "7px 10px",
          background: "var(--paper-3)",
          borderRadius: 4,
          fontSize: 11.5,
          color: "var(--muted)",
          lineHeight: 1.5,
        }}>
          <span style={{ fontWeight: 600, color: "var(--ink-2)" }}>Image · </span>
          {artifact.imagePrompt}
        </div>
      )}

      {/* Actions */}
      <div style={{
        padding: "10px 12px",
        borderTop: "1px solid var(--rule)",
        display: "flex", gap: 8, alignItems: "center",
      }}>
        {!queued ? (
          <Btn size="sm" variant="primary" data-testid="send-to-queue" onClick={handleSendToQueue}>
            <Icon name="check" size={11}/> Send to queue
          </Btn>
        ) : (
          <>
            <span style={{ fontSize: 11.5, color: "var(--success)", fontWeight: 500, display: "flex", alignItems: "center", gap: 5 }}>
              <Icon name="check" size={11}/> Added to queue
            </span>
            <Btn size="sm" variant="ghost" onClick={() => onOpen({ kind: "open_queue" })}>
              View queue →
            </Btn>
          </>
        )}
      </div>
    </div>
  );
}

function EmailDraftCard({ artifact, onOpen }) {
  // Local push state mirrors what's in store, but the card renders standalone
  // (artifact lives on a thread message — store row is created on push click).
  const [pushState, setPushState] = useStateChat({ status: "idle", url: null, audience: null, error: null });
  const accent = PLATFORM_ACCENT.email;

  const handlePush = () => {
    if (pushState.status === "pushing" || pushState.status === "ok") return;
    setPushState({ status: "pushing", url: null, audience: null, error: null });
    onOpen({
      kind: "push_klaviyo",
      data: artifact,
      onResult: (res) => {
        if (res?.ok) {
          setPushState({ status: "ok", url: res.klaviyoUrl, audience: res.audience, error: null });
        } else {
          setPushState({ status: "failed", url: null, audience: null, error: res?.error || "push failed" });
        }
      },
    });
  };

  return (
    <div data-testid="email-draft-card" style={{
      marginTop: 10,
      border: "1px solid var(--rule-strong)",
      borderRadius: 6,
      background: "var(--paper)",
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "9px 12px",
        borderBottom: "1px solid var(--rule)",
        background: "var(--paper-2)",
      }}>
        <Icon name="mail" size={12}/>
        <span className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase", flex: 1 }}>
          Email · draft
        </span>
        <Chip tone="accent">klaviyo</Chip>
      </div>

      {/* Subject + preheader */}
      <div style={{
        padding: "12px 14px 4px 17px",
        borderLeft: `3px solid ${accent}`,
      }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", lineHeight: 1.35 }}>{artifact.subject}</div>
        {artifact.preheader && (
          <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 3, lineHeight: 1.5 }}>{artifact.preheader}</div>
        )}
      </div>

      {/* Body preview */}
      <div style={{
        padding: "8px 14px 12px 17px",
        borderLeft: `3px solid ${accent}`,
        fontSize: 12.5, lineHeight: 1.65,
        color: "var(--ink-2)",
        whiteSpace: "pre-wrap",
        maxHeight: 180, overflow: "hidden",
        position: "relative",
      }}>
        {artifact.body}
      </div>

      {/* Audience hint (if present) */}
      {artifact.audienceHint && (
        <div style={{
          margin: "0 12px 10px",
          padding: "7px 10px",
          background: "var(--paper-3)",
          borderRadius: 4,
          fontSize: 11.5,
          color: "var(--muted)",
          lineHeight: 1.5,
        }}>
          <span style={{ fontWeight: 600, color: "var(--ink-2)" }}>Audience · </span>
          {artifact.audienceHint}
        </div>
      )}

      {/* Actions / status */}
      <div style={{
        padding: "10px 12px",
        borderTop: "1px solid var(--rule)",
        display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap",
      }}>
        {pushState.status === "idle" && (
          <Btn size="sm" variant="primary" data-testid="push-klaviyo" onClick={handlePush}>
            <Icon name="send" size={11}/> Push to Klaviyo
          </Btn>
        )}
        {pushState.status === "pushing" && (
          <span style={{ fontSize: 11.5, color: "var(--muted)", display: "flex", alignItems: "center", gap: 6 }}>
            <Dot status="warn"/> Creating template + campaign in Klaviyo…
          </span>
        )}
        {pushState.status === "ok" && (
          <>
            <span style={{ fontSize: 11.5, color: "var(--success)", fontWeight: 500, display: "flex", alignItems: "center", gap: 5 }}>
              <Icon name="check" size={11}/> Draft created in Klaviyo
              {pushState.audience?.name && (
                <span style={{ color: "var(--muted)", fontWeight: 400 }}>
                  · {pushState.audience.name}{pushState.audience.fallback ? " (fallback)" : ""}
                </span>
              )}
            </span>
            {pushState.url && (
              <a href={pushState.url} target="_blank" rel="noreferrer" style={{ fontSize: 11.5, color: "var(--accent-ink)", textDecoration: "underline" }}>
                Open in Klaviyo →
              </a>
            )}
            <Btn size="sm" variant="ghost" onClick={() => onOpen({ kind: "open_emailstudio" })}>
              View in Email Studio
            </Btn>
          </>
        )}
        {pushState.status === "failed" && (
          <>
            <span style={{ fontSize: 11.5, color: "oklch(48% 0.16 25)", display: "flex", alignItems: "center", gap: 5 }}>
              <Icon name="x" size={11}/> Push failed
              {pushState.error && <span style={{ color: "var(--muted)" }}>· {pushState.error}</span>}
            </span>
            <Btn size="sm" onClick={handlePush}>Retry</Btn>
          </>
        )}
      </div>
    </div>
  );
}

function SmsDraftCard({ artifact, onOpen }) {
  const [pushState, setPushState] = useStateChat({ status: "idle", url: null, audience: null, warnings: null, error: null });
  const accent = PLATFORM_ACCENT.sms;

  const length = (artifact.body || "").length;
  const overLimit = length > 160;
  const hasStop = /stop/i.test(artifact.body || "");
  const hasEmoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(artifact.body || "");

  const handlePush = () => {
    if (pushState.status === "pushing" || pushState.status === "ok") return;
    setPushState({ status: "pushing", url: null, audience: null, warnings: null, error: null });
    onOpen({
      kind: "push_klaviyo_sms",
      data: artifact,
      onResult: (res) => {
        if (res?.ok) {
          setPushState({ status: "ok", url: res.klaviyoUrl, audience: res.audience, warnings: res.warnings || null, error: null });
        } else {
          setPushState({ status: "failed", url: null, audience: null, warnings: null, error: res?.error || "push failed" });
        }
      },
    });
  };

  return (
    <div data-testid="sms-draft-card" style={{
      marginTop: 10,
      border: "1px solid var(--rule-strong)",
      borderRadius: 6,
      background: "var(--paper)",
      overflow: "hidden",
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "9px 12px",
        borderBottom: "1px solid var(--rule)",
        background: "var(--paper-2)",
      }}>
        <Icon name="flash" size={12}/>
        <span className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase", flex: 1 }}>
          SMS · draft
        </span>
        <Chip tone="accent">klaviyo sms</Chip>
      </div>

      {/* Body */}
      <div style={{
        padding: "12px 14px 6px 17px",
        borderLeft: `3px solid ${accent}`,
        fontSize: 13.5, lineHeight: 1.55,
        color: "var(--ink)",
        whiteSpace: "pre-wrap",
      }}>
        {artifact.body}
      </div>

      {/* Char counter + warnings */}
      <div style={{
        padding: "4px 14px 10px 17px",
        borderLeft: `3px solid ${accent}`,
        display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap",
      }}>
        <span className="mono" style={{
          fontSize: 10.5,
          color: overLimit ? "oklch(48% 0.16 25)" : length > 140 ? "oklch(58% 0.14 70)" : "var(--muted)",
          fontWeight: overLimit ? 600 : 400,
        }}>
          {length} / 160
        </span>
        {!hasStop && (
          <span style={{ fontSize: 10.5, color: "oklch(58% 0.14 70)" }}>
            ⚠ No STOP — verify with brand
          </span>
        )}
        {hasEmoji && (
          <span style={{ fontSize: 10.5, color: "oklch(58% 0.14 70)" }}>
            ⚠ Emoji halves char budget (70 cap)
          </span>
        )}
      </div>

      {artifact.audienceHint && (
        <div style={{
          margin: "0 12px 10px",
          padding: "7px 10px",
          background: "var(--paper-3)",
          borderRadius: 4,
          fontSize: 11.5,
          color: "var(--muted)",
          lineHeight: 1.5,
        }}>
          <span style={{ fontWeight: 600, color: "var(--ink-2)" }}>Audience · </span>
          {artifact.audienceHint}
        </div>
      )}

      <div style={{
        padding: "10px 12px",
        borderTop: "1px solid var(--rule)",
        display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap",
      }}>
        {pushState.status === "idle" && (
          <Btn size="sm" variant="primary" data-testid="push-klaviyo-sms" onClick={handlePush} disabled={overLimit}>
            <Icon name="send" size={11}/> Push to Klaviyo SMS
          </Btn>
        )}
        {pushState.status === "pushing" && (
          <span style={{ fontSize: 11.5, color: "var(--muted)", display: "flex", alignItems: "center", gap: 6 }}>
            <Dot status="warn"/> Creating draft SMS campaign in Klaviyo…
          </span>
        )}
        {pushState.status === "ok" && (
          <>
            <span style={{ fontSize: 11.5, color: "var(--success)", fontWeight: 500, display: "flex", alignItems: "center", gap: 5 }}>
              <Icon name="check" size={11}/> Draft SMS created in Klaviyo
              {pushState.audience?.name && (
                <span style={{ color: "var(--muted)", fontWeight: 400 }}>
                  · {pushState.audience.name}{pushState.audience.fallback ? " (fallback)" : ""}
                </span>
              )}
            </span>
            {pushState.url && (
              <a href={pushState.url} target="_blank" rel="noreferrer" style={{ fontSize: 11.5, color: "var(--accent-ink)", textDecoration: "underline" }}>
                Open in Klaviyo →
              </a>
            )}
            <Btn size="sm" variant="ghost" onClick={() => onOpen({ kind: "open_smscenter" })}>
              View in SMS Center
            </Btn>
          </>
        )}
        {pushState.status === "failed" && (
          <>
            <span style={{ fontSize: 11.5, color: "oklch(48% 0.16 25)", display: "flex", alignItems: "center", gap: 5 }}>
              <Icon name="x" size={11}/> Push failed
              {pushState.error && <span style={{ color: "var(--muted)" }}>· {pushState.error}</span>}
            </span>
            <Btn size="sm" onClick={handlePush}>Retry</Btn>
          </>
        )}
      </div>
    </div>
  );
}

const SEQUENCE_TYPE_LABEL = {
  onboarding:       "Onboarding",
  lead_nurture:     "Lead nurture",
  re_engagement:    "Re-engagement",
  win_back:         "Win-back",
  product_launch:   "Product launch",
  event_followup:   "Event follow-up",
  upsell:           "Upsell",
  educational_drip: "Educational drip",
};

function EmailSequenceCard({ artifact, onOpen }) {
  const [openIdx, setOpenIdx] = useStateChat(null);
  const accent = PLATFORM_ACCENT.email;
  const emails = Array.isArray(artifact.emails) ? artifact.emails : [];
  const typeLabel = SEQUENCE_TYPE_LABEL[artifact.sequenceType] || artifact.sequenceType || "Sequence";

  const subjectLabels = ["Benefit", "Curiosity", "Direct"];

  return (
    <div data-testid="email-sequence-card" style={{
      marginTop: 10,
      border: "1px solid var(--rule-strong)",
      borderRadius: 6,
      background: "var(--paper)",
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "9px 12px",
        borderBottom: "1px solid var(--rule)",
        background: "var(--paper-2)",
      }}>
        <Icon name="mail" size={12}/>
        <span className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase", flex: 1 }}>
          Email sequence · {typeLabel}
        </span>
        <Chip tone="accent">{emails.length} emails</Chip>
      </div>

      {/* Goal + audience */}
      {(artifact.goal || artifact.audience) && (
        <div style={{
          padding: "10px 14px 8px 17px",
          borderLeft: `3px solid ${accent}`,
          fontSize: 12, color: "var(--ink-2)", lineHeight: 1.55,
        }}>
          {artifact.goal && (
            <div><span style={{ color: "var(--muted)", fontWeight: 600 }}>Goal · </span>{artifact.goal}</div>
          )}
          {artifact.audience && (
            <div style={{ marginTop: 3 }}><span style={{ color: "var(--muted)", fontWeight: 600 }}>Audience · </span>{artifact.audience}</div>
          )}
        </div>
      )}

      {/* Email list */}
      <div style={{ borderTop: "1px solid var(--rule)" }}>
        {emails.map((em, i) => {
          const isOpen = openIdx === i;
          return (
            <div key={i} style={{ borderBottom: i < emails.length - 1 ? "1px solid var(--rule)" : "none" }}>
              <button
                onClick={() => setOpenIdx(isOpen ? null : i)}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  width: "100%", padding: "10px 14px",
                  background: isOpen ? "var(--paper-2)" : "transparent",
                  border: "none", cursor: "pointer", textAlign: "left",
                }}
              >
                <span className="mono" style={{
                  fontSize: 10.5, color: "var(--muted)", letterSpacing: "0.06em",
                  minWidth: 22,
                }}>
                  #{em.emailNumber ?? i + 1}
                </span>
                <span className="mono" style={{
                  fontSize: 10.5, color: "var(--ink-2)", minWidth: 54,
                }}>
                  Day {em.timingDays ?? 0}
                </span>
                <span style={{
                  fontSize: 12.5, color: "var(--ink)", flex: 1,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {em.purpose || (Array.isArray(em.subjectLines) ? em.subjectLines[0] : "")}
                </span>
                <Icon name={isOpen ? "chevron-up" : "chevron-down"} size={11}/>
              </button>

              {isOpen && (
                <div style={{
                  padding: "8px 14px 14px 17px",
                  borderLeft: `3px solid ${accent}`,
                  background: "var(--paper)",
                  fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.6,
                }}>
                  {Array.isArray(em.subjectLines) && em.subjectLines.length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      <div className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>
                        Subject options
                      </div>
                      {em.subjectLines.map((s, j) => (
                        <div key={j} style={{ display: "flex", gap: 8, marginTop: 3 }}>
                          <span className="mono" style={{ fontSize: 10.5, color: "var(--muted-2)", minWidth: 60 }}>
                            {subjectLabels[j] || `Option ${j + 1}`}
                          </span>
                          <span style={{ fontSize: 12.5, color: "var(--ink)" }}>{s}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {em.previewText && (
                    <div style={{ marginBottom: 8 }}>
                      <span style={{ color: "var(--muted)", fontWeight: 600 }}>Preview · </span>
                      <span>{em.previewText}</span>
                    </div>
                  )}

                  {em.body && (
                    <div style={{
                      padding: "8px 10px",
                      background: "var(--paper-2)",
                      borderRadius: 4,
                      whiteSpace: "pre-wrap",
                      fontSize: 12.5, color: "var(--ink)",
                      marginBottom: 8,
                    }}>
                      {em.body}
                    </div>
                  )}

                  {em.ctaText && (
                    <div style={{ marginBottom: 6 }}>
                      <span style={{ color: "var(--muted)", fontWeight: 600 }}>CTA · </span>
                      <span>{em.ctaText}</span>
                    </div>
                  )}

                  {em.segmentCondition && (
                    <div>
                      <span style={{ color: "var(--muted)", fontWeight: 600 }}>Segment · </span>
                      <span>{em.segmentCondition}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      {(artifact.branchingLogic || artifact.exitCondition || (Array.isArray(artifact.abTestSuggestions) && artifact.abTestSuggestions.length > 0) || artifact.benchmarks) && (
        <div style={{
          padding: "10px 14px",
          borderTop: "1px solid var(--rule)",
          background: "var(--paper-2)",
          fontSize: 11.5, color: "var(--ink-2)", lineHeight: 1.6,
        }}>
          {artifact.branchingLogic && (
            <div style={{ marginBottom: 6 }}>
              <span style={{ color: "var(--muted)", fontWeight: 600 }}>Branching · </span>
              <span>{artifact.branchingLogic}</span>
            </div>
          )}
          {artifact.exitCondition && (
            <div style={{ marginBottom: 6 }}>
              <span style={{ color: "var(--muted)", fontWeight: 600 }}>Exit · </span>
              <span>{artifact.exitCondition}</span>
            </div>
          )}
          {Array.isArray(artifact.abTestSuggestions) && artifact.abTestSuggestions.length > 0 && (
            <div style={{ marginBottom: 6 }}>
              <div style={{ color: "var(--muted)", fontWeight: 600, marginBottom: 2 }}>A/B tests</div>
              {artifact.abTestSuggestions.map((s, i) => (
                <div key={i} style={{ paddingLeft: 8 }}>· {s}</div>
              ))}
            </div>
          )}
          {artifact.benchmarks && (
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 4 }}>
              {artifact.benchmarks.openRate && (
                <span><span style={{ color: "var(--muted)" }}>Open </span>{artifact.benchmarks.openRate}</span>
              )}
              {artifact.benchmarks.clickRate && (
                <span><span style={{ color: "var(--muted)" }}>CTR </span>{artifact.benchmarks.clickRate}</span>
              )}
              {artifact.benchmarks.conversionRate && (
                <span><span style={{ color: "var(--muted)" }}>Conv </span>{artifact.benchmarks.conversionRate}</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div style={{
        padding: "10px 12px",
        borderTop: "1px solid var(--rule)",
        display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap",
      }}>
        <Btn size="sm" variant="primary" onClick={() => onOpen({ kind: "open_emailstudio", data: artifact })}>
          <Icon name="external-link" size={11}/> Open in Email Studio
        </Btn>
      </div>
    </div>
  );
}

const ASSESSMENT_META = {
  strong_foundation: { label: "Strong foundation", tone: "ok",     color: "var(--success)" },
  needs_work:        { label: "Needs work",        tone: "warn",   color: "oklch(62% 0.14 70)" },
  critical_issues:   { label: "Critical issues",   tone: "danger", color: "oklch(48% 0.16 25)" },
};

const SEVERITY_COLOR = {
  Critical: "oklch(48% 0.16 25)",
  High:     "oklch(54% 0.15 40)",
  Medium:   "oklch(62% 0.14 70)",
  Low:      "var(--muted)",
};

const STATUS_COLOR = {
  Pass:    "var(--success)",
  Fail:    "oklch(48% 0.16 25)",
  Warning: "oklch(62% 0.14 70)",
};

const OPPORTUNITY_COLOR = {
  high:   "var(--success)",
  medium: "oklch(62% 0.14 70)",
  low:    "var(--muted)",
};

const AUDIT_TYPE_LABEL = {
  full_audit:            "Full audit",
  keyword_research:      "Keyword research",
  content_gap:           "Content gap",
  technical_check:       "Technical check",
  competitor_comparison: "Competitor comparison",
};

const EFFORT_LABEL = {
  quick_win:   "Quick win",
  moderate:    "Moderate",
  substantial: "Substantial",
};

function SeoAuditCard({ artifact, onOpen }) {
  const [openSection, setOpenSection] = useStateChat("keywords");
  const accent = "oklch(54% 0.13 200)";

  const assessment = ASSESSMENT_META[artifact.overallAssessment] || ASSESSMENT_META.needs_work;
  const typeLabel  = AUDIT_TYPE_LABEL[artifact.auditType] || "SEO audit";
  const compNames  = Array.isArray(artifact.competitorNames) && artifact.competitorNames.length
    ? artifact.competitorNames
    : ["Competitor A", "Competitor B"];

  const sections = [
    { id: "keywords",    label: "Keyword opportunities", count: artifact.keywords.length },
    { id: "onpage",      label: "On-page issues",        count: artifact.onPageIssues.length },
    { id: "gaps",        label: "Content gaps",          count: artifact.contentGaps.length },
    { id: "technical",   label: "Technical checks",      count: artifact.technicalChecks.length },
    { id: "competitors", label: "Competitor comparison", count: artifact.competitors.length },
    { id: "actions",     label: "Action plan",           count: artifact.quickWins.length + artifact.strategicInvestments.length },
  ].filter(s => s.count > 0);

  const cell = { fontSize: 12, color: "var(--ink-2)", padding: "6px 8px", borderTop: "1px solid var(--rule)" };
  const headerCell = { ...cell, color: "var(--muted)", fontWeight: 500, borderTop: "none", letterSpacing: "0.04em", textTransform: "uppercase", fontSize: 10 };

  return (
    <div data-testid="seo-audit-card" style={{
      marginTop: 10,
      border: "1px solid var(--rule-strong)",
      borderRadius: 6,
      background: "var(--paper)",
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "9px 12px",
        borderBottom: "1px solid var(--rule)",
        background: "var(--paper-2)",
      }}>
        <Icon name="search" size={12}/>
        <span className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase", flex: 1 }}>
          SEO audit · {typeLabel}
        </span>
        <Chip tone={assessment.tone}>{assessment.label}</Chip>
      </div>

      {/* URL + summary */}
      <div style={{
        padding: "10px 14px 12px 17px",
        borderLeft: `3px solid ${accent}`,
        fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.55,
      }}>
        {artifact.url && (
          <div className="mono" style={{ fontSize: 11, color: "var(--ink)", marginBottom: 6, wordBreak: "break-all" }}>{artifact.url}</div>
        )}
        {artifact.executiveSummary && (
          <div style={{ fontSize: 12.5, color: "var(--ink-2)" }}>{artifact.executiveSummary}</div>
        )}
      </div>

      {/* Collapsible sections */}
      <div style={{ borderTop: "1px solid var(--rule)" }}>
        {sections.map((sec, i) => {
          const isOpen = openSection === sec.id;
          return (
            <div key={sec.id} style={{ borderBottom: i < sections.length - 1 ? "1px solid var(--rule)" : "none" }}>
              <button
                onClick={() => setOpenSection(isOpen ? null : sec.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  width: "100%", padding: "10px 14px",
                  background: isOpen ? "var(--paper-2)" : "transparent",
                  border: "none", cursor: "pointer", textAlign: "left",
                }}
              >
                <span style={{ fontSize: 12.5, color: "var(--ink)", flex: 1, fontWeight: 500 }}>
                  {sec.label}
                </span>
                <span className="mono" style={{ fontSize: 10.5, color: "var(--muted-2)" }}>
                  {sec.count}
                </span>
                <Icon name={isOpen ? "chevron-up" : "chevron-down"} size={11}/>
              </button>

              {isOpen && sec.id === "keywords" && (
                <div style={{ padding: "0 14px 12px", overflowX: "auto" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "minmax(140px,2fr) 90px 110px 100px 110px minmax(140px,1.6fr)" }}>
                    <div style={headerCell}>Keyword</div>
                    <div style={headerCell}>Difficulty</div>
                    <div style={headerCell}>Opportunity</div>
                    <div style={headerCell}>Ranking</div>
                    <div style={headerCell}>Intent</div>
                    <div style={headerCell}>Content type</div>
                    {artifact.keywords.map((k, j) => (
                      <React.Fragment key={j}>
                        <div style={{ ...cell, color: "var(--ink)", fontWeight: 500 }}>{k.keyword}</div>
                        <div style={cell}>{k.difficulty}</div>
                        <div style={{ ...cell, color: OPPORTUNITY_COLOR[k.opportunity] || "var(--ink-2)", fontWeight: 500 }}>{k.opportunity}</div>
                        <div style={{ ...cell, fontFamily: "var(--font-mono)" }}>{k.currentRanking || "—"}</div>
                        <div style={cell}>{k.intent}</div>
                        <div style={cell}>{k.recommendedContentType || "—"}</div>
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              )}

              {isOpen && sec.id === "onpage" && (
                <div style={{ padding: "0 14px 12px", overflowX: "auto" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "minmax(140px,1.4fr) minmax(160px,2fr) 90px minmax(160px,2fr)" }}>
                    <div style={headerCell}>Page</div>
                    <div style={headerCell}>Issue</div>
                    <div style={headerCell}>Severity</div>
                    <div style={headerCell}>Fix</div>
                    {artifact.onPageIssues.map((p, j) => (
                      <React.Fragment key={j}>
                        <div style={{ ...cell, fontFamily: "var(--font-mono)", fontSize: 11.5, wordBreak: "break-all" }}>{p.page}</div>
                        <div style={cell}>{p.issue}</div>
                        <div style={{ ...cell, color: SEVERITY_COLOR[p.severity] || "var(--ink-2)", fontWeight: 500 }}>{p.severity}</div>
                        <div style={cell}>{p.recommendedFix}</div>
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              )}

              {isOpen && sec.id === "gaps" && (
                <div style={{ padding: "0 14px 12px" }}>
                  {artifact.contentGaps.map((g, j) => (
                    <div key={j} style={{
                      padding: "10px 0",
                      borderTop: j ? "1px solid var(--rule)" : "1px solid var(--rule)",
                      fontSize: 12.5, lineHeight: 1.55,
                    }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 500, color: "var(--ink)" }}>{g.topic}</span>
                        <Chip tone={g.priority === "high" ? "accent" : "neutral"}>{g.priority}</Chip>
                        {g.effort && <span className="mono" style={{ fontSize: 10.5, color: "var(--muted)" }}>{EFFORT_LABEL[g.effort] || g.effort}</span>}
                        {g.format && <span className="mono" style={{ fontSize: 10.5, color: "var(--muted-2)" }}>· {g.format}</span>}
                      </div>
                      <div style={{ marginTop: 4, color: "var(--ink-2)" }}>{g.why}</div>
                    </div>
                  ))}
                </div>
              )}

              {isOpen && sec.id === "technical" && (
                <div style={{ padding: "0 14px 12px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "minmax(140px,1.4fr) 90px minmax(180px,2.4fr)" }}>
                    <div style={headerCell}>Check</div>
                    <div style={headerCell}>Status</div>
                    <div style={headerCell}>Details</div>
                    {artifact.technicalChecks.map((c, j) => (
                      <React.Fragment key={j}>
                        <div style={{ ...cell, color: "var(--ink)" }}>{c.check}</div>
                        <div style={{ ...cell, color: STATUS_COLOR[c.status] || "var(--ink-2)", fontWeight: 500 }}>{c.status}</div>
                        <div style={cell}>{c.details}</div>
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              )}

              {isOpen && sec.id === "competitors" && (
                <div style={{ padding: "0 14px 12px", overflowX: "auto" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "minmax(120px,1.2fr) 1fr 1fr 1fr 90px" }}>
                    <div style={headerCell}>Dimension</div>
                    <div style={headerCell}>Your site</div>
                    <div style={headerCell}>{compNames[0] || "Competitor A"}</div>
                    <div style={headerCell}>{compNames[1] || "Competitor B"}</div>
                    <div style={headerCell}>Winner</div>
                    {artifact.competitors.map((c, j) => (
                      <React.Fragment key={j}>
                        <div style={{ ...cell, color: "var(--ink)", fontWeight: 500 }}>{c.dimension}</div>
                        <div style={cell}>{c.yourSite || "—"}</div>
                        <div style={cell}>{c.competitorA || "—"}</div>
                        <div style={cell}>{c.competitorB || "—"}</div>
                        <div style={{ ...cell, fontWeight: 500, color: c.winner === "You" ? "var(--success)" : "var(--ink-2)" }}>{c.winner || "—"}</div>
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              )}

              {isOpen && sec.id === "actions" && (
                <div style={{ padding: "0 14px 12px", fontSize: 12.5, lineHeight: 1.55 }}>
                  {artifact.quickWins.length > 0 && (
                    <div style={{ paddingTop: 8 }}>
                      <div className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>
                        Quick wins · this week
                      </div>
                      {artifact.quickWins.map((q, j) => (
                        <div key={j} style={{ padding: "6px 0", borderTop: j ? "1px dashed var(--rule)" : "none" }}>
                          <div style={{ color: "var(--ink)", fontWeight: 500 }}>{q.action}</div>
                          <div style={{ display: "flex", gap: 12, marginTop: 2, color: "var(--muted-2)" }}>
                            <span><span style={{ color: "var(--muted)" }}>Impact · </span>{q.expectedImpact}</span>
                            {q.effort && <span><span style={{ color: "var(--muted)" }}>Effort · </span>{q.effort}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {artifact.strategicInvestments.length > 0 && (
                    <div style={{ paddingTop: 12 }}>
                      <div className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>
                        Strategic investments · this quarter
                      </div>
                      {artifact.strategicInvestments.map((s, j) => (
                        <div key={j} style={{ padding: "6px 0", borderTop: j ? "1px dashed var(--rule)" : "none" }}>
                          <div style={{ color: "var(--ink)", fontWeight: 500 }}>{s.action}</div>
                          <div style={{ display: "flex", gap: 12, marginTop: 2, color: "var(--muted-2)", flexWrap: "wrap" }}>
                            <span><span style={{ color: "var(--muted)" }}>Impact · </span>{s.expectedImpact}</span>
                            {s.effort && <span><span style={{ color: "var(--muted)" }}>Effort · </span>{s.effort}</span>}
                            {s.dependencies && <span><span style={{ color: "var(--muted)" }}>Depends · </span>{s.dependencies}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div style={{
        padding: "10px 12px",
        borderTop: "1px solid var(--rule)",
        display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap",
      }}>
        <Btn size="sm" variant="primary" onClick={() => onOpen({ kind: "open_seostudio", data: artifact })}>
          <Icon name="external-link" size={11}/> Open in SEO Studio
        </Btn>
      </div>
    </div>
  );
}

function ArtifactCard({ artifact, onOpen }) {
  if (!artifact) return null;
  const t = artifact.type;

  if (t === "email_draft") {
    return <EmailDraftCard artifact={artifact} onOpen={onOpen}/>;
  }

  if (t === "sms_draft") {
    return <SmsDraftCard artifact={artifact} onOpen={onOpen}/>;
  }

  if (t === "email_sequence") {
    return <EmailSequenceCard artifact={artifact} onOpen={onOpen}/>;
  }

  if (t === "seo_audit") {
    return <SeoAuditCard artifact={artifact} onOpen={onOpen}/>;
  }

  if (t === "email") {
    // Legacy seeded artifact shape — passive preview, opens in canvas.
    return (
      <button onClick={() => onOpen({ kind: "email", data: artifact })}
        style={{
          display: "block", width: "100%", textAlign: "left",
          marginTop: 8, padding: 14,
          background: "var(--paper)", border: "1px solid var(--rule-strong)",
          borderRadius: 6, cursor: "pointer", transition: "border-color .12s",
        }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <Icon name="mail" size={13}/>
          <span className="mono" style={{ fontSize: 10.5, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Email · draft</span>
          <Chip>klaviyo</Chip>
        </div>
        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>{artifact.subject}</div>
        <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.5, whiteSpace: "pre-line", maxHeight: 56, overflow: "hidden" }}>{artifact.body}</div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8, fontSize: 11, color: "var(--muted)" }}>Click to expand →</div>
      </button>
    );
  }

  if (t === "policy-review") {
    return (
      <div style={{ marginTop: 8, padding: 14, background: "var(--paper)", border: "1px solid var(--rule-strong)", borderRadius: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <Icon name="shield" size={13}/>
          <span className="mono" style={{ fontSize: 10.5, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Policy review · {artifact.items.length} items</span>
        </div>
        {artifact.items.map((it, i) => (
          <div key={i} style={{ paddingTop: i ? 12 : 0, borderTop: i ? "1px solid var(--rule)" : 0, marginTop: i ? 12 : 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 500 }}>{it.title}</div>
            <div style={{ fontSize: 11.5, color: "oklch(48% 0.16 25)", marginTop: 3 }}>⚠ {it.flag}</div>
            <div style={{ fontSize: 11.5, color: "var(--ink-2)", marginTop: 4, lineHeight: 1.5 }}><span style={{ color: "var(--muted)" }}>Suggested:</span> {it.suggestion}</div>
          </div>
        ))}
      </div>
    );
  }

  if (t === "calendar-preview" || t === "campaign-plan") {
    return (
      <button onClick={() => onOpen({ kind: "calendar", data: artifact })}
        style={{
          display: "block", width: "100%", textAlign: "left",
          marginTop: 8, padding: 14, cursor: "pointer",
          background: "var(--paper)", border: "1px solid var(--rule-strong)", borderRadius: 6,
        }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <Icon name="calendar" size={13}/>
          <span className="mono" style={{ fontSize: 10.5, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Campaign plan</span>
          <Chip tone="accent">{artifact.itemCount || 9} items</Chip>
        </div>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{artifact.title || "Hair Ritual · launch week"}</div>
        <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 4 }}>{artifact.summary || "9 items · 5 channels · Apr 27 → May 3"}</div>
        <div style={{ fontSize: 11, color: "var(--accent-ink)", marginTop: 8, fontWeight: 500 }}>Open in canvas →</div>
      </button>
    );
  }

  if (t === "drafts") {
    return (
      <button onClick={() => onOpen({ kind: "drafts", data: artifact })}
        style={{
          display: "block", width: "100%", textAlign: "left",
          marginTop: 8, padding: 14, cursor: "pointer",
          background: "var(--paper)", border: "1px solid var(--rule-strong)", borderRadius: 6,
        }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <Icon name="edit" size={13}/>
          <span className="mono" style={{ fontSize: 10.5, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase" }}>{artifact.items.length} drafts ready</span>
        </div>
        {artifact.items.slice(0,2).map((d, i) => (
          <div key={i} style={{ fontSize: 12, lineHeight: 1.5, color: "var(--ink-2)", marginTop: i ? 6 : 0, paddingTop: i ? 6 : 0, borderTop: i ? "1px dashed var(--rule)" : 0 }}>{d.title}</div>
        ))}
        <div style={{ fontSize: 11, color: "var(--accent-ink)", marginTop: 8, fontWeight: 500 }}>Open all in canvas →</div>
      </button>
    );
  }

  if (t === "strategy") {
    const families = artifact.families || {};
    const colors = {
      "Organic social": "oklch(72% 0.08 80)",
      "Owned (email)":  "oklch(48% 0.04 80)",
      "Paid search":    "oklch(60% 0.13 240)",
      "Paid social":    "oklch(56% 0.16 25)",
    };
    const entries = Object.entries(families).filter(([,v]) => v > 0);
    return (
      <button onClick={() => onOpen({ kind: "strategy" })}
        style={{
          display: "block", width: "100%", textAlign: "left",
          marginTop: 8, padding: 14, cursor: "pointer",
          background: "var(--paper)", border: "1px solid var(--rule-strong)", borderRadius: 6,
        }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <Icon name="target" size={13}/>
          <span className="mono" style={{ fontSize: 10.5, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Channel strategy · recommendation</span>
          {artifact.version && <Chip tone="accent">v{artifact.version}</Chip>}
        </div>
        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>{artifact.title || "Recommended channel mix"}</div>
        <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 4, marginBottom: 10 }}>{artifact.summary}</div>
        <div style={{ display: "flex", height: 22, borderRadius: 3, overflow: "hidden", border: "1px solid var(--rule)" }}>
          {entries.map(([name, pct]) => (
            <div key={name} title={`${name} · ${pct}%`} style={{
              width: `${pct}%`, background: colors[name],
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "var(--paper)", fontSize: 10, fontWeight: 500,
            }}>{pct >= 12 ? `${pct}%` : ""}</div>
          ))}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 8 }}>
          {entries.map(([name, pct]) => (
            <div key={name} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10.5, color: "var(--muted-2)" }}>
              <span style={{ width: 8, height: 8, background: colors[name], borderRadius: 2 }}/>
              <span>{name} {pct}%</span>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11, color: "var(--accent-ink)", marginTop: 10, fontWeight: 500 }}>Open strategy in canvas →</div>
      </button>
    );
  }

  if (t === "draft_created") {
    return <DraftCreatedCard artifact={artifact} onOpen={onOpen}/>;
  }

  if (t === "metric") {
    return (
      <div style={{ marginTop: 8, padding: 14, background: "var(--paper)", border: "1px solid var(--rule-strong)", borderRadius: 6 }}>
        <div className="mono" style={{ fontSize: 10.5, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>{artifact.label}</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span className="serif" style={{ fontSize: 28, fontWeight: 500, letterSpacing: "-0.02em" }}>{artifact.value}</span>
          {artifact.delta && <span style={{ fontSize: 12, color: artifact.delta.startsWith("+") ? "var(--success)" : "oklch(48% 0.16 25)" }}>{artifact.delta}</span>}
        </div>
        <div style={{ fontSize: 11.5, color: "var(--ink-2)", marginTop: 6, lineHeight: 1.5 }}>{artifact.note}</div>
      </div>
    );
  }

  return null;
}

// ────────────────────────────── MESSAGE ROW ──────────────────────────────
function Message({ m, onOpen, onConfirm }) {
  const isUser   = m.kind === "user";
  const isSystem = m.kind === "system";
  return (
    <div style={{
      display: "flex", gap: 10, padding: "10px 18px",
      background: isSystem ? "var(--paper-2)" : "transparent",
      borderLeft: isSystem ? "2px solid var(--accent)" : "2px solid transparent",
    }}>
      {isUser
        ? <UserAvatar name={m.author}/>
        : <SpecialistAvatar id={(m.author || "supervisor").toLowerCase().replace(/\s+/g,"")}/>}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 3 }}>
          <span style={{ fontSize: 12.5, fontWeight: 500 }}>{m.author}</span>
          <span className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.04em" }}>{m.time}</span>
          {!isUser && !isSystem && <span className="mono" style={{ fontSize: 9.5, color: "var(--muted-2)", letterSpacing: "0.06em", textTransform: "uppercase" }}>· agent</span>}
          {isSystem && <Chip tone="accent">confirm</Chip>}
        </div>
        {m.text && <div style={{ fontSize: 13, lineHeight: 1.55, color: "var(--ink)", whiteSpace: "pre-wrap" }}>{m.text}</div>}
        {m.artifact && <ArtifactCard artifact={m.artifact} onOpen={onOpen}/>}
        {m.confirm && (
          <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
            <Btn size="sm" variant="primary" onClick={() => onConfirm(m, true)}><Icon name="check" size={11}/> {m.confirm.yes}</Btn>
            <Btn size="sm" variant="ghost" onClick={() => onConfirm(m, false)}>{m.confirm.no}</Btn>
          </div>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────── BRIEFING CARD ──────────────────────────────
function BriefingCard({ briefing, onAction }) {
  return (
    <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--rule)" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <SpecialistAvatar id="supervisor" size={32}/>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 500 }}>Supervisor</span>
            <span className="mono" style={{ fontSize: 10, color: "var(--muted)" }}>06:00 · auto</span>
            <Chip>morning briefing</Chip>
          </div>
          <div className="serif" style={{ fontSize: 22, lineHeight: 1.2, marginTop: 10, fontWeight: 500, letterSpacing: "-0.015em" }}>{briefing.greeting}</div>
          <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>{briefing.date}</div>

          <div style={{ marginTop: 16 }}>
            <div className="mono" style={{ fontSize: 10.5, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Overnight</div>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
              {briefing.overnight.map((o, i) => (
                <li key={i} style={{ display: "flex", gap: 8, fontSize: 12.5, lineHeight: 1.55, color: "var(--ink-2)" }}>
                  <span style={{ color: o.kind === "warn" ? "oklch(60% 0.16 60)" : "var(--success)", fontFamily: "var(--font-mono)", fontSize: 10, marginTop: 4 }}>
                    {o.kind === "warn" ? "▲" : "✓"}
                  </span>
                  <span>{o.text}</span>
                </li>
              ))}
            </ul>
          </div>

          <div style={{ marginTop: 16 }}>
            <div className="mono" style={{ fontSize: 10.5, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Needs you · {briefing.needsYou.length}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {briefing.needsYou.map(n => (
                <div key={n.id} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 12px", border: "1px solid var(--rule)",
                  borderRadius: 5, background: "var(--paper)",
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{n.title}</div>
                    <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>{n.sub}</div>
                  </div>
                  <Btn size="sm" variant="ghost" onClick={() => onAction(n)}>{n.action} <Icon name="arrow" size={11}/></Btn>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <div className="mono" style={{ fontSize: 10.5, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Or, I could…</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {briefing.suggestedMoves.map((s, i) => (
                <button key={i} onClick={() => onAction({ suggested: s })}
                  style={{
                    textAlign: "left", padding: "8px 12px",
                    border: "1px dashed var(--rule)", borderRadius: 4,
                    background: "transparent", cursor: "pointer",
                    fontSize: 12, color: "var(--ink-2)", fontFamily: "var(--font-sans)",
                  }}>
                  <span style={{ color: "var(--accent-ink)", marginRight: 6 }}>→</span>{s}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────── COMPOSER (multi-modal input) ───────────────────
function Composer({ onSend, channelName }) {
  const [val, setVal] = useStateChat("");
  const [recording, setRecording] = useStateChat(false);
  const [files, setFiles] = useStateChat([]);
  const taRef = useRefChat();

  useEffectChat(() => {
    const ta = taRef.current; if (!ta) return;
    ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 180) + "px";
  }, [val]);

  const send = () => {
    if (!val.trim() && !files.length) return;
    onSend({ text: val, files });
    setVal(""); setFiles([]);
  };

  const onPaste = (e) => {
    const url = e.clipboardData.getData("text");
    if (/^https?:\/\//.test(url)) {
      // Attach as URL chip after a tick
    }
  };

  return (
    <div style={{ borderTop: "1px solid var(--rule)", background: "var(--paper)", padding: 12 }}>
      {files.length > 0 && (
        <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
          {files.map((f, i) => (
            <div key={i} style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "4px 8px 4px 6px", border: "1px solid var(--rule)",
              borderRadius: 4, fontSize: 11.5, background: "var(--paper-2)",
            }}>
              <Icon name={f.kind === "url" ? "globe" : "edit"} size={11}/>
              <span>{f.label}</span>
              <button onClick={() => setFiles(files.filter((_,j) => j !== i))}
                style={{ background: "transparent", border: 0, cursor: "pointer", color: "var(--muted)", padding: 0, fontSize: 12 }}>×</button>
            </div>
          ))}
        </div>
      )}
      <div style={{
        display: "flex", gap: 8, alignItems: "flex-end",
        border: "1px solid var(--rule-strong)", borderRadius: 8,
        padding: "8px 10px", background: "var(--paper)",
      }}>
        <textarea ref={taRef}
          data-testid="composer-input"
          value={val}
          onChange={e => setVal(e.target.value)}
          onPaste={onPaste}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder={`Message ${channelName} — drag a file, paste a URL, or hold Space to talk`}
          rows={1}
          style={{
            flex: 1, border: 0, resize: "none", outline: "none",
            fontFamily: "var(--font-sans)", fontSize: 13, lineHeight: 1.55,
            background: "transparent", color: "var(--ink)",
            maxHeight: 180, padding: "4px 0",
          }}/>
        <div style={{ display: "flex", alignItems: "center", gap: 4, paddingBottom: 2 }}>
          <button onClick={() => setFiles([...files, { kind: "file", label: "brief-q3.pdf" }])}
            title="Attach file"
            style={btn}><Icon name="plus" size={14}/></button>
          <button onClick={() => setFiles([...files, { kind: "url", label: "mveda.co/products/hair-mist" }])}
            title="Attach URL"
            style={btn}><Icon name="globe" size={14}/></button>
          <button
            onMouseDown={() => setRecording(true)}
            onMouseUp={() => { setRecording(false); setVal(val + (val ? " " : "") + "[transcript: draft a soft launch teaser for the saffron restock]"); }}
            onMouseLeave={() => setRecording(false)}
            title="Hold to dictate"
            style={{ ...btn, background: recording ? "var(--accent)" : "transparent", color: recording ? "var(--accent-ink)" : "var(--ink)" }}>
            <Icon name="dot" size={14}/>
          </button>
        </div>
        <Btn size="sm" variant="primary" onClick={send} disabled={!val.trim() && !files.length}>
          Send <Icon name="arrow" size={11}/>
        </Btn>
      </div>
      <div className="mono" style={{ fontSize: 10, color: "var(--muted-2)", letterSpacing: "0.04em", marginTop: 6, textAlign: "center" }}>
        ⌘↵ send · ⇧↵ newline · paste any URL to ingest · {recording ? <span style={{ color: "var(--accent)" }}>● recording</span> : "hold mic to dictate"}
      </div>
    </div>
  );
}
const btn = {
  width: 26, height: 26, borderRadius: 4,
  border: 0, background: "transparent", cursor: "pointer",
  display: "grid", placeItems: "center", color: "var(--muted)",
};

Object.assign(window, { SpecialistAvatar, UserAvatar, ArtifactCard, Message, BriefingCard, Composer });
