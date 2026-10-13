import { h } from "../core/dom.js";

export function mount({ root }) {
  root.append(
    h(
      "div",
      { class: "container page__inner" },
      h(
        "header",
        { class: "page-header" },
        h("h1", { class: "page-header__title" }, "About"),
      ),
      h(
        "div",
        { class: "prose" },
        h("p", {}, "3NDING is a private, offline-friendly EPUB reader with daily reading goals and streaks. Your books and reading data stay on your device — nothing is sent to a server."),
      ),
    ),
  );
}
