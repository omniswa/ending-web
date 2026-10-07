import { loadBooks, store, favs, icon, esc, toast } from "./app.js";
import { readZip } from "./zip.js";
const $ = (s) => document.querySelector(s),
  root = document.documentElement;
const DEFAULTS = { font: "serif", theme: "paper", size: 19, align: "left" };
const FONTS = {
  serif: "var(--serif)",
  sans: "var(--ui)",
  mono: '"JetBrains Mono",monospace',
};
const OPTS = {
  font: ["serif", "sans", "mono"],
  theme: ["paper", "sepia", "dark", "oled"],
  align: ["left", "justify"],
};
const SKELETON =
  '<div class="skl" aria-hidden="true">' + "<i></i>".repeat(10) + "</div>";
const failView = (msg, extra = "") =>
  `<div class="empty"><p>${esc(msg)}.</p><button class="btn primary" data-retry>Try again</button>${extra}</div>`;
function clean(s) {
  const o = { ...DEFAULTS };
  for (const k in OPTS) if (OPTS[k].includes(s?.[k])) o[k] = s[k];
  const n = Math.round(+s?.size);
  if (n >= 14 && n <= 32) o.size = n;
  return o;
}
let settings = clean(store.read("reader", {})),
  book,
  manifest,
  read,
  chapter = 0,
  saveTimer,
  token = 0,
  ready = false,
  panelBuilt = false;

