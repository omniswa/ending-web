import { h } from "../core/dom.js";
import { hueFrom } from "../core/utils.js";

/** Book cover with a generated fallback shown while loading or when no image exists. */
export function createCover(book) {
  const wrapper = h(
    "div",
    { class: "cover", style: `--hue:${hueFrom(book.title)}` },
    h(
      "div",
      { class: "cover__fallback", "aria-hidden": "true" },
      h("span", { class: "cover__title" }, book.title),
      h("span", { class: "cover__author" }, book.author),
    ),
  );
  if (book.cover) {
    const image = h("img", {
      class: "cover__img",
      src: book.cover,
      alt: `Cover of ${book.title}`,
      loading: "lazy",
      decoding: "async",
      onerror: () => image.remove(),
    });
    wrapper.append(image);
  }
  return wrapper;
}
