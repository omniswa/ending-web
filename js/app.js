const P =
  '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
const ICONS = {
  heart:
    '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/>',
  share:
    '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>',
  check:
    '<circle cx="12" cy="12" r="10"/><path d="m7.5 12 3 3 6-6" fill="none" stroke="white" stroke-width="2"/>',
  back: '<path d="M19 12H5m7-7-7 7 7 7"/>',
  full: '<path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>',
};
export const icon = (n) => P + ICONS[n] + "</svg>";
export const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );

export const norm = (s) =>
  String(s)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

let warned = false;
export const store = {
  read(k, d) {
    try {
      return JSON.parse(localStorage.getItem("3nding:" + k)) ?? d;
    } catch {
      return d;
    }
  },
  write(k, v) {
    try {
      localStorage.setItem("3nding:" + k, JSON.stringify(v));
      return true;
    } catch {
      if (!warned) {
        warned = true;
        toast("Could not save – browser storage is full or blocked");
      }
      return false;
    }
  },
};
export const obj = (k) => {
  const v = store.read(k, {});
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
};

// fetch() with a timeout, so a stalled request ends in an error message
// instead of leaving a skeleton on screen forever.
export async function fetchTimeout(url, opts = {}, ms = 20000) {
  try {
    return await fetch(url, {
      ...opts,
      signal: AbortSignal.timeout ? AbortSignal.timeout(ms) : undefined,
    });
  } catch (e) {
    if (e?.name === "TimeoutError") throw new Error("This is taking too long");
    if (e instanceof TypeError) throw new Error("You seem to be offline");
    throw e;
  }
}

let booksPromise;
export const loadBooks = () =>
  (booksPromise ??= fetchTimeout("books.json", { cache: "no-cache" })
    .then((r) => {
      if (!r.ok) throw new Error("Could not load the library");
      return r.json();
    })
    .then((list) => {
      if (!Array.isArray(list)) throw new Error("The library data is invalid");
      const seen = new Set();
      return list
        .filter(
          (b) =>
            b &&
            typeof b.id === "string" &&
            b.id &&
            !seen.has(b.id) &&
            seen.add(b.id),
        )
        .map((b) => {
          const title = String(b.title ?? "Untitled"),
            author = String(b.author ?? "Unknown");
          return {
            ...b,
            title,
            author,
            added: String(b.added ?? ""),
            cover: b.cover ? String(b.cover) : "",
            zip: b.zip ? String(b.zip) : `books/${b.id}.zip`,
            _s: norm(`${title} ${author}`),
          };
        });
    })
    .catch((e) => {
      booksPromise = null;
      throw e;
    }));

// "favs" holds one entry per book that is favorited and/or finished.
// `fav: false` marks a finished book that is NOT a favorite. Entries without
// the flag (including all data saved by older versions) count as favorites.
export const favs = () => obj("favs");
export const isFav = (f, id) => !!f[id] && f[id].fav !== false;
export function toggleFav(id) {
  const f = favs();
  if (isFav(f, id)) {
    // Un-favoriting a finished book must not wipe its finished state.
    if (f[id].done) f[id] = { ...f[id], fav: false };
    else delete f[id];
  } else {
    f[id] = { at: Date.now(), done: !!f[id]?.done };
  }
  store.write("favs", f);
  return isFav(f, id);
}
export function setDone(id, done) {
  const f = favs();
  if (!f[id]) return;
  if (!done && f[id].fav === false) delete f[id];
  else f[id].done = done;
  store.write("favs", f);
}
export function resetProgress(id) {
  const p = obj("progress");
  if (p[id]) {
    delete p[id];
    store.write("progress", p);
  }
}
export function percent(id) {
  if (favs()[id]?.done) return 100;
  const p = obj("progress")[id];
  if (!p || !p.total) return 0;
  return Math.min(99, Math.floor(((p.chapter + p.ratio) / p.total) * 100));
}
export function toast(msg) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("on");
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.remove("on"), 2200);
}

document.addEventListener(
  "error",
  (e) =>
    e.target.matches?.(".cover img") &&
    e.target.closest(".cover").classList.add("nocover"),
  true,
);
document.addEventListener(
  "load",
  (e) =>
    e.target.matches?.(".cover img") &&
    e.target.closest(".cover").classList.add("loaded"),
  true,
);
const yr = document.getElementById("year");
if (yr) yr.textContent = new Date().getFullYear();

