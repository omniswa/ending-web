import { h } from "../core/dom.js";

const MAX_VISIBLE = 3;

/** Shows a short, non-blocking message. Optionally includes one action (e.g. Undo). */
export function toast(message, { action, duration = 4500 } = {}) {
  const region = document.getElementById("toasts");
  if (!region) return;

  const dismiss = () => {
    clearTimeout(timer);
    el.classList.add("is-leaving");
    el.addEventListener("animationend", () => el.remove(), { once: true });
    setTimeout(() => el.remove(), 400);
  };
  const el = h(
    "div",
    { class: "toast", role: "status" },
    h("span", { class: "toast__message" }, message),
    action &&
      h(
        "button",
        {
          class: "toast__action",
          type: "button",
          onclick: () => {
            action.onClick();
            dismiss();
          },
        },
        action.label,
      ),
  );
  const timer = setTimeout(dismiss, duration);

  while (region.children.length >= MAX_VISIBLE)
    region.firstElementChild.remove();
  region.append(el);
}
