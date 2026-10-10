import { store } from "./app.js";

const NAME = "3nding",
  VERSION = 1;
let dbp,
  fallback = false;

function open() {
  return (dbp ??= new Promise((res, rej) => {
    if (typeof indexedDB === "undefined") return rej(new Error("No IndexedDB"));
    let r;
    try {
      r = indexedDB.open(NAME, VERSION);
    } catch (e) {
      return rej(e);
    }
    r.onupgradeneeded = () => {
      const d = r.result;
      d.createObjectStore("drafts", { keyPath: "id" });
      d.createObjectStore("meta");
    };
    r.onsuccess = () => {
      const d = r.result;
      d.onversionchange = () => {
        d.close();
        dbp = null;
      };
      res(d);
    };
    r.onerror = () => rej(r.error);
    r.onblocked = () => rej(new Error("IndexedDB blocked"));
  }).catch((e) => {
    dbp = null;
    throw e;
  }));
}
const req = (r) =>
  new Promise((res, rej) => {
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
const done = (t) =>
  new Promise((res, rej) => {
    t.oncomplete = () => res();
    t.onerror = () => rej(t.error);
    t.onabort = () => rej(t.error);
  });
const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

export async function load() {
  try {
    const d = await open();
    const t = d.transaction(["drafts", "meta"]);
    let [drafts, cur] = await Promise.all([
      req(t.objectStore("drafts").getAll()),
      req(t.objectStore("meta").get("cur")),
    ]);
    if (!drafts.length) {
      const old = store.read("drafts", []);
      const items = (Array.isArray(old) ? old : []).filter(
        (x) => x && typeof x === "object" && typeof x.id === "string" && x.id,
      );
      if (items.length) {
        cur = store.read("draftCur", "");
        const w = d.transaction(["drafts", "meta"], "readwrite");
        items.forEach((x) => w.objectStore("drafts").put(x));
        w.objectStore("meta").put(typeof cur === "string" ? cur : "", "cur");
        await done(w);
        store.remove("drafts");
        store.remove("draftCur");
        drafts = items;
      }
    }
    return { drafts: drafts.sort(byId), cur: typeof cur === "string" ? cur : "" };
  } catch {
    fallback = true;
    const old = store.read("drafts", []);
    return {
      drafts: Array.isArray(old) ? old : [],
      cur: store.read("draftCur", ""),
    };
  }
}

export async function save(doc, all) {
  if (fallback) {
    if (!(store.write("drafts", all) && store.write("draftCur", doc.id)))
      throw new Error("Not saved");
    return;
  }
  const d = await open(),
    t = d.transaction(["drafts", "meta"], "readwrite");
  t.objectStore("drafts").put(doc);
  t.objectStore("meta").put(doc.id, "cur");
  await done(t);
}

export async function remove(id, all) {
  if (fallback) {
    if (!store.write("drafts", all)) throw new Error("Not saved");
    return;
  }
  const d = await open(),
    t = d.transaction("drafts", "readwrite");
  t.objectStore("drafts").delete(id);
  await done(t);
}
