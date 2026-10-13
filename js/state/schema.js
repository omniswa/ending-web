/**
 * Shape, defaults and validation of persisted state. Anything read from
 * localStorage or an imported backup passes through `normalizeState`, so the
 * rest of the app can trust the structure.
 */
import {
  GOAL,
  HIGHLIGHT,
  READER_DEFAULTS,
  READER_OPTIONS,
  READER_RANGES,
  STATE_VERSION,
} from "../config.js";
import { isDateKey, todayKey } from "../core/dates.js";
import { clamp, isObject } from "../core/utils.js";

const finiteOr = (value, fallback) =>
  Number.isFinite(value) ? value : fallback;

export function createDefaultState() {
  return {
    version: STATE_VERSION,
    favorites: [],
    progress: {},
    goal: { minutes: GOAL.default, startedOn: todayKey() },
    days: {},
    reader: { ...READER_DEFAULTS },
    highlights: [],
  };
}

export function normalizeReader(raw) {
  const out = { ...READER_DEFAULTS };
  if (!isObject(raw)) return out;
  for (const [key, options] of Object.entries(READER_OPTIONS)) {
    if (options.some((option) => option.value === raw[key]))
      out[key] = raw[key];
  }
  for (const [key, range] of Object.entries(READER_RANGES)) {
    if (Number.isFinite(raw[key]))
      out[key] = clamp(raw[key], range.min, range.max);
  }
  return out;
}

function normalizeProgress(raw) {
  const out = {};
  if (!isObject(raw)) return out;
  for (const [id, entry] of Object.entries(raw)) {
    if (!isObject(entry)) continue;
    out[id] = {
      chapter: Math.max(0, Math.floor(finiteOr(entry.chapter, 0))),
      offset: clamp(finiteOr(entry.offset, 0), 0, 1),
      percent: clamp(finiteOr(entry.percent, 0), 0, 100),
      finished: entry.finished === true,
      finishedAt: Number.isFinite(entry.finishedAt) ? entry.finishedAt : null,
      updatedAt: finiteOr(entry.updatedAt, 0),
    };
  }
  return out;
}

function normalizeDays(raw) {
  const out = {};
  if (!isObject(raw)) return out;
  for (const [key, day] of Object.entries(raw)) {
    if (!isDateKey(key) || !isObject(day)) continue;
    out[key] = {
      seconds: Math.max(0, Math.floor(finiteOr(day.seconds, 0))),
      met: day.met === true,
    };
  }
  return out;
}

const asString = (value, fallback = "") =>
  typeof value === "string" ? value : fallback;

/** Newest first. Entries with unusable text or duplicate ids are dropped. */
function normalizeHighlights(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const out = [];
  for (const entry of raw) {
    if (!isObject(entry)) continue;
    const id = asString(entry.id);
    const bookId = asString(entry.bookId);
    const text = asString(entry.text).replace(/\s+/g, " ").trim();
    if (!id || !bookId || seen.has(id)) continue;
    if (text.length < HIGHLIGHT.minLength || text.length > HIGHLIGHT.maxLength)
      continue;
    seen.add(id);
    out.push({
      id,
      bookId,
      bookTitle: asString(entry.bookTitle, "Untitled"),
      author: asString(entry.author, "Unknown author"),
      chapter: Math.max(0, Math.floor(finiteOr(entry.chapter, 0))),
      chapterTitle: asString(entry.chapterTitle),
      text,
      color: HIGHLIGHT.colors.some((c) => c.value === entry.color)
        ? entry.color
        : HIGHLIGHT.defaultColor,
      // Where the passage sits in its chapter (whitespace-free character offset
      // and the characters just before it); -1 means unknown.
      offset: Number.isFinite(entry.offset)
        ? Math.max(0, Math.floor(entry.offset))
        : -1,
      prefix: asString(entry.prefix).slice(-24),
      createdAt: finiteOr(entry.createdAt, 0),
    });
  }
  return out.sort((a, b) => b.createdAt - a.createdAt);
}

export function normalizeState(raw) {
  const base = createDefaultState();
  if (!isObject(raw)) return base;
  const goal = isObject(raw.goal) ? raw.goal : {};
  return {
    version: STATE_VERSION,
    favorites: [
      ...new Set(
        (Array.isArray(raw.favorites) ? raw.favorites : []).filter(
          (id) => typeof id === "string",
        ),
      ),
    ],
    progress: normalizeProgress(raw.progress),
    goal: {
      minutes: clamp(
        Math.round(finiteOr(goal.minutes, base.goal.minutes)),
        GOAL.min,
        GOAL.max,
      ),
      startedOn: isDateKey(goal.startedOn)
        ? goal.startedOn
        : base.goal.startedOn,
    },
    days: normalizeDays(raw.days),
    reader: normalizeReader(raw.reader),
    highlights: normalizeHighlights(raw.highlights),
  };
}
