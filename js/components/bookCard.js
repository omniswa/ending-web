/**
 * Book card with an action overlay on the cover.
 * Desktop: overlay appears on hover/focus. Touch: tapping the cover toggles it.
 * Call `refresh()` after state changes; the card never re-renders itself.
 */
import { NEW_BOOK_DAYS } from "../config.js";
import { daysBetween, formatDay, todayKey } from "../core/dates.js";
import { h, icon } from "../core/dom.js";
import {
  isFavorite,
  toggleFavorite,
  addFavorite,
} from "../services/favorites.js";
import {
  getProgress,
  displayPercent,
  markFinished,
  readAgain,
} from "../services/progress.js";
import { shareBook } from "../services/share.js";
import { createCover } from "./cover.js";
import { toast } from "./toast.js";

const supportsHover = () => matchMedia("(hover: hover)").matches;

// One document-level listener closes any open touch overlay when tapping elsewhere.
document.addEventListener("click", (event) => {
  document
    .querySelectorAll('.book-card[data-active="true"]')
    .forEach((card) => {
      if (!card.contains(event.target)) delete card.dataset.active;
    });
});

export const readHref = (book) => `#/read/${encodeURIComponent(book.id)}`;

/**
 * @param {object} book
 * @param {{actions?: Array<'favorite'|'share'|'finish'|'delete'>, onDelete?: (book: object) => void}} options
 */
export function createBookCard(
  book,
  { actions = ["favorite", "share"], onDelete } = {},
) {
  const label = (text) => `${text} — ${book.title}`;

  const primaryLabel = h("span");
  const primary = h(
    "button",
    {
      class: "btn btn--primary btn--sm book-card__primary",
      type: "button",
      onclick: () => {
        if (getProgress(book.id).finished) readAgain(book.id);
        location.hash = readHref(book);
      },
    },
    icon("book-open", { size: 16 }),
    primaryLabel,
  );
  const percentText = h("span", { class: "book-card__percent" });

  const actionButton = (name, iconName, handler) =>
    h(
      "button",
      {
        class: "book-card__action",
        type: "button",
        dataset: { action: name },
        onclick: (event) => {
          handler(event);
          if (event.detail > 0) event.currentTarget.blur();
        },
      },
      icon(iconName, { size: 18 }),
    );

  const handlers = {
    favorite: () => {
      if (toggleFavorite(book.id)) return;
      toast("Removed from favorites", {
        action: { label: "Undo", onClick: () => addFavorite(book.id) },
      });
    },
    share: () => shareBook(book),
    finish: () => {
      markFinished(book.id);
      toast("Marked as finished");
    },
    delete: () => onDelete?.(book),
  };
  const icons = {
    favorite: "heart",
    share: "share",
    finish: "check-circle",
    delete: "trash",
  };
  const buttons = Object.fromEntries(
    actions.map((name) => [
      name,
      actionButton(name, icons[name], handlers[name]),
    ]),
  );

  const progressFill = h("span", { class: "book-card__progress-fill" });
  const progressBar = h(
    "div",
    {
      class: "book-card__progress",
      role: "progressbar",
      "aria-label": `Progress for ${book.title}`,
      "aria-valuemin": "0",
      "aria-valuemax": "100",
    },
    progressFill,
  );
  const statusBadge = h("span", { class: "book-card__badge" });
  const favoriteMark = h(
    "span",
    { class: "book-card__fav-mark", "aria-hidden": "true" },
    icon("heart", { size: 14 }),
  );

  const cover = h(
    "div",
    {
      class: "book-card__cover",
      onclick: (event) => {
        if (event.target.closest("button")) return;
        if (supportsHover()) primary.click();
        else
          el.dataset.active = el.dataset.active === "true" ? "false" : "true";
      },
    },
    createCover(book),
    statusBadge,
    favoriteMark,
    h(
      "div",
      { class: "book-card__overlay" },
      h("div", { class: "book-card__overlay-main" }, primary, percentText),
      h("div", { class: "book-card__actions" }, Object.values(buttons)),
    ),
    progressBar,
  );

  const isNew =
    book.added &&
    daysBetween(book.added, todayKey()) <= NEW_BOOK_DAYS &&
    daysBetween(book.added, todayKey()) >= 0;
  const el = h(
    "article",
    { class: "book-card", dataset: { source: book.source } },
    cover,
    h(
      "div",
      { class: "book-card__body" },
      h("h3", { class: "book-card__title", title: book.title }, book.title),
      h(
        "p",
        {
          class: "book-card__author",
          title: book.added
            ? `${book.author} · Added ${formatDay(book.added)}`
            : book.author,
        },
        book.author,
      ),
    ),
  );

  function refresh() {
    const favorite = isFavorite(book.id);
    const { finished } = getProgress(book.id);
    const percent = displayPercent(book.id);

    el.dataset.favorite = String(favorite);
    el.dataset.finished = String(finished);
    progressFill.style.width = `${percent}%`;
    progressBar.hidden = percent <= 0;
    progressBar.setAttribute("aria-valuenow", String(percent));

    primaryLabel.textContent = finished
      ? "Read again"
      : percent > 0
        ? "Continue"
        : "Read";
    percentText.textContent = finished
      ? "Finished"
      : percent > 0
        ? `${percent}% read`
        : "";
    statusBadge.hidden = !(finished || (isNew && percent === 0));
    statusBadge.textContent = finished ? "Finished" : "New";
    favoriteMark.hidden = !favorite;

    if (buttons.favorite) {
      const text = favorite ? "Remove from favorites" : "Add to favorites";
      buttons.favorite.setAttribute("aria-pressed", String(favorite));
      buttons.favorite.setAttribute("aria-label", label(text));
      buttons.favorite.title = text;
    }
    if (buttons.share) {
      buttons.share.setAttribute("aria-label", label("Share"));
      buttons.share.title = "Share";
    }
    if (buttons.finish) {
      buttons.finish.hidden = finished;
      buttons.finish.setAttribute("aria-label", label("Mark as finished"));
      buttons.finish.title = "Mark as finished";
    }
    if (buttons.delete) {
      buttons.delete.setAttribute("aria-label", label("Remove from my books"));
      buttons.delete.title = "Remove from my books";
    }
    primary.setAttribute("aria-label", label(primaryLabel.textContent));
  }

  refresh();
  return { el, refresh };
}
