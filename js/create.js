import { esc, norm, store, toast } from "./app.js";
import { readZip } from "./zip.js";
import { writeZip } from "./zipwrite.js";

// Where contributors send finished zips. Leave a value empty to hide it.
const SUBMIT = {
  telegram: "", // e.g. "https://t.me/yourname"
  contact: "", // e.g. "https://yoursite.com/contact" or "mailto:you@example.com"
};

const $ = (s) => document.querySelector(s);
const LANG_RE = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;
const MAX_CHAPTERS = 500,
  MAX_FILE = 10e6;
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const slug = (s) =>
  norm(s).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "book";
const paras = (t) =>
  t
    .split(/\r?\n\s*\r?\n/)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);
const words = (t) => (t.trim() ? t.trim().split(/\s+/).length : 0);
const s = (v, n) => String(v ?? "").slice(0, n);

const chapter = (title = "", text = "") => ({ id: uid(), title, text });
const blank = () => ({
  id: uid(),
  title: "",
  author: "",
  lang: "en",
  chapters: [chapter()],
  cur: 0,
  at: Date.now(),
});

function fix(d) {
  if (!d || typeof d !== "object" || typeof d.id !== "string") return null;
  const chapters = (Array.isArray(d.chapters) ? d.chapters : [])
    .filter((c) => c && typeof c === "object")
    .slice(0, MAX_CHAPTERS)
    .map((c) => ({
      id: s(c.id, 40) || uid(),
      title: s(c.title, 120),
      text: s(c.text, 2e6),
    }));
  if (!chapters.length) chapters.push(chapter());
  const cur = Math.floor(+d.cur);
  return {
    id: s(d.id, 40),
    title: s(d.title, 120),
    author: s(d.author, 120),
    lang: s(d.lang, 12) || "en",
    chapters,
    cur: cur >= 0 && cur < chapters.length ? cur : 0,
    at: Number.isFinite(+d.at) ? +d.at : Date.now(),
  };
}

const saved = store.read("drafts", []);
let drafts = (Array.isArray(saved) ? saved : []).map(fix).filter(Boolean);
if (!drafts.length) drafts.push(blank());
let doc = drafts.find((d) => d.id === store.read("draftCur", "")) || drafts[0],
  preview = false,
  saveTimer;

const label = (d) => d.title.trim() || "Untitled";
const chLabel = (c, i) => c.title.trim() || `Chapter ${i + 1}`;

function persist() {
  clearTimeout(saveTimer);
  doc.at = Date.now();
  store.write("drafts", drafts);
  store.write("draftCur", doc.id);
}
function queueSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(persist, 400);
}

