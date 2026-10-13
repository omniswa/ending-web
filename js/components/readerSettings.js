/** Reading appearance panel: font, theme, alignment, spacing and padding. */
import { READER_OPTIONS, READER_RANGES } from "../config.js";
import { h, icon } from "../core/dom.js";
import { resetReaderPrefs, setReaderPref } from "../services/readerPrefs.js";
import { subscribeSelect } from "../state/store.js";
import { createDialog } from "./dialog.js";
import { createSegmented } from "./segmented.js";
import { createStepper } from "./stepper.js";

const FORMATS = {
  size: (v) => `${v}px`,
  lineHeight: (v) => v.toFixed(2),
  letterSpacing: (v) => `${v.toFixed(2)}em`,
  padding: (v) => `${v}px`,
};

/** Applies preferences to the reader root using data attributes and CSS custom properties. */
export function applyReaderPrefs(root, prefs) {
  root.dataset.theme = prefs.theme;
  root.dataset.font = prefs.font;
  root.dataset.align = prefs.align;
  root.style.setProperty("--r-size", `${prefs.size}px`);
  root.style.setProperty("--r-lh", String(prefs.lineHeight));
  root.style.setProperty("--r-ls", `${prefs.letterSpacing}em`);
  root.style.setProperty("--r-pad", `${prefs.padding}px`);
}

export function createReaderSettings({ host }) {
  const dialog = createDialog({ title: "Appearance", variant: "panel", host });
  const syncers = [];

  const segmented = (key, label, variant, renderOption) => {
    const control = createSegmented({
      label,
      options: READER_OPTIONS[key],
      variant,
      renderOption,
      onChange: (value) => setReaderPref(key, value),
    });
    syncers.push((prefs) => control.set(prefs[key]));
    return control.el;
  };
  const stepper = (key) => {
    const range = READER_RANGES[key];
    const control = createStepper({
      ...range,
      format: FORMATS[key],
      onChange: (value) => setReaderPref(key, value),
    });
    syncers.push((prefs) => control.set(prefs[key]));
    return control.el;
  };
  const group = (title, ...content) =>
    h(
      "section",
      { class: "setting" },
      h("h3", { class: "setting__title" }, title),
      content,
    );

  dialog.body.append(
    group(
      "Font",
      segmented("font", "Font", "font", (o) =>
        h(
          "span",
          { class: "segmented__text", dataset: { font: o.value } },
          h("span", { class: "segmented__sample" }, "Aa"),
          o.label,
        ),
      ),
    ),
    group(
      "Theme",
      segmented("theme", "Theme", "theme", (o) =>
        h(
          "span",
          { class: "segmented__text", dataset: { theme: o.value } },
          h("span", { class: "swatch" }),
          o.label,
        ),
      ),
    ),
    group(
      "Text",
      segmented("align", "Text alignment", "default"),
      stepper("size"),
      stepper("lineHeight"),
      stepper("letterSpacing"),
    ),
    group("Layout", stepper("padding")),
  );
  dialog.footer.append(
    h(
      "button",
      { class: "btn btn--ghost", type: "button", onclick: resetReaderPrefs },
      icon("rotate", { size: 16 }),
      "Reset to defaults",
    ),
  );

  const unsubscribe = subscribeSelect(
    (s) => s.reader,
    (prefs) => syncers.forEach((sync) => sync(prefs)),
  );
  return {
    open: dialog.open,
    destroy() {
      unsubscribe();
      dialog.destroy();
    },
  };
}
