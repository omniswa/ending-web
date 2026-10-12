/** "Continue reading": favorited books that are in progress, most recent first. */
import { h, icon } from "../core/dom.js";
import { getProgress, displayPercent } from "../services/progress.js";
import { appStore } from "../state/store.js";
import { createCover } from "./cover.js";
import { readHref } from "./bookCard.js";
import { emptyState } from "./status.js";

const MAX_ITEMS = 3;

export function createContinueList() {
  let books = [];
  let signature = "";
  const list = h("div", { class: "continue__list" });
  const el = h(
    "section",
    { class: "continue", "aria-labelledby": "continue-title" },
    h(
      "div",
      { class: "section__head" },
      h(
        "h2",
        { class: "section__title", id: "continue-title" },
        "Continue reading",
      ),
      h("a", { class: "link", href: "#/favorites" }, "All favorites"),
    ),
    list,
  );

  function select() {
    const { favorites } = appStore.get();
    return favorites
      .map((id) => books.find((book) => book.id === id))
      .filter((book) => {
        if (!book) return false;
        const progress = getProgress(book.id);
        return progress.percent > 0 && !progress.finished;
      })
      .sort((a, b) => getProgress(b.id).updatedAt - getProgress(a.id).updatedAt)
      .slice(0, MAX_ITEMS);
  }

  function render() {
    const items = select();
    const next = items
      .map((book) => `${book.id}:${displayPercent(book.id)}`)
      .join("|");
    if (next === signature) return;
    signature = next;

    if (!items.length) {
      list.replaceChildren(
        emptyState({
          iconName: "heart",
          title: "Nothing in progress",
          text: "Favorite a book and start reading. It will show up here so you can pick up where you left off.",
        }),
      );
      return;
    }
    list.replaceChildren(
      ...items.map((book) => {
        const percent = displayPercent(book.id);
        return h(
          "article",
          { class: "continue-item" },
          h("div", { class: "continue-item__cover" }, createCover(book)),
          h(
            "div",
            { class: "continue-item__info" },
            h("h3", { class: "continue-item__title" }, book.title),
            h("p", { class: "continue-item__author" }, book.author),
            h(
              "div",
              { class: "continue-item__progress" },
              h(
                "div",
                {
                  class: "bar",
                  role: "progressbar",
                  "aria-label": `Progress for ${book.title}`,
                  "aria-valuemin": "0",
                  "aria-valuemax": "100",
                  "aria-valuenow": String(percent),
                },
                h("span", { class: "bar__fill", style: `width:${percent}%` }),
              ),
              h("span", { class: "continue-item__percent" }, `${percent}%`),
            ),
          ),
          h(
            "a",
            {
              class: "btn btn--primary btn--sm continue-item__cta",
              href: readHref(book),
              "aria-label": `Continue reading ${book.title}`,
            },
            icon("book-open", { size: 16 }),
            "Continue",
          ),
        );
      }),
    );
  }

  const unsubscribe = appStore.subscribe(render);
  return {
    el,
    /** Provide the full set of known books so favorites can be resolved. */
    setBooks(next) {
      books = next;
      signature = "\u0000";
      render();
    },
    destroy: unsubscribe,
  };
}
