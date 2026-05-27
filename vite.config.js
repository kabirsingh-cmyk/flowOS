import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Transitional plugin: injects `const React = globalThis.React;` into every
 * .jsx file so the existing hook-aliasing pattern continues to work during
 * the gradual ES-module migration.
 *
 * TODO: Remove once all files have been converted to direct `import` from
 * 'react' and no file references `React` as a bare global.
 */
function injectReactGlobal() {
  return {
    name: 'inject-react-global',
    enforce: 'pre',
    transform(code, id) {
      if (!id.endsWith('.jsx')) return null
      if (code.includes('import React from') || code.includes('const React = globalThis.React')) return null
      return `const React = globalThis.React;\n${code}`
    }
  }
}

/**
 * Transitional plugin: injects `const X = window.X;` for known globals that
 * were previously on `window` in sloppy-mode classic scripts but are NOT
 * automatically available as bare identifiers in strict-mode ES modules.
 *
 * Only injects globals that are (a) referenced in the file, and (b) not
 * declared locally in that same file.
 *
 * TODO: Remove once all files use explicit import/export.
 */
function injectWindowGlobals() {
  const GLOBALS = [
    // supabase.jsx
    'sb', 'flowAuth', 'apiFetch',
    // seed.jsx
    'SEED',
    // store.jsx
    'useMvedaStore',
    // ui.jsx / ui2.jsx
    'cls', 'fmtTime', 'Chip', 'Dot', 'SectionLabel', 'Spinner', 'Card', 'Kpi',
    'Btn', 'Icon', 'Dialog', 'statusChip', 'ANIM_STYLE',
    'Drawer', 'Input', 'Textarea', 'FormRow', 'Slider', 'Toggle',
    'EditableList', 'NotifBell', 'inputCSS',
    // chat-data.jsx
    'SPECIALISTS', 'CHANNELS', 'BRIEFING', 'TEAM_THREAD',
    'PERSONAL_HISTORY', 'SUGGESTIONS',
    // chat-ui.jsx
    'SpecialistAvatar', 'UserAvatar', 'ArtifactCard', 'Message',
    'BriefingCard', 'Composer',
    // channel-strategy.jsx
    'ChannelStrategyCanvas', 'computeChannelStrategy', 'AllocationRow',
    // features.jsx
    'OrganicSocialStudio', 'SmsCenter', 'SeoStudio', 'AffiliateProgram',
    'RetentionDashboard', 'CxSignals', 'SeasonalMode', 'AbTestLab',
    'TeamSeats', 'DiscountOps', 'MobileShell',
    // studio.jsx
    'StudioHub', 'EmailStudio', 'SearchStudio', 'SettingsHub', 'SpendDashboard',
    // login.jsx
    'LoginScreen',
    // onboarding.jsx
    'OnboardingWizard', 'applyPalette', 'BRAND_PALETTES',
    // agents.jsx
    'AgentsWorkspace',
    // insights.jsx
    'InsightsCenter',
    // ai.jsx
    'sendAIMessage',
    // main.jsx
    'ReactDOM',
    // workspaces1.jsx
    'CommandCenter', 'BrandMemory',
    // workspaces2.jsx
    'CampaignPlanner', 'ContentStudio',
    // workspaces3.jsx
    'PublishingQueue', 'InboxEscalation', 'AutonomySettings',
    // workspaces4.jsx
    'Connections', 'BrandImportModal', 'ConnectorIcon', 'LetterMark',
  ]

  const LOCAL_PATTERNS = (name) => [
    `const ${name} =`, `let ${name} =`, `var ${name} =`,
    `function ${name}(`, `class ${name} `,
    `import ${name} from`, `import { ${name} }`, `import * as ${name} from`,
    `const { ${name} }`, `let { ${name} }`, `var { ${name} }`,
  ]

  return {
    name: 'inject-window-globals',
    enforce: 'pre',
    transform(code, id) {
      if (!id.endsWith('.jsx')) return null
      if (code.includes('/* globals-injected */')) return null

      const needed = GLOBALS.filter(g => {
        // Must be referenced as a bare word
        if (!new RegExp(`\\b${g}\\b`).test(code)) return false
        // Must NOT be declared locally
        return !LOCAL_PATTERNS(g).some(p => code.includes(p))
      })

      if (needed.length === 0) return null

      const injection = needed.map(g => `const ${g} = window.${g};`).join('\n')
      return `/* globals-injected */\n${injection}\n${code}`
    }
  }
}

export default defineConfig({
  plugins: [
    injectWindowGlobals(),
    injectReactGlobal(),
    react({ jsxRuntime: 'classic' }),
  ],
  root: '.',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 8765,
  },
})
