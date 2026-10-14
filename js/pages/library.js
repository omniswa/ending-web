/** "My books": the reader's own imported EPUB library. */
import { h, icon } from "../core/dom.js";
import { plural } from "../core/utils.js";
import { createBookGrid } from "../components/bookGrid.js";
import { confirmDialog } from "../components/dialog.js";
import { createPagination } from "../components/pagination.js";
import { emptyState, errorState, gridSkeleton } from "../components/status.js";
import { toast } from "../components/toast.js";
import { BOOKS_PER_PAGE } from "../config.js";
import {
  importFiles,
  listOwnedBooks,
  removeOwnedBook,
} from "../services/library.js";
import { removeHighlightsForBook } from "../services/highlights.js";
import { forgetBook } from "../services/progress.js";

export function mount({ root, query, router }) {
  // Set to false on unmount. An import keeps running in the background (its
  // data work should finish), but it no longer touches this page's UI or URL.
  let alive = true;
  let grid = null;
  let busy = false;
  let ownedBooks = [];
  let page = Number(query?.page) > 0 ? Number(query.page) : 1;

  function updateUrl() {
    if (!alive) return;
    const hash = page > 1 ? `#/library?page=${page}` : "#/library";
    router?.replaceHash?.(hash);
  }

  const body = h("div", { class: "shelf__body" }, gridSkeleton(4));
  const count = h(
    "p",
    { class: "page-header__sub" },
    "Import EPUB files to build a library that stays on this device.",
  );
  const pagination = createPagination({
    page,
    pageSize: BOOKS_PER_PAGE,
    totalItems: 0,
    onPageChange: (newPage) => {
      page = newPage;
      updateUrl();
      renderShelf();
    },
    scrollTo: () => document.querySelector(".page-header"),
  });
  const fileInput = h("input", {
    type: "file",
    accept: ".epub,application/epub+zip",
    multiple: true,
    hidden: true,
    onchange: () => {
      const files = [...fileInput.files];
      fileInput.value = "";
      if (files.length) runImport(files);
    },
  });
  const importLabel = h("span", {}, "Import EPUB");
  const importButton = h(
    "button",
    {
      class: "btn btn--primary",
      type: "button",
      onclick: () => fileInput.click(),
    },
    icon("plus", { size: 18 }),
    importLabel,
  );

  const shelf = h(
    "section",
    { class: "shelf", "aria-label": "My books" },
    body,
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
          h("h1", { class: "page-header__title" }, "My books"),
          count,
        ),
        h("div", { class: "page-header__actions" }, importButton, fileInput),
      ),
      shelf,
    ),
  );

  // Drag & drop anywhere on the shelf.
  let dragDepth = 0;
  const setDragging = (on) => shelf.classList.toggle("is-dragging", on);
  shelf.addEventListener("dragenter", (e) => {
    e.preventDefault();
    dragDepth++;
    setDragging(true);
  });
  shelf.addEventListener("dragover", (e) => e.preventDefault());
  shelf.addEventListener("dragleave", () => {
    dragDepth = Math.max(0, dragDepth - 1);
    if (!dragDepth) setDragging(false);
  });
  shelf.addEventListener("drop", (e) => {
    e.preventDefault();
    dragDepth = 0;
    setDragging(false);
    if (e.dataTransfer?.files.length) runImport([...e.dataTransfer.files]);
  });

  async function runImport(files) {
    if (busy) return;
    busy = true;
    importButton.disabled = true;
    try {
      const result = await importFiles(files, (current, total) => {
        importLabel.textContent =
          total > 1 ? `Importing ${current} of ${total}…` : "Importing…";
      });
      const parts = [];
      if (result.added.length)
        parts.push(`Added ${plural(result.added.length, "book")}`);
      if (result.duplicates.length)
        parts.push(
          `${plural(result.duplicates.length, "file")} already in your library`,
        );
      if (result.failed.length)
        parts.push(
          `${plural(result.failed.length, "file")} could not be imported`,
        );
      toast(parts.join(". ") + ".");
      if (result.failed.length) console.warn("Import failures", result.failed);
      await load();
    } finally {
      busy = false;
      importButton.disabled = false;
      importLabel.textContent = "Import EPUB";
    }
  }

  async function remove(book) {
    const ok = await confirmDialog({
      title: "Remove this book?",
      message: `“${book.title}”, its reading progress and its highlights will be deleted from this device. Your original file is not affected.`,
      confirmLabel: "Remove book",
      danger: true,
    });
    if (!ok) return;
    await removeOwnedBook(book.id);
    forgetBook(book.id);
    removeHighlightsForBook(book.id);
    toast("Book removed");
    await load();
  }

  function renderShelf() {
    grid?.destroy();
    grid = null;
    count.textContent = ownedBooks.length
      ? `${plural(ownedBooks.length, "book")} on this device`
      : "Import EPUB files to build a library that stays on this device.";

    if (!ownedBooks.length) {
      pagination.update({ totalItems: 0, page: 1, pageSize: BOOKS_PER_PAGE });
      body.replaceChildren(
        emptyState({
          iconName: "upload",
          title: "Your shelf is empty",
          text: "Drop EPUB files here or choose them from your device. They are stored privately in this browser.",
          action: h(
            "button",
            {
              class: "btn btn--primary",
              type: "button",
              onclick: () => fileInput.click(),
            },
            icon("plus", { size: 18 }),
            "Import EPUB",
          ),
        }),
      );
      return;
    }

    const totalPages = Math.ceil(ownedBooks.length / BOOKS_PER_PAGE) || 1;
    page = Math.min(Math.max(1, page), totalPages);
    updateUrl();

    const start = (page - 1) * BOOKS_PER_PAGE;
    const paged = ownedBooks.slice(start, start + BOOKS_PER_PAGE);

    grid = createBookGrid(paged, {
      actions: ["favorite", "share", "delete"],
      onDelete: remove,
    });
    pagination.update({
      totalItems: ownedBooks.length,
      page,
      pageSize: BOOKS_PER_PAGE,
    });
    body.replaceChildren(grid.el, pagination.el);
  }

  async function load() {
    try {
      const loaded = await listOwnedBooks();
      if (!alive) return;
      ownedBooks = loaded;
      renderShelf();
      if (page > 1) {
        requestAnimationFrame(() => {
          document
            .querySelector(".shelf")
            ?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }
    } catch (error) {
      console.error(error);
      if (!alive) return;
      pagination.update({ totalItems: 0, page: 1, pageSize: BOOKS_PER_PAGE });
      body.replaceChildren(
        errorState({
          title: "Your books could not be loaded",
          text: "Browser storage may be unavailable (for example in private browsing).",
          onRetry: load,
        }),
      );
    }
  }
  load();

  return {
    unmount: () => {
      alive = false;
      grid?.destroy();
      pagination.destroy();
    },
  };
}