function apply() {
  root.dataset.theme = settings.theme;
  root.style.setProperty("--font", FONTS[settings.font]);
  root.style.setProperty("--size", settings.size + "px");
  root.style.setProperty("--align", settings.align);
  document
    .querySelectorAll(".panel [data-k]")
    .forEach((b) =>
      b.setAttribute("aria-pressed", settings[b.dataset.k] === b.dataset.v),
    );
  const r = $("#size");
  if (r) r.value = settings.size;
  const o = $("#sizeVal");
  if (o) o.textContent = settings.size + " px";
  store.write("reader", settings);
}
function buildPanel() {
  if (panelBuilt) return;
  panelBuilt = true;
  const seg = (k) =>
    `<div class="seg">${OPTS[k].map((v) => `<button data-k="${k}" data-v="${v}">${v[0].toUpperCase() + v.slice(1)}</button>`).join("")}</div>`;
  $("#panel").innerHTML =
    `<label>Font${seg("font")}</label><label>Theme${seg("theme")}</label><label><span class="row">Font size<b id="sizeVal"></b></span><input id="size" type="range" min="14" max="32" step="1"></label><label>Alignment${seg("align")}</label><button class="btn" id="reset">Reset to defaults</button>`;
  $("#panel").addEventListener("click", (e) => {
    const b = e.target.closest("[data-k]");
    if (b) {
      settings[b.dataset.k] = b.dataset.v;
      apply();
    }
  });
  $("#size").addEventListener("input", (e) => {
    settings.size = +e.target.value;
    apply();
  });
  $("#reset").addEventListener("click", () => {
    settings = { ...DEFAULTS };
    apply();
    toast("Settings reset");
  });
}
const ratio = () => {
  const m = root.scrollHeight - innerHeight;
  return m > 0 ? Math.min(1, scrollY / m) : 1;
};
function save() {
  if (!book || !manifest || !ready) return;
  const p = store.read("progress", {});
  p[book.id] = {
    chapter,
    ratio: ratio(),
    total: manifest.chapters.length,
    updated: Date.now(),
  };
  store.write("progress", p);
  $("#bar").style.width =
    ((chapter + ratio()) / manifest.chapters.length) * 100 + "%";
}
const isLast = () => chapter === manifest.chapters.length - 1;
function updateNext() {
  const n = $("#next");
  n.disabled = false;
  n.textContent = !isLast()
    ? "Next"
    : favs()[book.id]?.done
      ? "Back to library"
      : "Mark as finished";
}
async function open(i, r = 0) {
  const my = ++token;
  ready = false;
  chapter = Math.max(0, Math.min(i, manifest.chapters.length - 1));
  const c = manifest.chapters[chapter];
  $("#page").setAttribute("aria-busy", "true");
  $("#page").innerHTML = SKELETON;
  let ok = true;
  try {
    const text = await read(c.file);
    if (my !== token) return;
    $("#page").innerHTML =
      `<h2>${esc(c.title)}</h2>` +
      text
        .split(/\r?\n\s*\r?\n/)
        .filter((s) => s.trim())
        .map((s) => `<p>${esc(s.trim()).replace(/\r?\n/g, " ")}</p>`)
        .join("");
  } catch (e) {
    if (my !== token) return;
    ok = false;
    $("#page").innerHTML = failView(e.message || "Could not load this chapter");
  }
  $("#page").removeAttribute("aria-busy");
  $("#chapters").value = chapter;
  $("#prev").disabled = chapter === 0;
  updateNext();
  requestAnimationFrame(() => {
    if (my !== token) return;
    scrollTo(0, (Number.isFinite(r) ? r : 0) * (root.scrollHeight - innerHeight));
    ready = ok;
    if (ok) save();
  });
}
async function init() {
  history.scrollRestoration = "manual";
  $("#back").innerHTML = icon("back");
  $("#fs").innerHTML = icon("full");
  if (!document.fullscreenEnabled) $("#fs").hidden = true;
  buildPanel();
  apply();
  $("#page").setAttribute("aria-busy", "true");
  $("#page").innerHTML = SKELETON;
  try {
    const id = new URLSearchParams(location.search).get("id");
    book = (await loadBooks()).find((b) => b.id === id);
    if (!book) throw new Error("Book not found");
    const res = await fetch(book.zip);
    if (!res.ok) throw new Error("Could not download this book");
    read = await readZip(await res.arrayBuffer());
    manifest = JSON.parse(await read("manifest.json"));
    if (!manifest.chapters?.length)
      throw new Error("This book has no chapters");
    document.title = `${manifest.title} – 3NDING`;
    $("#bookTitle").textContent = manifest.title;
    $("#chapters").innerHTML = manifest.chapters
      .map((c, i) => `<option value="${i}">${i + 1}. ${esc(c.title)}</option>`)
      .join("");
    const p = store.read("progress", {})[id];
    await open(p?.chapter ?? 0, p?.ratio ?? 0);
  } catch (e) {
    book = manifest = null;
    $("#page").removeAttribute("aria-busy");
    $("#bookTitle").textContent = "Unable to open book";
    $("#page").innerHTML = failView(
      e instanceof SyntaxError
        ? "This book's contents could not be read"
        : e.message || "Something went wrong",
      '<a class="btn" href="index.html">Back to library</a>',
    );
  }
}
const closePanel = () => {
  $("#panel").hidden = true;
  $("#aa").setAttribute("aria-expanded", "false");
};
$("#page").addEventListener("click", (e) => {
  if (!e.target.closest("[data-retry]")) return;
  if (book && manifest) open(chapter);
  else init();
});
$("#chapters").addEventListener("change", (e) => open(+e.target.value));
$("#prev").addEventListener("click", () => open(chapter - 1));
$("#next").addEventListener("click", () => {
  if (!isLast()) return open(chapter + 1);
  if (favs()[book.id]?.done) return (location.href = "index.html");
  const f = favs();
  f[book.id] = { at: f[book.id]?.at ?? Date.now(), done: true };
  store.write("favs", f);
  toast("Marked as finished");
  updateNext();
});
$("#aa").addEventListener("click", (e) => {
  const h = ($("#panel").hidden = !$("#panel").hidden);
  e.currentTarget.setAttribute("aria-expanded", !h);
});
document.addEventListener("click", (e) => {
  if (!$("#panel").hidden && !e.target.closest("#panel, #aa")) closePanel();
});
addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !$("#panel").hidden) {
    closePanel();
    $("#aa").focus();
  }
});
$("#fs").addEventListener("click", () => {
  if (document.fullscreenElement) return document.exitFullscreen();
  if (!root.requestFullscreen)
    return toast("Full screen is not supported here");
  root
    .requestFullscreen()
    .catch(() => toast("Full screen is not supported here"));
});
addEventListener(
  "scroll",
  () => {
    if (!book || !manifest) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 300);
  },
  { passive: true },
);
addEventListener("pagehide", save);
document.addEventListener("visibilitychange", () => document.hidden && save());
init();
