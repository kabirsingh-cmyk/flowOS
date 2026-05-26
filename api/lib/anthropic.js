/**
 * Shared Claude model selection.
 *
 * Override via env vars:
 *   ANTHROPIC_MODEL       — main model  (default: claude-opus-4-5)
 *   ANTHROPIC_MODEL_FAST  — fast model  (default: claude-haiku-4-5-20251001)
 *
 * Usage:
 *   import { getModel, getFastModel } from './lib/anthropic.js';
 *   model: getModel()       // heavyweight: chat, insights, drafts, brand-import
 *   model: getFastModel()   // lightweight: title generation, quick classify
 */

export function getModel() {
  return process.env.ANTHROPIC_MODEL || "claude-opus-4-5";
}

export function getFastModel() {
  return process.env.ANTHROPIC_MODEL_FAST || "claude-haiku-4-5-20251001";
}
