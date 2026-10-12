import { h, icon } from "../core/dom.js";

/**
 * Returns a compact list of page numbers and ellipsis tokens.
 * The output is bounded to at most 7 items (e.g. [1, "…", 4, 5, 6, "…", 10])
 * so the pagination bar never overflows or wraps awkwardly on small screens.
 */
export function getPaginationRange(current, total) {
  if (total <= 1) return [];
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  if (current <= 4) {
    return [1, 2, 3, 4, 5, "…", total];
  }
  if (current >= total - 3) {
    return [1, "…", total - 4, total - 3, total - 2, total - 1, total];
  }
  return [1, "…", current - 1, current, current + 1, "…", total];
}

/**
 * Creates an accessible, responsive pagination component.
 * Automatically hides when totalPages <= 1 to avoid cluttering the UI.
 *
 * @param {Object} options
 * @param {number} [options.page=1]
 * @param {number} [options.pageSize=8]
 * @param {number} [options.totalItems=0]
 * @param {function} options.onPageChange
 * @param {HTMLElement|function} [options.scrollTo]
 */
export function createPagination({
  page = 1,
  pageSize = 8,
  totalItems = 0,
  onPageChange,
  scrollTo,
} = {}) {
  let currentPage = page;
  let total = totalItems;
  let size = pageSize;

  const el = h("nav", {
    class: "pagination",
    "aria-label": "Pagination",
  });

  function render() {
    el.replaceChildren();
    const totalPages = Math.ceil(total / size);

    if (totalPages <= 1) {
      el.hidden = true;
      return;
    }

    el.hidden = false;
    currentPage = Math.min(Math.max(1, currentPage), totalPages);

    // Previous button
    const prevBtn = h(
      "button",
      {
        class: "pagination__btn pagination__btn--prev",
        type: "button",
        "aria-label": "Previous page",
        disabled: currentPage <= 1,
        onclick: () => goTo(currentPage - 1),
      },
      icon("chevron-left", { size: 18 }),
      h("span", { class: "pagination__label" }, "Prev"),
    );
    el.append(prevBtn);

    // Numbered buttons and ellipses
    const range = getPaginationRange(currentPage, totalPages);
    for (const item of range) {
      if (item === "…") {
        el.append(
          h(
            "span",
            { class: "pagination__ellipsis", "aria-hidden": "true" },
            "…",
          ),
        );
      } else {
        const isCurrent = item === currentPage;
        const pageBtn = h(
          "button",
          {
            class: "pagination__btn pagination__btn--page",
            type: "button",
            "aria-label": `Page ${item}`,
            ...(isCurrent ? { "aria-current": "page" } : {}),
            onclick: () => goTo(item),
          },
          String(item),
        );
        el.append(pageBtn);
      }
    }

    // Next button
    const nextBtn = h(
      "button",
      {
        class: "pagination__btn pagination__btn--next",
        type: "button",
        "aria-label": "Next page",
        disabled: currentPage >= totalPages,
        onclick: () => goTo(currentPage + 1),
      },
      h("span", { class: "pagination__label" }, "Next"),
      icon("chevron-right", { size: 18 }),
    );
    el.append(nextBtn);

    // Accessible screen reader announcement
    el.append(
      h(
        "span",
        { class: "sr-only", "aria-live": "polite" },
        `Page ${currentPage} of ${totalPages}`,
      ),
    );
  }

  function goTo(newPage) {
    const totalPages = Math.ceil(total / size);
    const clamped = Math.min(Math.max(1, newPage), totalPages);
    if (clamped === currentPage) return;
    currentPage = clamped;
    render();
    onPageChange?.(currentPage);

    if (scrollTo) {
      const target = typeof scrollTo === "function" ? scrollTo() : scrollTo;
      if (target?.scrollIntoView) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  }

  render();

  return {
    el,
    getPage: () => currentPage,
    setPage: (p) => {
      currentPage = p;
      render();
    },
    update: ({
      page: newPage = currentPage,
      totalItems: newTotal = total,
      pageSize: newSize = size,
    } = {}) => {
      currentPage = newPage;
      total = newTotal;
      size = newSize;
      render();
    },
    destroy: () => {
      el.replaceChildren();
    },
  };
}