/* ---------- rendering ---------- */
function renderNb() {
  $("#nb").innerHTML = drafts
    .map(
      (d) =>
        `<option value="${esc(d.id)}"${d === doc ? " selected" : ""}>${esc(label(d))}</option>`,
    )
    .join("");
}
function renderMeta() {
  $("#mTitle").value = doc.title;
  $("#mAuthor").value = doc.author;
  $("#mLang").value = doc.lang;
}
function renderList(focus) {
  $("#chList").innerHTML = doc.chapters
    .map((c, i) => {
      const n = chLabel(c, i);
      return `<li data-i="${i}"${i === doc.cur ? ' class="on"' : ""}><button class="go" data-a="go"${i === doc.cur ? ' aria-current="true"' : ""}><span>${i + 1}. ${esc(n)}</span><small>${words(c.text).toLocaleString()} w</small></button><button class="mv" data-a="up" aria-label="Move up: ${esc(n)}"${i === 0 ? " disabled" : ""}>↑</button><button class="mv" data-a="down" aria-label="Move down: ${esc(n)}"${i === doc.chapters.length - 1 ? " disabled" : ""}>↓</button><button class="mv" data-a="del" aria-label="Delete: ${esc(n)}">×</button></li>`;
    })
    .join("");
  if (focus)
    $(`#chList [data-i="${focus.i}"] [data-a="${focus.a}"]`)?.focus();
}
function renderEditor() {
  const c = doc.chapters[doc.cur];
  $("#chTitle").value = c.title;
  $("#chTitle").placeholder = `Chapter ${doc.cur + 1}`;
  $("#body").value = c.text;
  renderPreview();
  renderStat();
}
function renderPreview() {
  if (!preview) return;
  const c = doc.chapters[doc.cur];
  $("#prev").innerHTML =
    `<h2>${esc(chLabel(c, doc.cur))}</h2>` +
    (paras(c.text).map((p) => `<p>${esc(p)}</p>`).join("") ||
      '<p class="muted">Nothing to preview yet.</p>');
}
function renderStat() {
  const c = doc.chapters[doc.cur],
    w = words(c.text),
    total = doc.chapters.reduce((n, x) => n + words(x.text), 0);
  $("#stat").textContent =
    `${w.toLocaleString()} words · ${Math.max(1, Math.round(w / 230))} min read · book total ${total.toLocaleString()}`;
}
function problems() {
  const bad = [],
    warn = [],
    ok = [];
  if (!doc.title.trim()) bad.push("Add a book title.");
  else ok.push("Title set.");
  if (!doc.author.trim()) bad.push("Add an author name.");
  if (!LANG_RE.test(doc.lang.trim())) bad.push("Language code looks invalid (try “en”).");
  const filled = doc.chapters.filter((c) => c.text.trim());
  if (!filled.length) bad.push("Write at least one chapter.");
  else ok.push(`${filled.length} chapter${filled.length === 1 ? "" : "s"} ready.`);
  const empty = doc.chapters.length - filled.length;
  if (filled.length && empty)
    warn.push(`${empty} empty chapter${empty === 1 ? " is" : "s are"} left out of the zip.`);
  return { bad, warn, ok };
}
function renderCheck() {
  const { bad, warn, ok } = problems();
  $("#chk").innerHTML = [
    ...bad.map((m) => `<li class="bad"><b aria-hidden="true">✕</b> ${esc(m)}</li>`),
    ...warn.map((m) => `<li class="warn"><b aria-hidden="true">!</b> ${esc(m)}</li>`),
    ...(bad.length ? [] : ok.map((m) => `<li class="ok"><b aria-hidden="true">✓</b> ${esc(m)}</li>`)),
  ].join("");
  $("#dl").disabled = !!bad.length;
  $("#share").disabled = !!bad.length;
}
function renderAll() {
  renderNb();
  renderMeta();
  renderList();
  renderEditor();
  renderCheck();
}

/* ---------- editing ---------- */
$("#mTitle").addEventListener("input", (e) => {
  doc.title = e.target.value;
  queueSave();
  renderCheck();
  const o = $(`#nb option[value="${CSS.escape(doc.id)}"]`);
  if (o) o.textContent = label(doc);
});
$("#mAuthor").addEventListener("input", (e) => {
  doc.author = e.target.value;
  queueSave();
  renderCheck();
});
$("#mLang").addEventListener("input", (e) => {
  doc.lang = e.target.value.trim();
  queueSave();
  renderCheck();
});
$("#chTitle").addEventListener("input", (e) => {
  doc.chapters[doc.cur].title = e.target.value;
  queueSave();
  renderList();
  renderPreview();
});
$("#body").addEventListener("input", (e) => {
  doc.chapters[doc.cur].text = e.target.value;
  queueSave();
  renderStat();
  renderCheck();
  const w = $(`#chList [data-i="${doc.cur}"] small`);
  if (w) w.textContent = words(e.target.value).toLocaleString() + " w";
});

