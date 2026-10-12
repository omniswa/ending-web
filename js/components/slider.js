import { h } from "../core/dom.js";

let counter = 0;

export function createSlider({ label, min, max, step, format, onInput }) {
  const id = `slider-${++counter}`;
  const output = h("output", { class: "slider__value", for: id });
  const input = h("input", {
    class: "slider__input",
    id,
    type: "range",
    min,
    max,
    step,
    oninput: () => {
      const value = Number(input.value);
      output.textContent = format(value);
      onInput(value);
    },
  });
  return {
    el: h(
      "div",
      { class: "slider" },
      h(
        "div",
        { class: "slider__head" },
        h("label", { for: id }, label),
        output,
      ),
      input,
    ),
    set(value) {
      input.value = String(value);
      output.textContent = format(value);
    },
  };
}
