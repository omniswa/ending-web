import { HIGHLIGHT } from "../config.js";
import { h, icon } from "../core/dom.js";
import { anchorOf } from "../core/highlightDom.js";
import {
  cleanHighlightText,
  isValidHighlightLength,
} from "../services/highlights.js";

const HIDE_DELAY_MS = 250;

/**
 * Floating toolbar inside the reader. It has two modes:
 *  - selection: text inside `scope` is selected; pick a color to highlight it
 *    or make a quote card straight away.
 *  - existing: `showFor(highlight)` was called after tapping a painted
 *    highlight; pick a color to change it, remove it, or make a quote card.
 */
export function createSelectionBar({
  scope,
  onHighlight,
  onCard,
  onRecolor,
  onRemove,
}) {
  let text = "";
  let anchor = null;
  let existing = null;
  let hideTimer = null;

  const count = h("span", { class: "selection-bar__count" });
  const swatches = HIGHLIGHT.colors.map((color) =>
    h("button", {
      class: "selection-bar__swatch",
      type: "button",
      dataset: { color: color.value },
      "aria-label": `Highlight ${color.label.toLowerCase()}`,
      title: `Highlight ${color.label.toLowerCase()}`,
      onclick: () => pick(color.value),
    }),
  );
  const remove = h(
    "button",
    {
      class: "icon-btn selection-bar__remove",
      type: "button",
      "aria-label": "Remove highlight",
      title: "Remove highlight",
      onclick: () => {
        const highlight = existing;
        hide();
        if (highlight) onRemove({ highlight });
      },
    },
    icon("trash", { size: 18 }),
  );
  const card = h(
    "button",
    {
      class: "btn btn--primary btn--sm",
      type: "button",
      onclick: makeCard,
    },
    icon("share", { size: 16 }),
    "Quote card",
  );
  const el = h(
    "div",
    {
      class: "selection-bar",
      role: "toolbar",
      "aria-label": "Highlight",
      hidden: true,
    },
    count,
    swatches,
    remove,
    card,
  );
  // Keep the text selected while the buttons are pressed.
  el.addEventListener("pointerdown", (event) => event.preventDefault());

  function syncSwatches() {
    for (const swatch of swatches) {
      if (existing)
        swatch.setAttribute(
          "aria-pressed",
          String(swatch.dataset.color === existing.color),
        );
      else swatch.removeAttribute("aria-pressed");
    }
  }

  function hide() {
    clearTimeout(hideTimer);
    el.hidden = true;
    existing = null;
  }

  function finishSelection() {
    hide();
    getSelection()?.removeAllRanges();
  }

  function pick(color) {
    if (existing) {
      const highlight = existing;
      existing = { ...highlight, color };
      syncSwatches();
      onRecolor({ highlight, color });
      return;
    }
    if (!isValidHighlightLength(text)) return;
    const picked = { text, anchor, color };
    finishSelection();
    onHighlight(picked);
  }

  function makeCard() {
    if (existing) {
      const highlight = existing;
      hide();
      onCard({ text: highlight.text, anchor: null, highlight });
      return;
    }
    if (!isValidHighlightLength(text)) return;
    const picked = { text, anchor, highlight: null };
    finishSelection();
    onCard(picked);
  }

  function readSelection() {
    const selection = getSelection();
    if (!selection || selection.isCollapsed || !selection.rangeCount) return null;
    const range = selection.getRangeAt(0);
    if (!scope.contains(range.commonAncestorContainer)) return null;
    return {
      text: cleanHighlightText(selection.toString()),
      anchor: anchorOf(scope, range),
    };
  }

  function onSelectionChange() {
    const found = readSelection();
    if (!found || !found.text) {
      // A tap on a painted highlight collapses the selection; keep its bar open.
      if (existing) return;
      clearTimeout(hideTimer);
      hideTimer = setTimeout(hide, HIDE_DELAY_MS);
      return;
    }
    clearTimeout(hideTimer);
    existing = null;
    text = found.text;
    anchor = found.anchor;
    const valid = isValidHighlightLength(text);
    count.hidden = false;
    count.textContent = valid
      ? `${text.length}/${HIGHLIGHT.maxLength}`
      : text.length > HIGHLIGHT.maxLength
        ? `Too long: ${text.length}/${HIGHLIGHT.maxLength}`
        : "Select a bit more";
    count.dataset.over = String(!valid);
    remove.hidden = true;
    syncSwatches();
    for (const swatch of swatches) swatch.disabled = !valid;
    card.disabled = !valid;
    el.hidden = false;
  }

  document.addEventListener("selectionchange", onSelectionChange);

  return {
    el,
    /** Opens the bar for a highlight that is already saved. */
    showFor(highlight) {
      clearTimeout(hideTimer);
      existing = highlight;
      count.hidden = true;
      remove.hidden = false;
      for (const swatch of swatches) swatch.disabled = false;
      card.disabled = false;
      syncSwatches();
      el.hidden = false;
    },
    /** Closes the bar when it is showing an existing highlight. */
    dismiss() {
      if (existing) hide();
    },
    destroy() {
      clearTimeout(hideTimer);
      document.removeEventListener("selectionchange", onSelectionChange);
      el.remove();
    },
  };
}
