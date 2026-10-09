import {
  loadBooks,
  fetchBody,
  store,
  obj,
  favs,
  isFav,
  toggleFav,
  icon,
  esc,
  toast,
} from "./app.js";
import { readZip } from "./zip.js";
import { addTime } from "./stats.js";
import { shareCard } from "./quote.js";
const $ = (s) => document.querySelector(s),
  root = document.documentElement;
const DEFAULTS = {
  font: "serif",
  theme: "paper",
  size: 19,
  align: "left",
  lh: 1.75,
  rate: 1,
};
const FONTS = {
  serif: "var(--serif)",
  sans: "var(--ui)",
  mono: '"For Mono",monospace',
};
const OPTS = {
  font: ["serif", "sans", "mono"],
  theme: ["paper", "sepia", "dark", "oled"],
  align: ["left", "justify"],
};
const SKELETON =
  '<div class="skl" aria-hidden="true"><i class="h"></i>' +
  "<i></i>".repeat(10) +
  "</div>";
const nextFrame = () =>
  new Promise((res) => {
    if (document.hidden) return res();
    requestAnimationFrame(() => res());
    setTimeout(res, 150);
  });
const fontsReady = () =>
  document.fonts && document.fonts.status === "loading"
    ? Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1200))])
    : Promise.resolve();
const svg = (p) =>
  `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const failView = (msg, extra = "") =>
  `<div class="empty"><p>${esc(msg)}.</p><button class="btn primary" data-retry>Try again</button>${extra}</div>`;
function clean(s) {
  const o = { ...DEFAULTS };
  for (const k in OPTS) if (OPTS[k].includes(s?.[k])) o[k] = s[k];
  const n = Math.round(+s?.size);
  if (n >= 14 && n <= 32) o.size = n;
  const l = Math.round(+s?.lh * 20) / 20;
  if (l >= 1.4 && l <= 2.2) o.lh = l;
  const r = Math.round(+s?.rate * 10) / 10;
  if (r >= 0.6 && r <= 2) o.rate = r;
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
  panelBuilt = false,
  jump = null,
  pending = null,
  selTimer,
  lastAct = Date.now();
const canSpeak =
    "speechSynthesis" in window && "SpeechSynthesisUtterance" in window,
  synth = canSpeak ? window.speechSynthesis : null,
  tts = { on: false, u: null },
  reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

$("#fs").insertAdjacentHTML(
  "beforebegin",
  `${canSpeak ? `<button class="icon-btn" id="tts" aria-label="Read aloud" aria-pressed="false">${svg('<path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/>')}</button>` : ""}<button class="icon-btn" id="hlBtn" aria-label="Highlights">${svg('<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>')}</button>`,
);
document.body.insertAdjacentHTML(
  "beforeend",
  `<div id="hlbar" hidden><button class="btn primary" data-a="save">Highlight</button><button class="btn" data-a="card">Share card</button></div>
