/** Daily goal card: progress ring, streak, week indicators and a target stepper. */
import { GOAL } from "../config.js";
import { h, icon } from "../core/dom.js";
import {
  getStreak,
  getToday,
  getWeek,
  setGoalMinutes,
} from "../services/goals.js";
import { plural } from "../core/utils.js";
import { appStore } from "../state/store.js";

const RADIUS = 44;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const STATUS_TEXT = {
  done: "goal reached",
  progress: "in progress",
  missed: "missed",
  upcoming: "upcoming",
  none: "no data",
};

export function createGoalCard() {
  const SVG = "http://www.w3.org/2000/svg";
  const ringFill = document.createElementNS(SVG, "circle");
  ringFill.setAttribute("class", "goal__ring-fill");
  ringFill.setAttribute("cx", "50");
  ringFill.setAttribute("cy", "50");
  ringFill.setAttribute("r", String(RADIUS));
  ringFill.style.strokeDasharray = String(CIRCUMFERENCE);
  const ringTrack = ringFill.cloneNode();
  ringTrack.setAttribute("class", "goal__ring-track");
  ringTrack.style.strokeDasharray = "";
  const ringSvg = document.createElementNS(SVG, "svg");
  ringSvg.setAttribute("viewBox", "0 0 100 100");
  ringSvg.setAttribute("aria-hidden", "true");
  ringSvg.append(ringTrack, ringFill);

  const minutesText = h("span", { class: "goal__minutes" });
  const targetText = h("span", { class: "goal__target" });
  const ring = h(
    "div",
    { class: "goal__ring", role: "img" },
    ringSvg,
    h("div", { class: "goal__ring-text" }, minutesText, targetText),
  );

  const streakText = h("span", { class: "goal__streak-count" });
  const bestText = h("span", { class: "goal__best" });
  const streak = h(
    "div",
    { class: "goal__streak" },
    icon("flame", { size: 20 }),
    h("div", {}, streakText, bestText),
  );
  const message = h("p", { class: "goal__message" });

  const week = h("ol", { class: "week", "aria-label": "This week" });
  const legend = h(
    "ul",
    { class: "legend", "aria-hidden": "true" },
    [
      ["done", "Done"],
      ["progress", "In progress"],
      ["missed", "Missed"],
    ].map(([status, text]) =>
      h(
        "li",
        { class: "legend__item" },
        h("span", { class: "legend__dot", dataset: { status } }),
        text,
      ),
    ),
  );

  const targetValue = h("output", {
    class: "stepper__value",
    "aria-live": "polite",
  });
  const decrease = h(
    "button",
    {
      class: "stepper__btn",
      type: "button",
      "aria-label": "Decrease daily goal",
      onclick: () => setGoalMinutes(appStore.get().goal.minutes - GOAL.step),
    },
    icon("minus", { size: 16 }),
  );
  const increase = h(
    "button",
    {
      class: "stepper__btn",
      type: "button",
      "aria-label": "Increase daily goal",
      onclick: () => setGoalMinutes(appStore.get().goal.minutes + GOAL.step),
    },
    icon("plus", { size: 16 }),
  );

  const el = h(
    "section",
    { class: "card goal", "aria-labelledby": "goal-title" },
    h(
      "div",
      { class: "goal__top" },
      h("h2", { class: "section__title", id: "goal-title" }, "Daily goal"),
      streak,
    ),
    h("div", { class: "goal__body" }, ring, message),
    week,
    legend,
    h(
      "div",
      { class: "goal__footer" },
      h(
        "span",
        { class: "goal__footer-label", id: "goal-target-label" },
        "Daily target",
      ),
      h(
        "div",
        {
          class: "stepper",
          role: "group",
          "aria-labelledby": "goal-target-label",
        },
        decrease,
        targetValue,
        increase,
      ),
    ),
  );

  function render(state) {
    const today = getToday(state);
    const streakInfo = getStreak(state);

    ringFill.style.strokeDashoffset = String(CIRCUMFERENCE * (1 - today.ratio));
    ring.dataset.met = String(today.met);
    ring.setAttribute(
      "aria-label",
      `${today.minutes} of ${today.goalMinutes} minutes read today`,
    );
    minutesText.textContent = String(today.minutes);
    targetText.textContent = `of ${today.goalMinutes} min`;

    streakText.textContent = plural(streakInfo.current, "day") + " streak";
    bestText.textContent =
      streakInfo.best > 0
        ? `Best: ${plural(streakInfo.best, "day")}`
        : "Start your first streak";
    streak.dataset.active = String(streakInfo.todayMet);

    if (today.met)
      message.textContent =
        "Goal reached today. Come back tomorrow to keep your streak going.";
    else if (streakInfo.current > 0)
      message.textContent = `${plural(today.remainingMinutes, "minute")} left to extend your ${streakInfo.current}-day streak.`;
    else
      message.textContent = `Read for ${plural(today.goalMinutes, "minute")} today to start a streak.`;

    week.replaceChildren(
      ...getWeek(state).map((day) =>
        h(
          "li",
          {
            class: "week__day",
            dataset: { status: day.status, today: String(day.isToday) },
            "aria-label": `${day.longLabel}${day.isToday ? " (today)" : ""}: ${STATUS_TEXT[day.status]}`,
          },
          h(
            "span",
            { class: "week__label", "aria-hidden": "true" },
            day.shortLabel,
          ),
          h(
            "span",
            {
              class: "week__dot",
              style: `--ratio:${day.ratio.toFixed(3)}`,
              "aria-hidden": "true",
            },
            day.status === "done"
              ? icon("check", { size: 14 })
              : day.status === "missed"
                ? icon("x", { size: 12 })
                : null,
          ),
        ),
      ),
    );

    targetValue.textContent = `${state.goal.minutes} min`;
    decrease.disabled = state.goal.minutes <= GOAL.min;
    increase.disabled = state.goal.minutes >= GOAL.max;
  }

  render(appStore.get());
  const unsubscribe = appStore.subscribe(render);
  return { el, destroy: unsubscribe };
}
