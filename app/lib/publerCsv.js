// FlowOS — Publer Bulk Schedule CSV utility
// Pure functions. Tenant-agnostic. Takes a structured day-output and emits a
// 12-column CSV string compatible with Publer's bulk import.
//
// Spec: https://publer.com/help/en/article/what-csv-template-should-i-use-18qhxcq/
// Required columns (order matters, all 12 must be present even if blank):
//   Date | Text | Link | Media URL | Title | Label | Alt text(s) | Comment(s)
//   | Pin board, FB album, or Google category | Post subtype | CTA | Reminder
//
// Date format: "YYYY/MM/DD HH:MM" (24h, local)
// Multi-photo carousels: comma-separate Media URLs in one row, Alt text(s) double-pipe ||
// Post subtypes: Photo | Reel | Story | Short | PDF | Event | Offer
//
// USAGE:
//   import { buildPublerCsv } from '/app/lib/publerCsv.js';
//   const csv = buildPublerCsv({ tenant, dayOutput, group: 'meta' });
//   const pinCsv = buildPublerCsv({ tenant, dayOutput, group: 'pinterest' });

const PUBLER_CSV_HEADER = [
  'Date',
  'Text',
  'Link',
  'Media URL',
  'Title',
  'Label',
  'Alt text(s)',
  'Comment(s)',
  'Pin board, FB album, or Google category',
  'Post subtype',
  'CTA',
  'Reminder',
];

