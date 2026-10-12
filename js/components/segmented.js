import { h } from "../core/dom.js";

let counter = 0;

/** Accessible single-choice control built on native radio inputs. */
export function createSegmented({
  label,
  options,
  onChange,
  variant = "default",
  renderOption,
}) {
  const name = `segmented-${++counter}`;
  const inputs = new Map();
  const el = h(
    "fieldset",
    { class: `segmented segmented--${variant}` },
    h("legend", { class: "sr-only" }, label),
    options.map((option) => {
      const input = h("input", {
        class: "segmented__input",
        type: "radio",
        name,
        value: option.value,
        onchange: () => onChange(option.value),
      });
      inputs.set(option.value, input);
      return h(
        "label",
        { class: "segmented__option", dataset: { value: option.value } },
        input,
        renderOption
          ? renderOption(option)
          : h("span", { class: "segmented__text" }, option.label),
      );
    }),
  );
  return {
    el,
    set(value) {
      const input = inputs.get(value);
      if (input) input.checked = true;
    },
  };
}
