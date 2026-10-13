import { h } from "../core/dom.js";

export function mount({ root }) {
  root.append(
    h(
      "div",
      { class: "container page__inner" },
      h(
        "header",
        { class: "page-header" },
        h("h1", { class: "page-header__title" }, "Terms of Use"),
      ),
      h(
        "div",
        { class: "prose" },
        h("p", {}, "By using 3NDING you agree to use it for personal, lawful purposes only. The app is provided as-is without warranties of any kind."),
      ),
    ),
  );
}
