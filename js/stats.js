import { store } from "./app.js";
export const GOALS = [5, 10, 15, 20, 30, 45, 60];
export const dayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const days = () => {
  const d = store.read("days", {});
  return d && typeof d === "object" && !Array.isArray(d) ? d : {};
};
export function getGoal() {
  const m = +store.read("goal", 10);
  return GOALS.includes(m) ? m : 10;
}
export const setGoal = (m) => GOALS.includes(m) && store.write("goal", m);
export const todaySeconds = () => days()[dayKey()] || 0;

export function addTime(sec) {
  const d = days(),
    k = dayKey(),
    before = d[k] || 0;
  d[k] = before + sec;
  Object.keys(d)
    .sort()
    .slice(0, -400)
    .forEach((x) => delete d[x]);
  store.write("days", d);
  return before < getGoal() * 60 && d[k] >= getGoal() * 60;
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
    out = [];
  for (let i = 6; i >= 0; i--) {
    const day = new Date();
    day.setDate(day.getDate() - i);
    const key = dayKey(day);
    out.push({
      key,
      sec: d[key] || 0,
      label: day.toLocaleDateString(undefined, { weekday: "narrow" }),
    });
  }
  return out;
}
