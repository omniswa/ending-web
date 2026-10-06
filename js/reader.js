import { loadBooks, store, icon, esc, toast } from "./app.js";
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
let settings = { ...DEFAULTS, ...store.read("reader", {}) },
  book,
  manifest,
  read,
  chapter = 0,
  saveTimer;

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
  store.write("reader", settings);
}
function buildPanel() {
  const seg = (k) =>
    `<div class="seg">${OPTS[k].map((v) => `<button data-k="${k}" data-v="${v}">${v[0].toUpperCase() + v.slice(1)}</button>`).join("")}</div>`;
  $("#panel").innerHTML =
    `<label>Font${seg("font")}</label><label>Theme${seg("theme")}</label><label>Font size<input id="size" type="range" min="14" max="32" step="1"></label><label>Alignment${seg("align")}</label><button class="btn" id="reset">Reset to defaults</button>`;
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
  const m = document.documentElement.scrollHeight - innerHeight;
  return m > 0 ? Math.min(1, scrollY / m) : 0;
};
function save() {
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
async function open(i, r = 0) {
  chapter = Math.max(0, Math.min(i, manifest.chapters.length - 1));
  const c = manifest.chapters[chapter];
  $("#page").innerHTML = "<p>Loading…</p>";
  try {
    const text = await read(c.file);
    $("#page").innerHTML =
      `<h2>${esc(c.title)}</h2>` +
      text
        .split(/\r?\n\s*\r?\n/)
        .filter((s) => s.trim())
        .map((s) => `<p>${esc(s.trim()).replace(/\r?\n/g, " ")}</p>`)
        .join("");
  } catch (e) {
    $("#page").innerHTML = `<p>${esc(e.message)}</p>`;
  }
  $("#chapters").value = chapter;
  $("#prev").disabled = chapter === 0;
  $("#next").disabled = chapter === manifest.chapters.length - 1;
  requestAnimationFrame(() => {
    scrollTo(0, r * (document.documentElement.scrollHeight - innerHeight));
    save();
  });
}
async function init() {
  $("#back").innerHTML = icon("back");
  $("#fs").innerHTML = icon("full");
  buildPanel();
  apply();
  try {
    const id = new URLSearchParams(location.search).get("id");
    book = (await loadBooks()).find((b) => b.id === id);
    if (!book) throw new Error("Book not found");
    const res = await fetch(book.zip);
    if (!res.ok) throw new Error("Could not download this book");
    read = await readZip(await res.arrayBuffer());
    manifest = JSON.parse(await read("manifest.json"));
    document.title = `${manifest.title} – 3NDING`;
    $("#bookTitle").textContent = manifest.title;
    $("#chapters").innerHTML = manifest.chapters
      .map((c, i) => `<option value="${i}">${i + 1}. ${esc(c.title)}</option>`)
      .join("");
    const p = store.read("progress", {})[id];
    await open(p?.chapter ?? 0, p?.ratio ?? 0);
  } catch (e) {
    $("#bookTitle").textContent = "Unable to open book";
    $("#page").innerHTML =
      `<p>${esc(e.message)}. <a href="index.html"><u>Back to library</u></a></p>`;
  }
}
$("#chapters").addEventListener("change", (e) => open(+e.target.value));
$("#prev").addEventListener("click", () => open(chapter - 1));
$("#next").addEventListener("click", () => open(chapter + 1));
$("#aa").addEventListener("click", (e) => {
  const h = ($("#panel").hidden = !$("#panel").hidden);
  e.currentTarget.setAttribute("aria-expanded", !h);
});
$("#fs").addEventListener("click", () =>
  document.fullscreenElement
    ? document.exitFullscreen()
    : root
        .requestFullscreen?.()
        .catch(() => toast("Full screen is not supported")),
);
addEventListener(
  "scroll",
  () => {
    if (!book || !manifest) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 300);
  },
  { passive: true },
);
init();
