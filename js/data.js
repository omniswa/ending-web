import { store, obj } from "./app.js";
import { GOALS, dayKey, flushTime } from "./stats.js";
const KEYS = ["favs", "progress", "reader", "days", "goal", "highlights"];
const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
const okKey = (k) =>
  typeof k === "string" &&
  k.length <= 200 &&
  !["__proto__", "constructor", "prototype"].includes(k);
const str = (v, n) => String(v ?? "").slice(0, n);
const save = (k, v) => {
  if (!store.write(k, v)) throw new Error("Not enough storage space to import");
};

export function exportData() {
  flushTime();
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
    const f = obj("favs");
    for (const [id, v] of Object.entries(d.favs)) {
      // Old exports may contain non-favorite "finished" entries; those are no longer kept.
      if (!okKey(id) || !isObj(v) || v.fav === false) continue;
      const cur = f[id];
      f[id] = {
        at: cur?.at ?? (Number.isFinite(v.at) ? v.at : Date.now()),
        done: !!(cur?.done || v.done),
      };
      n.favs++;
    }
    save("favs", f);
  }
  if (isObj(d.progress)) {
    const p = obj("progress");
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
          chapter < total &&
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
    save("progress", p);
  }
  if (isObj(d.days)) {
    const cur = obj("days");
    for (const [k, s] of Object.entries(d.days)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(k) || !(+s >= 0 && +s <= 86400)) continue;
      cur[k] = Math.max(cur[k] || 0, +s);
      n.days++;
    }
    save("days", cur);
  }
  if (GOALS.includes(+d.goal)) save("goal", +d.goal);
  if (isObj(d.reader)) {
    const r = {};
    for (const k of ["font", "theme", "size", "align", "lh", "rate"])
      if (["string", "number"].includes(typeof d.reader[k])) r[k] = d.reader[k];
    save("reader", r);
  }
  if (Array.isArray(d.highlights)) {
    const raw = store.read("highlights", []);
    const all = Array.isArray(raw) ? raw : [];
    const has = (h) =>
      all.some(
        (x) =>
          x.id === h.id ||
          (x.book === h.book &&
            x.chapter === h.chapter &&
            x.text === h.text &&
            (x.pi ?? h.pi) === (h.pi ?? x.pi)),
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
        chapter = Math.floor(+h.chapter),
        pi = Math.floor(+h.pi);
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
      if (pi >= 0) item.pi = pi;
      if (!has(item)) {
        all.push(item);
        n.highlights++;
      }
    }
    save("highlights", all.slice(-500));
  }
  return `${n.progress} book progress, ${n.favs} favorites, ${n.highlights} highlights, ${n.days} days`;
}
