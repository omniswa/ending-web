import { h, icon } from "../core/dom.js";

/**
 * Slide-in drawer for mobile secondary navigation (About, Terms, Privacy).
 * Uses a native <dialog> so Escape, focus-trap, and backdrop are free.
 * The trigger button is shown only on small screens via CSS.
 */
export function createDrawer() {
  const dialog = h("dialog", {
    class: "drawer",
    "aria-label": "Site menu",
  });

  const closeBtn = h(
    "button",
    { class: "icon-btn drawer__close", type: "button", "aria-label": "Close menu" },
    icon("x"),
  );

  dialog.append(
    h(
      "div",
      { class: "drawer__inner" },
      h(
        "div",
        { class: "drawer__header" },
        h("span", { class: "drawer__title" }, "Menu"),
        closeBtn,
      ),
      h(
        "nav",
        { class: "drawer__nav", "aria-label": "Site" },
        h("a", { class: "drawer__link", href: "#/about" }, "About"),
        h("a", { class: "drawer__link", href: "#/terms" }, "Terms"),
        h("a", { class: "drawer__link", href: "#/privacy" }, "Privacy"),
      ),
    ),
  );

  // Close on backdrop click (click targets the <dialog> itself, not its children)
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) dialog.close();
  });

  // Close when a link is followed
  dialog.addEventListener("click", (e) => {
    if (e.target.closest(".drawer__link")) dialog.close();
  });

  closeBtn.addEventListener("click", () => dialog.close());

  document.body.append(dialog);

  // Trigger button — rendered into the header by the caller
  const trigger = h(
    "button",
    {
      class: "btn btn--ghost btn--sm drawer__trigger",
      type: "button",
      "aria-label": "Open menu",
      "aria-haspopup": "dialog",
      onclick: () => {
        if (!dialog.open) dialog.showModal();
      },
    },
    icon("list", { size: 18 }),
  );

  return {
    trigger,
    destroy() {
      if (dialog.open) dialog.close();
      dialog.remove();
    },
  };
}
