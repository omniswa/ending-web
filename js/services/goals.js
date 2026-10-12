/**
 * Daily reading goal and streak logic.
 *
 * Each calendar day stores the seconds read and a sticky `met` flag. A day that
 * reached the goal stays "done" even if the target is raised later. The streak
 * is the run of consecutive done days ending today (or yesterday, while today
 * is still in progress).
 */
import { GOAL } from "../config.js";
import { addDays, todayKey, weekKeys, weekdayLabel } from "../core/dates.js";
import { clamp } from "../core/utils.js";
import { appStore } from "../state/store.js";

const EMPTY_DAY = Object.freeze({ seconds: 0, met: false });
const dayOf = (state, key) => state.days[key] ?? EMPTY_DAY;

export function setGoalMinutes(minutes) {
  const value = clamp(
    Math.round(minutes / GOAL.step) * GOAL.step,
    GOAL.min,
    GOAL.max,
  );
  appStore.update((s) => {
    const key = todayKey();
    const today = dayOf(s, key);
    const nowMet = !today.met && today.seconds >= value * 60;
    return {
      ...s,
      goal: { ...s.goal, minutes: value },
      days: nowMet ? { ...s.days, [key]: { ...today, met: true } } : s.days,
    };
  });
}

/** Adds reading time to today. Reports whether this call completed today's goal. */
export function addReadingSeconds(seconds) {
  if (!(seconds > 0)) return { goalJustReached: false, streak: 0 };
  let goalJustReached = false;
  appStore.update((s) => {
    const key = todayKey();
    const today = dayOf(s, key);
    const total = today.seconds + seconds;
    const met = today.met || total >= s.goal.minutes * 60;
    goalJustReached = met && !today.met;
    return { ...s, days: { ...s.days, [key]: { seconds: total, met } } };
  });
  return { goalJustReached, streak: goalJustReached ? getStreak().current : 0 };
}

export function getStreak(state = appStore.get()) {
  const today = todayKey();
  const todayMet = dayOf(state, today).met;

  let current = 0;
  let cursor = todayMet ? today : addDays(today, -1);
  while (dayOf(state, cursor).met) {
    current++;
    cursor = addDays(cursor, -1);
  }

  const metDays = Object.keys(state.days)
    .filter((key) => state.days[key].met)
    .sort();
  let best = 0;
  let run = 0;
  let previous = null;
  for (const key of metDays) {
    run = previous && addDays(previous, 1) === key ? run + 1 : 1;
    best = Math.max(best, run);
    previous = key;
  }
  return { current, best: Math.max(best, current), todayMet };
}

export function getToday(state = appStore.get()) {
  const goalSeconds = state.goal.minutes * 60;
  const { seconds, met } = dayOf(state, todayKey());
  return {
    goalMinutes: state.goal.minutes,
    minutes: Math.floor(seconds / 60),
    ratio: met ? 1 : clamp(seconds / goalSeconds, 0, 1),
    met,
    remainingMinutes: Math.max(0, Math.ceil((goalSeconds - seconds) / 60)),
  };
}

/** The current Monday-first week with a status for each day: done | progress | missed | upcoming | none. */
export function getWeek(state = appStore.get()) {
  const today = todayKey();
  const goalSeconds = state.goal.minutes * 60;
  return weekKeys(today).map((key) => {
    const day = dayOf(state, key);
    let status;
    if (day.met) status = "done";
    else if (key > today) status = "upcoming";
    else if (key === today) status = "progress";
    else if (key >= state.goal.startedOn) status = "missed";
    else status = "none";
    return {
      key,
      status,
      isToday: key === today,
      ratio: day.met ? 1 : clamp(day.seconds / goalSeconds, 0, 1),
      shortLabel: weekdayLabel(key, "narrow"),
      longLabel: weekdayLabel(key, "long"),
    };
  });
}
