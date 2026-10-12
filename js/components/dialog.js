import { h, icon } from "../core/dom.js";

let counter = 0;

/**
 * Wraps the native <dialog> element (focus trapping, Escape, top layer for free).
 * variant: 'modal' (centered), 'sheet' (bottom sheet on phones) or 'panel' (side panel on desktop).
 */
export function createDialog({
  title,
  variant = "modal",
  host = document.body,
  onClose,
} = {}) {
  const titleId = `dialog-title-${++counter}`;
  const dialog = h("dialog", {
    class: `dialog dialog--${variant}`,
    "aria-labelledby": titleId,
  });
  const body = h("div", { class: "dialog__body" });
  const footer = h("footer", { class: "dialog__footer" });
  dialog.append(
    h(
      "header",
      { class: "dialog__header" },
      h("h2", { class: "dialog__title", id: titleId }, title),
      h(
        "button",
        {
          class: "icon-btn",
          type: "button",
          "aria-label": "Close",
          onclick: () => dialog.close(),
        },
        icon("x"),
      ),
    ),
    body,
    footer,
  );

  // Clicks on the backdrop target the <dialog> element itself.
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener("close", () => onClose?.());

  return {
    dialog,
    body,
    footer,
    open() {
      if (!dialog.isConnected) host.append(dialog);
      if (!dialog.open) dialog.showModal();
    },
    close: () => dialog.close(),
    destroy() {
      if (dialog.open) dialog.close();
      dialog.remove();
    },
  };
}

/** Promise-based confirmation prompt. Resolves true only when the confirm button is used. */
export function confirmDialog({
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
}) {
  return new Promise((resolve) => {
    let confirmed = false;
    const modal = createDialog({
      title,
      variant: "modal",
      onClose: () => {
        resolve(confirmed);
        modal.destroy();
      },
    });
    modal.body.append(h("p", { class: "dialog__text" }, message));
    modal.footer.append(
      h(
        "button",
        {
          class: "btn btn--ghost",
          type: "button",
          onclick: () => modal.close(),
        },
        cancelLabel,
      ),
      h(
        "button",
        {
          class: `btn ${danger ? "btn--danger" : "btn--primary"}`,
          type: "button",
          onclick: () => {
            confirmed = true;
            modal.close();
          },
        },
        confirmLabel,
      ),
    );
    modal.open();
  });
}
