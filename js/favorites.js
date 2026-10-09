import {
  loadBooks,
  card,
  bindCards,
  favs,
  isFav,
  percent,
  showError,
  skeleton,
} from "./app.js";
const STEP = 12,
  $ = (s) => document.querySelector(s);
const EMPTY = {
  all: "You haven't saved any books yet.",
  reading: "No books in progress.",
  done: "No finished books yet.",
};
let books = [],
  filter = "all",
  shown = STEP;
const match = (b, f) => {
  if (filter === "all") return true;
  if (filter === "done") return !!f[b.id].done;
  return !f[b.id].done && percent(b.id) > 0;
};
function render() {
  const f = favs();
  const list = books
    .filter((b) => isFav(f, b.id))
    .sort((a, b) => (f[b.id].at || 0) - (f[a.id].at || 0))
    .filter((b) => match(b, f));
  $("#grid").removeAttribute("aria-busy");
  $("#grid").innerHTML = list
    .slice(0, shown)
    .map((b) => card(b, { managed: true }))
    .join("");
  const rest = list.length - shown;
  $("#more").hidden = rest <= 0;
  $("#more").textContent = `Show more (${rest})`;
  $("#empty").hidden = list.length > 0;
  $("#emptyMsg").textContent = EMPTY[filter];
  const has = Object.keys(f).filter((id) => isFav(f, id)).length;
  $("#tabs").hidden = !has;
  if (!has && filter !== "all") {
    filter = "all";
    document
      .querySelectorAll("#tabs button")
      .forEach((x) => x.setAttribute("aria-pressed", x.dataset.f === "all"));
    render();
  }
}
$("#more").addEventListener("click", () => {
  shown += STEP;
  render();
});
$("#tabs").addEventListener("click", (e) => {
  const b = e.target.closest("[data-f]");
  if (!b) return;
  filter = b.dataset.f;
  shown = STEP;
  document
    .querySelectorAll("#tabs button")
    .forEach((x) => x.setAttribute("aria-pressed", x === b));
  render();
});
$("#grid").setAttribute("aria-busy", "true");
if (!$("#grid").querySelector(".sk")) $("#grid").innerHTML = skeleton(6);
const refresh = () => books.length && render();
addEventListener("pageshow", (e) => e.persisted && refresh());
addEventListener("storage", refresh);
loadBooks()
  .then((b) => {
    books = b;
    bindCards($("#grid"), books, render);
    render();
  })
  .catch((e) => showError($("#grid"), e));
