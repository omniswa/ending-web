/**
 * Unified access to books: the remote catalog plus the reader's own imports
 * (stored in IndexedDB). Everything else asks this module to resolve a book.
 */
import { DB } from "../config.js";
import { dbBatch, dbGet, dbGetAll } from "../core/db.js";
import { todayKey } from "../core/dates.js";
import { hashBlob } from "../core/utils.js";
import { loadCatalog } from "./catalog.js";
import { openEpub } from "./epub/book.js";

const coverUrls = new Map();

function toBook(record) {
  if (record.cover && !coverUrls.has(record.id))
    coverUrls.set(record.id, URL.createObjectURL(record.cover));
  return {
    id: record.id,
    title: record.title,
    author: record.author,
    added: record.added,
    cover: coverUrls.get(record.id) ?? null,
    file: null,
    source: "owned",
  };
}

export async function listOwnedBooks() {
  const records = await dbGetAll(DB.stores.books);
  return records
    .sort((a, b) => b.addedAt - a.addedAt || a.title.localeCompare(b.title))
    .map(toBook);
}

/** Catalog + owned books. A catalog failure is reported without hiding owned books. */
export async function getAllBooks() {
  const [catalog, owned] = await Promise.allSettled([
    loadCatalog(),
    listOwnedBooks(),
  ]);
  return {
    books: [...(catalog.value ?? []), ...(owned.value ?? [])],
    catalogError: catalog.status === "rejected" ? catalog.reason : null,
  };
}

export async function resolveBook(id) {
  try {
    const catalogBook = (await loadCatalog()).find((book) => book.id === id);
    if (catalogBook) return catalogBook;
  } catch {
    /* fall through to owned books */
  }
  const record = await dbGet(DB.stores.books, id);
  return record ? toBook(record) : null;
}

export async function getBookBlob(book) {
  if (book.source === "owned") {
    const record = await dbGet(DB.stores.files, book.id);
    if (!record)
      throw new Error("The file for this book is missing from your library.");
    return record.blob;
  }
  if (!book.file) throw new Error("No EPUB file is available for this book.");
  const response = await fetch(book.file);
  if (!response.ok)
    throw new Error(
      `The book file could not be loaded (HTTP ${response.status}).`,
    );
  return response.blob();
}

const isEpubFile = (file) =>
  /\.epub$/i.test(file.name) || file.type === "application/epub+zip";

/**
 * Imports EPUB files into the user's library.
 * @returns {{added: object[], duplicates: string[], failed: {name: string, reason: string}[]}}
 */
export async function importFiles(files, onProgress) {
  const result = { added: [], duplicates: [], failed: [] };
  const list = [...files];
  for (const [index, file] of list.entries()) {
    onProgress?.(index + 1, list.length);
    if (!isEpubFile(file)) {
      result.failed.push({ name: file.name, reason: "Not an EPUB file." });
      continue;
    }
    try {
      const id = `own-${(await hashBlob(file)).slice(0, 16)}`;
      if (await dbGet(DB.stores.books, id)) {
        result.duplicates.push(file.name);
        continue;
      }
      const epub = await openEpub(file);
      const cover = await epub.getCoverBlob();
      const record = {
        id,
        title: epub.metadata.title || file.name.replace(/\.epub$/i, ""),
        author: epub.metadata.author || "Unknown author",
        added: todayKey(),
        addedAt: Date.now(),
        size: file.size,
        cover,
      };
      epub.destroy();
      await dbBatch([
        { store: DB.stores.files, type: "put", value: { id, blob: file } },
        { store: DB.stores.books, type: "put", value: record },
      ]);
      result.added.push(toBook(record));
    } catch (error) {
      console.warn(`Import failed for ${file.name}`, error);
      result.failed.push({
        name: file.name,
        reason: error.message || "The file could not be read.",
      });
    }
  }
  return result;
}

export async function removeOwnedBook(id) {
  await dbBatch([
    { store: DB.stores.books, type: "delete", key: id },
    { store: DB.stores.files, type: "delete", key: id },
  ]);
  const url = coverUrls.get(id);
  if (url) URL.revokeObjectURL(url);
  coverUrls.delete(id);
}

/** Raw records (with binary data) for backups. */
export async function readOwnedRecords() {
  const records = await dbGetAll(DB.stores.books);
  return Promise.all(
    records.map(async (record) => ({
      record,
      file: (await dbGet(DB.stores.files, record.id))?.blob ?? null,
    })),
  );
}

export async function writeOwnedRecord(record, fileBlob) {
  await dbBatch([
    {
      store: DB.stores.files,
      type: "put",
      value: { id: record.id, blob: fileBlob },
    },
    { store: DB.stores.books, type: "put", value: record },
  ]);
}