export const skeleton = (n = 6, { row = false } = {}) =>
  Array.from({ length: n }, () =>
    row
      ? '<div class="card row sk" aria-hidden="true"><div class="cover"></div><div class="meta"><i></i><i></i></div></div>'
      : '<div class="card sk" aria-hidden="true"><div class="cover"></div><i></i><i></i></div>',
  ).join("");

export function card(b, { managed = false, row = false } = {}) {
  const all = favs(),
    f = all[b.id],
    fav = isFav(all, b.id),
    pct = percent(b.id),
    t = esc(b.title),
    href = `reader.html?id=${encodeURIComponent(b.id)}`;
  const label =
    pct > 0 && pct < 100 ? "Continue" : pct === 100 ? "Read again" : "Read";
  const done = managed
    ? `<button class="icon-btn" data-act="done" aria-pressed="${!!f?.done}" aria-label="${f?.done ? "Mark as unfinished" : "Mark as finished"}: ${t}" title="Finished">${icon("check")}</button>`
    : "";
  const prog =
    pct || managed
      ? `<div class="prog" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="Reading progress: ${t}"><b><i style="width:${pct}%"></i></b>${pct}%</div>`
      : "";
  const img = b.cover
    ? `<img loading="lazy" decoding="async" width="600" height="800" src="${esc(b.cover)}" alt="">`
    : "";
  return `<article class="card${managed ? " managed" : ""}${row ? " row" : ""}" data-id="${esc(b.id)}"><div class="cw"><a class="cover${b.cover ? "" : " nocover"}" href="${href}" tabindex="-1" aria-hidden="true"><span class="ph">${t}</span>${img}${pct === 100 ? '<span class="badge">Finished</span>' : ""}</a>${prog}<button class="icon-btn fav" data-act="fav" aria-pressed="${fav}" aria-label="${fav ? "Remove from favorites" : "Add to favorites"}: ${t}" title="Favorite">${icon("heart")}</button></div>
<div class="meta"><h3 class="t"><a href="${href}">${t}</a></h3><p class="a">${esc(b.author)}</p>
<div class="acts"><a class="btn primary" href="${href}"${pct === 100 ? ' data-act="again"' : ""}>${label}</a>${done}<button class="icon-btn" data-act="share" aria-label="Share: ${t}" title="Share">${icon("share")}</button></div></div></article>`;
}

export function bindCards(root, books, onChange) {
  root.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    const cardEl = btn.closest(".card"),
      id = cardEl.dataset.id,
      b = books.find((x) => x.id === id),
      act = btn.dataset.act,
      index = [...root.querySelectorAll(".card")].indexOf(cardEl);
    if (act === "fav") {
      toast(toggleFav(id) ? "Added to favorites" : "Removed from favorites");
    } else if (act === "done") {
      const d = !favs()[id]?.done;
      setDone(id, d);
      if (!d) resetProgress(id);
      toast(d ? "Marked as finished" : "Marked as unfinished");
    } else if (act === "again") {
      setDone(id, false);
      resetProgress(id);
      return;
    } else if (act === "share") {
      if (!b) return;
      const url = new URL(
        `reader.html?id=${encodeURIComponent(id)}`,
        location.href,
      ).href;
      try {
        if (navigator.share)
          await navigator.share({
            title: b.title,
            text: `${b.title} by ${b.author}`,
            url,
          });
        else {
          await navigator.clipboard.writeText(url);
          toast("Link copied");
        }
      } catch (err) {
        if (err.name !== "AbortError") toast("Could not share this book");
      }
      return;
    }
    onChange();
    const sel = `[data-act="${act}"]`;
    const same = root.querySelector(
      `.card[data-id="${CSS.escape(id)}"] ${sel}`,
    );
    const cards = [...root.querySelectorAll(".card")];
    (same ?? (cards[index] ?? cards[cards.length - 1])?.querySelector(sel))
      ?.focus();
  });
}
export const showError = (el, e) => {
  el.removeAttribute("aria-busy");
  el.innerHTML =`<div class="empty"><p>${esc(e.message || "Something went wrong")}. Check your connection and try again.</p><button class="btn primary" onclick="location.reload()">Try again</button></div>`;
};
