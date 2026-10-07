import { store } from "./app.js";
import { GOALS, dayKey } from "./stats.js";
const KEYS = ["favs", "progress", "reader", "days", "goal", "highlights"];
const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
const okKey = (k) =>
  typeof k === "string" &&
  k.length <= 200 &&
  !["__proto__", "constructor", "prototype"].includes(k);
const str = (v, n) => String(v ?? "").slice(0, n);

export function exportData() {
  const data = {};
  for (const k of KEYS) {
    const v = store.read(k, null);
    if (v !== null) data[k] = v;
  }
  const blob = new Blob(
    [
      JSON.stringify(
        { app: "3nding", version: 1, exported: new Date().toISOString(), data },
        null,
        2,
      ),
    ],
    { type: "application/json" },
  );
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `3nding-progress-${dayKey()}.json`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1e4);
}

export function importData(text) {
  let j;
  try {
    j = JSON.parse(text);
  } catch {
    throw new Error("That file isn't valid JSON");
  }
  if (j?.app !== "3nding" || !isObj(j.data))
    throw new Error("That isn't a 3NDING progress file");
  const d = j.data,
    n = { favs: 0, progress: 0, days: 0, highlights: 0 };

  if (isObj(d.favs)) {
    const f = store.read("favs", {});
    for (const [id, v] of Object.entries(d.favs)) {
      if (!okKey(id) || !isObj(v)) continue;
      f[id] = {
        at: f[id]?.at ?? (Number.isFinite(v.at) ? v.at : Date.now()),
        done: !!(f[id]?.done || v.done),
      };
      n.favs++;
    }
    store.write("favs", f);
  }
  if (isObj(d.progress)) {
    const p = store.read("progress", {});
    for (const [id, v] of Object.entries(d.progress)) {
      if (!okKey(id) || !isObj(v)) continue;
      const chapter = Math.floor(+v.chapter),
        total = Math.floor(+v.total),
        ratio = +v.ratio,
        updated = +v.updated;
      if (
        !(
          chapter >= 0 &&
          total >= 1 &&
          ratio >= 0 &&
          ratio <= 1 &&
          Number.isFinite(updated)
        )
      )
        continue;
      if (!p[id] || updated > (p[id].updated || 0)) {
        p[id] = { chapter, ratio, total, updated };
        n.progress++;
      }
    }
    store.write("progress", p);
  }
  if (isObj(d.days)) {
    const cur = store.read("days", {});
    for (const [k, s] of Object.entries(d.days)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(k) || !(+s >= 0 && +s <= 86400)) continue;
      cur[k] = Math.max(cur[k] || 0, +s);
      n.days++;
    }
    store.write("days", cur);
  }
  if (GOALS.includes(+d.goal)) store.write("goal", +d.goal);
  if (isObj(d.reader)) store.write("reader", d.reader); 
  if (Array.isArray(d.highlights)) {
    const all = store.read("highlights", []);
    const has = (h) =>
      all.some(
        (x) =>
          x.id === h.id ||
          (x.book === h.book && x.chapter === h.chapter && x.text === h.text),
      );
    for (const h of d.highlights) {
      if (
        !isObj(h) ||
        !okKey(h.id) ||
        !okKey(h.book) ||
        typeof h.text !== "string"
      )
        continue;
      const text = h.text.replace(/\s+/g, " ").trim().slice(0, 300),
        chapter = Math.floor(+h.chapter);
      if (text.length < 3 || !(chapter >= 0)) continue;
      const item = {
        id: h.id,
        book: h.book,
        chapter,
        text,
        title: str(h.title, 200),
        author: str(h.author, 200),
        ch: str(h.ch, 200),
        at: Number.isFinite(+h.at) ? +h.at : Date.now(),
      };
      if (!has(item)) {
        all.push(item);
        n.highlights++;
      }
    }
    store.write("highlights", all.slice(-500));
  }
  return `${n.progress} book progress, ${n.favs} favorites, ${n.highlights} highlights, ${n.days} days`;
}
