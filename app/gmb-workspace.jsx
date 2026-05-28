/**
 * Google Business Profile Workspace
 * Panes: Posts · Reviews
 *
 * Posts: list + create (standard / event / offer)
 * Reviews: list + reply
 */

(function () {
  const useStateGmb    = React.useState;
  const useEffectGmb   = React.useEffect;
  const useCallbackGmb = React.useCallback;

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  function fmtDate(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  function StarRow({ rating }) {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <span key={i} style={{ color: i <= rating ? "oklch(75% 0.15 85)" : "var(--rule-strong)", fontSize: 14 }}>
          ★
        </span>
      );
    }
    return <span style={{ display: "inline-flex", gap: 1 }}>{stars}</span>;
  }

  // ─── Create Post Drawer ──────────────────────────────────────────────────────

  function CreatePostDrawer({ open, onClose, onCreate, loading }) {
    const [topicType, setTopicType] = useStateGmb("STANDARD");
    const [text, setText]           = useStateGmb("");
    const [ctaType, setCtaType]     = useStateGmb("");
    const [ctaUrl, setCtaUrl]       = useStateGmb("");
    const [eventTitle, setEventTitle] = useStateGmb("");
    const [eventStart, setEventStart] = useStateGmb("");
    const [eventEnd, setEventEnd]     = useStateGmb("");
    const [offerTitle, setOfferTitle] = useStateGmb("");
    const [offerCode, setOfferCode]   = useStateGmb("");

    if (!open) return null;

    const handleSubmit = (e) => {
      e.preventDefault();
      const payload = { text, topicType };
      if (ctaType && ctaUrl) payload.callToAction = { type: ctaType, url: ctaUrl };
      if (topicType === "EVENT" && eventTitle && eventStart) {
        payload.event = {
          title: eventTitle,
          schedule: {
            startDate: { year: new Date(eventStart).getFullYear(), month: new Date(eventStart).getMonth() + 1, day: new Date(eventStart).getDate() },
            startTime: { hours: new Date(eventStart).getHours(), minutes: new Date(eventStart).getMinutes(), seconds: 0, nanos: 0 },
          },
        };
        if (eventEnd) {
          payload.event.schedule.endDate = { year: new Date(eventEnd).getFullYear(), month: new Date(eventEnd).getMonth() + 1, day: new Date(eventEnd).getDate() };
          payload.event.schedule.endTime = { hours: new Date(eventEnd).getHours(), minutes: new Date(eventEnd).getMinutes(), seconds: 0, nanos: 0 };
        }
      }
      if (topicType === "OFFER" && offerTitle) {
        payload.offer = { title: offerTitle };
        if (offerCode) payload.offer.couponCode = offerCode;
      }
      onCreate(payload);
    };

    const CTA_OPTIONS = ["LEARN_MORE", "BOOK", "ORDER", "SHOP", "SIGN_UP", "CALL"];

    return (
      <div style={{
        position: "fixed", inset: 0, zIndex: 50,
        background: "rgba(0,0,0,0.35)",
        display: "flex", justifyContent: "flex-end",
      }} onClick={onClose}>
        <div style={{
          width: 420, height: "100%", background: "var(--paper)",
          borderLeft: "1px solid var(--rule)", display: "flex", flexDirection: "column",
        }} onClick={e => e.stopPropagation()}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--rule)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>Create GBP Post</span>
            <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "var(--muted)" }}>×</button>
          </div>
          <form onSubmit={handleSubmit} style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Type */}
            <div>
              <label style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>Post type</label>
              <div style={{ display: "flex", gap: 6 }}>
                {["STANDARD", "EVENT", "OFFER"].map(t => (
                  <button key={t} type="button" onClick={() => setTopicType(t)} style={{
                    padding: "5px 10px", borderRadius: 5, fontSize: 11.5, fontFamily: "inherit",
                    border: "1px solid " + (topicType === t ? "var(--ink)" : "var(--rule)"),
                    background: topicType === t ? "var(--ink)" : "var(--paper)",
                    color: topicType === t ? "var(--paper)" : "var(--ink-2)", cursor: "pointer",
                  }}>{t}</button>
                ))}
              </div>
            </div>

            {/* Text */}
            <div>
              <label style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>Text</label>
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                rows={4}
                required
                style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid var(--rule)", background: "var(--paper-2)", fontSize: 13, color: "var(--ink)", resize: "vertical", fontFamily: "inherit" }}
              />
            </div>

            {/* CTA */}
            <div>
              <label style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>Call to action (optional)</label>
              <select
                value={ctaType}
                onChange={e => setCtaType(e.target.value)}
                style={{ width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid var(--rule)", background: "var(--paper-2)", fontSize: 12, marginBottom: 6, fontFamily: "inherit", color: "var(--ink)" }}
              >
                <option value="">None</option>
                {CTA_OPTIONS.map(c => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
              </select>
              {ctaType && (
                <input
                  type="url"
                  value={ctaUrl}
                  onChange={e => setCtaUrl(e.target.value)}
                  placeholder="https://..."
                  required
                  style={{ width: "100%", padding: "6px 10px", borderRadius: 6, border: "1px solid var(--rule)", background: "var(--paper-2)", fontSize: 12, fontFamily: "inherit", color: "var(--ink)" }}
                />
              )}
            </div>

            {/* Event fields */}
            {topicType === "EVENT" && (
              <>
                <div>
                  <label style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>Event title</label>
                  <input value={eventTitle} onChange={e => setEventTitle(e.target.value)} required style={{ width: "100%", padding: "6px 10px", borderRadius: 6, border: "1px solid var(--rule)", background: "var(--paper-2)", fontSize: 12, fontFamily: "inherit", color: "var(--ink)" }} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>Start</label>
                    <input type="datetime-local" value={eventStart} onChange={e => setEventStart(e.target.value)} required style={{ width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid var(--rule)", background: "var(--paper-2)", fontSize: 12, fontFamily: "inherit", color: "var(--ink)" }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>End (opt)</label>
                    <input type="datetime-local" value={eventEnd} onChange={e => setEventEnd(e.target.value)} style={{ width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid var(--rule)", background: "var(--paper-2)", fontSize: 12, fontFamily: "inherit", color: "var(--ink)" }} />
                  </div>
                </div>
              </>
            )}

            {/* Offer fields */}
            {topicType === "OFFER" && (
              <>
                <div>
                  <label style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>Offer title</label>
                  <input value={offerTitle} onChange={e => setOfferTitle(e.target.value)} required style={{ width: "100%", padding: "6px 10px", borderRadius: 6, border: "1px solid var(--rule)", background: "var(--paper-2)", fontSize: 12, fontFamily: "inherit", color: "var(--ink)" }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>Coupon code (opt)</label>
                  <input value={offerCode} onChange={e => setOfferCode(e.target.value)} style={{ width: "100%", padding: "6px 10px", borderRadius: 6, border: "1px solid var(--rule)", background: "var(--paper-2)", fontSize: 12, fontFamily: "inherit", color: "var(--ink)" }} />
                </div>
              </>
            )}

            <div style={{ marginTop: "auto", paddingTop: 10 }}>
              <button type="submit" disabled={loading || !text.trim()} style={{
                width: "100%", padding: "9px 0", borderRadius: 7,
                background: loading || !text.trim() ? "var(--paper-2)" : "var(--accent)",
                color: loading || !text.trim() ? "var(--muted)" : "#fff",
                border: "none", fontSize: 13, fontWeight: 500, cursor: loading || !text.trim() ? "default" : "pointer",
              }}>
                {loading ? "Publishing…" : "Publish to GBP"}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // ─── Reply Drawer ────────────────────────────────────────────────────────────

  function ReplyDrawer({ review, open, onClose, onSend, loading }) {
    const [text, setText] = useStateGmb("");

    useEffectGmb(() => {
      if (open && review?.reviewReply?.comment) setText(review.reviewReply.comment);
      else if (open) setText("");
    }, [open, review]);

    if (!open || !review) return null;

    const handleSubmit = (e) => {
      e.preventDefault();
      if (!text.trim()) return;
      onSend(review.id, text.trim());
    };

    return (
      <div style={{
        position: "fixed", inset: 0, zIndex: 50,
        background: "rgba(0,0,0,0.35)",
        display: "flex", justifyContent: "flex-end",
      }} onClick={onClose}>
        <div style={{
          width: 400, height: "100%", background: "var(--paper)",
          borderLeft: "1px solid var(--rule)", display: "flex", flexDirection: "column",
        }} onClick={e => e.stopPropagation()}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--rule)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>Reply to Review</span>
            <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "var(--muted)" }}>×</button>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
            <div style={{ background: "var(--paper-2)", border: "1px solid var(--rule)", borderRadius: 8, padding: 12, marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 500 }}>{review.reviewer?.displayName || "Anonymous"}</span>
                <StarRow rating={review.rating || 0} />
              </div>
              <div style={{ fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.55 }}>{review.comment}</div>
              <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 6 }}>{fmtDate(review.createTime)}</div>
            </div>
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                rows={5}
                placeholder="Write your reply…"
                required
                style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid var(--rule)", background: "var(--paper-2)", fontSize: 13, color: "var(--ink)", resize: "vertical", fontFamily: "inherit" }}
              />
              <button type="submit" disabled={loading || !text.trim()} style={{
                padding: "8px 0", borderRadius: 7,
                background: loading || !text.trim() ? "var(--paper-2)" : "var(--accent)",
                color: loading || !text.trim() ? "var(--muted)" : "#fff",
                border: "none", fontSize: 13, fontWeight: 500, cursor: loading || !text.trim() ? "default" : "pointer",
              }}>
                {loading ? "Sending…" : review.reviewReply ? "Update Reply" : "Send Reply"}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ─── Main Workspace ──────────────────────────────────────────────────────────

  function GmbWorkspace({ state, actions }) {
    const tenantId = state?.auth?.user?.id || state?.tenantId || null;
    const sb = window.sb;

    const [tab, setTab]               = useStateGmb("posts");
    const [connected, setConnected]   = useStateGmb(false);
    const [locationName, setLocationName] = useStateGmb(null);
    const [reviews, setReviews]       = useStateGmb([]);
    const [posts, setPosts]           = useStateGmb([]);
    const [loading, setLoading]       = useStateGmb(false);
    const [actionLoading, setActionLoading] = useStateGmb(false);
    const [error, setError]           = useStateGmb(null);
    const [drawerOpen, setDrawerOpen] = useStateGmb(false);
    const [replyReview, setReplyReview] = useStateGmb(null);
    const [avgRating, setAvgRating]   = useStateGmb(null);
    const [totalReviews, setTotalReviews] = useStateGmb(0);

    // Check connection + fetch data
    const loadAll = useCallbackGmb(async () => {
      if (!tenantId || !sb) return;
      setLoading(true);
      setError(null);
      try {
        const { data: channels } = await sb.from("channels")
          .select("platform, account_handle")
          .eq("user_id", tenantId)
          .eq("status", "connected")
          .eq("platform", "gbusiness");

        const isConn = Array.isArray(channels) && channels.length > 0;
        setConnected(isConn);
        if (channels?.[0]?.account_handle) setLocationName(channels[0].account_handle);

        if (!isConn) { setLoading(false); return; }

        const [revRes, postRes] = await Promise.all([
          apiFetch("/api/zernio-platform", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "list_reviews", pageSize: 50 }),
          }),
          apiFetch("/api/zernio-platform", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "list_posts", platform: "googlebusiness", limit: 50 }),
          }),
        ]);

        const revData = await revRes.json().catch(() => ({}));
        const postData = await postRes.json().catch(() => ({}));

        if (revData.ok && revData.data) {
          setReviews(revData.data.reviews || []);
          setAvgRating(revData.data.averageRating ?? null);
          setTotalReviews(revData.data.totalReviewCount || 0);
        }
        if (postData.ok && postData.data) {
          setPosts(postData.data.posts || postData.data.items || []);
        }
      } catch (e) {
        setError(e.message || "Failed to load GBP data");
      } finally {
        setLoading(false);
      }
    }, [tenantId, sb]);

    useEffectGmb(() => { loadAll(); }, [loadAll]);

    async function handleCreatePost(payload) {
      setActionLoading(true);
      setError(null);
      try {
        const res = await apiFetch("/api/zernio-platform", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "create_post", ...payload }),
        });
        const data = await res.json();
        if (data.ok) {
          setDrawerOpen(false);
          await loadAll();
        } else {
          setError(data.error || "Publish failed");
        }
      } catch (e) {
        setError(e.message || "Network error");
      } finally {
        setActionLoading(false);
      }
    }

    async function handleReply(reviewId, reply) {
      setActionLoading(true);
      setError(null);
      try {
        const res = await apiFetch("/api/zernio-platform", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "reply_to_review", reviewId, reply }),
        });
        const data = await res.json();
        if (data.ok) {
          setReplyReview(null);
          await loadAll();
        } else {
          setError(data.error || "Reply failed");
        }
      } catch (e) {
        setError(e.message || "Network error");
      } finally {
        setActionLoading(false);
      }
    }

    // ─── Render ────────────────────────────────────────────────────────────────

    return (
      <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "var(--paper-2)" }}>
        {/* Top bar */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 20px", background: "var(--paper)", borderBottom: "1px solid var(--rule)",
          flexShrink: 0, gap: 12,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontWeight: 600, fontSize: 14, color: "var(--ink)" }}>
              🗺️ Google Business {locationName ? "· " + locationName : ""}
            </span>
            {!connected && (
              <span style={{ fontSize: 11, color: "oklch(55% 0.16 25)" }}>Not connected</span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={loadAll} disabled={loading} style={{
              padding: "5px 12px", borderRadius: 6, border: "1px solid var(--rule)",
              background: "var(--paper-2)", fontSize: 11.5, color: "var(--muted)", cursor: "pointer",
            }}>{loading ? "Loading…" : "↻ Refresh"}</button>
            {connected && (
              <button onClick={() => setDrawerOpen(true)} style={{
                padding: "5px 12px", borderRadius: 6, border: "none",
                background: "var(--accent)", color: "#fff", fontSize: 11.5, fontWeight: 500, cursor: "pointer",
              }}>+ New Post</button>
            )}
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div style={{
            background: "#FEF2F2", borderBottom: "1px solid #FECACA",
            padding: "8px 20px", fontSize: 13, color: "#DC2626",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            {error}
            <button onClick={() => setError(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#DC2626", fontSize: 16 }}>×</button>
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: "flex", gap: 2, padding: "10px 20px 0", borderBottom: "1px solid var(--rule)", background: "var(--paper)" }}>
          {[["posts", "Posts"], ["reviews", "Reviews"]].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} style={{
              padding: "8px 14px", fontSize: 12.5, background: "transparent", border: "none",
              borderBottom: tab === k ? "2px solid var(--ink)" : "2px solid transparent",
              color: tab === k ? "var(--ink)" : "var(--muted)", cursor: "pointer", fontFamily: "var(--font-sans)",
            }}>{l}</button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px 40px" }}>
          {!connected ? (
            <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--muted)" }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🗺️</div>
              <div style={{ fontSize: 14, fontWeight: 500, color: "var(--ink)", marginBottom: 6 }}>Google Business Profile not connected</div>
              <div style={{ fontSize: 13, maxWidth: 320, margin: "0 auto", lineHeight: 1.6 }}>
                Go to Settings → Connections to link your GBP account. Posts and reviews will appear here.
              </div>
            </div>
          ) : tab === "posts" ? (
            <PostsPane posts={posts} loading={loading} />
          ) : (
            <ReviewsPane
              reviews={reviews}
              avgRating={avgRating}
              totalReviews={totalReviews}
              loading={loading}
              onReply={r => setReplyReview(r)}
            />
          )}
        </div>

        {/* Drawers */}
        <CreatePostDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          onCreate={handleCreatePost}
          loading={actionLoading}
        />
        <ReplyDrawer
          review={replyReview}
          open={!!replyReview}
          onClose={() => setReplyReview(null)}
          onSend={handleReply}
          loading={actionLoading}
        />
      </div>
    );
  }

  // ─── Posts Pane ──────────────────────────────────────────────────────────────

  function PostsPane({ posts, loading }) {
    if (loading) return <div style={{ textAlign: "center", padding: 40, color: "var(--muted)" }}>Loading posts…</div>;
    if (!posts || posts.length === 0) {
      return (
        <div style={{ textAlign: "center", padding: "50px 20px", color: "var(--muted)" }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: "var(--ink)", marginBottom: 6 }}>No posts yet</div>
          <div style={{ fontSize: 12.5 }}>Click "New Post" to publish your first update to Google Business.</div>
        </div>
      );
    }

    const TOPIC_LABELS = { STANDARD: "Update", EVENT: "Event", OFFER: "Offer" };

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {posts.map((p, i) => (
          <div key={p.id || i} style={{
            background: "var(--paper)", border: "1px solid var(--rule)",
            borderRadius: 8, padding: "12px 16px",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{
                  fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em",
                  padding: "2px 6px", borderRadius: 4,
                  background: p.topicType === "EVENT" ? "oklch(92% 0.04 240)" : p.topicType === "OFFER" ? "oklch(92% 0.06 25)" : "var(--paper-2)",
                  color: p.topicType === "EVENT" ? "oklch(45% 0.12 240)" : p.topicType === "OFFER" ? "oklch(45% 0.14 25)" : "var(--muted)",
                }}>
                  {TOPIC_LABELS[p.topicType] || "Update"}
                </span>
                <span style={{ fontSize: 11, color: "var(--muted)" }}>{fmtDate(p.publishedAt || p.createdAt)}</span>
              </div>
              <span style={{ fontSize: 11, color: p.status === "published" ? "oklch(55% 0.15 145)" : "var(--muted)" }}>
                {p.status || "published"}
              </span>
            </div>
            <div style={{ fontSize: 13, color: "var(--ink)", lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
              {p.text || p.content}
            </div>
            {p.callToAction && (
              <div style={{ marginTop: 8, fontSize: 11, color: "var(--accent-ink)" }}>
                CTA: {p.callToAction.type.replace(/_/g, " ")} → {p.callToAction.url}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  // ─── Reviews Pane ────────────────────────────────────────────────────────────

  function ReviewsPane({ reviews, avgRating, totalReviews, loading, onReply }) {
    if (loading) return <div style={{ textAlign: "center", padding: 40, color: "var(--muted)" }}>Loading reviews…</div>;
    if (!reviews || reviews.length === 0) {
      return (
        <div style={{ textAlign: "center", padding: "50px 20px", color: "var(--muted)" }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: "var(--ink)", marginBottom: 6 }}>No reviews yet</div>
          <div style={{ fontSize: 12.5 }}>Reviews will appear here once customers leave them on your Google Business Profile.</div>
        </div>
      );
    }

    return (
      <div>
        {/* Summary strip */}
        <div style={{
          display: "flex", alignItems: "center", gap: 16,
          background: "var(--paper)", border: "1px solid var(--rule)",
          borderRadius: 8, padding: "12px 16px", marginBottom: 14,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 22, fontWeight: 600, fontFamily: "JetBrains Mono, monospace" }}>{avgRating?.toFixed(1) || "—"}</span>
            <StarRow rating={Math.round(avgRating || 0)} />
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>
            {totalReviews.toLocaleString()} review{totalReviews !== 1 ? "s" : ""}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {reviews.map((r, i) => (
            <div key={r.id || i} style={{
              background: "var(--paper)", border: "1px solid var(--rule)",
              borderRadius: 8, padding: "12px 16px",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{r.reviewer?.displayName || "Anonymous"}</span>
                  <StarRow rating={r.rating || 0} />
                </div>
                <span style={{ fontSize: 11, color: "var(--muted)" }}>{fmtDate(r.createTime)}</span>
              </div>
              <div style={{ fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.55, marginBottom: 8 }}>
                {r.comment}
              </div>
              {r.reviewReply ? (
                <div style={{
                  background: "var(--paper-2)", border: "1px solid var(--rule)",
                  borderRadius: 6, padding: "8px 10px", marginBottom: 8,
                }}>
                  <div style={{ fontSize: 10.5, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 }}>Your reply</div>
                  <div style={{ fontSize: 12, color: "var(--ink)", lineHeight: 1.5 }}>{r.reviewReply.comment}</div>
                </div>
              ) : null}
              <button onClick={() => onReply(r)} style={{
                padding: "4px 10px", borderRadius: 5, border: "1px solid var(--rule)",
                background: "transparent", fontSize: 11.5, color: "var(--muted)", cursor: "pointer",
              }}>
                {r.reviewReply ? "Edit Reply" : "Reply"}
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  Object.assign(window, { GmbWorkspace });
})();
