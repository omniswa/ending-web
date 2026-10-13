/**
 * The single app-wide store. Small state (favorites, progress, goal, prefs)
 * lives in localStorage. Highlights, which grow without bound, and binary data
 * live in IndexedDB (see core/db.js).
 *
 * Highlights stay in the in-memory store like everything else, so the rest of
 * the app does not care where they are persisted. Persisting them is
 * incremental (only added, changed or removed items are written), and they
 * only leave localStorage once IndexedDB has confirmed a write, so a failed
 * migration or an unavailable IndexedDB never loses data.
 */
import { DB, STORAGE_KEY } from "../config.js";
import { createStore } from "../core/store.js";
import { dbBatch, dbGetAll } from "../core/db.js";
import { debounce } from "../core/utils.js";
import {
  createDefaultState,
  normalizeHighlights,
  normalizeState,
} from "./schema.js";

const HIGHLIGHTS = DB.stores.highlights;
const WRITE_DELAY_MS = 300;
/** Do not hold the app back for longer than this while IndexedDB opens. */
const HYDRATE_TIMEOUT_MS = 3000;

// ----- Save failures -----

const errorListeners = new Set();

/** Calls `listener(error)` when the app could not save data. Returns an unsubscribe function. */
export function onPersistError(listener) {
  errorListeners.add(listener);
  return () => errorListeners.delete(listener);
}

function reportError(error) {
  for (const listener of errorListeners) {
    try {
      listener(error);
    } catch {
      /* a broken listener must not break saving */
    }
  }
}

// ----- State in localStorage -----

function load() {
  try {
    const raw =
      localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem("folio:state");
    return normalizeState(raw ? JSON.parse(raw) : null);
  } catch (error) {
    console.warn("Could not read saved data, starting fresh.", error);
    return createDefaultState();
  }
}

export const appStore = createStore(load());

/** True once IndexedDB holds every highlight; only then are they left out of localStorage. */
let highlightsInDb = false;

function snapshot() {
  const state = appStore.get();
  if (!highlightsInDb) return state;
  const { highlights: _inDb, ...rest } = state;
  return rest;
}

const persist = debounce(() => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot()));
  } catch (error) {
    console.warn("Could not save data.", error);
    reportError(error);
  }
}, WRITE_DELAY_MS);
const persistNow = () => {
  persist();
  persist.flush();
};

appStore.subscribe(persist);

// ----- Highlights in IndexedDB -----

/** id -> the object last written to (or read from) IndexedDB. */
let stored = new Map();
/** The highlights array that IndexedDB was last brought in line with. */
let storedList = null;
/** The highlights array last seen by the store listener. */
let seenList = null;

async function writeHighlights() {
  const list = appStore.get().highlights;
  if (list === storedList) return;

  const operations = [];
  const next = new Map();
  for (const item of list) {
    next.set(item.id, item);
    // Updates are immutable, so a changed reference means a changed highlight.
    if (stored.get(item.id) !== item)
      operations.push({ store: HIGHLIGHTS, type: "put", value: item });
  }
  for (const id of stored.keys())
    if (!next.has(id))
      operations.push({ store: HIGHLIGHTS, type: "delete", key: id });

  try {
    if (operations.length) await dbBatch(operations);
    stored = next;
    storedList = list;
    if (!highlightsInDb) {
      // IndexedDB now has everything: stop duplicating highlights in localStorage.
      highlightsInDb = true;
      persistNow();
    }
  } catch (error) {
    console.warn("Could not save highlights to IndexedDB.", error);
    if (highlightsInDb) {
      // Fall back to localStorage so nothing is lost (it reports its own failures).
      highlightsInDb = false;
      persistNow();
    }
  }
}

let writeQueue = Promise.resolve();
const scheduleWrite = debounce(() => {
  writeQueue = writeQueue.then(writeHighlights);
}, WRITE_DELAY_MS);

function onStateChange(state) {
  if (state.highlights === seenList) return;
  seenList = state.highlights;
  scheduleWrite();
}

/** Merges highlights saved in IndexedDB into the store and starts persisting changes. */
async function hydrateHighlights() {
  const fromDb = normalizeHighlights(await dbGetAll(HIGHLIGHTS));
  stored = new Map(fromDb.map((item) => [item.id, item]));

  appStore.update((state) => {
    // Highlights still held in localStorage (older versions) win over the copy in IndexedDB.
    const have = new Set(state.highlights.map((item) => item.id));
    const missing = fromDb.filter((item) => !have.has(item.id));
    if (!missing.length) return state;
    return {
      ...state,
      highlights: [...state.highlights, ...missing].sort(
        (a, b) => b.createdAt - a.createdAt,
      ),
    };
  });

  seenList = appStore.get().highlights;
  appStore.subscribe(onStateChange);
  // Also migrates highlights that so far only exist in localStorage.
  await writeHighlights();
}

/**
 * Resolves once saved highlights are loaded (or loading took too long or
 * failed). Pages should start after this so they do not flash an empty state.
 * Never rejects.
 */
export const storeReady = Promise.race([
  hydrateHighlights().catch((error) => {
    console.warn("Could not load highlights from IndexedDB.", error);
  }),
  new Promise((resolve) => setTimeout(resolve, HYDRATE_TIMEOUT_MS)),
]);

// ----- Flushing -----

function flushAll() {
  persist.flush();
  scheduleWrite.flush();
}
window.addEventListener("pagehide", flushAll);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") flushAll();
});

/** Calls `listener(selected)` whenever the selected slice changes (and once immediately by default). */
export function subscribeSelect(selector, listener, { immediate = true } = {}) {
  let previous = selector(appStore.get());
  if (immediate) listener(previous);
  return appStore.subscribe((state) => {
    const next = selector(state);
    if (Object.is(next, previous)) return;
    previous = next;
    listener(next);
  });
}

/** Replaces the entire state (used by backup import). */
export function replaceState(rawState) {
  const next = normalizeState(rawState);
  appStore.update(() => next);
  flushAll();
}
