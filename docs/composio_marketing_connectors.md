# Marketing Connector Coverage

Recommended connector per platform, prioritised: **Composio** → **Pipedream** → **Direct API**.

`Wired` reflects end-to-end verification against the live provider as of 2026-05-17 (Composio managed-OAuth, Composio API-key via `use_custom_auth + authScheme:"API_KEY"`, and Pipedream Connect via `/v1/connect/{project_id}/tokens`). Blank = needs work (custom OAuth app config in the provider's dashboard, or not-yet-wired Direct API route). See `flowOS/CLAUDE.md` for the per-toolkit state table.

| Category | Platform | Connector Type | Wired |
|----------|----------|----------------|-------|
| Paid Search | Google Ads | Composio (also covers YouTube Ads via VIDEO campaign type) | Yes |
| Paid Audio | Spotify Ads | Manual handoff — FlowOS generates creative, user uploads to Ad Studio (no public API) | Yes (manual) |
| Paid Social | Meta Ads (Facebook/Instagram) | Composio | Yes |
| Paid Social | LinkedIn Ads | Composio | Yes |
| Paid Social | TikTok Ads | Composio | |
| Paid Social | Twitter/X Ads | Composio | |
| Paid Social | Pinterest Ads | Pipedream | Yes |
| Organic Social | Facebook | Composio | Yes |
| Organic Social | Instagram | Composio | Yes |
| Organic Social | LinkedIn | Composio | Yes |
| Organic Social | Twitter/X | Composio | |
| Organic Social | TikTok | Composio | |
| Organic Social | Pinterest | Pipedream | Yes |
| Organic Social | Reddit | Composio | Yes |
| Organic Social | YouTube | Composio | Yes |
| Email Marketing | Mailchimp | Composio | Yes |
| Email Marketing | Klaviyo | Composio | Yes |
| Email Marketing | SendGrid | Pipedream | Yes |
| SMS Marketing | Klaviyo SMS | Composio | Yes |
| SMS Marketing | Twilio | Pipedream | Yes |
| Email Verification | NeverBounce | Composio | Yes |
| Email Verification | Kickbox | Composio | Yes |
| Email Verification | Listclean | Composio | Yes |
| SEO & Search | Google Search Console | Composio | Yes |
| SEO & Search | Ahrefs | Composio | Yes |
| SEO & Search | Moz | Composio | Yes |
| SEO & Search | Neuronwriter | Composio | Yes |
| E-commerce | Shopify | Composio | |
| E-commerce | WooCommerce | ~~Pipedream~~ — dropped (not in Pipedream's catalog; out of product scope) | |
| E-commerce | WordPress | Direct API (Application Password — site URL + username + app password) | Yes |
| A/B Testing | Optimizely | Direct API (Bearer token) | Yes |
| AI Video / Image | HeyGen | Composio | Yes |
| AI Video / Image | Replicate | Direct API (API key) | Yes |
| AI Video / Image | RunWare.ai | Pipedream | Yes |
| AI Video / Image | Higgsfield.ai | Direct API (API key) | Yes |
| AI Video / Image | Luma AI | Direct API (API key) | Yes |
| AI Audio / Voice | ElevenLabs | Composio | Yes |
| AI Audio / Voice | AudioStack | Direct API (API key) — end-to-end audio ad production | Yes |
| Analytics | Google Analytics | Composio | Yes |
| CRM & Marketing Ops | HubSpot | Composio | Yes |
| CRM & Marketing Ops | Salesforce | Composio | Yes |

## Summary (2026-05-18)

- **40 of 40** connectors wired end-to-end (23 Composio + 5 Pipedream + 6 Direct + 1 Manual: Spotify Ads).
- **5 Composio toolkits need a custom OAuth app configured in the Composio dashboard**: Shopify, TikTok (Ads + Organic), Twitter/X (Ads + Organic). Composio recognises these toolkits but doesn't ship managed credentials.
- **Spotify Ads = Manual handoff**: Spotify Ad Studio has no public API and the partner-only Marketing API requires a signed agreement. Reframed as `auth: "Manual"` — FlowOS generates the creative (script via Claude, audio via AudioStack / ElevenLabs), user uploads to adstudio.spotify.com themselves. Tile flips to "in use" without any backend call. Documented in [CLAUDE.md](../CLAUDE.md) under Manual / creative-handoff connectors.
- WooCommerce dropped post-verification. VWO, AB Tasty, and Loops.so dropped 2026-05-18 (scope cut — Optimizely covers A/B Testing alone). MailerLite, Moosend, ActiveCampaign, Hunter, and Attentive dropped 2026-05-18 (scope cut — Klaviyo + Mailchimp + SendGrid cover email; Klaviyo SMS covers SMS marketing; Twilio retained for transactional/dev-side messaging). Microsoft Ads dropped 2026-05-18 (scope cut — not a priority channel; Bing/Audience Network spend not material for the brands in scope). 40 total, down from 50.
