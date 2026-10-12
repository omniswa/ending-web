/**
 * The single app-wide store. State is small (favorites, progress, goal, prefs)
 * so it lives in localStorage; binary data lives in IndexedDB (see core/db.js).
 */
import { STORAGE_KEY } from "../config.js";
import { createStore } from "../core/store.js";
import { debounce } from "../core/utils.js";
import { createDefaultState, normalizeState } from "./schema.js";

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

const persist = debounce(() => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appStore.get()));
  } catch (error) {
    console.warn("Could not save data.", error);
  }
}, 300);

appStore.subscribe(persist);
window.addEventListener("pagehide", persist.flush);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") persist.flush();
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
  persist.flush();
}
