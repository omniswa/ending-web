/** Path helpers for resolving hrefs inside an EPUB package. */
const ORIGIN = "http://epub.local/";

export function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Resolves `href` relative to the file at `fromPath`. Returns the archive path and any #fragment. */
export function resolveHref(fromPath, href) {
  const hashIndex = href.indexOf("#");
  const rawPath = hashIndex === -1 ? href : href.slice(0, hashIndex);
  const fragment =
    hashIndex === -1 ? "" : safeDecode(href.slice(hashIndex + 1));
  const url = new URL(
    rawPath,
    ORIGIN + fromPath.split("/").map(encodeURIComponent).join("/"),
  );
  return { path: safeDecode(url.pathname.slice(1)), fragment };
}

const MIME_BY_EXTENSION = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  avif: "image/avif",
};

export function guessImageType(path) {
  const extension = path.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXTENSION[extension] ?? "";
}
