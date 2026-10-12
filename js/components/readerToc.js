import { h } from "../core/dom.js";
import { createDialog } from "./dialog.js";

/** Table of contents panel. `onSelect` receives the chosen TOC entry. */
export function createToc({ host, epub, getChapter, onSelect }) {
  const dialog = createDialog({ title: "Contents", variant: "panel", host });

  function render() {
    const current = epub.toc.findIndex(
      (entry) => entry.chapter === getChapter(),
    );
    dialog.body.replaceChildren(
      h(
        "ol",
        { class: "toc" },
        epub.toc.map((entry, index) =>
          h(
            "li",
            {},
            h(
              "button",
              {
                class: "toc__item",
                type: "button",
                style: `--depth:${entry.depth}`,
                "aria-current": index === current ? "true" : null,
                onclick: () => {
                  dialog.close();
                  onSelect(entry);
                },
              },
              entry.label,
            ),
          ),
        ),
      ),
    );
  }

  return {
    open() {
      render();
      dialog.open();
      dialog.body
        .querySelector('[aria-current="true"]')
        ?.scrollIntoView({ block: "center" });
    },
    destroy: dialog.destroy,
  };
}
