// FlowOS Reach — Vite entry point
// Gradual migration from runtime-Babel globals to ES modules.

import './setup-globals.jsx'

// ─── Load app layer in dependency order (legacy global-scope pattern) ────────

import './supabase.jsx'
import './seed.jsx'
import './ui.jsx'
import './ui2.jsx'
import './store.jsx'
import './workspaces1.jsx'
import './workspaces2.jsx'
import './workspaces3.jsx'
import './workspaces4.jsx'
import './chat-data.jsx'
import './chat-ui.jsx'
import './channel-strategy.jsx'
import './features.jsx'
import './studio.jsx'
import './login.jsx'
import './onboarding.jsx'
import './agents.jsx'
import './insights.jsx'
import './ads-workspace.jsx'
import './gmb-workspace.jsx'
import './ai.jsx'

// chat-app.jsx defines and exports ChatOS; mount it here rather than inside
// the file so ReactDOM is explicitly in scope.
import { ChatOS } from './chat-app.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(<ChatOS />)
