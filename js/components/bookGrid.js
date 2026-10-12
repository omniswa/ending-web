import { h } from "../core/dom.js";
import { appStore } from "../state/store.js";
import { createBookCard } from "./bookCard.js";

/** Responsive grid of book cards that keeps itself in sync with the store. */
export function createBookGrid(books, cardOptions) {
  const cards = books.map((book) => createBookCard(book, cardOptions));
  const el = h(
    "ul",
    { class: "book-grid" },
    cards.map((card) => h("li", { class: "book-grid__item" }, card.el)),
  );
  const refresh = () => cards.forEach((card) => card.refresh());
  const unsubscribe = appStore.subscribe(refresh);
  return { el, refresh, destroy: unsubscribe };
}