// ─── CSV escaping (RFC 4180) ────────────────────────────────────────────────
function csvCell(val) {
  if (val === null || val === undefined) return '';
  const s = String(val);
  // Quote if contains comma, quote, or newline. Escape internal quotes.
  if (/[",\n\r]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function row(cells) {
  return cells.map(csvCell).join(',');
}

// ─── Date formatter (Publer expects YYYY/MM/DD HH:MM, 24h) ──────────────────
function formatDate(date, time) {
  // date: 'YYYY-MM-DD'  or Date object
  // time: 'HH:MM'       or omitted
  let d;
  if (typeof date === 'string') {
    d = new Date(date + (time ? `T${time}:00` : 'T00:00:00'));
  } else {
    d = date;
  }
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mn = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}/${mm}/${dd} ${hh}:${mn}`;
}

// ─── Default time-of-day per slot (per platform engagement curves) ──────────
const DEFAULT_TIMES = {
  feed:     '09:00',
  story:    '09:30',
  carousel: '13:00',
  reel:     '18:00',
  pin:      '09:00',
};

// ─── Pinterest board per SKU type (universal default; tenant can override) ──
const DEFAULT_PIN_BOARDS = {
  bath_soap:    'Soaps',
  sensitive_soap: 'Soaps',
  body_oil:     'Body Oils',
  face_mist:    'Face Mists',
  face_serum:   'Face Serums',
  hair_oil:     'Hair',
  cold_pressed: 'Oils',
};

// ─── Post subtype mapping ───────────────────────────────────────────────────
function subtypeForSlot(slotKind) {
  if (slotKind === 'reel')          return 'Reel';
  if (slotKind === 'story')         return 'Story';
  if (slotKind === 'short')         return 'Short';
  return 'Photo';
}

// ─── Build a single Publer row from a slot ──────────────────────────────────
function buildSlotRow({ tenant, dayOutput, slot }) {
  // slot: { kind, scheduledTime, captionText, mediaPaths, altTexts, title, productUrl, pinBoard }
  const date = formatDate(dayOutput.date, slot.scheduledTime || DEFAULT_TIMES[slot.kind] || '09:00');

  // Media URLs comma-separated for carousels; blank if operator will drag-drop
  const mediaUrls = (slot.mediaUrls || []).join(',');

  // Alt texts double-pipe separated for multi-photo carousels
  const altTexts = (slot.altTexts || []).join('||');

  // Comments double-pipe separated for threaded posts
  const comments = (slot.comments || []).join('||');

  // Label combines tenant + day + slot kind for searchability in Publer
  const label = `${tenant.name} ${dayOutput.dayLabel || ''} ${slot.kind.toUpperCase()}`.trim();

  return row([
    date,
    slot.captionText || '',
    slot.productUrl || '',
    mediaUrls,
    slot.title || '',
    label,
    altTexts,
    comments,
    slot.pinBoard || '',
    subtypeForSlot(slot.kind),
    slot.cta || '',
    slot.reminder ? 'TRUE' : '',
  ]);
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Build a Publer-compliant 12-column CSV string for a single day.
 *
 * @param {Object} args
 * @param {Object} args.tenant     — { id, name, ... }
 * @param {Object} args.dayOutput  — {
 *     date: 'YYYY-MM-DD',
 *     dayLabel: 'Thu',
 *     skuId: 'BOD-001',
 *     skuType: 'body_oil',
 *     productUrl: 'https://...',
 *     captions: { feed, story, carousel, reel?, pin },
 *     assetPaths: { feed, story, carouselSlides[], reel?, pin },
 *     altTexts:   { feed, story, carouselSlides[], reel?, pin }
 *   }
 * @param {'meta'|'pinterest'} args.group  — which platform group this CSV is for
 *
 * @returns {string} CSV text (header + rows, separated by \n, terminated with \n)
 */
export function buildPublerCsv({ tenant, dayOutput, group }) {
  const rows = [row(PUBLER_CSV_HEADER)];

  if (group === 'meta') {
    // Meta group: IG + FB. One row per slot.
    rows.push(buildSlotRow({
      tenant, dayOutput,
      slot: {
        kind: 'feed',
        captionText: dayOutput.captions.feed,
        mediaUrls: dayOutput.assetPaths.feed ? [dayOutput.assetPaths.feed] : [],
        altTexts: dayOutput.altTexts?.feed ? [dayOutput.altTexts.feed] : [],
        productUrl: dayOutput.productUrl,
      },
    }));

    rows.push(buildSlotRow({
      tenant, dayOutput,
      slot: {
        kind: 'story',
        captionText: dayOutput.captions.story,
        mediaUrls: dayOutput.assetPaths.story ? [dayOutput.assetPaths.story] : [],
        altTexts: dayOutput.altTexts?.story ? [dayOutput.altTexts.story] : [],
      },
    }));

    rows.push(buildSlotRow({
      tenant, dayOutput,
      slot: {
        kind: 'carousel',
        captionText: dayOutput.captions.carousel,
        mediaUrls: dayOutput.assetPaths.carouselSlides || [],
        altTexts: dayOutput.altTexts?.carouselSlides || [],
      },
    }));

    if (dayOutput.captions.reel && dayOutput.assetPaths.reel) {
      rows.push(buildSlotRow({
        tenant, dayOutput,
        slot: {
          kind: 'reel',
          captionText: dayOutput.captions.reel,
          mediaUrls: [dayOutput.assetPaths.reel],
          altTexts: dayOutput.altTexts?.reel ? [dayOutput.altTexts.reel] : [],
        },
      }));
    }
  }

  if (group === 'pinterest') {
    // Pinterest group: one pin row.
    const pinBoardOverride = tenant?.pinBoardOverrides?.[dayOutput.skuType];
    const pinBoard = pinBoardOverride || DEFAULT_PIN_BOARDS[dayOutput.skuType] || 'Pins';

    rows.push(buildSlotRow({
      tenant, dayOutput,
      slot: {
        kind: 'pin',
        captionText: dayOutput.captions.pin,
        mediaUrls: dayOutput.assetPaths.pin ? [dayOutput.assetPaths.pin] : [],
        altTexts: dayOutput.altTexts?.pin ? [dayOutput.altTexts.pin] : [],
        productUrl: dayOutput.productUrl,
        title: dayOutput.captions.pinTitle || dayOutput.skuTitle || '',
        pinBoard,
      },
    }));
  }

  return rows.join('\n') + '\n';
}

/**
 * Build BOTH meta and pinterest CSVs in one call. Returns an object keyed
 * by group, ready to write to disk or attach to a Studio download.
 *
 * @returns {{ meta: string, pinterest: string }}
 */
export function buildPublerCsvBundle({ tenant, dayOutput }) {
  return {
    meta:      buildPublerCsv({ tenant, dayOutput, group: 'meta' }),
    pinterest: buildPublerCsv({ tenant, dayOutput, group: 'pinterest' }),
  };
}

// ─── Validation helper ──────────────────────────────────────────────────────

/**
 * Sanity-check a CSV string before download. Throws if structure is wrong.
 */
export function validatePublerCsv(csvText) {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) throw new Error('CSV must have header + at least 1 row');
  const header = lines[0].split(',');
  if (header.length !== 12) throw new Error(`Header must have 12 columns, got ${header.length}`);
  // Per-row column count check (handles quoted commas correctly via simple state machine)
  for (let i = 1; i < lines.length; i++) {
    const cellCount = countCsvColumns(lines[i]);
    if (cellCount !== 12) {
      throw new Error(`Row ${i} has ${cellCount} columns, expected 12`);
    }
  }
  return true;
}

function countCsvColumns(line) {
  let count = 1;
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === ',' && !inQuotes) {
      count++;
    }
  }
  return count;
}
