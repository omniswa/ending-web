/**
 * Central configuration. Everything tweakable lives here so feature code
 * never contains magic numbers or duplicated option lists.
 */
export const APP_NAME = "3NDING";
export const STORAGE_KEY = "3nding:state";
export const STATE_VERSION = 1;
export const BACKUP_FORMAT = "3nding-backup";
export const BACKUP_VERSION = 1;
export const CATALOG_URL = "books.json";

export const DB = Object.freeze({
  name: "3nding",
  version: 1,
  stores: Object.freeze({ books: "books", files: "files" }),
});

export const GOAL = Object.freeze({ min: 5, max: 240, step: 5, default: 15 });
/** Reading time stops counting after this long without interaction. */
export const IDLE_TIMEOUT_MS = 60_000;
/** Books added within this many days are flagged as new. */
export const NEW_BOOK_DAYS = 14;
/** Reaching this percentage marks a book as finished automatically. */
export const FINISH_THRESHOLD = 99;
/** Default number of books per page in collection views. */
export const BOOKS_PER_PAGE = 10;

/** Highlights are deliberately short so they fit a quote card. */
export const HIGHLIGHT = Object.freeze({ minLength: 3, maxLength: 280 });

export const READER_DEFAULTS = Object.freeze({
  font: "serif",
  theme: "paper",
  align: "left",
  size: 19,
  lineHeight: 1.7,
  letterSpacing: 0,
  padding: 32,
});

export const READER_OPTIONS = Object.freeze({
  font: [
    { value: "sans", label: "Sans" },
    { value: "serif", label: "Serif" },
    { value: "mono", label: "Mono" },
  ],
  theme: [
    { value: "paper", label: "Paper" },
    { value: "sepia", label: "Sepia" },
    { value: "dark", label: "Dark" },
    { value: "oled", label: "OLED" },
  ],
  align: [
    { value: "left", label: "Left" },
    { value: "justify", label: "Justify" },
  ],
});

export const READER_RANGES = Object.freeze({
  size: { min: 14, max: 30, step: 1, label: "Text size" },
  lineHeight: { min: 1.3, max: 2.2, step: 0.05, label: "Line spacing" },
  letterSpacing: { min: 0, max: 0.12, step: 0.01, label: "Letter spacing" },
  padding: { min: 8, max: 120, step: 4, label: "Page padding" },
});
