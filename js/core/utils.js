/** Small, dependency-free helpers shared across the app. */

export const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
export const round = (n, digits = 1) =>
  Math.round(n * 10 ** digits) / 10 ** digits;
export const isObject = (v) =>
  v !== null && typeof v === "object" && !Array.isArray(v);
export const plural = (n, one, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`;

/** Trailing debounce. The returned function also exposes `flush` and `cancel`. */
export function debounce(fn, wait) {
  let timer = null;
  let lastArgs = null;
  const run = () => {
    timer = null;
    const args = lastArgs;
    lastArgs = null;
    fn(...args);
  };
  const debounced = (...args) => {
    lastArgs = args;
    clearTimeout(timer);
    timer = setTimeout(run, wait);
  };
  debounced.flush = () => {
    if (timer !== null) {
      clearTimeout(timer);
      run();
    }
  };
  debounced.cancel = () => {
    clearTimeout(timer);
    timer = null;
    lastArgs = null;
  };
  return debounced;
}

/** Runs `fn` at most once per animation frame. */
export function rafThrottle(fn) {
  let queued = false;
  return (...args) => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      fn(...args);
    });
  };
}

/** Stable hue (0-359) derived from text; used for generated covers. */
export function hueFrom(text) {
  let hash = 0;
  for (const ch of String(text)) hash = (hash * 31 + ch.codePointAt(0)) >>> 0;
  return hash % 360;
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function blobToBase64(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const CHUNK = 0x8000; // keeps String.fromCharCode within argument limits
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK)
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return btoa(binary);
}

export async function base64ToBlob(base64, type = "application/octet-stream") {
  const response = await fetch(`data:${type};base64,${base64}`);
  return response.blob();
}

/** SHA-1 hex digest of a Blob; falls back to a random id where unavailable. */
export async function hashBlob(blob) {
  if (!globalThis.crypto?.subtle)
    return `${Date.now().toString(16)}${Math.random().toString(16).slice(2, 10)}`;
  const digest = await crypto.subtle.digest("SHA-1", await blob.arrayBuffer());
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
