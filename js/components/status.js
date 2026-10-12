import { h, icon } from "../core/dom.js";

export function emptyState({ iconName = "book", title, text, action }) {
  return h(
    "div",
    { class: "empty" },
    h("span", { class: "empty__icon" }, icon(iconName, { size: 26 })),
    h("h2", { class: "empty__title" }, title),
    text && h("p", { class: "empty__text" }, text),
    action,
  );
}

export function errorState({ title, text, onRetry }) {
  return emptyState({
    iconName: "alert",
    title,
    text,
    action:
      onRetry &&
      h(
        "button",
        { class: "btn", type: "button", onclick: onRetry },
        "Try again",
      ),
  });
}

export function gridSkeleton(count = 8) {
  return h(
    "ul",
    { class: "book-grid", "aria-hidden": "true" },
    Array.from({ length: count }, () =>
      h(
        "li",
        {},
        h("div", { class: "skeleton skeleton--cover" }),
        h("div", { class: "skeleton skeleton--line" }),
        h("div", { class: "skeleton skeleton--line skeleton--short" }),
      ),
    ),
  );
}
