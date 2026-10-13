# 3NDING — vanilla EPUB reader

Pure HTML, CSS and JavaScript (ES modules). No frameworks, no build step, no dependencies —
even the EPUB/ZIP parsing is written from scratch on top of `DecompressionStream`.

## Run

ES modules and `fetch` need a web server (opening `index.html` directly will not work):

```bash
cd folio
python3 -m http.server 8000      # or: npx serve
# open http://localhost:8000
```

## Features

| Page | Hash route | What it does |
|------|-----------|--------------|
| Home | `#/` | Browse `books.json` in cards (hover/tap overlay: favorite, share, read, progress), search + sort, **daily goal + streak**, **continue reading** (favorited books in progress) |
| Favorites | `#/favorites` | Same grid; read / continue / read again, unfavorite (with undo), mark finished, share, filter by status |
| Highlights | `#/highlights` | Short passages (3–280 characters) saved from the reader; turn any of them into a **quote card** (1080×1350 PNG, four themes) to share or download; filter by book, remove with undo. Each is stored with a color and its position in the chapter so it can be painted back into the book |
| My books | `#/library` | Import your own `.epub` files (picker or drag & drop); stored privately in IndexedDB |
| Reader | `#/read/:id` | Font (sans/serif/mono), theme (paper/sepia/dark/OLED), alignment, text size, line + letter spacing, page padding, reset; contents panel; auto-hiding chrome; keyboard ←/→ for chapters; **select text → pick a highlight color (yellow/green/blue/pink) or make a Quote card**; highlights are painted into the text, tap one to recolor, remove or share it |
| Backup | header button | Export/import progress + settings, optionally including imported books |

**Streaks:** reading time is counted only while the reader is open, visible and recently touched
(60 s idle limit). Reaching the daily goal marks the day *done*; the streak is the run of done
days. Week indicators show **done**, **in progress** (today), **missed**, and upcoming days.

## books.json

```json
{ "id": "slug", "title": "…", "author": "…", "added": "2026-10-01", "cover": "https://…", "file": "epubs/slug.epub" }
```
`file` is the one addition to your original format: the URL/path of the EPUB to open.
`tools/generate-sample-epubs.py` creates placeholder EPUBs for every entry so you can try the reader;
replace them with real files by editing `file`.

## Architecture

```
index.html            static shell (header, tab bar, toast region)
css/                  tokens → base → layout → components → reader
js/
  main.js, routes.js  bootstrap + lazy route table
  config.js           all constants and option lists
  core/               dom (h/icon), router, store, db (IndexedDB), dates, utils
  state/              schema (defaults + validation), store (localStorage persistence)
  services/           catalog, library, progress, favorites, goals, readerPrefs,
                      readingTimer, share, backup, highlights, quoteCard (canvas → PNG)
  services/epub/      zip, paths, sanitize, book (OPF/TOC parsing, chapter loading)
  components/         bookCard, bookGrid, goalCard, continueList, dialog, toast, …
  pages/              home, favorites, highlights, library, reader  (each exports mount() → cleanup)
```

Principles: pages own their lifecycle (`mount` returns cleanup); components never fetch;
services never touch the DOM (except toasts); all persisted data passes through
`normalizeState`; book markup is sanitized and styled only by the reader's own CSS.

**Storage:** small state (favorites, progress, goal, days, prefs) → `localStorage`;
binary data (imported EPUBs, covers) → IndexedDB.

## Notes

- Remote cover images (picsum) need internet; a generated cover shows otherwise.
- Browsers need `DecompressionStream('deflate-raw')` (Chrome 80+, Safari 16.4+, Firefox 113+).
- DRM-protected EPUBs are not supported.
