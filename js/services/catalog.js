/** Loads and validates the remote library description (books.json). */
import { CATALOG_URL } from "../config.js";
import { isDateKey } from "../core/dates.js";

let cache = null;

const asText = (value) => (typeof value === "string" ? value.trim() : "");

function normalizeBook(raw) {
  const id = asText(raw?.id);
  const title = asText(raw?.title);
  if (!id || !title) return null;
  return {
    id,
    title,
    author: asText(raw.author) || "Unknown author",
    added: isDateKey(raw.added) ? raw.added : "",
    cover: asText(raw.cover) || null,
    file: asText(raw.file) || null,
    source: "catalog",
  };
}

export async function loadCatalog({ force = false } = {}) {
  if (cache && !force) return cache;
  const response = await fetch(CATALOG_URL, { cache: "no-cache" });
  if (!response.ok)
    throw new Error(
      `The library could not be loaded (HTTP ${response.status}).`,
    );
  const data = await response.json();
  if (!Array.isArray(data))
    throw new Error("books.json must contain a list of books.");
  cache = data.map(normalizeBook).filter(Boolean);
  return cache;
}
