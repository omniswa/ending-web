import { HIGHLIGHT } from "../config.js";
import { h, icon } from "../core/dom.js";
import {
  cleanHighlightText,
  isValidHighlightLength,
} from "../services/highlights.js";

const HIDE_DELAY_MS = 250;

/**
 * Floating toolbar shown while text inside `scope` is selected. It offers to
 * save the selection as a highlight or turn it straight into a quote card.
 * Callbacks receive the cleaned selection text.
 */
export function createSelectionBar({ scope, onSave, onCard }) {
  let text = "";
  let hideTimer = null;

  const count = h("span", { class: "selection-bar__count" });
  const save = h(
    "button",
    { class: "btn btn--sm", type: "button", onclick: () => run(onSave) },
    icon("quote", { size: 16 }),
    "Highlight",
  );
  const card = h(
    "button",
    {
      class: "btn btn--primary btn--sm",
      type: "button",
      onclick: () => run(onCard),
    },
    icon("share", { size: 16 }),
    "Quote card",
  );
  const el = h(
    "div",
    {
      class: "selection-bar",
      role: "toolbar",
      "aria-label": "Selected text",
      hidden: true,
    },
    count,
    save,
    card,
  );
  // Keep the text selected while the buttons are pressed.
  el.addEventListener("pointerdown", (event) => event.preventDefault());

  function hide() {
    clearTimeout(hideTimer);
    el.hidden = true;
  }

  function run(handler) {
    const selected = text;
    if (!isValidHighlightLength(selected)) return;
    hide();
    getSelection()?.removeAllRanges();
    handler(selected);
  }

  function readSelection() {
    const selection = getSelection();
    if (!selection || selection.isCollapsed || !selection.rangeCount) return "";
    const range = selection.getRangeAt(0);
    if (!scope.contains(range.commonAncestorContainer)) return "";
    return cleanHighlightText(selection.toString());
  }

  function onSelectionChange() {
    const next = readSelection();
    if (!next) {
      clearTimeout(hideTimer);
      hideTimer = setTimeout(hide, HIDE_DELAY_MS);
      return;
    }
    clearTimeout(hideTimer);
    text = next;
    const valid = isValidHighlightLength(next);
    count.textContent = valid
      ? `${next.length}/${HIGHLIGHT.maxLength}`
      : next.length > HIGHLIGHT.maxLength
        ? `Too long: ${next.length}/${HIGHLIGHT.maxLength}`
        : "Select a bit more";
    count.dataset.over = String(!valid);
    save.disabled = !valid;
    card.disabled = !valid;
    el.hidden = false;
  }

  document.addEventListener("selectionchange", onSelectionChange);

  return {
    el,
    destroy() {
      clearTimeout(hideTimer);
      document.removeEventListener("selectionchange", onSelectionChange);
      el.remove();
    },
  };
}
