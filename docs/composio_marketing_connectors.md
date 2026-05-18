# Marketing Connector Coverage

Recommended connector per platform, prioritised: **Composio** → **Pipedream** → **Direct API**.

`Wired` reflects end-to-end verification against the live provider as of 2026-05-17 (Composio managed-OAuth, Composio API-key via `use_custom_auth + authScheme:"API_KEY"`, and Pipedream Connect via `/v1/connect/{project_id}/tokens`). Blank = needs work (custom OAuth app config in the provider's dashboard, or not-yet-wired Direct API route). See `flowOS/CLAUDE.md` for the per-toolkit state table.

| Category | Platform | Connector Type | Wired |
|----------|----------|----------------|-------|
| Paid Search | Google Ads | Composio (also covers YouTube Ads via VIDEO campaign type) | Yes |
| Paid Search | Microsoft Ads | Direct API (OAuth 2.0, Azure AD) | |
| Paid Audio | Spotify Ads | Direct API (OAuth 2.0) — requires Ads Manager account | |
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
| Email Marketing | MailerLite | Composio | Yes |
| Email Marketing | Loops.so | Direct API (not in Composio's catalog — was reclassified) | |
| Email Marketing | Moosend | Composio | Yes |
| Email Marketing | SendGrid | Pipedream | Yes |
| Email Marketing | ActiveCampaign | Pipedream | Yes |
| Email Marketing | Hunter | Composio | Yes |
| SMS Marketing | Klaviyo SMS | Composio | Yes |
| SMS Marketing | Attentive | Direct API (OAuth 2.0) | |
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
| E-commerce | WordPress | Direct API (not in Pipedream's catalog — reclassified) | |
| A/B Testing | AB Tasty | Direct API (OAuth 2.0) | |
| A/B Testing | Optimizely | Direct API (Bearer token) | |
| A/B Testing | VWO | Direct API (API key) | |
| AI Video / Image | HeyGen | Composio | Yes |
| AI Video / Image | Replicate | Direct API (API key) | Yes |
| AI Video / Image | RunWare.ai | Pipedream | Yes |
| AI Video / Image | Higgsfield.ai | Direct API (API key) | Yes |
| AI Video / Image | Luma AI | Direct API (API key) | Yes |
| AI Audio / Voice | ElevenLabs | Composio | Yes |
| AI Audio / Voice | AudioStack | Direct API (API key) — end-to-end audio ad production | |
| Analytics | Google Analytics | Composio | Yes |
| CRM & Marketing Ops | HubSpot | Composio | Yes |
| CRM & Marketing Ops | Salesforce | Composio | Yes |

## Summary (2026-05-18)

- **35 of 49** connectors wired end-to-end (26 Composio + 6 Pipedream + 3 Direct: Replicate, Higgsfield, Luma).
- **5 Composio toolkits need a custom OAuth app configured in the Composio dashboard**: Shopify, TikTok (Ads + Organic), Twitter/X (Ads + Organic). Composio recognises these toolkits but doesn't ship managed credentials.
- **9 Direct API connectors** remain (Microsoft Ads, Spotify Ads, Attentive, AB Tasty, Optimizely, VWO, AudioStack, Loops.so, WordPress) — same `/api/<provider>` pattern, shared `connector_credentials` persistence.
- WooCommerce was dropped (49 total, down from 50).
