import {
  loadBooks,
  card,
  bindCards,
  obj,
  favs,
  norm,
  percent,
  snapshot,
  showError,
  skeleton,
} from "./app.js";
import { mountStats } from "./dashboard.js";
const PER = 60,
  RECENT = 3,
  $ = (s) => document.querySelector(s);

const col = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" })
  .compare;
const cmp = (x, y) => (x < y ? -1 : x > y ? 1 : 0);
const sorters = {
  new: (a, b) => cmp(b.added, a.added) || col(a.title, b.title),
  old: (a, b) => cmp(a.added, b.added) || col(a.title, b.title),
  ta: (a, b) => col(a.title, b.title),
  tz: (a, b) => col(b.title, a.title),
  aa: (a, b) => col(a.author, b.author) || col(a.title, b.title),
  az: (a, b) => col(b.author, a.author) || col(a.title, b.title),
};

const params = new URLSearchParams(location.search);
const state = {
  q: (params.get("q") || "").trim().slice(0, 100),
  sort: Object.hasOwn(sorters, params.get("sort")) ? params.get("sort") : "new",
  page: Math.max(1, parseInt(params.get("page"), 10) || 1),
  allRecent: false,
};
let books = [],
  byId = new Map(),
  view = [];
const sorted = {};
const sortedBooks = () =>
  (sorted[state.sort] ??= [...books].sort(sorters[state.sort]));

function syncUrl() {
  const p = new URLSearchParams();
  if (state.q) p.set("q", state.q);
  if (state.sort !== "new") p.set("sort", state.sort);
  if (state.page > 1) p.set("page", state.page);
  const s = p.toString();
  history.replaceState(null, "", location.pathname + (s ? "?" + s : "") + location.hash);
}

function renderRecent(snap = snapshot()) {
  const list = Object.entries(snap.p)
    .sort((a, b) => (b[1]?.updated || 0) - (a[1]?.updated || 0))
    .map(([id]) => byId.get(id))
    .filter((b) => {
      if (!b) return false;
      const pc = percent(b.id, snap);
      return pc > 0 && pc < 100;
    });
  const shown = state.allRecent ? list : list.slice(0, RECENT);
  $("#recent").hidden = !list.length;
  $("#recentList").innerHTML = shown
    .map((b) => card(b, { row: true, snap }))
    .join("");
  $("#recentList").removeAttribute("aria-busy");
  const more = $("#recentMore");
  more.hidden = list.length <= RECENT;
  more.textContent = state.allRecent
    ? "Show less"
    : `Show all (${list.length})`;
  more.setAttribute("aria-expanded", String(state.allRecent));
}
function render() {
  const snap = snapshot();
  const words = norm(state.q).split(/\s+/).filter(Boolean);
  view = sortedBooks().filter((b) => words.every((w) => b._s.includes(w)));
  const pages = Math.max(1, Math.ceil(view.length / PER));
  state.page = Math.min(state.page, pages);
  syncUrl();
  $("#grid").removeAttribute("aria-busy");
  $("#count").textContent =
    `${view.length.toLocaleString()} ${view.length === 1 ? "book" : "books"}`;
  $("#grid").innerHTML = view.length
    ? view
        .slice((state.page - 1) * PER, state.page * PER)
        .map((b) => card(b, { snap }))
        .join("")
    : '<div class="empty"><p>No books match your search.</p><button class="btn" id="clear">Clear search</button></div>';
  const nums = [];
  for (let i = 1; i <= pages; i++)
    if (i === 1 || i === pages || Math.abs(i - state.page) <= 1) nums.push(i);
  let html = `<button class="btn" data-p="${state.page - 1}" ${state.page === 1 ? "disabled" : ""}>Prev</button>`,
    last = 0;
  for (const n of nums) {
    if (n - last > 1) html += '<span aria-hidden="true">…</span>';
    html += `<button class="btn" data-p="${n}" ${n === state.page ? 'aria-current="page"' : ""}>${n}</button>`;
    last = n;
  }
  $("#pager").innerHTML =
    pages > 1
      ? html +
        `<button class="btn" data-p="${state.page + 1}" ${state.page === pages ? "disabled" : ""}>Next</button>`
      : "";
  renderRecent(snap);
}
$("#q").value = state.q;
$("#sort").value = state.sort;
$("#q").addEventListener("input", (e) => {
  clearTimeout(render.t);
  render.t = setTimeout(() => {
    state.q = e.target.value.trim().slice(0, 100);
    state.page = 1;
    render();
  }, 200);
});
$("#sort").addEventListener("change", (e) => {
  state.sort = e.target.value;
  state.page = 1;
  render();
});
$("#grid").addEventListener("click", (e) => {
  if (!e.target.closest("#clear")) return;
  $("#q").value = state.q = "";
  render();
});
$("#pager").addEventListener("click", (e) => {
  const p = e.target.closest("[data-p]");
  if (p && !p.disabled) {
    state.page = +p.dataset.p;
    render();
    const h = $("h1");
    h.tabIndex = -1;
    h.focus({ preventScroll: true });
    h.scrollIntoView({
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  }
});
$("#recentMore").addEventListener("click", () => {
  state.allRecent = !state.allRecent;
  renderRecent();
});
const pendingRecent = () => {
  const done = favs();
  return Object.entries(obj("progress")).filter(
    ([id, p]) =>
      p &&
      p.total > 0 &&
      !done[id]?.done &&
      Math.floor(((p.chapter + p.ratio) / p.total) * 100) > 0,
  ).length;
};
$("#count").textContent = "Loading library…";
$("#grid").setAttribute("aria-busy", "true");
if (!$("#grid").querySelector(".sk")) $("#grid").innerHTML = skeleton(12);
const nRecent = Math.min(RECENT, pendingRecent());
if (nRecent) {
  $("#recent").hidden = false;
  $("#recentList").setAttribute("aria-busy", "true");
  $("#recentList").innerHTML = skeleton(nRecent, { row: true });
}
const stats = mountStats($("main"), () => books.length && render());
const refresh = () => {
  stats();
  books.length && render();
};
addEventListener("pageshow", (e) => e.persisted && refresh());
addEventListener("storage", refresh);
const setBooks = (b) => {
  books = b;
  byId = new Map(b.map((x) => [x.id, x]));
  for (const k in sorted) delete sorted[k];
};
loadBooks()
  .then((b) => {
    setBooks(b);
    bindCards($("#grid"), () => books, render);
    bindCards($("#recentList"), () => books, render);
    render();
  })
  .catch((e) => {
    $("#recent").hidden = true;
    $("#recentList").innerHTML = "";
    $("#recentList").removeAttribute("aria-busy");
    $("#count").textContent = "";
    showError($("#grid"), e);
  });
