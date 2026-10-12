import { h } from "../core/dom.js";
import { createBookGrid } from "../components/bookGrid.js";
import { createPagination } from "../components/pagination.js";
import { createSegmented } from "../components/segmented.js";
import { emptyState, errorState, gridSkeleton } from "../components/status.js";
import { BOOKS_PER_PAGE } from "../config.js";
import { getAllBooks } from "../services/library.js";
import { getProgress } from "../services/progress.js";
import { appStore } from "../state/store.js";
import { plural } from "../core/utils.js";

const FILTERS = [
  { value: "all", label: "All" },
  { value: "reading", label: "In progress" },
  { value: "finished", label: "Finished" },
];

export function mount({ root, query, router }) {
  let books = [];
  let filter = "all";
  let grid = null;
  let signature = "";
  let page = Number(query?.page) > 0 ? Number(query.page) : 1;

  function updateUrl() {
    const hash = page > 1 ? `#/favorites?page=${page}` : "#/favorites";
    router?.replaceHash?.(hash);
  }

  const count = h("p", { class: "page-header__sub" });
  const body = h("div", { class: "favorites__body" }, gridSkeleton());
  const pagination = createPagination({
    page,
    pageSize: BOOKS_PER_PAGE,
    totalItems: 0,
    onPageChange: (newPage) => {
      page = newPage;
      updateUrl();
      render(true);
    },
    scrollTo: () => document.querySelector(".page-header"),
  });

  const filters = createSegmented({
    label: "Filter favorites",
    options: FILTERS,
    variant: "pills",
    onChange: (value) => {
      filter = value;
      page = 1;
      updateUrl();
      render(true);
    },
  });
  filters.set(filter);
  const filterBar = h("div", { class: "toolbar" }, filters.el);

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
          h("h1", { class: "page-header__title" }, "Favorites"),
          count,
        ),
      ),
      filterBar,
      body,
    ),
  );

  const matches = (book) => {
    const { finished, percent } = getProgress(book.id);
    if (filter === "finished") return finished;
    if (filter === "reading") return !finished && percent > 0;
    return true;
  };

  function render(force = false) {
    const { favorites } = appStore.get();
    const byId = new Map(books.map((book) => [book.id, book]));
    const all = favorites.map((id) => byId.get(id)).filter(Boolean);
    const visible = all.filter(matches);
    count.textContent = all.length
      ? plural(all.length, "book") + " saved"
      : "Books you favorite are collected here.";
    filterBar.hidden = all.length === 0;

    const totalPages = Math.ceil(visible.length / BOOKS_PER_PAGE) || 1;
    page = Math.min(Math.max(1, page), totalPages);
    updateUrl();

    const next = `${visible.map((book) => book.id).join("|")}@${page}`;
    if (!force && next === signature && grid) return;
    signature = next;
    grid?.destroy();
    grid = null;

    if (!all.length) {
      pagination.update({ totalItems: 0, page: 1, pageSize: BOOKS_PER_PAGE });
      body.replaceChildren(
        emptyState({
          iconName: "heart",
          title: "No favorites yet",
          text: "Tap the heart on any book to keep it here for quick access.",
          action: h(
            "a",
            { class: "btn btn--primary", href: "#/" },
            "Browse the library",
          ),
        }),
      );
    } else if (!visible.length) {
      pagination.update({ totalItems: 0, page: 1, pageSize: BOOKS_PER_PAGE });
      body.replaceChildren(
        emptyState({
          iconName: "book",
          title:
            filter === "finished"
              ? "No finished books yet"
              : "Nothing in progress",
          text: "Books will appear here as you read them.",
        }),
      );
    } else {
      const start = (page - 1) * BOOKS_PER_PAGE;
      const paged = visible.slice(start, start + BOOKS_PER_PAGE);
      grid = createBookGrid(paged, {
        actions: ["favorite", "share", "finish"],
      });
      pagination.update({
        totalItems: visible.length,
        page,
        pageSize: BOOKS_PER_PAGE,
      });
      body.replaceChildren(grid.el, pagination.el);
    }
  }

  const unsubscribe = appStore.subscribe(() => render());

  (async function load() {
    body.replaceChildren(gridSkeleton());
    const result = await getAllBooks();
    books = result.books;
    if (result.catalogError && !books.length) {
      body.replaceChildren(
        errorState({
          title: "Your favorites could not load",
          text: result.catalogError.message,
          onRetry: load,
        }),
      );
      return;
    }
    render(true);
    if (page > 1) {
      requestAnimationFrame(() => {
        document
          .querySelector(".favorites__body")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  })();

  return {
    unmount() {
      unsubscribe();
      grid?.destroy();
      pagination.destroy();
    },
  };
}
