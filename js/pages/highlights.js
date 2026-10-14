/** Highlights: short passages saved from the reader, each shareable as a quote card. */
import { h, icon } from "../core/dom.js";
import { plural } from "../core/utils.js";
import { openQuoteCard } from "../components/quoteCardDialog.js";
import { createPagination } from "../components/pagination.js";
import { emptyState } from "../components/status.js";
import { toast } from "../components/toast.js";
import { HIGHLIGHTS_PER_PAGE } from "../config.js";
import {
  getHighlights,
  removeHighlight,
  restoreHighlight,
} from "../services/highlights.js";
import { getReaderPrefs } from "../services/readerPrefs.js";
import { subscribeSelect } from "../state/store.js";

export function mount({ root, query, router }) {
  let alive = true;
  let filter = "all";
  let page = Number(query?.page) > 0 ? Number(query.page) : 1;

  function updateUrl() {
    if (!alive) return;
    const hash = page > 1 ? `#/highlights?page=${page}` : "#/highlights";
    router?.replaceHash?.(hash);
  }

  const pagination = createPagination({
    page,
    pageSize: HIGHLIGHTS_PER_PAGE,
    totalItems: 0,
    onPageChange: (newPage) => {
      page = newPage;
      updateUrl();
      render();
    },
    scrollTo: () => document.querySelector(".page-header"),
  });

  const count = h("p", { class: "page-header__sub" });
  const select = h("select", {
    class: "field__input field__select",
    "aria-label": "Filter by book",
    onchange: () => {
      filter = select.value;
      page = 1;
      updateUrl();
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
            href: `#/read/${encodeURIComponent(highlight.bookId)}?hl=${encodeURIComponent(highlight.id)}`,
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
      pagination.update({
        totalItems: 0,
        page: 1,
        pageSize: HIGHLIGHTS_PER_PAGE,
      });
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
    // Keep the page in range (e.g. after removing the last item on a page).
    const totalPages = Math.ceil(visible.length / HIGHLIGHTS_PER_PAGE) || 1;
    const clamped = Math.min(Math.max(1, page), totalPages);
    if (clamped !== page) {
      page = clamped;
      updateUrl();
    }

    const start = (page - 1) * HIGHLIGHTS_PER_PAGE;
    const paged = visible.slice(start, start + HIGHLIGHTS_PER_PAGE);
    pagination.update({
      totalItems: visible.length,
      page,
      pageSize: HIGHLIGHTS_PER_PAGE,
    });
    body.replaceChildren(
      h("ul", { class: "highlights__list" }, paged.map(item)),
      pagination.el,
    );
  }

  const unsubscribe = subscribeSelect((s) => s.highlights, render);

  return {
    unmount() {
      alive = false;
      unsubscribe();
      pagination.destroy();
    },
  };
}
