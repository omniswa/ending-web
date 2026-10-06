import { loadBooks, card, bindCards, favs, showError } from "./app.js";
const STEP = 12,
  $ = (s) => document.querySelector(s);
let books = [],
  filter = "all",
  shown = STEP;
function render() {
  const f = favs();
  const list = books
    .filter((b) => f[b.id])
    .sort((a, b) => f[b.id].at - f[a.id].at)
    .filter((b) => filter === "all" || (filter === "done") === !!f[b.id].done);
  $("#grid").innerHTML = list
    .slice(0, shown)
    .map((b) => card(b, { managed: true }))
    .join("");
  const rest = list.length - shown;
  $("#more").hidden = rest <= 0;
  $("#more").textContent = `Show more (${rest})`;
  $("#empty").hidden = list.length > 0;
  $("#tabs").hidden = !Object.keys(f).length;
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
loadBooks()
  .then((b) => {
    books = b;
    bindCards($("#grid"), books, render);
    render();
  })
  .catch((e) => showError($("#grid"), e));
