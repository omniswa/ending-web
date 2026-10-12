/** Per-book reading progress and finished state. */
import { FINISH_THRESHOLD } from "../config.js";
import { round } from "../core/utils.js";
import { appStore } from "../state/store.js";

const EMPTY = Object.freeze({
  chapter: 0,
  offset: 0,
  percent: 0,
  finished: false,
  finishedAt: null,
  updatedAt: 0,
});

export const getProgress = (id) => appStore.get().progress[id] ?? EMPTY;

/** Percentage to display: finished books always read 100%. */
export function displayPercent(id) {
  const entry = getProgress(id);
  return entry.finished ? 100 : Math.round(entry.percent);
}

/** Saves the reading position. Returns true when this save finished the book. */
export function saveLocation(id, { chapter, offset, percent }) {
  const wasFinished = getProgress(id).finished;
  appStore.update((s) => {
    const previous = s.progress[id] ?? EMPTY;
    const finished = previous.finished || percent >= FINISH_THRESHOLD;
    const entry = {
      ...previous,
      chapter,
      offset,
      percent: round(percent),
      finished,
      finishedAt: finished ? (previous.finishedAt ?? Date.now()) : null,
      updatedAt: Date.now(),
    };
    return { ...s, progress: { ...s.progress, [id]: entry } };
  });
  return !wasFinished && getProgress(id).finished;
}

export function markFinished(id) {
  appStore.update((s) => {
    const previous = s.progress[id] ?? EMPTY;
    const entry = {
      ...previous,
      percent: 100,
      finished: true,
      finishedAt: Date.now(),
      updatedAt: Date.now(),
    };
    return { ...s, progress: { ...s.progress, [id]: entry } };
  });
}

export function readAgain(id) {
  appStore.update((s) => ({
    ...s,
    progress: { ...s.progress, [id]: { ...EMPTY, updatedAt: Date.now() } },
  }));
}

/** Removes all traces of a book (used when an imported book is deleted). */
export function forgetBook(id) {
  appStore.update((s) => {
    const { [id]: _removed, ...progress } = s.progress;
    return { ...s, progress, favorites: s.favorites.filter((f) => f !== id) };
  });
}
