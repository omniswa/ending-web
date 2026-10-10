#!/usr/bin/env node
// Generates books.json from the zips in books/ and the images in covers/.
//
//   node build-books.mjs
//
// For every books/<slug>.zip:
//   id     = <slug>
//   title  = manifest.json "title"   (required)
//   author = manifest.json "author"  (required)
//   added  = manifest.json "added" (YYYY-MM-DD, optional)
//            else the value already in books.json for that id (so dates stay stable)
//            else today's date
//   cover  = "covers/<slug>.<ext>" if such a file exists (png, jpg, jpeg, webp, avif, gif);
//            otherwise the key is omitted and the site shows its title placeholder.
//
// The "zip" key is not written; the site derives it as books/<id>.zip.

import { readdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readZip } from "./js/zip.js";

const ROOT = dirname(fileURLToPath(import.meta.url));
const BOOKS_DIR = join(ROOT, "books");
const COVERS_DIR = join(ROOT, "covers");
const OUT = join(ROOT, "books.json");
const COVER_EXTS = ["avif", "webp", "png", "jpg", "jpeg", "gif"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const ls = (dir) => readdir(dir).catch((e) => (e.code === "ENOENT" ? [] : Promise.reject(e)));

const previous = new Map();
try {
  for (const b of JSON.parse(await readFile(OUT, "utf8")))
    if (b?.id && DATE_RE.test(b.added)) previous.set(b.id, b.added);
} catch {}

const covers = new Map(); // slug -> file name
for (const f of (await ls(COVERS_DIR)).sort()) {
  const m = f.match(/^(.+)\.([a-z0-9]+)$/i);
  if (!m || !COVER_EXTS.includes(m[2].toLowerCase())) continue;
  const slug = m[1];
  if (covers.has(slug))
    console.warn(`! covers/${f}: ignored, covers/${covers.get(slug)} already used for "${slug}"`);
  else covers.set(slug, f);
}

const zips = (await ls(BOOKS_DIR)).filter((f) => f.toLowerCase().endsWith(".zip")).sort();
const books = [];
const errors = [];
const missing = [];

for (const file of zips) {
  const slug = basename(file, file.slice(-4));
  try {
    if (!SLUG_RE.test(slug))
      throw new Error("file name must be lowercase letters, digits and hyphens");
    const buf = await readFile(join(BOOKS_DIR, file));
    const read = await readZip(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
    const m = JSON.parse(await read("manifest.json"));
    const title = String(m?.title ?? "").trim();
    const author = String(m?.author ?? "").trim();
    if (!title) throw new Error('manifest.json has no "title"');
    if (!author) throw new Error('manifest.json has no "author"');
    if (!Array.isArray(m.chapters) || !m.chapters.length)
      throw new Error("manifest.json has no chapters");
    for (const c of m.chapters) await read(c.file); // every listed chapter must exist

    const added = DATE_RE.test(m.added) ? m.added : (previous.get(slug) ?? today());
    const book = { id: slug, title, author, added };
    if (covers.has(slug)) book.cover = `covers/${covers.get(slug)}`;
    else missing.push(slug);
    books.push(book);
  } catch (e) {
    errors.push(`books/${file}: ${e.message}`);
  }
}

for (const slug of covers.keys())
  if (!zips.includes(`${slug}.zip`)) console.warn(`! covers/${covers.get(slug)}: no matching books/${slug}.zip`);

if (errors.length) {
  console.error(errors.map((e) => "✕ " + e).join("\n"));
  console.error("\nbooks.json was not changed.");
  process.exit(1);
}

books.sort((a, b) => (a.added < b.added ? 1 : a.added > b.added ? -1 : a.id < b.id ? -1 : 1));
await writeFile(OUT, JSON.stringify(books, null, 2) + "\n");
console.log(`books.json: ${books.length} book${books.length === 1 ? "" : "s"}`);
if (missing.length)
  console.log(`No cover (placeholder will be shown): ${missing.join(", ")}`);
