/** Export and import of reading data (and optionally imported books) as one JSON file. */
import { APP_NAME, BACKUP_FORMAT, BACKUP_VERSION } from "../config.js";
import { replaceState, appStore } from "../state/store.js";
import { normalizeState } from "../state/schema.js";
import { base64ToBlob, blobToBase64, isObject } from "../core/utils.js";
import { readOwnedRecords, writeOwnedRecord } from "./library.js";

export async function createBackup({ includeBooks }) {
  const books = [];
  if (includeBooks) {
    for (const { record, file } of await readOwnedRecords()) {
      if (!file) continue;
      const { cover, ...meta } = record;
      books.push({
        ...meta,
        file: {
          type: file.type || "application/epub+zip",
          data: await blobToBase64(file),
        },
        cover: cover
          ? { type: cover.type, data: await blobToBase64(cover) }
          : null,
      });
    }
  }
  const payload = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    includesBooks: includeBooks,
    state: appStore.get(),
    books,
  };
  return {
    blob: new Blob([JSON.stringify(payload)], { type: "application/json" }),
    bookCount: books.length,
  };
}

/** Restores a backup file, replacing current progress and settings. Returns how many books were restored. */
export async function restoreBackup(file) {
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch {
    throw new Error("This file is not valid JSON.");
  }
  if (
    !isObject(data) ||
    (data.format !== BACKUP_FORMAT && data.format !== "folio-backup")
  )
    throw new Error(`This is not a ${APP_NAME} backup file.`);
  if (!(data.version <= BACKUP_VERSION))
    throw new Error(`This backup was made by a newer version of ${APP_NAME}.`);

  let restored = 0;
  for (const item of Array.isArray(data.books) ? data.books : []) {
    if (
      !isObject(item) ||
      typeof item.id !== "string" ||
      !item.id.startsWith("own-") ||
      !isObject(item.file)
    )
      continue;
    const { file: fileData, cover: coverData, ...meta } = item;
    const record = {
      id: meta.id,
      title: String(meta.title ?? "Untitled"),
      author: String(meta.author ?? "Unknown author"),
      added: String(meta.added ?? ""),
      addedAt: Number.isFinite(meta.addedAt) ? meta.addedAt : Date.now(),
      size: Number.isFinite(meta.size) ? meta.size : 0,
      cover: isObject(coverData)
        ? await base64ToBlob(coverData.data, coverData.type || "image/jpeg")
        : null,
    };
    await writeOwnedRecord(
      record,
      await base64ToBlob(fileData.data, fileData.type),
    );
    restored++;
  }
  replaceState(normalizeState(data.state));
  return restored;
}
