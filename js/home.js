import {
  loadBooks,
  card,
  bindCards,
  store,
  percent,
  showError,
} from "./app.js";
const PER = 12,
  $ = (s) => document.querySelector(s);
const sorters = {
  new: (a, b) =>
    b.added.localeCompare(a.added) || a.title.localeCompare(b.title),
  old: (a, b) =>
    a.added.localeCompare(b.added) || a.title.localeCompare(b.title),
  ta: (a, b) => a.title.localeCompare(b.title),
  tz: (a, b) => b.title.localeCompare(a.title),
  aa: (a, b) => a.author.localeCompare(b.author),
  az: (a, b) => b.author.localeCompare(a.author),
};
const state = { q: "", sort: "new", page: 1 };
let books = [],
  view = [];

function renderRecent() {
  const prog = store.read("progress", {});
  const list = Object.entries(prog)
    .sort((a, b) => b[1].updated - a[1].updated)
    .map(([id]) => books.find((b) => b.id === id))
    .filter((b) => b && percent(b.id) < 100)
    .slice(0, 8);
  $("#recent").hidden = !list.length;
  $("#recentList").innerHTML = list.map((b) => card(b)).join("");
}
function render() {
  view = books.filter((b) => b._s.includes(state.q)).sort(sorters[state.sort]);
  const pages = Math.max(1, Math.ceil(view.length / PER));
  state.page = Math.min(state.page, pages);
  $("#count").textContent =
    `${view.length.toLocaleString()} ${view.length === 1 ? "book" : "books"}`;
  $("#grid").innerHTML = view.length
    ? view
        .slice((state.page - 1) * PER, state.page * PER)
        .map((b) => card(b))
        .join("")
    : '<div class="empty"><p>No books match your search.</p></div>';
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
  renderRecent();
}
$("#q").addEventListener("input", (e) => {
  clearTimeout(render.t);
  render.t = setTimeout(() => {
    state.q = e.target.value.trim().toLowerCase();
    state.page = 1;
    render();
  }, 200);
});
$("#sort").addEventListener("change", (e) => {
  state.sort = e.target.value;
  state.page = 1;
  render();
});
$("#pager").addEventListener("click", (e) => {
  const p = e.target.closest("[data-p]");
  if (p && !p.disabled) {
    state.page = +p.dataset.p;
    render();
    scrollTo({ top: $("h1").offsetTop - 70, behavior: "smooth" });
  }
});
loadBooks()
  .then((b) => {
    books = b;
    bindCards($("#grid"), books, render);
    bindCards($("#recentList"), books, render);
    render();
  })
  .catch((e) => showError($("#grid"), e));
