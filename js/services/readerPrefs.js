import { READER_DEFAULTS } from "../config.js";
import { appStore } from "../state/store.js";
import { normalizeReader } from "../state/schema.js";

export const getReaderPrefs = () => appStore.get().reader;

/** Updates one preference; the value is validated/clamped by the schema. */
export function setReaderPref(key, value) {
  if (!(key in READER_DEFAULTS)) return;
  appStore.update((s) => {
    const next = normalizeReader({ ...s.reader, [key]: value });
    return next[key] === s.reader[key] ? s : { ...s, reader: next };
  });
}

export function resetReaderPrefs() {
  appStore.update((s) => ({ ...s, reader: { ...READER_DEFAULTS } }));
}
