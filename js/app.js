const P =
  '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
const ICONS = {
  heart:
    '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/>',
  share:
    '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14"/>',
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
    } catch {}
  },
};
let booksPromise;
export const loadBooks = () =>
  (booksPromise ??= fetch("books.json")
    .then((r) => {
      if (!r.ok) throw new Error("Could not load books.json");
      return r.json();
    })
    .then((list) =>
      list.map((b) => ({ ...b, _s: `${b.title} ${b.author}`.toLowerCase() })),
    )
    .catch((e) => {
      booksPromise = null; // allow retry after a failed load
      throw e;
    }));

export const favs = () => store.read("favs", {});
export function toggleFav(id) {
  const f = favs();
  f[id] ? delete f[id] : (f[id] = { at: Date.now(), done: false });
  store.write("favs", f);
  return !!f[id];
}
export function setDone(id, done) {
  const f = favs();
  if (f[id]) {
    f[id].done = done;
    store.write("favs", f);
  }
}
export function percent(id) {
  if (favs()[id]?.done) return 100;
  const p = store.read("progress", {})[id];
  if (!p || !p.total) return 0;
  return Math.min(100, Math.floor(((p.chapter + p.ratio) / p.total) * 100));
}
export function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("on");
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.remove("on"), 2200);
}

// Cover fallback: if an image fails, show the styled placeholder instead of a broken icon.
document.addEventListener(
  "error",
  (e) =>
    e.target.matches?.(".cover img") &&
    e.target.closest(".cover").classList.add("nocover"),
  true,
);
// Footer year
const yr = document.getElementById("year");
if (yr) yr.textContent = new Date().getFullYear();

export function card(b, { managed = false } = {}) {
  const f = favs()[b.id],
    pct = percent(b.id),
    href = `reader.html?id=${encodeURIComponent(b.id)}`;
  const label =
    pct > 0 && pct < 100 ? "Continue" : pct === 100 ? "Read again" : "Read";
  const extra = managed
    ? `<button class="icon-btn" data-act="done" aria-pressed="${!!f?.done}" aria-label="${f?.done ? "Mark as unfinished" : "Mark as finished"}" title="Finished">${icon("check")}</button><button class="icon-btn" data-act="remove" aria-label="Remove from favorites" title="Remove">${icon("trash")}</button>`
    : `<button class="icon-btn" data-act="fav" aria-pressed="${!!f}" aria-label="${f ? "Remove from favorites" : "Add to favorites"}" title="Favorite">${icon("heart")}</button>`;
  return `<article class="card" data-id="${esc(b.id)}"><a class="cover" href="${href}" tabindex="-1" aria-hidden="true"><span class="ph">${esc(b.title)}</span><img loading="lazy" decoding="async" width="600" height="800" src="${esc(b.cover)}" alt="">${pct === 100 ? '<span class="badge">Finished</span>' : ""}</a>
<div class="meta"><h3 class="t"><a href="${href}">${esc(b.title)}</a></h3><p class="a">${esc(b.author)}</p>
${pct || managed ? `<div class="prog"><b><i style="width:${pct}%"></i></b>${pct}%</div>` : ""}
<div class="acts"><a class="btn primary" href="${href}">${label}</a>${extra}<button class="icon-btn" data-act="share" aria-label="Share" title="Share">${icon("share")}</button></div></div></article>`;
}

/** Delegated card actions; `onChange` re-renders the host page. */
export function bindCards(root, books, onChange) {
  root.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    const id = btn.closest(".card").dataset.id,
      b = books.find((x) => x.id === id),
      act = btn.dataset.act;
    if (act === "fav") {
      toast(toggleFav(id) ? "Added to favorites" : "Removed from favorites");
    } else if (act === "remove") {
      toggleFav(id);
      toast("Removed from favorites");
    } else if (act === "done") {
      const d = !favs()[id]?.done;
      setDone(id, d);
      toast(d ? "Marked as finished" : "Marked as unfinished");
    } else if (act === "share") {
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
    // Re-rendering replaces the DOM; restore keyboard focus to the same control.
    root
      .querySelector(`.card[data-id="${CSS.escape(id)}"] [data-act="${act}"]`)
      ?.focus();
  });
}
export const showError = (el, e) => {
  el.innerHTML = `<div class="empty"><p>${esc(e.message || "Something went wrong")}. Check your connection and try again.</p><button class="btn primary" onclick="location.reload()">Reload</button></div>`;
};