<dialog id="hl" aria-labelledby="hlT"><div class="hl-in"><div class="hl-head"><h2 id="hlT">Highlights</h2><button class="btn" data-a="close">Close</button></div><ul id="hlList"></ul></div></dialog>
<dialog id="fv" aria-labelledby="fvT"><div class="hl-in"><h2 id="fvT">Progress is saved for favorites only</h2><p class="muted">Add this book to your favorites to keep your place, reading progress and finished status. Without it, you can still read, but you will start from the beginning next time.</p><div class="hl-act"><button class="btn primary" data-a="fav">Add to favorites</button><button class="btn" data-a="close">Continue without saving</button></div></div></dialog>`,
);

const highlights = () => {
  const h = store.read("highlights", []);
  return Array.isArray(h) ? h : [];
};
const forPara = (hs, i) => hs.filter((h) => h.pi == null || h.pi === i);
function markup(s, hs) {
  const r = [];
  for (const h of hs) {
    const i = s.indexOf(h.text);
    if (i >= 0) r.push([i, i + h.text.length, h.id]);
  }
  r.sort((a, b) => a[0] - b[0]);
  let out = "",
    pos = 0;
  for (const [a, b, id] of r) {
    if (a < pos) continue;
    out +=
      esc(s.slice(pos, a)) +
      `<mark data-h="${esc(id)}">${esc(s.slice(a, b))}</mark>`;
    pos = b;
  }
  return out + esc(s.slice(pos));
}

function apply() {
  root.dataset.theme = settings.theme;
  root.style.setProperty("--font", FONTS[settings.font]);
  root.style.setProperty("--size", settings.size + "px");
  root.style.setProperty("--lh", settings.lh);
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
  if ($("#lh")) {
    $("#lh").value = settings.lh;
    $("#lhVal").textContent = settings.lh.toFixed(2);
  }
  if ($("#rate")) {
    $("#rate").value = settings.rate;
    $("#rateVal").textContent = settings.rate.toFixed(1) + "×";
  }
  // Nothing to remember when everything is at its default.
  if (Object.keys(DEFAULTS).every((k) => settings[k] === DEFAULTS[k]))
    store.remove("reader");
  else store.write("reader", settings);
}
function buildPanel() {
  if (panelBuilt) return;
  panelBuilt = true;
  const seg = (k, name) =>
    `<div class="fld" role="group" aria-label="${name}">${name}<div class="seg">${OPTS[k].map((v) => `<button data-k="${k}" data-v="${v}">${v[0].toUpperCase() + v.slice(1)}</button>`).join("")}</div></div>`;
  $("#panel").innerHTML =
    `${seg("font", "Font")}${seg("theme", "Theme")}<label><span class="row">Font size<b id="sizeVal"></b></span><input id="size" type="range" min="14" max="32" step="1"></label><label><span class="row">Line height<b id="lhVal"></b></span><input id="lh" type="range" min="1.4" max="2.2" step="0.05"></label>${seg("align", "Alignment")}${canSpeak ? '<label><span class="row">Voice speed<b id="rateVal"></b></span><input id="rate" type="range" min="0.6" max="2" step="0.1"></label>' : ""}<button class="btn" id="reset">Reset to defaults</button>`;
  $("#panel").addEventListener("click", (e) => {
    const b = e.target.closest("[data-k]");
    if (b) {
      settings[b.dataset.k] = b.dataset.v;
      apply();
    }
  });
  for (const [id, key] of [
    ["size", "size"],
    ["lh", "lh"],
    ["rate", "rate"],
  ])
    $("#" + id)?.addEventListener("input", (e) => {
      settings[key] = +e.target.value;
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
  if (isFav(favs(), book.id)) {
    const p = obj("progress");
    p[book.id] = {
      chapter,
      ratio: ratio(),
      total: manifest.chapters.length,
      updated: Date.now(),
    };
    store.write("progress", p);
  }
  $("#bar").style.width =
    ((chapter + ratio()) / manifest.chapters.length) * 100 + "%";
}
const isLast = () => chapter === manifest.chapters.length - 1;
function updateNext() {
  const n = $("#next");
  n.disabled = false;
  n.textContent = !isLast()
    ? "Next"
    : !isFav(favs(), book.id) || favs()[book.id]?.done
      ? "Back to library"
      : "Mark as finished";
}

function ttsStop() {
  tts.on = false;
  tts.u = null;
  synth?.cancel();
  document
    .querySelectorAll(".speaking")
    .forEach((x) => x.classList.remove("speaking"));
  $("#tts")?.setAttribute("aria-pressed", "false");
}
const ttsNodes = () => [...document.querySelectorAll("#page > h2, #page > p")];
function speakFrom(i) {
  if (!tts.on) return;
  document
    .querySelectorAll(".speaking")
    .forEach((x) => x.classList.remove("speaking"));
  const ns = ttsNodes();
  if (!ns.length) return ttsStop();
  if (i >= ns.length) {
    if (isLast()) {
      ttsStop();
      return toast("Finished listening");
    }
    return open(chapter + 1, 0, true).then(() => speakFrom(0));
  }
  const n = ns[i],
    u = new SpeechSynthesisUtterance(n.textContent);
  n.classList.add("speaking");
  n.scrollIntoView({
    block: "center",
    behavior: reduced() ? "auto" : "smooth",
  });
  u.rate = settings.rate;
  u.lang = root.lang || "en";
  u.onend = () => tts.on && tts.u === u && speakFrom(i + 1);
  u.onerror = (e) => {
    if (tts.u !== u || e.error === "canceled" || e.error === "interrupted")
      return;
    ttsStop();
    toast("Speech stopped");
  };
  tts.u = u;
  synth.speak(u);
}
$("#tts")?.addEventListener("click", () => {
  if (tts.on) return ttsStop();
  if (!ready) return;
  tts.on = true;
  $("#tts").setAttribute("aria-pressed", "true");
  synth.cancel();
  const i = ttsNodes().findIndex((n) => n.getBoundingClientRect().bottom > 70);
  speakFrom(Math.max(0, i));
});

async function open(i, r = 0, keepTts = false) {
  const my = ++token;
  if (!keepTts) ttsStop();
  ready = false;
  chapter = Math.max(0, Math.min(i, manifest.chapters.length - 1));
  const c = manifest.chapters[chapter];
  $("#page").setAttribute("aria-busy", "true");
  let skTimer = 0;
  const showSkeleton = () => {
    if (my === token && !$("#page").querySelector(".skl"))
      $("#page").innerHTML = SKELETON;
  };
  if ($("#page").querySelector(":scope > p, :scope > h2"))
    skTimer = setTimeout(showSkeleton, 150);
  else showSkeleton();
  let ok = true;
  try {
    const text = await read(c.file);
    clearTimeout(skTimer);
    if (my !== token) return;
    const hs = highlights().filter(
      (h) => h.book === book.id && h.chapter === chapter,
    );
    $("#page").innerHTML =
      `<h2>${esc(c.title)}</h2>` +
      text
        .split(/\r?\n\s*\r?\n/)
        .map((s) => s.replace(/\s+/g, " ").trim())
        .filter(Boolean)
        .map((s, idx) => `<p>${markup(s, forPara(hs, idx))}</p>`)
        .join("");
  } catch (e) {
    clearTimeout(skTimer);
    if (my !== token) return;
    ok = false;
    $("#page").innerHTML = failView(e.message || "Could not load this chapter");
  }
  $("#page").removeAttribute("aria-busy");
  $("#chapters").value = chapter;
  $("#prev").disabled = chapter === 0;
  updateNext();
  await nextFrame();
  if (ok) await fontsReady();
  if (my !== token) return;
  const m = jump && document.querySelector(`mark[data-h="${CSS.escape(jump)}"]`);
  jump = null;
  if (m) m.scrollIntoView({ block: "center" });
  else
    scrollTo(
      0,
      (Number.isFinite(r) ? r : 0) * (root.scrollHeight - innerHeight),
    );
  ready = ok;
  if (ok) save();
}
async function init() {
  history.scrollRestoration = "manual";
  $("#back").innerHTML = icon("back");
  $("#fs").innerHTML = icon("full");
  if (!document.fullscreenEnabled) $("#fs").hidden = true;
  buildPanel();
  apply();
  $("#bookTitle").textContent = "Loading…";
  $("#chapters").disabled = true;
  $("#chapters").innerHTML = "<option>Chapters</option>";
  $("#page").setAttribute("aria-busy", "true");
  if (!$("#page").querySelector(".skl")) $("#page").innerHTML = SKELETON;
  try {
    const id = new URLSearchParams(location.search).get("id");
    book = (await loadBooks()).find((b) => b.id === id);
    if (!book) book = (await loadBooks({ fresh: true })).find((b) => b.id === id);
    if (!book) throw new Error("Book not found");
    const buf = await fetchBody(book.zip, (r) => r.arrayBuffer(), {
      ms: 60000,
      fail: "Could not download this book",
    });
    read = await readZip(buf);
    manifest = JSON.parse(await read("manifest.json"));
    if (!manifest || !Array.isArray(manifest.chapters))
      throw new Error("This book has no chapters");
    manifest.chapters = manifest.chapters
      .filter((c) => c && typeof c.file === "string" && c.file)
      .map((c, i) => ({ file: c.file, title: String(c.title || `Chapter ${i + 1}`) }));
    if (!manifest.chapters.length) throw new Error("This book has no chapters");
    manifest.title = String(manifest.title || book.title);
    if (/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(manifest.lang || ""))
      root.lang = manifest.lang;
    document.title = `${manifest.title} – 3NDING`;
    $("#bookTitle").textContent = manifest.title;
    $("#chapters").innerHTML = manifest.chapters
      .map((c, i) => `<option value="${i}">${i + 1}. ${esc(c.title)}</option>`)
      .join("");
    $("#chapters").disabled = false;
    const p = obj("progress")[id];
    await open(p?.chapter ?? 0, p?.ratio ?? 0);
    askFavorite();
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

function selInfo() {
  const s = getSelection();
  if (!s || s.isCollapsed || !s.rangeCount) return null;
  const r = s.getRangeAt(0),
    pa = (n) => (n.nodeType === 1 ? n : n.parentElement)?.closest("#page p"),
    p = pa(r.startContainer);
  if (!p || p !== pa(r.endContainer)) return null;
  const text = s.toString().replace(/\s+/g, " ").trim();
  return text.length >= 3 && text.length <= 300 ? { text, p } : null;
}
document.addEventListener("selectionchange", () => {
  clearTimeout(selTimer);
  selTimer = setTimeout(() => {
    const s = selInfo();
    if (s) pending = s;
    $("#hlbar").hidden = !s;
  }, 150);
});
$("#hlbar").addEventListener("pointerdown", (e) => e.preventDefault());
function saveHighlight() {
  if (!pending || !book || !manifest) return null;
  const { text, p } = pending,
    all = highlights(),
    pi = [...document.querySelectorAll("#page > p")].indexOf(p);
  let h = all.find(
    (x) =>
      x.book === book.id &&
      x.chapter === chapter &&
      x.text === text &&
      (x.pi ?? pi) === pi,
  );
  if (!h) {
    h = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      book: book.id,
      title: manifest.title || book.title,
      author: book.author,
      chapter,
      ch: manifest.chapters[chapter].title,
      text,
      at: Date.now(),
    };
    if (pi >= 0) h.pi = pi;
    all.push(h);
    store.write("highlights", all.slice(-500));
    if (p.isConnected)
      p.innerHTML = markup(
        p.textContent,
        forPara(
          all.filter((x) => x.book === book.id && x.chapter === chapter),
          pi,
        ),
      );
    toast("Highlight saved");
  }
  getSelection().removeAllRanges();
  $("#hlbar").hidden = true;
  pending = null;
  return h;
}
async function cardFor(h) {
  try {
    const r = await shareCard(h),
      msg = { shared: "Card shared", downloaded: "Quote card saved" }[r];
    if (msg) toast(msg);
  } catch {
    toast("Could not create the card");
  }
}
$("#hlbar").addEventListener("click", (e) => {
  const a = e.target.closest("[data-a]")?.dataset.a;
  if (!a) return;
  const h = saveHighlight();
  if (h && a === "card") cardFor(h);
});
function renderHl() {
  const l = highlights()
    .filter((h) => h.book === book?.id)
    .sort((a, b) => a.chapter - b.chapter || a.at - b.at);
  $("#hlList").innerHTML = l.length
    ? l
        .map(
          (h) =>
            `<li data-id="${esc(h.id)}"><blockquote>${esc(h.text)}</blockquote><small>${esc(h.ch || "")}</small><div class="hl-act"><button class="btn" data-a="go">Go to</button><button class="btn" data-a="card">Share card</button><button class="btn" data-a="del">Delete</button></div></li>`,
        )
        .join("")
    : '<li class="muted">No highlights yet.</li>';
}
function askFavorite() {
  if (book && !isFav(favs(), book.id) && !$("#fv").open) $("#fv").showModal();
}
$("#fv").addEventListener("click", (e) => {
  if (e.target === $("#fv")) return $("#fv").close();
  const a = e.target.closest("[data-a]")?.dataset.a;
  if (!a) return;
  if (a === "fav" && book && !isFav(favs(), book.id)) {
    toggleFav(book.id);
    toast("Added to favorites");
    save();
    updateNext();
  }
  $("#fv").close();
});
$("#hlBtn").addEventListener("click", () => {
  renderHl();
  $("#hl").showModal();
});
$("#hl").addEventListener("click", (e) => {
  if (e.target === $("#hl")) return $("#hl").close();
  const b = e.target.closest("[data-a]");
  if (!b) return;
  const a = b.dataset.a;
  if (a === "close") return $("#hl").close();
  const id = b.closest("li")?.dataset.id,
    h = highlights().find((x) => x.id === id);
  if (!h) return;
  if (a === "card") cardFor(h);
  else if (a === "del") {
    store.write(
      "highlights",
      highlights().filter((x) => x.id !== id),
    );
    document
      .querySelectorAll(`mark[data-h="${CSS.escape(id)}"]`)
      .forEach((m) => {
        const p = m.parentNode;
        m.replaceWith(m.textContent);
        p.normalize();
      });
    renderHl();
  } else if (a === "go" && manifest) {
    $("#hl").close();
    jump = id;
    open(h.chapter);
  }
});

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
  const f = favs();
  // Only favorites can be finished; everything else just goes back.
  if (!isFav(f, book.id) || f[book.id].done) return (location.href = "index.html");
  f[book.id] = { ...f[book.id], done: true };
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
    return;
  }
  if (
    e.altKey ||
    e.ctrlKey ||
    e.metaKey ||
    e.shiftKey ||
    e.repeat ||
    !book ||
    !manifest
  )
    return;
  if (
    e.target.closest?.("input, select, textarea, [contenteditable]") ||
    $("#hl").open ||
    $("#fv").open
  )
    return;
  if (e.key === "ArrowLeft" && chapter > 0) {
    e.preventDefault();
    open(chapter - 1);
  } else if (e.key === "ArrowRight" && !isLast()) {
    e.preventDefault();
    open(chapter + 1);
  }
});
let t0 = null;
addEventListener(
  "touchstart",
  (e) => {
    const t = e.touches[0];
    t0 =
      e.touches.length === 1 &&
      (window.visualViewport?.scale ?? 1) <= 1.01 &&
      t.clientX > 24 &&
      t.clientX < innerWidth - 24 &&
      !e.target.closest("#panel, #hl, #hlbar, .top")
        ? { x: t.clientX, y: t.clientY, t: Date.now() }
        : null;
  },
  { passive: true },
);
addEventListener("touchcancel", () => (t0 = null), { passive: true });
addEventListener(
  "touchend",
  (e) => {
    if (!t0 || !book || !manifest) return;
    const t = e.changedTouches[0],
      dx = t.clientX - t0.x,
      dy = t.clientY - t0.y,
      ok = Date.now() - t0.t < 700;
    t0 = null;
    if (
      !ok ||
      Math.abs(dx) < 80 ||
      Math.abs(dx) < Math.abs(dy) * 2 ||
      !getSelection().isCollapsed
    )
      return;
    if (dx < 0 && !isLast()) open(chapter + 1);
    else if (dx > 0 && chapter > 0) open(chapter - 1);
  },
  { passive: true },
);
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
for (const ev of ["scroll", "keydown", "pointerdown", "touchstart"])
  addEventListener(ev, () => (lastAct = Date.now()), { passive: true });
setInterval(() => {
  if (!ready || document.hidden) return;
  if (!tts.on && Date.now() - lastAct > 60000) return;
  if (addTime(5)) toast("Daily reading goal reached");
}, 5000);
addEventListener("pagehide", () => {
  synth?.cancel();
  save();
});
document.addEventListener("visibilitychange", () => document.hidden && save());
init();
