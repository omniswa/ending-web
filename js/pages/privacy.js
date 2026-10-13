import { h } from "../core/dom.js";

export function mount({ root }) {
  root.append(
    h(
      "div",
      { class: "container page__inner" },
      h(
        "header",
        { class: "page-header" },
        h("h1", { class: "page-header__title" }, "Privacy Policy"),
      ),
      h(
        "div",
        { class: "prose" },
        h("p", {}, "3NDING stores all data locally in your browser using IndexedDB. No personal information is collected or transmitted. Clearing your browser storage removes all app data permanently."),
      ),
    ),
  );
}
