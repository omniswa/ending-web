/** Short text highlights saved from the reader; each one can become a quote card. */
import { HIGHLIGHT } from "../config.js";
import { appStore } from "../state/store.js";

export const getHighlights = () => appStore.get().highlights;

/** Collapses whitespace so selections from different layouts compare equal. */
export const cleanHighlightText = (text) =>
  String(text ?? "")
    .replace(/\s+/g, " ")
    .trim();

export const isValidHighlightLength = (text) =>
  text.length >= HIGHLIGHT.minLength && text.length <= HIGHLIGHT.maxLength;

const newId = () =>
  `hl-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/**
 * Saves a highlight. Selecting the same passage of the same book twice returns
 * the existing one. Returns `{ highlight, created }`, or null if the text is
 * empty or does not fit the allowed length.
 */
export function addHighlight({
  bookId,
  bookTitle,
  author,
  chapter,
  chapterTitle,
  text,
}) {
  const clean = cleanHighlightText(text);
  if (!bookId || !isValidHighlightLength(clean)) return null;

  const existing = getHighlights().find(
    (item) => item.bookId === bookId && item.text === clean,
  );
  if (existing) return { highlight: existing, created: false };

  const highlight = {
    id: newId(),
    bookId,
    bookTitle: bookTitle || "Untitled",
    author: author || "Unknown author",
    chapter: Number.isFinite(chapter) ? chapter : 0,
    chapterTitle: chapterTitle || "",
    text: clean,
    createdAt: Date.now(),
  };
  appStore.update((s) => ({ ...s, highlights: [highlight, ...s.highlights] }));
  return { highlight, created: true };
}

/** Puts a previously removed highlight back (used by "Undo"). */
export function restoreHighlight(highlight) {
  appStore.update((s) =>
    s.highlights.some((item) => item.id === highlight.id)
      ? s
      : {
          ...s,
          highlights: [highlight, ...s.highlights].sort(
            (a, b) => b.createdAt - a.createdAt,
          ),
        },
  );
}

export function removeHighlight(id) {
  appStore.update((s) =>
    s.highlights.some((item) => item.id === id)
      ? { ...s, highlights: s.highlights.filter((item) => item.id !== id) }
      : s,
  );
}