function select(i) {
  doc.cur = i;
  persist();
  renderList();
  renderEditor();
}
$("#chList").addEventListener("click", (e) => {
  const b = e.target.closest("[data-a]");
  if (!b) return;
  const i = +b.closest("li").dataset.i,
    a = b.dataset.a,
    cs = doc.chapters;
  if (a === "go") {
    select(i);
    if (!preview) $("#body").focus();
  } else if (a === "up" || a === "down") {
    const j = a === "up" ? i - 1 : i + 1;
    if (j < 0 || j >= cs.length) return;
    [cs[i], cs[j]] = [cs[j], cs[i]];
    if (doc.cur === i) doc.cur = j;
    else if (doc.cur === j) doc.cur = i;
    persist();
    renderList({ i: j, a: j === 0 ? "down" : j === cs.length - 1 ? "up" : a });
    renderEditor();
    renderCheck();
  } else if (a === "del") {
    if (cs[i].text.trim() && !confirm(`Delete “${chLabel(cs[i], i)}”? This can't be undone.`))
      return;
    cs.splice(i, 1);
    if (!cs.length) cs.push(chapter());
    doc.cur = Math.min(doc.cur > i ? doc.cur - 1 : doc.cur, cs.length - 1);
    persist();
    renderList({ i: Math.min(i, cs.length - 1), a: "go" });
    renderEditor();
    renderCheck();
  }
});
$("#chAdd").addEventListener("click", () => {
  if (doc.chapters.length >= MAX_CHAPTERS) return toast("That's the chapter limit");
  doc.chapters.push(chapter());
  doc.cur = doc.chapters.length - 1;
  persist();
  renderList();
  renderEditor();
  renderCheck();
  $("#chTitle").focus();
});

function setMode(p) {
  preview = p;
  $("#modeEdit").setAttribute("aria-pressed", String(!p));
  $("#modePrev").setAttribute("aria-pressed", String(p));
  $("#body").hidden = p;
  $("#prev").hidden = !p;
  renderPreview();
}
$("#modeEdit").addEventListener("click", () => setMode(false));
$("#modePrev").addEventListener("click", () => setMode(true));

/* ---------- notebooks ---------- */
$("#nb").addEventListener("change", (e) => {
  persist();
  doc = drafts.find((d) => d.id === e.target.value) || drafts[0];
  persist();
  renderAll();
});
$("#nbNew").addEventListener("click", () => {
  persist();
  doc = blank();
  drafts.push(doc);
  persist();
  renderAll();
  $("#mTitle").focus();
});
$("#nbDel").addEventListener("click", () => {
  const filled = doc.title.trim() || doc.chapters.some((c) => c.text.trim());
  if (filled && !confirm(`Delete “${label(doc)}”? This can't be undone.`)) return;
  drafts = drafts.filter((d) => d !== doc);
  if (!drafts.length) drafts.push(blank());
  doc = drafts[0];
  persist();
  renderAll();
  toast("Notebook deleted");
});

/* ---------- output ---------- */
async function build() {
  const { bad } = problems();
  if (bad.length) {
    toast(bad[0]);
    return null;
  }
  const list = doc.chapters.filter((c) => c.text.trim()),
    lang = doc.lang.trim();
  const manifest = {
    title: doc.title.trim(),
    author: doc.author.trim(),
    lang,
    chapters: list.map((c, i) => ({
      file: `${i + 1}.txt`,
      title: c.title.trim() || `Chapter ${i + 1}`,
    })),
  };
  const files = [
    { name: "manifest.json", text: JSON.stringify(manifest, null, 2) + "\n" },
    ...list.map((c, i) => ({
      name: `${i + 1}.txt`,
      text: paras(c.text).join("\n\n") + "\n",
    })),
  ];
  return { blob: await writeZip(files), name: slug(doc.title) + ".zip" };
}
function download(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1e4);
}
$("#dl").addEventListener("click", async () => {
  try {
    const z = await build();
    if (!z) return;
    download(z.blob, z.name);
    toast(`Saved ${z.name} (${(z.blob.size / 1024).toFixed(1)} KB)`);
  } catch {
    toast("Could not create the zip");
  }
});
$("#share").addEventListener("click", async () => {
  try {
    const z = await build();
    if (!z) return;
    const file = new File([z.blob], z.name, { type: "application/zip" });
    await navigator.share({ files: [file], title: doc.title.trim() });
  } catch (e) {
    if (e?.name !== "AbortError") toast("Could not share the zip");
  }
});
$("#md").addEventListener("click", () => {
  const out = [`# ${label(doc)}`];
  if (doc.author.trim()) out.push(`*${doc.author.trim()}*`);
  doc.chapters.forEach((c, i) => {
    if (!c.text.trim() && !c.title.trim()) return;
    out.push(`## ${chLabel(c, i)}`, paras(c.text).join("\n\n"));
  });
  download(
    new Blob([out.join("\n\n") + "\n"], { type: "text/markdown" }),
    slug(doc.title) + ".md",
  );
  toast("Markdown saved");
});

