import { store } from "./app.js";
export const GOALS = [5, 10, 15, 20, 30, 45, 60];
export const dayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const FLUSH_MS = 30000;
let pending = 0,
  pendDay = "",
  flushedAt = Date.now();
const stored = () => {
  const d = store.read("days", {});
  return d && typeof d === "object" && !Array.isArray(d) ? d : {};
};
const days = () => {
  const d = stored();
  if (pending) d[pendDay] = (d[pendDay] || 0) + pending;
  return d;
};
export function flushTime() {
  if (!pending) return;
  const d = stored();
  d[pendDay] = (d[pendDay] || 0) + pending;
  Object.keys(d)
    .sort()
    .slice(0, -1000)
    .forEach((x) => delete d[x]);
  if (store.write("days", d)) pending = 0;
  flushedAt = Date.now();
}
addEventListener("pagehide", flushTime);
document.addEventListener(
  "visibilitychange",
  () => document.hidden && flushTime(),
);
export function getGoal() {
  const m = +store.read("goal", 10);
  return GOALS.includes(m) ? m : 10;
}
export const setGoal = (m) => GOALS.includes(m) && store.write("goal", m);
export const todaySeconds = () => days()[dayKey()] || 0;

export function addTime(sec) {
  const k = dayKey();
  if (pending && pendDay !== k) flushTime();
  const need = getGoal() * 60,
    before = days()[k] || 0;
  pendDay = k;
  pending += sec;
  const hit = before < need && before + sec >= need;
  if (hit || Date.now() - flushedAt >= FLUSH_MS) flushTime();
  return hit;
}
export function streak() {
  const d = days(),
    need = getGoal() * 60,
    day = new Date();
  let n = 0;
  if (!(d[dayKey(day)] >= need)) day.setDate(day.getDate() - 1);
  while (d[dayKey(day)] >= need) {
    n++;
    day.setDate(day.getDate() - 1);
  }
  return n;
}
export function week() {
  const d = days(),
    need = getGoal() * 60,
    today = dayKey(),
    first = Object.keys(d).sort()[0],
    out = [];
  for (let i = 6; i >= 0; i--) {
    const day = new Date();
    day.setDate(day.getDate() - i);
    const key = dayKey(day);
    out.push({
      key,
      sec: d[key] || 0,
      // A finished day that missed the goal (only once reading has started,
      // so brand-new users don't see a row of red).
      missed: !!first && key >= first && key < today && (d[key] || 0) < need,
      label: day.toLocaleDateString(undefined, { weekday: "narrow" }),
    });
  }
  return out;
}
