/** Highlights: short passages saved from the reader, each shareable as a quote card. */
import { h, icon } from "../core/dom.js";
import { plural } from "../core/utils.js";
import { openQuoteCard } from "../components/quoteCardDialog.js";
import { emptyState } from "../components/status.js";
import { toast } from "../components/toast.js";
import {
  getHighlights,
  removeHighlight,
  restoreHighlight,
} from "../services/highlights.js";
import { getReaderPrefs } from "../services/readerPrefs.js";
import { subscribeSelect } from "../state/store.js";

export function mount({ root }) {
  let filter = "all";

  const count = h("p", { class: "page-header__sub" });
  const select = h("select", {
    class: "field__input field__select",
    "aria-label": "Filter by book",
    onchange: () => {
      filter = select.value;
      render();
    },
  });
  const toolbar = h("div", { class: "toolbar" }, select);
  const body = h("div", { class: "highlights__body" });

  root.append(
    h(
      "div",
      { class: "container page__inner" },
      h(
        "header",
        { class: "page-header" },
        h(
          "div",
          {},
          h("h1", { class: "page-header__title" }, "Highlights"),
          count,
        ),
      ),
      toolbar,
      body,
    ),
  );

  function remove(highlight) {
    removeHighlight(highlight.id);
    toast("Highlight removed", {
      action: { label: "Undo", onClick: () => restoreHighlight(highlight) },
    });
  }

  function item(highlight) {
    const where = [highlight.bookTitle, highlight.author]
      .filter(Boolean)
      .join(" · ");
    return h(
      "li",
      { class: "card highlight" },
      h(
        "blockquote",
        { class: "highlight__text", dataset: { color: highlight.color } },
        highlight.text,
      ),
      h(
        "p",
        { class: "highlight__meta" },
        h("span", { class: "highlight__book" }, where),
        highlight.chapterTitle &&
          h("span", { class: "highlight__chapter" }, highlight.chapterTitle),
      ),
      h(
        "div",
        { class: "highlight__actions" },
        h(
          "button",
          {
            class: "btn btn--primary btn--sm",
            type: "button",
            "aria-label": `Quote card: ${highlight.text}`,
            onclick: () =>
              openQuoteCard(highlight, { theme: getReaderPrefs().theme }),
          },
          icon("share", { size: 16 }),
          "Quote card",
        ),
        h(
          "a",
          {
            class: "btn btn--ghost btn--sm",
            href: `#/read/${encodeURIComponent(highlight.bookId)}`,
          },
          icon("book-open", { size: 16 }),
          "Open book",
        ),
        h(
          "button",
          {
            class: "icon-btn highlight__delete",
            type: "button",
            "aria-label": `Remove highlight: ${highlight.text}`,
            title: "Remove highlight",
            onclick: () => remove(highlight),
          },
          icon("trash", { size: 18 }),
        ),
      ),
    );
  }

  function render() {
    const all = getHighlights();

    const books = new Map();
    for (const { bookId, bookTitle } of all) books.set(bookId, bookTitle);
    if (filter !== "all" && !books.has(filter)) filter = "all";
    select.replaceChildren(
      h("option", { value: "all" }, "All books"),
      ...[...books].map(([id, title]) => h("option", { value: id }, title)),
    );
    select.value = filter;
    toolbar.hidden = books.size < 2;

    count.textContent = all.length
      ? `${plural(all.length, "highlight")} saved`
      : "Passages you highlight while reading are collected here.";

    if (!all.length) {
      body.replaceChildren(
        emptyState({
          iconName: "quote",
          title: "No highlights yet",
          text: "While reading, select a short passage (up to 280 characters) and tap Highlight, or make a quote card straight away.",
          action: h(
            "a",
            { class: "btn btn--primary", href: "#/" },
            "Browse the library",
          ),
        }),
      );
      return;
    }

    const visible =
      filter === "all" ? all : all.filter((entry) => entry.bookId === filter);
    body.replaceChildren(
      h("ul", { class: "highlights__list" }, visible.map(item)),
    );
  }

  const unsubscribe = subscribeSelect((s) => s.highlights, render);

  return { unmount: unsubscribe };
}
