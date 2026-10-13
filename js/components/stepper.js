import { h, icon } from "../core/dom.js";
import { clamp, round } from "../core/utils.js";

let counter = 0;

const HOLD_DELAY_MS = 450;
const HOLD_INTERVAL_MS = 80;

const decimalsOf = (step) => String(step).split(".")[1]?.length ?? 0;

/**
 * Labelled − / value / + control for a bounded number. Holding a button
 * repeats the step. Reuses the `.stepper` look from the daily goal card.
 */
export function createStepper({ label, min, max, step, format, onChange }) {
  const labelId = `stepper-${++counter}`;
  const decimals = decimalsOf(step);
  let value = min;

  const output = h("output", {
    class: "stepper__value",
    "aria-live": "polite",
    "aria-atomic": "true",
  });

  function nudge(direction) {
    const next = round(clamp(value + direction * step, min, max), decimals);
    if (next === value) return false;
    value = next;
    paint();
    onChange(value);
    return true;
  }

  function paint() {
    output.textContent = format(value);
    decrease.disabled = value <= min;
    increase.disabled = value >= max;
  }

  function button(direction, iconName, text) {
    let holdTimer = null;
    let repeatTimer = null;
    let held = false;

    const stop = () => {
      clearTimeout(holdTimer);
      clearInterval(repeatTimer);
      holdTimer = repeatTimer = null;
    };
    const el = h(
      "button",
      {
        class: "stepper__btn",
        type: "button",
        "aria-label": `${text} ${label.toLowerCase()}`,
        onpointerdown: (event) => {
          if (event.button !== 0 || el.disabled) return;
          held = false;
          holdTimer = setTimeout(() => {
            held = true;
            repeatTimer = setInterval(() => {
              if (!nudge(direction)) stop();
            }, HOLD_INTERVAL_MS);
          }, HOLD_DELAY_MS);
        },
        onpointerup: stop,
        onpointerleave: stop,
        onpointercancel: stop,
        // Keyboard activation and plain taps; a long press already stepped.
        onclick: () => {
          if (held) {
            held = false;
            return;
          }
          nudge(direction);
        },
        oncontextmenu: (event) => event.preventDefault(),
      },
      icon(iconName, { size: 16 }),
    );
    return el;
  }

  const decrease = button(-1, "minus", "Decrease");
  const increase = button(1, "plus", "Increase");

  return {
    el: h(
      "div",
      { class: "stepper-row" },
      h("span", { class: "stepper-row__label", id: labelId }, label),
      h(
        "div",
        { class: "stepper", role: "group", "aria-labelledby": labelId },
        decrease,
        output,
        increase,
      ),
    ),
    set(next) {
      value = clamp(next, min, max);
      paint();
    },
  };
}