/* ---------- import ---------- */
function splitText(name, text) {
  const base = name.replace(/\.[^.]+$/, "");
  const parts = text.replace(/\r\n?/g, "\n").split(/^(?=# [^\n]+$)/m).filter((x) => x.trim());
  if (parts.length > 1 || /^# /.test(parts[0] || "")) {
    return parts.map((p) => {
      const m = p.match(/^# ([^\n]+)\n?/);
      return chapter(m ? m[1].trim().slice(0, 120) : base.slice(0, 120), (m ? p.slice(m[0].length) : p).trim());
    });
  }
  return [chapter(base.slice(0, 120), text.trim())];
}
$("#imp").addEventListener("click", () => $("#impFile").click());
$("#impFile").addEventListener("change", async (e) => {
  const files = [...e.target.files];
  e.target.value = "";
  let added = 0;
  for (const f of files) {
    try {
      if (f.size > MAX_FILE) throw new Error(`${f.name} is too large`);
      if (/\.zip$/i.test(f.name)) {
        const read = await readZip(await f.arrayBuffer()),
          m = JSON.parse(await read("manifest.json"));
        if (!m || !Array.isArray(m.chapters)) throw new Error("No chapters in that zip");
        const d = blank();
        d.title = s(m.title, 120);
        d.author = s(m.author, 120);
        if (LANG_RE.test(m.lang || "")) d.lang = m.lang;
        d.chapters = [];
        for (const [i, c] of m.chapters.slice(0, MAX_CHAPTERS).entries())
          if (c && typeof c.file === "string")
            d.chapters.push(chapter(s(c.title, 120) || `Chapter ${i + 1}`, (await read(c.file)).trim()));
        if (!d.chapters.length) throw new Error("No chapters in that zip");
        persist();
        drafts.push(d);
        doc = d;
        added++;
      } else {
        const cs = splitText(f.name, await f.text());
        if (doc.chapters.length === 1 && !doc.chapters[0].text.trim() && !doc.chapters[0].title.trim())
          doc.chapters = [];
        doc.chapters.push(...cs);
        doc.cur = doc.chapters.length - cs.length;
        added += cs.length;
      }
    } catch (err) {
      toast(err.message || "Could not import that file");
    }
  }
  if (added) {
    persist();
    renderAll();
    toast("Imported");
  }
});

/* ---------- contribute links ---------- */
(function sendLinks() {
  const links = [];
  if (SUBMIT.telegram) links.push(["Telegram", SUBMIT.telegram]);
  if (SUBMIT.contact) links.push(["Contact", SUBMIT.contact]);
  $("#sendLinks").innerHTML = links
    .map(([n, u]) => `<a class="btn" href="${esc(u)}" target="_blank" rel="noopener">Send via ${esc(n)}</a>`)
    .join("");
  if (links.length) $("#sendStep").textContent = "Send it to the library owner with the button below.";
  try {
    const t = new File([""], "a.zip", { type: "application/zip" });
    if (navigator.canShare?.({ files: [t] })) $("#share").hidden = false;
  } catch {}
})();

addEventListener("pagehide", persist);
document.addEventListener("visibilitychange", () => document.hidden && persist());
addEventListener("storage", (e) => {
  if (e.key && e.key.startsWith("3nding:draft")) toast("Notebooks changed in another tab");
});
renderAll();
