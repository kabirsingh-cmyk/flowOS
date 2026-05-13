// MVEDA demo seed — Ayurvedic skincare brand (real)

// Single source of truth for MVEDA brand values (referenced in brandPresets and brandValues)
const MVEDA_VALUES = [
  "5,000 years of Ayurveda, made modern",
  "Ritual over routine",
  "Quiet luxury — never demanding attention",
  "Plant-led, cold-pressed, small batch",
];

const SEED = {
  brand: {
    name: "MVEDA",
    category: "Ayurvedic skincare · luxury body & hair care",
    tagline: "Experience the ritual.",
    url: "https://mveda.co",
    story: "Five thousand years of Indian Ayurvedic tradition, made into a daily ritual. Named for Mitha and Ayurveda.",
  },
  user: { name: "Priya Khanna", role: "Marketing Operator" },
  today: "Saturday · 25 April 2026",

  // Brand presets — what the import flow can produce
  brandPresets: {
    mveda: {
      id: "mveda",
      name: "MVEDA",
      url: "mveda.co",
      palette: {
        accent:      { l: 58, c: 0.13, h: 60 },   // saffron
        secondary:   { l: 38, c: 0.06, h: 40 },   // oud
        bg:          { l: 96, c: 0.012, h: 70 },  // ivory
        bgAlt:       { l: 92, c: 0.018, h: 70 },  // sandstone
        ink:         { l: 22, c: 0.025, h: 50 },  // deep brown
      },
      fonts: { display: "Cormorant Garamond", body: "Jost", mono: "JetBrains Mono" },
      voice: "Ritualistic, opulent, quietly confident · 'Daily, until it becomes yours.'",
      values: MVEDA_VALUES,
      claims: [
        "Cold-pressed extraction · single source",
        "Ayurvedic tradition · 5,000 years documented",
        "No synthetic fragrance · no parabens",
        "Hand-poured small batches · India",
        "Gold-rated for sensitive skin (own panel · n=42)",
        "Free U.S. shipping over $50",
      ],
      prohibitedTopics: ["medical claims", "competitor by name", "weight loss", "religion", "specific dermatology advice"],
      // Connectors the AI recommends based on brand type (DTC skincare · visual + social commerce)
      recommendedConnectors: [
        "ig", "tt", "pn", "threads",                     // organic social
        "metaads", "pinads",                              // paid social
        "shopify", "klaviyo", "klaviyo_sms",              // commerce + email
        "ga4", "heygen", "runware",                       // analytics + creative AI
      ],
    },
    erickson: {
      id: "erickson",
      name: "Erickson Commercial Refrigeration",
      url: "ericksonrefrigeration.com",
      industry: "Commercial Refrigeration & HVAC · B2B",
      location: "Seattle, WA  ·  Auburn, WA  ·  Lynnwood, WA",
      serviceArea: "Washington · Oregon · Idaho",
      founded: "1977",
      palette: {
        accent:    { l: 42, c: 0.18, h: 250 },
        secondary: { l: 55, c: 0.20, h: 30  },
        bg:        { l: 97, c: 0.005, h: 240 },
        bgAlt:     { l: 93, c: 0.008, h: 240 },
        ink:       { l: 18, c: 0.02,  h: 240 },
      },
      fonts: { display: "Inter", body: "Inter", mono: "JetBrains Mono" },
      voice: "Reliable, expert, no-nonsense · 'When you call us, we know your priority is to get back to work. We've got your back, 24/7.'",
      values: [
        "Locally owned & operated since 1977",
        "Union-certified technicians — UA Local 32",
        "24/7 emergency response — we answer every call",
        "Full-service contracts tailored to your operation",
      ],
      claims: [
        "EPA universally certified",
        "Seattle refrigeration licensed",
        "Union labor — UA Local 32",
        "24/7 emergency service across WA, OR & ID",
        "Service contracts tailored to customer requirements",
        "Support for all major commercial brands (Manitowoc, Trane, Daikin & more)",
        "Clients include Museum of Pop Culture, Panda Express, O'Brien Auto Group",
      ],
      prohibitedTopics: ["residential framing", "competitor by name", "guaranteed energy savings without testing", "medical claims"],
      // Connectors for a B2B commercial services company (Seattle market)
      recommendedConnectors: [
        "googleads", "ga4", "gsc",          // search is primary — commercial refrigeration repair queries
        "liads", "li",                       // LinkedIn for facility managers & commercial decision-makers
        "metaads", "fb",                     // Facebook for local B2B awareness + remarketing
        "klaviyo", "klaviyo_sms",            // service contract renewals + seasonal maintenance reminders
        "yt",                                // YouTube how-to content (build trust, SEO)
        "yelp", "semrush",                  // Yelp reviews critical for restaurants choosing a vendor
      ],
    },
  },
  brandImported: false, // toggled by the import flow

  // Connectors — what the user can connect via API
  // Social platforms connect directly via Composio managed OAuth
  connectorCatalog: [
    // ── Social ───────────────────────────────────────────────────────────────
    { id: "ig",        category: "Social",     name: "Instagram",        desc: "Posts, Reels, Stories",                                            auth: "OAuth",    icon: "ig" },
    { id: "tt",        category: "Social",     name: "TikTok",           desc: "Videos, Photo mode",                                               auth: "OAuth",    icon: "tt" },
    { id: "fb",        category: "Social",     name: "Facebook",         desc: "Pages & posts",                                                    auth: "OAuth",    icon: "fb" },
    { id: "li",        category: "Social",     name: "LinkedIn",         desc: "Company posts, articles",                                          auth: "OAuth",    icon: "li" },
    { id: "yt",        category: "Social",     name: "YouTube",          desc: "Shorts & long-form video",                                         auth: "OAuth",    icon: "yt" },
    { id: "pn",        category: "Social",     name: "Pinterest",        desc: "Pins & boards",                                                    auth: "OAuth",    icon: "pn"      },
    { id: "x",         category: "Social",     name: "X",                desc: "Posts & Spaces",                                                   auth: "OAuth",    icon: "x"       },
    { id: "threads",   category: "Social",     name: "Threads",          desc: "Text & media posts · Meta's open social layer",                    auth: "OAuth",    icon: "threads" },
    { id: "reddit",    category: "Social",     name: "Reddit",           desc: "Subreddit posts & communities",                                    auth: "OAuth",    icon: "reddit"  },
    { id: "snap",      category: "Social",     name: "Snapchat",         desc: "Spotlight + Story posts",                                          auth: "OAuth",    icon: "snap"    },
    { id: "bluesky",   category: "Social",     name: "Bluesky",          desc: "Open AT Protocol social",                                          auth: "OAuth",    icon: "bsky"    },
    { id: "mastodon",  category: "Social",     name: "Mastodon",         desc: "Federated open social",                                            auth: "OAuth",    icon: "mst"     },
    { id: "telegram",  category: "Social",     name: "Telegram",         desc: "Channel posts & broadcasts",                                       auth: "OAuth",    icon: "tg"      },

    // ── Email ────────────────────────────────────────────────────────────────
    { id: "klaviyo",   category: "Email",      name: "Klaviyo",          desc: "Lists, flows, campaigns, segmentation",                            auth: "API key", icon: "kl" },
    { id: "mailchimp", category: "Email",      name: "Mailchimp",        desc: "Audiences, automations, A/B tests",                                auth: "API key", icon: "mc" },

    // ── SMS ──────────────────────────────────────────────────────────────────
    { id: "klaviyo_sms", category: "SMS",      name: "Klaviyo SMS",      desc: "TCPA consent, MMS, automations · same API key as Klaviyo",         auth: "API key", icon: "kl" },
    { id: "attentive",   category: "SMS",      name: "Attentive",        desc: "Conversational SMS · enterprise & SMB",                            auth: "API key", icon: "at" },

    // ── Search Ads ───────────────────────────────────────────────────────────
    { id: "googleads", category: "Search Ads", name: "Google Ads",       desc: "Search, Performance Max, Display, YouTube",                        auth: "OAuth",   icon: "g"  },
    { id: "msads",     category: "Search Ads", name: "Microsoft Ads",    desc: "Bing, Edge, Yahoo · Search + Audience",                            auth: "OAuth",   icon: "ms" },
    { id: "amazonads", category: "Search Ads", name: "Amazon Ads",       desc: "Sponsored Products + Brands · search-intent",                      auth: "OAuth",   icon: "az" },

    // ── Social Ads ───────────────────────────────────────────────────────────
    { id: "metaads",   category: "Social Ads", name: "Meta Ads",         desc: "Facebook + IG paid · Advantage+",                                  auth: "OAuth",   icon: "m"  },
    { id: "ttads",     category: "Social Ads", name: "TikTok Ads",       desc: "Spark Ads, paid creator content",                                  auth: "OAuth",   icon: "ta" },
    { id: "liads",     category: "Social Ads", name: "LinkedIn Ads",     desc: "Sponsored content · B2B",                                          auth: "OAuth",   icon: "lia"},
    { id: "pinads",    category: "Social Ads", name: "Pinterest Ads",    desc: "Promoted pins · discovery intent",                                  auth: "OAuth",   icon: "pa" },

    // ── Commerce ─────────────────────────────────────────────────────────────
    { id: "shopify",   category: "Commerce",   name: "Shopify",          desc: "Products, inventory, orders, customers",                           auth: "OAuth",   icon: "sh" },

    // ── Reviews & Local ──────────────────────────────────────────────────────
    { id: "yelp",      category: "Reviews & Local", name: "Yelp",        desc: "Business reviews, ratings, local search presence & reputation",    auth: "API key", icon: "yelp" },

    // ── Analytics ────────────────────────────────────────────────────────────
    { id: "ga4",       category: "Analytics",  name: "Google Analytics", desc: "GA4 · acquisition, behavior, conversion",                          auth: "OAuth",   icon: "ga" },
    { id: "amplitude", category: "Analytics",  name: "Amplitude",        desc: "Product analytics · funnels, cohorts, retention",                  auth: "API key", icon: "am" },

    // ── SEO ──────────────────────────────────────────────────────────────────
    { id: "ahrefs",    category: "SEO",        name: "Ahrefs",           desc: "Keyword ranks, backlinks, site audit",                             auth: "API key", icon: "ah" },
    { id: "semrush",   category: "SEO",        name: "Semrush",          desc: "Keyword tracking, content gap, competitor intel",                  auth: "API key", icon: "sr" },
    { id: "gsc",       category: "SEO",        name: "Search Console",   desc: "Google · impressions, CTR, indexing status",                       auth: "OAuth",   icon: "gs" },

    // ── Affiliate ────────────────────────────────────────────────────────────
    { id: "refersion", category: "Affiliate",  name: "Refersion",        desc: "Affiliate links, payouts, commission tiers",                       auth: "API key", icon: "rf" },
    { id: "impact",    category: "Affiliate",  name: "Impact",           desc: "Partner network · enterprise affiliate",                           auth: "API key", icon: "im" },

    // ── Experimentation ──────────────────────────────────────────────────────
    { id: "growthbook", category: "Experimentation", name: "GrowthBook", desc: "Open-source A/B tests + feature flags · free cloud tier",          auth: "API key", icon: "gb" },

    // ── Creative AI ──────────────────────────────────────────────────────────
    { id: "runware",    category: "Creative AI", name: "Runware",        desc: "Ultra-fast image gen · SDXL & Flux models",                        auth: "API key", icon: "runware"    },
    { id: "heygen",     category: "Creative AI", name: "HeyGen",         desc: "AI avatar videos · UGC personas, voiceover",                       auth: "API key", icon: "heygen"     },
    { id: "luma",       category: "Creative AI", name: "Luma AI",        desc: "Dream Machine · photorealistic video gen",                         auth: "API key", icon: "luma"       },
    { id: "elevenlabs", category: "Creative AI", name: "ElevenLabs",     desc: "Voice cloning · narration, ads, captions",                         auth: "API key", icon: "elevenlabs" },
    { id: "runway",     category: "Creative AI", name: "Runway",         desc: "Gen-4 video generation · inpainting",                              auth: "API key", icon: "runway"     },

    // ── MCP · Custom ─────────────────────────────────────────────────────────
    { id: "mcp_runware",  category: "MCP · Custom", name: "Runware MCP",  desc: "Image gen via Model Context Protocol",                            auth: "MCP",     icon: "runware"    },
    { id: "mcp_heygen",   category: "MCP · Custom", name: "HeyGen MCP",   desc: "Avatar video generation via MCP",                                auth: "MCP",     icon: "heygen"     },
    { id: "mcp_shopify",  category: "MCP · Custom", name: "Shopify MCP",  desc: "Products, orders, inventory via MCP",                            auth: "MCP",     icon: "shopify"    },
    { id: "mcp_klaviyo",  category: "MCP · Custom", name: "Klaviyo MCP",  desc: "Email & SMS flows, lists via MCP",                               auth: "MCP",     icon: "klaviyo"    },
    { id: "mcp_custom",   category: "MCP · Custom", name: "Custom MCP",   desc: "Connect any MCP-compatible server by URL",                       auth: "MCP",     icon: "mcp"        },
  ],
  connectorState: {
    // Social
    ig:        { connected: true,  status: "ok",   note: "synced 2m ago · @mvedaskincare",    syncCount: "1,284 posts" },
    tt:        { connected: true,  status: "ok",   note: "synced 1m ago · @mveda",            syncCount: "412 videos" },
    fb:        { connected: true,  status: "warn", note: "rate limited · retry 14:02",         syncCount: "904 posts" },
    li:        { connected: true,  status: "ok",   note: "synced 4m ago",                     syncCount: "126 posts" },
    yt:        { connected: true,  status: "ok",   note: "synced 8m ago · @mveda-co",         syncCount: "38 videos" },
    pn:        { connected: false, status: "—",    note: "not connected",  syncCount: "—" },
    x:         { connected: false, status: "—",    note: "not connected",  syncCount: "—" },
    threads:   { connected: false, status: "—",    note: "not connected",  syncCount: "—" },
    reddit:    { connected: false, status: "—",    note: "not connected",  syncCount: "—" },
    snap:      { connected: false, status: "—",    note: "not connected",  syncCount: "—" },
    bluesky:   { connected: false, status: "—",    note: "not connected",  syncCount: "—" },
    mastodon:  { connected: false, status: "—",    note: "not connected",  syncCount: "—" },
    telegram:  { connected: false, status: "—",    note: "not connected",  syncCount: "—" },
    // Email
    klaviyo:   { connected: true,  status: "ok",   note: "lists synced 2m ago",               syncCount: "24,118 contacts · 6 flows" },
    mailchimp: { connected: false, status: "—",    note: "not connected",                     syncCount: "—" },
    // SMS
    klaviyo_sms: { connected: true, status: "ok",  note: "TCPA opt-ins synced 4m ago",        syncCount: "8,402 SMS subscribers · 3 flows" },
    attentive:   { connected: false, status: "—",  note: "not connected",                     syncCount: "—" },
    // Search Ads
    googleads: { connected: true,  status: "ok",   note: "spend $4,820 MTD · 6 campaigns",   syncCount: "" },
    msads:     { connected: false, status: "—",    note: "not connected",                     syncCount: "—" },
    amazonads: { connected: false, status: "—",    note: "not connected",                     syncCount: "—" },
    // Social Ads
    metaads:   { connected: true,  status: "ok",   note: "spend $7,610 MTD · 11 ad sets",    syncCount: "" },
    ttads:     { connected: false, status: "—",    note: "not connected",                     syncCount: "—" },
    liads:     { connected: false, status: "—",    note: "not connected",                     syncCount: "—" },
    pinads:    { connected: false, status: "—",    note: "not connected",                     syncCount: "—" },
    // Commerce
    shopify:   { connected: true,  status: "ok",   note: "32 products · 1,408 orders MTD",   syncCount: "" },
    // Reviews & Local
    yelp:      { connected: false, status: "—",    note: "not connected",                     syncCount: "—" },
    // Analytics
    ga4:       { connected: true,  status: "ok",   note: "last event 1m ago",                 syncCount: "" },
    amplitude: { connected: false, status: "—",    note: "not connected",                     syncCount: "—" },
    // SEO
    ahrefs:    { connected: true,  status: "ok",   note: "rank crawl 6h ago · 184 tracked",  syncCount: "184 keywords" },
    semrush:   { connected: false, status: "—",    note: "not connected",                     syncCount: "—" },
    gsc:       { connected: true,  status: "ok",   note: "synced 12m ago",                    syncCount: "26 indexed pages" },
    // Affiliate
    refersion: { connected: true,  status: "ok",   note: "12 active partners · 3 pending",   syncCount: "$2,140 MTD payouts" },
    impact:    { connected: false, status: "—",    note: "not connected",                     syncCount: "—" },
    // Experimentation
    growthbook: { connected: false, status: "—",   note: "not connected",                     syncCount: "—" },
    // Creative AI
    runware:    { connected: false, status: "—",   note: "not connected",                     syncCount: "—" },
    heygen:     { connected: true,  status: "ok",  note: "3 assets rendering",                syncCount: "12 personas" },
    luma:       { connected: false, status: "—",   note: "not connected",                     syncCount: "—" },
    elevenlabs: { connected: false, status: "—",   note: "not connected",                     syncCount: "—" },
    runway:     { connected: false, status: "—",   note: "not connected",                     syncCount: "—" },
    // MCPs
    mcp_runware: { connected: false, status: "—",  note: "not connected",                     syncCount: "—" },
    mcp_heygen:  { connected: false, status: "—",  note: "not connected",                     syncCount: "—" },
    mcp_shopify: { connected: false, status: "—",  note: "not connected",                     syncCount: "—" },
    mcp_klaviyo: { connected: false, status: "—",  note: "not connected",                     syncCount: "—" },
    mcp_custom:  { connected: false, status: "—",  note: "not connected",                     syncCount: "—" },
  },

  // Per-brand connector states — used when switching accounts
  brandConnectorStates: {
    mveda: null, // null = use default connectorState above
    erickson: {
      ig:          { connected: false, status: "—",  note: "not connected — not a primary channel",               syncCount: "—" },
      tt:          { connected: false, status: "—",  note: "not connected — not relevant for B2B commercial",     syncCount: "—" },
      fb:          { connected: true,  status: "ok", note: "synced 6m ago · Erickson Commercial Refrigeration",   syncCount: "284 posts" },
      li:          { connected: true,  status: "ok", note: "synced 18m ago · Erickson Commercial Refrigeration",  syncCount: "96 posts" },
      yt:          { connected: true,  status: "ok", note: "synced 2h ago · @EricksonRefrigeration",              syncCount: "18 videos" },
      pn:          { connected: false, status: "—",  note: "not connected",                                        syncCount: "—" },
      x:           { connected: false, status: "—",  note: "not connected",                                        syncCount: "—" },
      threads:     { connected: false, status: "—",  note: "not connected",                                        syncCount: "—" },
      reddit:      { connected: false, status: "—",  note: "not connected",                                        syncCount: "—" },
      snap:        { connected: false, status: "—",  note: "not connected",                                        syncCount: "—" },
      bluesky:     { connected: false, status: "—",  note: "not connected",                                        syncCount: "—" },
      mastodon:    { connected: false, status: "—",  note: "not connected",                                        syncCount: "—" },
      telegram:    { connected: false, status: "—",  note: "not connected",                                        syncCount: "—" },
      klaviyo:     { connected: true,  status: "ok", note: "synced 4m ago",                                        syncCount: "1,840 contacts · 3 flows" },
      mailchimp:   { connected: false, status: "—",  note: "not connected",                                        syncCount: "—" },
      klaviyo_sms: { connected: true,  status: "ok", note: "synced 4m ago · service appointment reminders",       syncCount: "820 opted in" },
      attentive:   { connected: false, status: "—",  note: "not connected",                                        syncCount: "—" },
      googleads:   { connected: true,  status: "ok", note: "synced 3m ago · $4,800 MTD",                          syncCount: "4 campaigns active" },
      msads:       { connected: false, status: "—",  note: "not connected",                                        syncCount: "—" },
      amazonads:   { connected: false, status: "—",  note: "not connected — not relevant",                        syncCount: "—" },
      metaads:     { connected: true,  status: "ok", note: "synced 10m ago · local awareness + remarketing",      syncCount: "2 campaigns active" },
      ttads:       { connected: false, status: "—",  note: "not connected — not relevant for B2B commercial",     syncCount: "—" },
      liads:       { connected: true,  status: "ok", note: "synced 22m ago · facility manager targeting",         syncCount: "2 campaigns active" },
      pinads:      { connected: false, status: "—",  note: "not connected",                                        syncCount: "—" },
      shopify:     { connected: false, status: "—",  note: "not connected — service business, no storefront",     syncCount: "—" },
      yelp:        { connected: true,  status: "ok", note: "4.8 ★ · 142 reviews · synced 1h ago",                syncCount: "142 reviews" },
      ga4:         { connected: true,  status: "ok", note: "synced live · ericksonrefrigeration.com",             syncCount: "62 events tracked" },
      amplitude:   { connected: false, status: "—",  note: "not connected",                                        syncCount: "—" },
      ahrefs:      { connected: false, status: "—",  note: "not connected",                                        syncCount: "—" },
      semrush:     { connected: true,  status: "ok", note: "synced 2h ago · 84 keywords tracked",                 syncCount: "84 keywords" },
      gsc:         { connected: true,  status: "ok", note: "synced 1h ago",                                        syncCount: "96 queries tracked" },
      refersion:   { connected: false, status: "—",  note: "not connected — not relevant",                        syncCount: "—" },
      impact:      { connected: false, status: "—",  note: "not connected",                                        syncCount: "—" },
      growthbook:  { connected: false, status: "—",  note: "not connected",                                        syncCount: "—" },
      runware:     { connected: false, status: "—",  note: "not connected",                                        syncCount: "—" },
      heygen:      { connected: false, status: "—",  note: "not connected",                                        syncCount: "—" },
      luma:        { connected: false, status: "—",  note: "not connected",                                        syncCount: "—" },
      elevenlabs:  { connected: false, status: "—",  note: "not connected",                                        syncCount: "—" },
      runway:      { connected: false, status: "—",  note: "not connected",                                        syncCount: "—" },
      mcp_runware: { connected: false, status: "—",  note: "not connected",                                        syncCount: "—" },
      mcp_heygen:  { connected: false, status: "—",  note: "not connected",                                        syncCount: "—" },
      mcp_shopify: { connected: false, status: "—",  note: "not connected",                                        syncCount: "—" },
      mcp_klaviyo: { connected: false, status: "—",  note: "not connected",                                        syncCount: "—" },
      mcp_custom:  { connected: false, status: "—",  note: "not connected",                                        syncCount: "—" },
    },
  },

  // ── Organic social post queue ────────────────────────────────────────────
  organicQueue: [
    { id: "o1", platform: "instagram", type: "Reel",     status: "scheduled",   scheduledAt: "Tue Apr 29 · 08:00 BST", caption: "Three drops. Palms warmed. Drawn through the lengths.", hasImage: true  },
    { id: "o2", platform: "tiktok",    type: "Video",    status: "scheduled",   scheduledAt: "Tue Apr 29 · 19:00 BST", caption: "The morning ritual that changes how your hair feels.",   hasImage: true  },
    { id: "o3", platform: "instagram", type: "Carousel", status: "needs_image", scheduledAt: "Wed Apr 30 · 09:00 BST", caption: "Hair, but the way our grandmothers knew it.",            hasImage: false },
    { id: "o4", platform: "pinterest", type: "Pin",      status: "scheduled",   scheduledAt: "Wed Apr 30 · 11:00 BST", caption: "Saffron & Bhringraj. The ritual for thick, healthy hair.", hasImage: true },
    { id: "o5", platform: "instagram", type: "Story",    status: "draft",       scheduledAt: null,                      caption: "Have you tried the Hair Ritual kit yet?",               hasImage: false },
    { id: "o6", platform: "youtube",   type: "Short",    status: "scheduled",   scheduledAt: "Thu May 1 · 12:00 BST",  caption: "60 seconds. The full Hair Mist ritual. Watch.",          hasImage: true  },
    { id: "o7", platform: "tiktok",    type: "Video",    status: "draft",       scheduledAt: null,                      caption: "Body Oil · the 3-step morning ritual for glowing skin.", hasImage: false },
    { id: "o8", platform: "pinterest", type: "Idea pin", status: "draft",       scheduledAt: null,                      caption: "5,000 years of Ayurveda. One drop.",                    hasImage: false },
  ],
  organicAccounts: {
    instagram: { handle: "@mvedaskincare", followers: "48.2k", status: "connected" },
    tiktok:    { handle: "@mveda",         followers: "31.6k", status: "connected" },
    pinterest: { handle: "@mvedawellness", followers: "12.4k", status: "connected" },
    youtube:   { handle: "@mveda-co",      followers: "8.9k",  status: "connected" },
  },

  toneModes: [
    {
      id: "tm_ritual", name: "Ritual", status: "active", isDefault: true,
      register: "Slow, sensorial, second-person — turns a step into a ceremony",
      approved: ["return", "daily", "ritual", "linger", "warm in your hands", "drawn down", "until it becomes yours"],
      avoided: ["routine", "quick", "easy", "instant"],
      rhythm: "Long, unhurried sentences. Verbs of slowness — warm, draw, settle, return.",
      whenToUse: "Hero product copy, IG carousels, founder voice, hair oil + body oil stories.",
      whenNotToUse: "Performance ads with click targets, urgency emails.",
      example: "Warm a few drops between your palms. Draw them through the lengths. Return to it tomorrow, and the day after, until it becomes yours.",
      performance: "+34% saves vs. prior quarter",
      usage: 38,
    },
    {
      id: "tm_quiet", name: "Quiet Luxury", status: "active", isDefault: false,
      register: "Restrained, declarative, never shouting · 'speaks softly, holds attention'",
      approved: ["small batch", "single source", "cold-pressed", "hand-poured", "of the season"],
      avoided: ["best", "luxury (as adjective)", "premium", "exclusive (overuse)"],
      rhythm: "Short. Confident. One claim, well placed. White space does the rest.",
      whenToUse: "Product launches, packaging copy, press one-pagers.",
      whenNotToUse: "Community-led posts, casual reply threads.",
      example: "Saffron from Kashmir. Lime from Coorg. Cold-pressed in small batches. That's the bar.",
      performance: "Highest add-to-cart rate · +0.8 pp vs. avg",
      usage: 24,
    },
    {
      id: "tm_tradition", name: "Tradition", status: "active", isDefault: false,
      register: "Educational, reverent — Ayurvedic ingredient stories",
      approved: ["the texts say", "for centuries", "in Ayurveda", "rooted in", "tradition holds"],
      avoided: ["proven", "clinical", "studies show", "doctor-tested"],
      rhythm: "Story first, ingredient second. Open with a place or a person.",
      whenToUse: "Long-form blog, founder letters, ingredient deep-dives, video voiceover.",
      whenNotToUse: "Promotional emails, paid ad copy.",
      example: "Long before vanity tables, there were stone bowls and brass diyas. The texts say to warm the oil first; tradition holds, and our hands agree.",
      performance: "Highest time-on-page · 3:42 avg",
      usage: 18,
    },
    {
      id: "tm_invite", name: "Invite", status: "active", isDefault: false,
      register: "Warm, second-person — for the MV Tribe",
      approved: ["the tribe", "join us", "with you", "this season", "show up"],
      avoided: ["VIP", "members only", "limited"],
      rhythm: "Address the reader. One question, one answer.",
      whenToUse: "Klaviyo flows, sample-set follow-ups, community newsletters.",
      whenNotToUse: "Cold acquisition, paid social hooks.",
      example: "First soap of the season is out. The tribe gets it before the shelf does — your code is below.",
      performance: "Best CTR on email · 6.3%",
      usage: 20,
    },
  ],

  brandValues: MVEDA_VALUES,
  approvedClaims: [
    "Cold-pressed extraction · single source",
    "Ayurvedic tradition · 5,000 years documented",
    "No synthetic fragrance · no parabens",
    "Hand-poured small batches · India",
    "Gold-rated for sensitive skin (own panel · n=42)",
    "Free U.S. shipping over $50",
  ],
  prohibited: ["medical claims (healing, cure, treat)", "competitor by name", "weight loss / body shaming", "religion", "specific dermatology advice", "before/after with skin conditions"],
  channels: ["Instagram", "TikTok", "Email", "Google Ads", "Meta Ads", "LinkedIn"],

  // Calendar — week of Apr 20–26 · MVEDA campaigns
  calendar: [
    { id: "ci1", day: 0, channel: "Instagram", tone: "Ritual",       title: "Hair Mist · ritual carousel",        status: "approved", campaign: "Hair Ritual",   body: "Three drops of Hair Mist. A slow draw through the lengths. Return tomorrow.", scheduledAt: "09:30" },
    { id: "ci2", day: 0, channel: "Email",     tone: "Invite",       title: "MV Tribe · weekly drop",             status: "scheduled", campaign: "MV Tribe",      body: "First-of-the-season Honey & Oatmeal soap. The tribe gets it before the shelf does.", scheduledAt: "11:00" },
    { id: "ci3", day: 1, channel: "TikTok",    tone: "Ritual",       title: "UGC — morning serum unboxing",       status: "review",   campaign: "Morning Serum", body: "Day one. The bottle is heavier than you'd think. The dropper, slow on purpose.", scheduledAt: "12:15" },
    { id: "ci4", day: 2, channel: "Instagram", tone: "Quiet Luxury", title: "Rose & Cardamom · hero shot",        status: "approved", campaign: "Soap Story",    body: "Damask rose from Kannauj. Cardamom from Idukki. Hand-poured. That's the bar.", scheduledAt: "08:45" },
    { id: "ci5", day: 2, channel: "Google Ads",tone: "Quiet Luxury", title: "Pmax · Hair Oil set keywords",       status: "policy",   campaign: "Hair Ritual",   body: "Cold-pressed hair oil. Three steps. The before, the during, the after.", scheduledAt: "10:20" },
    { id: "ci6", day: 3, channel: "Instagram", tone: "Tradition",    title: "Ingredient story · saffron",         status: "approved", campaign: "Tradition",     body: "The Kashmiri saffron season is six weeks long. Then a year of waiting.", scheduledAt: "07:10" },
    { id: "ci7", day: 4, channel: "Email",     tone: "Quiet Luxury", title: "Night Serum · Klaviyo flow #3",      status: "policy",   campaign: "Morning Serum", body: "Night Serum. Eight oils, one bottle. The bar.", scheduledAt: "09:00" },
    { id: "ci8", day: 5, channel: "TikTok",    tone: "Invite",       title: "MV Tribe · live drop teaser",        status: "approved", campaign: "MV Tribe",      body: "Saturday, 7am EST. The tribe drop. Set a reminder.", scheduledAt: "16:00" },
    { id: "ci9", day: 6, channel: "Meta Ads",  tone: "Quiet Luxury", title: "Advantage+ · Body Oil retargeting",  status: "draft",    campaign: "Body Oil",      body: "Honey & Vanilla. Cold-pressed. Your skin will know.", scheduledAt: "19:00" },
  ],
  approvals: [
    { id: "ap1", itemId: "ci7", title: "Night Serum · Klaviyo flow #3", reason: "Claim 'clinically proven' not in approved library — replace with own-panel language", rule: "Brand memory · approved claims", source: "Email Service", severity: "revise" },
    { id: "ap2", itemId: "ci3", title: "HeyGen · UGC unboxing v3",      reason: "AI-generated video requires human review before external publish", rule: "Hard boundary · AI video", source: "Creative Service", severity: "required" },
    { id: "ap3", title: "Trend brief · week 17",                         reason: "3 trends marked 'incorporate' — review before Planning uses them", rule: "Trend compatibility screen", source: "Trend Scout", severity: "review" },
    { id: "ap4", inboxId: "i3", title: "Press DM · Vogue India beauty", reason: "High-risk reputational surface — classified as 'press/PR'", rule: "Response risk · high", source: "Response Service", severity: "required" },
  ],
  inbox: [
    { id: "i1", source: "Instagram · comment", author: "@aanya.j",       risk: "low",    timeAgo: "14m", text: "wait is the rose & cardamom soap back in stock?",                                                              draft: "Rose & Cardamom restocks next Tuesday — the tribe gets first access. Drop your email and we'll send you a reminder.", category: "product question", reason: "Routine stock question. Safe to auto-reply. Confidence 0.94.", status: "open" },
    { id: "i2", source: "Instagram · DM",      author: "@beautysoothes", risk: "medium", timeAgo: "1h",  text: "Would love to send our kit to your founder for a feature — what's the best route?",                           draft: "Thank you for reaching out — passing this to our partnerships lead, who'll be in touch within 2 business days.", category: "partnerships", reason: "Inbound partnership pitch. Routed to partnerships lead — not a brand risk, but requires a human decision.", status: "open" },
    { id: "i3", source: "Email · reply",       author: "noor.a@vogue.in", risk: "high",   timeAgo: "2h",  text: "Hi — following up on a feature we're running on heritage Indian beauty brands for our September issue. Deadline is Friday COB.",  draft: "", category: "press", reason: "Press/PR enquiry — Vogue India, Friday deadline. Hard boundary: no AI reply permitted. Forward to comms lead immediately.", status: "open" },
    { id: "i4", source: "TikTok · comment",    author: "@morning.warmth", risk: "low",    timeAgo: "3h",  text: "does the night serum smell strong? I'm really sensitive to fragrance",                                        draft: "It's quiet — sandalwood and a whisper of vetiver. Most sensitive skin finds it well-tolerated. We offer a sample set if you'd like to try first.", category: "product question", reason: "Ingredient/scent question. Safe to auto-reply. Confidence 0.91.", status: "open" },
    { id: "i5", source: "Klaviyo · reply",     author: "Maya R.",         risk: "medium", timeAgo: "4h",  text: "I had a really frustrating experience with my return last month and I'm still waiting to hear back. This is the third time I'm reaching out.", draft: "", category: "service complaint", reason: "Repeat service complaint — 3rd contact, unresolved return. Requires human empathy and account access. No auto-reply.", status: "open" },
  ],
  assets: [
    { id: "a1", kind: "video",  source: "HeyGen",  status: "review",   title: "UGC — morning serum unboxing v3",  duration: "0:22", persona: "Ananya — 28, Mumbai", linkedTo: "ci3" },
    { id: "a2", kind: "image",  source: "fal.ai",  status: "approved", title: "Rose & Cardamom · hero · ivory bg", aspect: "4:5", model: "Nano Banana Pro", linkedTo: "ci4" },
    { id: "a3", kind: "motion", source: "fal.ai",  status: "queued",   title: "Texture loop · saffron threads",   aspect: "9:16", model: "Nano Banana Pro" },
    { id: "a4", kind: "image",  source: "fal.ai",  status: "approved", title: "Hair Mist · stone bowl · b-roll",   aspect: "4:5", model: "Nano Banana Pro", linkedTo: "ci1" },
    { id: "a5", kind: "video",  source: "HeyGen",  status: "review",   title: "UGC — Night Serum · 'first week'", duration: "0:31", persona: "Devika — 34, Bangalore" },
    { id: "a6", kind: "image",  source: "fal.ai",  status: "rejected", title: "Trail crew banner",                  aspect: "16:9", model: "Nano Banana Pro", note: "off-brand · saturated sunset · use ivory + warm neutrals only" },
  ],
  kpis: {
    acceptance: { v: 87, d: +6, unit: "%" },
    shipped:    { v: 31, d: +4, unit: "/36" },
    compliance: { v: 96, d: +2, unit: "%" },
    approval:   { v: 38, d: -14, unit: "min" },
  },
  trendBrief: [
    { id: "t1", title: "Quiet luxury skincare · brass + stone aesthetic", score: 91, status: "incorporate", note: "Fits 'Ritual' and 'Quiet Luxury' tones perfectly. Already in our visual DNA." },
    { id: "t2", title: "Sound-on UGC outperforming b-roll on TikTok",     score: 78, status: "incorporate", note: "Script 2 variants for next shoot — let the founder narrate." },
    { id: "t3", title: "Founder-led origin stories on LinkedIn",          score: 74, status: "incorporate", note: "Mitha & Ayurveda story has high resonance. Use 'Tradition' tone." },
    { id: "t4", title: "Sunrise-color grading peaking",                   score: 64, status: "monitor",     note: "Overused — we hold the ivory + saffron palette. Don't drift." },
    { id: "t5", title: "Competitor X · refillable packaging push",        score: 58, status: "monitor",     note: "Worth tracking — refillables align with small-batch story." },
    { id: "t6", title: "'Hot girl walk' beauty crossover",                score: 31, status: "ignore",      note: "Demographic mismatch with ritual buyer." },
  ],
  audit: [
    { t: "10:42", actor: "Policy Guard", event: "revise · email v2 · 'clinically proven' not in approved claims" },
    { t: "10:38", actor: "Priya K.",     event: "approved · IG post 'Hair Mist · ritual carousel'" },
    { t: "10:31", actor: "Supervisor",   event: "weekly plan generated for Apr 20–26 · 36 items" },
    { t: "10:22", actor: "Trend Scout",  event: "brief week 17 published · 6 items · 3 incorporate" },
    { t: "10:14", actor: "HeyGen",       event: "asset a1 entered review queue · requires human" },
    { t: "10:02", actor: "Klaviyo",      event: "list sync · 24,118 contacts · 3 suppressed" },
    { t: "09:58", actor: "Policy Guard", event: "allow · IG post 'Rose & Cardamom · hero shot'" },
    { t: "09:51", actor: "Priya K.",     event: "edited tone mode · 'Ritual' · example caption updated" },
    { t: "09:44", actor: "Supervisor",   event: "workflow B · weekly planning loop · completed" },
    { t: "09:30", actor: "System",       event: "analytics refresh · all channels · ok" },
  ],

  // Campaign templates — now includes Email Marketing & Google Ads workflows
  campaignTemplates: [
    {
      name: "Product Launch · Multi-channel", kind: "multi",
      pillars: ["Tease", "Reveal", "Story", "Convert"],
      mix: [
        { day: 0, channel: "Instagram", tone: "Quiet Luxury", title: "Hero · product reveal",      body: "It's here. Cold-pressed. Hand-poured. The bar." },
        { day: 0, channel: "Email",     tone: "Invite",       title: "MV Tribe · first access",     body: "First access for the tribe. The link below works for 24 hours." },
        { day: 1, channel: "TikTok",    tone: "Ritual",       title: "Unboxing · 15s",              body: "Unwrap. Warm. Draw. Done — and we're back tomorrow." },
        { day: 2, channel: "Instagram", tone: "Tradition",    title: "Story · ingredient origin",   body: "From the saffron fields of Kashmir. A six-week season, a year of waiting." },
        { day: 3, channel: "Google Ads",tone: "Quiet Luxury", title: "Pmax · launch keywords",      body: "Cold-pressed [product]. The bar." },
        { day: 4, channel: "Meta Ads",  tone: "Quiet Luxury", title: "Advantage+ · launch creative", body: "Hand-poured. Small batch. Yours." },
        { day: 5, channel: "Email",     tone: "Invite",       title: "Klaviyo · sample-set follow", body: "Saved a sample set for those still deciding. Reply Y and we'll send." },
        { day: 6, channel: "Instagram", tone: "Ritual",       title: "Recap · launch week",         body: "Week one. Returning hands. Thank you for showing up." },
      ],
    },
    {
      name: "Email Marketing · Klaviyo Flow", kind: "email",
      pillars: ["Welcome", "Educate", "Convert", "Recover"],
      mix: [
        { day: 0, channel: "Email", tone: "Invite",       title: "Welcome · MV Tribe email 1",         body: "Welcome. The story starts with a dachshund and 5,000 years of Ayurveda.", subjectLine: "Welcome to the tribe", preheader: "The story starts with a dachshund." },
        { day: 1, channel: "Email", tone: "Tradition",    title: "Educate · ingredient deep-dive 1",   body: "Today: saffron. The most labor-intensive crop on earth, and why we use it anyway.", subjectLine: "Why saffron, slowly", preheader: "Six weeks a year. A year of waiting." },
        { day: 3, channel: "Email", tone: "Ritual",       title: "Educate · how to use · hair oil",     body: "Three drops, palms warmed, drawn through the lengths. Return tomorrow.", subjectLine: "Three drops, palms warmed", preheader: "How to use — properly." },
        { day: 5, channel: "Email", tone: "Quiet Luxury", title: "Convert · first purchase offer",     body: "Your tribe code, $10 off your first ritual. No urgency, no expiry.", subjectLine: "$10, no expiry", preheader: "Tribe code inside." },
        { day: 7, channel: "Email", tone: "Invite",       title: "Recover · cart abandon (gentle)",     body: "We saved your basket. No nudges, no countdowns — it'll be here when you return.", subjectLine: "We saved your basket", preheader: "No nudges. It'll wait." },
        { day: 14,channel: "Email", tone: "Quiet Luxury", title: "Re-engage · 14d no open",            body: "If you'd rather hear from us less, change your cadence below.", subjectLine: "Less from us, if you'd like", preheader: "Pick a new cadence." },
      ],
    },
    {
      name: "Google Ads · Pmax + Search", kind: "googleads",
      pillars: ["Search intent", "Pmax", "Retarget"],
      mix: [
        { day: 0, channel: "Google Ads", tone: "Quiet Luxury", title: "Search · brand · 'mveda'",            body: "MVEDA — Cold-pressed Ayurvedic skincare. The bar.", headlines: ["MVEDA — Ayurvedic Skincare","Cold-Pressed Body Oil","Ritual, Not Routine","Hand-Poured Small Batch"], descriptions: ["5,000 years of Ayurveda. Cold-pressed in small batches.","Free U.S. shipping over $50."], keywords: ["mveda", "mveda skincare", "mveda body oil"], audience: "Brand searchers · all", budget: "$40/day" },
        { day: 0, channel: "Google Ads", tone: "Quiet Luxury", title: "Search · category · 'ayurvedic body oil'", body: "Cold-pressed body oil. Small batch. India.", headlines: ["Ayurvedic Body Oil","Cold-Pressed · Small Batch","Honey & Vanilla, Saffron & Lime","Free Shipping $50+"], descriptions: ["Hand-poured. Plant-led.","Saffron, vanilla, oud — your ritual."], keywords: ["ayurvedic body oil","cold pressed body oil","ayurvedic skincare","luxury ayurveda"], audience: "Category in-market", budget: "$80/day" },
        { day: 1, channel: "Google Ads", tone: "Quiet Luxury", title: "Pmax · Hair Care collection",        body: "Three steps, one ritual. Pre-wash, scalp, post-wash.", headlines: ["Hair Ritual · 3 Steps","Pre-Wash. Scalp. Post-Wash.","Cold-Pressed Hair Oil","Hand-Poured · India"], descriptions: ["The hair ritual, made simple.","Pre-wash oil, scalp massage, post-wash serum."], keywords: ["—"], audience: "Pmax · hair care signal", budget: "$120/day" },
        { day: 2, channel: "Google Ads", tone: "Ritual",       title: "Pmax · Soap collection",             body: "Rose, oud, lime, agave — pick your morning.", headlines: ["Rose & Cardamom","Green Tea & Oud","Lime & Saffron","Pick Your Morning"], descriptions: ["Hand-poured Ayurvedic soap.","Free shipping over $50."], keywords: ["—"], audience: "Pmax · soap + body wash", budget: "$60/day" },
        { day: 4, channel: "Google Ads", tone: "Quiet Luxury", title: "Retarget · cart abandon (28d)",      body: "Your basket is still here.", headlines: ["Your Basket Is Here","Pick Up Your Ritual","Free Shipping $50+","No Expiry"], descriptions: ["No nudges. Saved for whenever you return.","Free U.S. shipping over $50."], keywords: ["—"], audience: "Cart abandoners 28d", budget: "$30/day" },
      ],
    },
    {
      name: "Community · MV Tribe", kind: "multi",
      pillars: ["Invite", "Show up", "Recap"],
      mix: [
        { day: 0, channel: "Email",     tone: "Invite",       title: "Tribe · monthly drop brief",     body: "First-of-the-season Honey & Oatmeal. The tribe gets it before the shelf does." },
        { day: 1, channel: "Instagram", tone: "Invite",       title: "Drop graphic · single image",    body: "Saturday. The tribe drop. 7am EST." },
        { day: 3, channel: "TikTok",    tone: "Invite",       title: "Founder POV · 30s",              body: "Three flavors. Four bars. The first ones, for the tribe." },
        { day: 5, channel: "Instagram", tone: "Ritual",       title: "Drop day · carousel",            body: "We met at 7. Here's what landed in your hands." },
        { day: 6, channel: "Email",     tone: "Quiet Luxury", title: "After-drop letter",              body: "Thank you. Notes for next month inside." },
      ],
    },
    {
      name: "Seasonal · Ingredient Story", kind: "multi",
      pillars: ["Story", "Product", "Ritual"],
      mix: [
        { day: 0, channel: "Instagram", tone: "Tradition",    title: "Story · saffron season",         body: "Six weeks a year. A year of waiting. The Kashmir saffron story." },
        { day: 1, channel: "Email",     tone: "Tradition",    title: "Founder letter · seasonal",      body: "A letter for spring. What we're warming, drawing, returning to." },
        { day: 2, channel: "TikTok",    tone: "Ritual",       title: "Saffron texture loop",           body: "Four threads. Sixty seconds in warm milk. The color comes slowly." },
        { day: 4, channel: "Instagram", tone: "Quiet Luxury", title: "Product fit · saffron range",    body: "Soap, body oil, mist — pick the one that meets you in the morning." },
        { day: 5, channel: "Google Ads",tone: "Quiet Luxury", title: "Pmax · saffron collection",       body: "Saffron from Kashmir. The bar." },
        { day: 6, channel: "Instagram", tone: "Invite",       title: "Live · saffron Q&A",              body: "Saturday, 7pm. Founder live, saffron threads, your questions." },
      ],
    },
  ],

  // ─── SMS — first-class channel (Klaviyo SMS / Postscript) ───
  smsCampaigns: [
    { id: "sms1", name: "MV Tribe · drop reminder",  segment: "VIP · last-90d openers", recipients: 4220, sendAt: "Sat 06:50",  status: "scheduled", provider: "Klaviyo SMS", body: "Saturday, 7am. The tribe drop is live. — Reply STOP to opt out." },
    { id: "sms2", name: "Cart abandon · 1h soft",    segment: "Cart abandoners (1h, no nudge)", recipients: 312, sendAt: "automation", status: "live",      provider: "Klaviyo SMS", body: "We saved your basket — link inside, no expiry. mveda.co/c/{{token}}" },
    { id: "sms3", name: "Restock · Rose & Cardamom", segment: "Back-in-stock waitlist", recipients: 894, sendAt: "Tue 10:00", status: "draft",     provider: "Postscript",  body: "Rose & Cardamom is back. The tribe gets first access — link below." },
    { id: "sms4", name: "Replenish · 60d body oil",  segment: "Body Oil buyers · 60d window", recipients: 612, sendAt: "automation", status: "live",      provider: "Klaviyo SMS", body: "It's been 60 days. Time to refill the ritual? Tap to reorder." },
  ],
  smsAutomations: [
    { id: "sa1", name: "Welcome · post-opt-in",      trigger: "SMS opt-in", steps: 3, ctr: "12.4%", revenue: "$1,820/mo", status: "live" },
    { id: "sa2", name: "Browse abandon",             trigger: "PDP > 90s, no add", steps: 1, ctr: "8.1%",  revenue: "$640/mo",   status: "live" },
    { id: "sa3", name: "Win-back · 90d",             trigger: "No order 90d",     steps: 2, ctr: "3.7%",  revenue: "$420/mo",   status: "paused" },
  ],
  smsCompliance: { tcpaConsent: 8402, optOut30d: 38, optOutRate: "0.45%", quietHours: "9pm–9am local" },

  // ─── SEO — articles, keywords, backlinks ───
  seoArticles: [
    { id: "se1", title: "What is Ayurvedic skincare? A modern guide",        cluster: "ayurveda explained",  status: "published", url: "/blog/what-is-ayurvedic-skincare", words: 1840, internalLinks: 6, traffic: 2840, rank: 3,  intent: "informational" },
    { id: "se2", title: "Cold-pressed body oil: what it actually means",     cluster: "ingredient story",    status: "draft",     url: "/blog/cold-pressed-body-oil",      words: 1240, internalLinks: 4, traffic: 0,    rank: null, intent: "informational" },
    { id: "se3", title: "Saffron in skincare — the Kashmir story",            cluster: "ingredient story",    status: "brief",     url: "/blog/saffron-kashmir-story",      words: 0,    internalLinks: 0, traffic: 0,    rank: null, intent: "informational" },
    { id: "se4", title: "Hair oil routine for 4a/4b textures",                cluster: "hair ritual",         status: "published", url: "/blog/hair-oil-4a-4b",             words: 1520, internalLinks: 8, traffic: 1820, rank: 7,  intent: "how-to" },
    { id: "se5", title: "Best body oil for sensitive skin (review roundup)",  cluster: "comparison",          status: "outline",   url: "/blog/best-body-oil-sensitive",    words: 0,    internalLinks: 0, traffic: 0,    rank: null, intent: "commercial" },
  ],
  seoKeywords: [
    { id: "kw1", term: "ayurvedic body oil",      vol: 4400,  rank: 6,  prevRank: 9,  url: "/products/body-oil",       difficulty: 38 },
    { id: "kw2", term: "cold pressed hair oil",   vol: 2900,  rank: 12, prevRank: 11, url: "/products/hair-mist",      difficulty: 41 },
    { id: "kw3", term: "ayurvedic skincare brand",vol: 1800,  rank: 4,  prevRank: 7,  url: "/",                        difficulty: 44 },
    { id: "kw4", term: "saffron face serum",      vol: 880,   rank: 18, prevRank: 22, url: "/products/night-serum",    difficulty: 27 },
    { id: "kw5", term: "what is mveda",           vol: 320,   rank: 1,  prevRank: 1,  url: "/",                        difficulty: 8  },
    { id: "kw6", term: "ayurvedic skincare for sensitive skin", vol: 720, rank: 14, prevRank: 16, url: "/blog/sensitive-skin", difficulty: 31 },
  ],
  seoBacklinks: [
    { source: "vogue.in", anchor: "MVEDA · heritage", da: 92, type: "editorial", date: "Apr 18" },
    { source: "byrdie.com", anchor: "Ayurvedic skincare brands", da: 86, type: "roundup", date: "Apr 04" },
    { source: "the-cut.com", anchor: "small-batch body oil", da: 89, type: "editorial", date: "Mar 22" },
  ],
  seoInternalSuggestions: [
    { from: "/blog/what-is-ayurvedic-skincare", to: "/products/body-oil", anchor: "cold-pressed body oil", reason: "high topical relevance · no link yet" },
    { from: "/blog/hair-oil-4a-4b",              to: "/products/hair-mist", anchor: "hair mist ritual", reason: "ranking page · push link equity to PDP" },
    { from: "/",                                  to: "/blog/saffron-kashmir-story", anchor: "the saffron story", reason: "homepage authority → new content" },
  ],

  // ─── Affiliate / referral program ───
  affiliateProgram: {
    name: "MV Tribe Partners", commissionTier: "12% · 90d cookie · 30d payout", terms: "MVEDA-vetted creators only. Heritage / wellness / ritual aesthetic.",
    mtdRevenue: 18420, mtdPayouts: 2140, conversionRate: 4.8,
  },
  affiliatePartners: [
    { id: "af1", name: "Aanya · @aanya.j",           tier: "creator",  followers: 184000, status: "active",    sales: 1840, payout: 220, code: "AANYA12", link: "mveda.co/?ref=aanya" },
    { id: "af2", name: "Rituals & Tea · podcast",    tier: "podcast",  followers: 62000,  status: "active",    sales: 940,  payout: 113, code: "RITUALS", link: "mveda.co/?ref=rituals" },
    { id: "af3", name: "Devika M. · @morning.warmth",tier: "creator",  followers: 412000, status: "active",    sales: 4220, payout: 506, code: "DEVIKA",  link: "mveda.co/?ref=devika" },
    { id: "af4", name: "Heritage Wellness Newsletter",tier: "newsletter",followers: 28000, status: "pending",   sales: 0,    payout: 0,   code: "—",       link: "—" },
    { id: "af5", name: "Anika · TikTok creator",     tier: "creator",  followers: 96000,  status: "paused",    sales: 320,  payout: 38,  code: "ANIKA",   link: "mveda.co/?ref=anika" },
  ],
  referralProgram: { reward: "$10 give, $10 get", referrers30d: 184, redemptions30d: 62, ltvUplift: "+18%" },

  // ─── Retention dashboards ───
  retention: {
    rpr: { v: 32, d: +3, unit: "%", note: "repeat purchase rate · 90d window" },
    aov: { v: 64, d: +4, unit: "$", note: "average order value · 30d" },
    replenishmentMedianDays: { v: 58, d: -2, unit: "d", note: "median time between orders" },
    subscriptionChurn: { v: 4.2, d: -0.3, unit: "%", note: "monthly · subscription pause + cancel" },
    segments: [
      { id: "s_new",     name: "New buyers · 0–14d",        size: 412, trend: +18,  cadence: "—",    note: "Send welcome flow" },
      { id: "s_repeat",  name: "Repeat · 2+ orders",         size: 2840, trend: +6,   cadence: "62d", note: "Backbone of revenue" },
      { id: "s_vip",     name: "VIP · top 10% LTV",          size: 488,  trend: +12,  cadence: "44d", note: "Hasn't heard from you in 19d" },
      { id: "s_lapsing", name: "Lapsing · 60d+ since order",  size: 1124, trend: -8,   cadence: "—",    note: "Win-back overdue" },
      { id: "s_disc",    name: "Price-sensitive · discount-only", size: 320, trend: 0, cadence: "discount-led", note: "Limit margin exposure" },
    ],
    replenishmentBySku: [
      { sku: "Body Oil · 100ml", median: 58, range: "44–72d", buyers: 1820, dueNow: 184 },
      { sku: "Hair Mist · 60ml", median: 48, range: "38–62d", buyers: 940,  dueNow: 102 },
      { sku: "Night Serum",      median: 90, range: "70–108d", buyers: 412, dueNow: 38 },
    ],
  },

  // ─── CX signal — returns, RMA spikes, reviews ───
  cxSignals: {
    returnRate: { v: 3.4, d: -0.6, unit: "%", note: "30d · trending down" },
    rmaQueue: 6, openTickets: 38,
    spikes: [
      { id: "cx1", sku: "Body Oil · 100ml · Honey & Vanilla", reason: "leaking cap · batch 2604", count: 14, period: "last 7d", severity: "high",   action: "Pause Meta Ads on this SKU until QA confirms · already auto-paused inbound replenishment SMS" },
      { id: "cx2", sku: "Hair Mist · 60ml",                    reason: "scent stronger than expected", count: 6,  period: "last 14d", severity: "medium", action: "Update PDP scent description · add 'sandalwood + vetiver, medium intensity'" },
    ],
    topComplaints: [
      { theme: "shipping delays · West coast",  count: 22, suggestedReply: "shipping update + 10% credit", channel: "Gorgias" },
      { theme: "scent intensity · Hair Mist",    count: 14, suggestedReply: "honest scent description + sample offer", channel: "IG DMs" },
      { theme: "size disappointment · 30ml",     count: 8,  suggestedReply: "100ml upgrade flow · 15% credit", channel: "Email" },
    ],
    reviews30d: 184, avgRating: 4.7, lowestSku: "Body Oil · Honey & Vanilla (4.2)",
  },

  // ─── Holiday / seasonal mode ───
  seasonalPlaybooks: [
    { id: "sp_bfcm", name: "BFCM · Black Friday → Cyber Monday", window: "Nov 25 → Dec 2",  status: "preloaded", phases: ["Tease (Nov 1)","Early-access (Nov 15)","BFCM peak (Nov 25)","CM extension (Dec 1)","Recovery (Dec 5)"], expectedLift: "+220% revenue · 2.4× normal CAC" },
    { id: "sp_diwali",name: "Diwali · gift season",            window: "Oct 20 → Nov 5",   status: "active",    phases: ["Cultural lead (Oct 1)","Gift sets (Oct 15)","Diwali peak (Oct 24)","Send-by reminder (Oct 28)"], expectedLift: "+85% AOV via gift sets" },
    { id: "sp_mday", name: "Mother's Day",                    window: "Apr 25 → May 12",  status: "active",    phases: ["Story lead (Apr 25)","Gift guide (May 1)","Last-call shipping (May 8)","Recovery (May 13)"], expectedLift: "+60% gift-set AOV" },
    { id: "sp_holiday",name: "Year-end · holiday + gifting",  window: "Dec 5 → Dec 24",   status: "preloaded", phases: ["Gift edit (Dec 5)","Last-mail dates (Dec 14)","Final hours (Dec 23)"], expectedLift: "+140% revenue" },
    { id: "sp_summer",name: "Summer · ritual & travel",        window: "Jun 1 → Aug 31",   status: "draft",     phases: ["Travel kits","Body care heatwave","Recovery"], expectedLift: "+25% AOV" },
  ],
  capacityPlan: { ordersPerDay: 180, peakCapacity: 480, fulfilmentSLA: "72h", warehouseLeadTime: "5d", paidSpendCeiling: "$8,400/day" },

  // ─── A/B testing as a primitive ───
  abTests: [
    { id: "ab1", subject: "Email · subject line",           variantA: "Welcome to the tribe",        variantB: "The story starts with a dachshund.", openA: 38.2, openB: 44.6, ctrA: 5.4, ctrB: 7.2, status: "winner-b", confidence: 96, lift: "+15.4% open · +33% CTR", linkedDraftId: "ci2" },
    { id: "ab2", subject: "IG carousel · first slide",      variantA: "Three drops, palms warmed.",   variantB: "Hair, the way our grandmothers knew.", saveA: 1.2,  saveB: 1.8,  ctrA: 0.8, ctrB: 1.1, status: "running", confidence: 78, lift: "+50% saves · running", linkedDraftId: "ci1" },
    { id: "ab3", subject: "Pmax · headline",                variantA: "Cold-Pressed Body Oil",         variantB: "Ayurveda · 5,000 Years",                ctrA: 1.4,  ctrB: 1.1,  cvrA: 2.4, cvrB: 1.8, status: "winner-a", confidence: 92, lift: "+27% CTR · won", linkedCampaign: "googleads" },
    { id: "ab4", subject: "PDP · CTA copy",                 variantA: "Add to ritual",                 variantB: "Add to cart",                            cvrA: 3.1,  cvrB: 2.6, status: "winner-a", confidence: 88, lift: "+19% CVR via ritual framing", provider: "VWO" },
  ],
  abFedBrandRules: [
    { rule: "Story-led subject lines outperform generic by 22%", source: "ab1 → won 33% CTR · added to Brand Memory" },
    { rule: "'Add to ritual' beats 'Add to cart' on PDP CVR",     source: "ab4 → won 19% CVR · pushed to all PDPs" },
  ],

  // ─── Vendor + agency collaboration · seats and scopes ───
  team: [
    { id: "u_greg",   name: "Greg O.",     role: "owner",      email: "greg@mveda.co",  scope: "all",        last: "now" },
    { id: "u_priya",  name: "Priya K.",    role: "operator",   email: "priya@mveda.co", scope: "all",        last: "2m" },
    { id: "u_ana",    name: "Ana O.",      role: "operator",   email: "ana@mveda.co",   scope: "all",        last: "3h" },
  ],
  guests: [
    { id: "g_agency1", name: "Field Studio (agency)",  role: "guest", email: "ops@fieldstudio.com",   scope: ["paid-channels","creative-studio"],  permissions: "comment-only", last: "1d",  via: "agency seat" },
    { id: "g_freelan", name: "Imran R. (freelance)",   role: "guest", email: "imran@designerco.in", scope: ["creative-studio"],                  permissions: "edit",         last: "5d",  via: "vendor seat" },
    { id: "g_legal",   name: "Counsel · Sutter Hill",  role: "guest", email: "review@sutterhill.com", scope: ["compliance"],                       permissions: "view-only",    last: "2w",  via: "guest seat" },
  ],

  // ─── Pricing / discount ops ───
  discountHistory: [
    { id: "dh1", code: "TRIBE10",    pct: 10, used30d: 412, revenue30d: 18420, marginAfter: 38, status: "active",  fatigue: "low" },
    { id: "dh2", code: "WELCOME15",  pct: 15, used30d: 184, revenue30d: 12640, marginAfter: 33, status: "active",  fatigue: "medium" },
    { id: "dh3", code: "SPRING20",   pct: 20, used30d: 22,  revenue30d: 1840,  marginAfter: 28, status: "expired", fatigue: "high" },
    { id: "dh4", code: "BFCM25",     pct: 25, used30d: 0,   revenue30d: 0,     marginAfter: 23, status: "scheduled", fatigue: "—" },
  ],
  marginFloors: { default: 25, premium: 35, gift: 30, note: "MVEDA SKUs land at 62% blended gross margin · floors set at half" },
  discountFatigue: { last90d: 38, threshold: 45, alerts: ["WELCOME15 used in 6 of 12 weekly sends · slowing redemption"] },

  // ─── Pricing simulator presets ───
  pricingSimDefault: { sku: "Body Oil · 100ml", basePrice: 64, baseCogs: 18, baseShip: 6, baseUnits: 612 },
};

Object.assign(window, { SEED });
