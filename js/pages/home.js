import { h, icon } from "../core/dom.js";
import { daysBetween } from "../core/dates.js";
import { createBookGrid } from "../components/bookGrid.js";
import { createContinueList } from "../components/continueList.js";
import { createGoalCard } from "../components/goalCard.js";
import { createPagination } from "../components/pagination.js";
import { emptyState, errorState, gridSkeleton } from "../components/status.js";
import { BOOKS_PER_PAGE } from "../config.js";
import { getAllBooks } from "../services/library.js";

const SORTERS = {
  recent: (a, b) =>
    (b.added || "").localeCompare(a.added || "") ||
    a.title.localeCompare(b.title),
  title: (a, b) => a.title.localeCompare(b.title),
  author: (a, b) =>
    a.author.localeCompare(b.author) || a.title.localeCompare(b.title),
};

export function mount({ root, query, router }) {
  const goal = createGoalCard();
  const continueList = createContinueList();
  let grid = null;
  let books = [];
  let queryStr = "";
  let sort = "recent";
  let page = Number(query?.page) > 0 ? Number(query.page) : 1;

  function updateUrl() {
    const hash = page > 1 ? `#/?page=${page}` : "#/";
    router?.replaceHash?.(hash);
  }

  const pagination = createPagination({
    page,
    pageSize: BOOKS_PER_PAGE,
    totalItems: 0,
    onPageChange: (newPage) => {
      page = newPage;
      updateUrl();
      renderGrid(false);
    },
    scrollTo: () => document.getElementById("library-title"),
  });

  const gridHost = h("div", { class: "library__body" }, gridSkeleton());
  const search = h("input", {
    class: "field__input field__input--search",
    type: "search",
    placeholder: "Search title or author",
    "aria-label": "Search library",
    autocomplete: "off",
    oninput: () => {
      queryStr = search.value.trim().toLowerCase();
      page = 1;
      updateUrl();
      renderGrid(false);
    },
  });
  const sortSelect = h(
    "select",
    {
      class: "field__input field__select",
      "aria-label": "Sort books",
      onchange: () => {
        sort = sortSelect.value;
        page = 1;
        updateUrl();
        renderGrid(false);
      },
    },
    h("option", { value: "recent" }, "Recently added"),
    h("option", { value: "title" }, "Title A–Z"),
    h("option", { value: "author" }, "Author A–Z"),
  );
  const toolbar = h(
    "div",
    { class: "toolbar" },
    h("div", { class: "search" }, icon("search", { size: 18 }), search),
    sortSelect,
  );

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
          h("h1", { class: "page-header__title" }, "Library"),
          h(
            "p",
            { class: "page-header__sub" },
            "Pick something to read, and keep your daily streak alive.",
          ),
        ),
      ),
      h("div", { class: "dashboard" }, goal.el, continueList.el),
      h(
        "section",
        { class: "library", "aria-labelledby": "library-title" },
        h(
          "div",
          { class: "section__head" },
          h(
            "h2",
            { class: "section__title", id: "library-title" },
            "Browse books",
          ),
        ),
        toolbar,
        gridHost,
      ),
    ),
  );

  function renderGrid(resetPage = false) {
    if (resetPage) page = 1;
    grid?.destroy();
    grid = null;
    const visible = books
      .filter(
        (book) =>
          !queryStr ||
          `${book.title} ${book.author}`.toLowerCase().includes(queryStr),
      )
      .sort(SORTERS[sort]);
    if (!visible.length) {
      pagination.update({ totalItems: 0, page: 1, pageSize: BOOKS_PER_PAGE });
      gridHost.replaceChildren(
        emptyState({
          iconName: "search",
          title: queryStr ? "No matches" : "The library is empty",
          text: queryStr
            ? `Nothing matches “${search.value.trim()}”. Try a different title or author.`
            : "Books listed in books.json will appear here.",
        }),
      );
      return;
    }

    const totalPages = Math.ceil(visible.length / BOOKS_PER_PAGE) || 1;
    page = Math.min(Math.max(1, page), totalPages);
    updateUrl();

    const start = (page - 1) * BOOKS_PER_PAGE;
    const pagedBooks = visible.slice(start, start + BOOKS_PER_PAGE);

    grid = createBookGrid(pagedBooks, { actions: ["favorite", "share"] });
    pagination.update({
      totalItems: visible.length,
      page,
      pageSize: BOOKS_PER_PAGE,
    });
    gridHost.replaceChildren(grid.el, pagination.el);
  }

  async function load() {
    gridHost.replaceChildren(gridSkeleton());
    const result = await getAllBooks();
    continueList.setBooks(result.books);
    books = result.books.filter((book) => book.source === "catalog");
    if (result.catalogError) {
      gridHost.replaceChildren(
        errorState({
          title: "The library did not load",
          text: result.catalogError.message,
          onRetry: load,
        }),
      );
      return;
    }
    renderGrid(false);
    if (page > 1) {
      requestAnimationFrame(() => {
        document
          .getElementById("library-title")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }
  load();

  return {
    unmount() {
      goal.destroy();
      continueList.destroy();
      grid?.destroy();
      pagination.destroy();
    },
  };
}
