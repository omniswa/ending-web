/**
 * Counts active reading time toward the daily goal. Time only accrues while
 * the page is visible and the reader interacted within the idle window.
 */
import { IDLE_TIMEOUT_MS } from "../config.js";
import { addReadingSeconds } from "./goals.js";

const ACTIVITY_EVENTS = [
  "pointerdown",
  "pointermove",
  "keydown",
  "wheel",
  "touchstart",
  "scroll",
];
const FLUSH_EVERY_TICKS = 5;

export function startReadingTimer({ onGoalReached } = {}) {
  let lastActivity = Date.now();
  let pending = 0;
  let ticks = 0;

  const markActive = () => {
    lastActivity = Date.now();
  };
  const flush = () => {
    if (!pending) return;
    const seconds = pending;
    pending = 0;
    const result = addReadingSeconds(seconds);
    if (result.goalJustReached) onGoalReached?.(result);
  };
  const onVisibility = () => {
    if (document.visibilityState === "hidden") flush();
  };

  for (const type of ACTIVITY_EVENTS)
    window.addEventListener(type, markActive, { passive: true, capture: true });
  document.addEventListener("visibilitychange", onVisibility);

  const interval = setInterval(() => {
    const active =
      document.visibilityState === "visible" &&
      Date.now() - lastActivity <= IDLE_TIMEOUT_MS;
    if (active) pending++;
    if (++ticks % FLUSH_EVERY_TICKS === 0) flush();
  }, 1000);

  return {
    stop() {
      clearInterval(interval);
      for (const type of ACTIVITY_EVENTS)
        window.removeEventListener(type, markActive, { capture: true });
      document.removeEventListener("visibilitychange", onVisibility);
      flush();
    },
  };
}
