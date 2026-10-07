#!/usr/bin/env node
/**
 * 3NDING SEO + GEO build.  Run from the repo root:
 *
 *   npm i -D adm-zip
 *   SITE_URL=https://3nding.top node scripts/build-seo.mjs
 *
 * Generates (all static HTML, no JS needed to read it):
 *   book/<id>/index.html      one page per book (title, facts, chapter list, JSON-LD)
 *   author/<slug>/index.html  one hub page per author
 *   catalog/ , catalog/<n>/   paginated crawlable list of every book (100 per page)
 *   sitemap.xml  robots.txt  llms.txt  feed.xml  css/static-pages.css
 * and patches the SEO <head> block of index.html.
 *
 * Optional per-book fields in books.json: "description", "lang".
 * Without "description", one is built from the first lines of chapter 1.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import AdmZip from "adm-zip";

const SITE = (process.env.SITE_URL || "https://3nding.top").replace(/\/+$/, "");
if (!/^https?:\/\/[^/]/.test(SITE)) {
  console.error("Set SITE_URL, e.g. SITE_URL=https://your-domain.com");
  process.exit(1);
}
const NAME = "3NDING",
  TAGLINE = "A quiet place to read.",
  SITE_DESC =
    "3NDING is an online library with a distraction-free reader. Browse books, pick a theme and font, and your reading progress is saved on your device.",
  LANG = "en",
  PER_PAGE = 100,
  WPM = 230;
const root = process.cwd();

/* ---------- helpers ---------- */
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const enc = encodeURIComponent;
const slug = (s) =>
  s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") ||
  "a-" + crypto.createHash("sha1").update(s).digest("hex").slice(0, 8);
const trunc = (s, n) => (s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…");
const time = (w) => {
  const m = Math.max(1, Math.round(w / WPM));
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
};
const ld = (o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, "\\u003c")}</script>`;
const write = (f, s) => {
  const p = path.join(root, f);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, s);
};
const isAnon = (a) => /^anonymous$/i.test(a.trim());
const abs = (u) => new URL(u, SITE + "/").href;
const coverSrc = (b, rel) => (/^(https?:)?\/\//.test(b.cover) ? b.cover : rel + b.cover);

/* ---------- load books + read zips ---------- */
const books = JSON.parse(fs.readFileSync(path.join(root, "books.json"), "utf8"));
const seen = new Set();
for (const b of books) {
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(b.id) || seen.has(b.id)) throw new Error(`Bad or duplicate id: ${b.id}`);
  seen.add(b.id);
}
function inspect(b) {
  try {
    const z = new AdmZip(path.join(root, b.zip));
    const files = z.getEntries().filter((e) => !e.isDirectory && !e.entryName.split("/").includes("__MACOSX"));
    const get = (n) => {
      const e = files.find((x) => x.entryName === n || x.entryName.endsWith("/" + n));
      if (!e) throw new Error("missing " + n);
      return e.getData().toString("utf8");
    };
    const m = JSON.parse(get("manifest.json"));
    let words = 0,
      excerpt = "";
    const chapters = m.chapters.map((c, i) => {
      const t = get(c.file);
      words += (t.match(/\S+/g) || []).length;
      if (i === 0) excerpt = (t.split(/\r?\n\s*\r?\n/).find((p) => p.trim()) || "").replace(/\s+/g, " ").trim();
      return c.title;
    });
    return { chapters, words, excerpt };
  } catch (e) {
    console.warn(`! ${b.id}: ${e.message} (page built without chapter data)`);
    return { chapters: [], words: 0, excerpt: "" };
  }
}
for (const b of books) {
  Object.assign(b, inspect(b));
  b.url = `book/${enc(b.id)}/`;
  b.lang = b.lang || LANG;
  const facts = b.chapters.length ? `${b.chapters.length} chapters, about ${time(b.words)} to read. ` : "";
  b.summary =
    b.description ||
    `Read ${b.title} by ${b.author} online on ${NAME}. ${facts}${b.excerpt ? trunc(b.excerpt, 140) : ""}`.trim();
}
const byTitle = [...books].sort((a, b) => a.title.localeCompare(b.title));
const byNew = [...books].sort((a, b) => b.added.localeCompare(a.added) || a.title.localeCompare(b.title));
const authors = new Map();
for (const b of byTitle) {
  if (isAnon(b.author)) continue;
  const s = slug(b.author);
  if (!authors.has(s)) authors.set(s, { name: b.author, books: [] });
  authors.get(s).books.push(b);
}
const authorUrl = (b) => (isAnon(b.author) ? null : `author/${slug(b.author)}/`);
const latest = byNew[0]?.added || new Date().toISOString().slice(0, 10);

/* ---------- shared markup ---------- */
const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600&family=Newsreader:ital,opsz,wght@0,6..72,400..700;1,6..72,400&display=swap" rel="stylesheet">`;
const metaTags = ({ url, title, desc, image, type = "website" }) =>
  [
    `<meta name="description" content="${esc(desc)}">`,
    `<link rel="canonical" href="${SITE}/${url}">`,
    `<meta property="og:site_name" content="${NAME}">`,
    `<meta property="og:type" content="${type}">`,
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(desc)}">`,
    `<meta property="og:url" content="${SITE}/${url}">`,
    image ? `<meta property="og:image" content="${esc(abs(image))}">` : "",
    `<meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}">`,
    `<meta name="twitter:title" content="${esc(title)}">`,
    `<meta name="twitter:description" content="${esc(desc)}">`,
    image ? `<meta name="twitter:image" content="${esc(abs(image))}">` : "",
  ]
    .filter(Boolean)
    .join("\n");

const page = ({ depth, url, title, desc, image, type, jsonld = [], body, extraHead = "" }) => {
  const rel = "../".repeat(depth);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="robots" content="index,follow,max-image-preview:large">
${metaTags({ url, title, desc, image, type })}
${extraHead}
${FONTS}
<link rel="stylesheet" href="${rel}css/styles.css">
<link rel="stylesheet" href="${rel}css/static-pages.css">
${jsonld.map(ld).join("\n")}
</head>
<body>
<header class="top"><div class="wrap"><a class="brand" href="${rel}index.html">${NAME}</a><nav aria-label="Main"><a href="${rel}index.html">Library</a><a href="${rel}favorites.html">Favorites</a></nav></div></header>
<main class="wrap">
${body}
</main>
<footer class="foot"><div class="wrap"><div><a class="brand" href="${rel}index.html">${NAME}</a><p>${TAGLINE}</p></div><nav aria-label="Footer"><a href="${rel}index.html">Library</a><a href="${rel}catalog/">All books</a><a href="${rel}favorites.html">Favorites</a></nav><small>© ${new Date().getFullYear()} ${NAME}</small></div></footer>
</body>
</html>
`;
};
const crumbs = (items) =>
  `<nav class="crumbs" aria-label="Breadcrumb">${items.map(([n, h]) => (h ? `<a href="${h}">${esc(n)}</a>` : `<span>${esc(n)}</span>`)).join(" › ")}</nav>`;
const crumbLd = (items) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: items.map(([name, url], i) => ({ "@type": "ListItem", position: i + 1, name, item: SITE + "/" + url })),
});
const miniCard = (b, rel) =>
  `<article class="card"><a class="cover" href="${rel}${b.url}" tabindex="-1" aria-hidden="true"><img loading="lazy" decoding="async" width="600" height="800" src="${esc(coverSrc(b, rel))}" alt=""></a><div class="meta"><h3 class="t"><a href="${rel}${b.url}">${esc(b.title)}</a></h3><p class="a">${esc(b.author)}</p></div></article>`;

/* ---------- clean generated dirs ---------- */
for (const d of ["book", "author", "catalog"]) fs.rmSync(path.join(root, d), { recursive: true, force: true });

/* ---------- book pages ---------- */
books.forEach((b) => {
  const a = authorUrl(b);
  const crumb = [["Library", ""], ["All books", "catalog/"], [b.title, b.url]];
  const same = books.filter((x) => x.id !== b.id && x.author === b.author).slice(0, 6);
  const i = byTitle.indexOf(b);
  const more = [...same];
  for (let k = 1; more.length < 6 && k < books.length; k++) {
    const x = byTitle[(i + k) % byTitle.length];
    if (x.id !== b.id && !more.includes(x)) more.push(x);
  }
  const reader = `../../reader.html?id=${enc(b.id)}`;
  const facts = [
    ["Author", a ? `<a href="../../${a}">${esc(b.author)}</a>` : esc(b.author)],
    b.chapters.length && ["Chapters", b.chapters.length],
    b.words && ["Length", `${b.words.toLocaleString("en-US")} words`],
    b.words && ["Reading time", `About ${time(b.words)}`],
    ["Language", new Intl.DisplayNames(["en"], { type: "language" }).of(b.lang) || b.lang],
    ["Added", b.added],
  ].filter(Boolean);
  const html = page({
    depth: 2,
    url: b.url,
    title: `${b.title} by ${b.author} – Read online | ${NAME}`,
    desc: trunc(b.summary, 158),
    image: b.cover,
    type: "book",
    jsonld: [
      {
        "@context": "https://schema.org",
        "@type": "Book",
        "@id": `${SITE}/${b.url}#book`,
        name: b.title,
        url: `${SITE}/${b.url}`,
        image: abs(b.cover),
        description: b.summary,
        inLanguage: b.lang,
        isAccessibleForFree: true,
        ...(isAnon(b.author) ? {} : { author: { "@type": "Person", name: b.author, url: `${SITE}/${a}` } }),
        ...(b.words ? { wordCount: b.words, timeRequired: `PT${Math.max(1, Math.round(b.words / WPM))}M` } : {}),
        publisher: { "@type": "Organization", name: NAME, url: SITE + "/" },
        potentialAction: { "@type": "ReadAction", target: `${SITE}/reader.html?id=${enc(b.id)}` },
      },
      crumbLd(crumb),
    ],
    body: `${crumbs([["Library", "../../catalog/"], [b.title]])}
<article class="bk">
<div class="cover"><img width="600" height="800" src="${esc(coverSrc(b, "../../"))}" alt="Cover of ${esc(b.title)} by ${esc(b.author)}"></div>
<div>
<h1>${esc(b.title)}</h1>
<p class="lead">by ${a ? `<a href="../../${a}">${esc(b.author)}</a>` : esc(b.author)}</p>
<p>${esc(b.summary)}</p>
<dl class="facts">${facts.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl>
<p><a class="btn primary" href="${reader}">Start reading</a></p>
</div>
</article>
${b.chapters.length ? `<section><h2>Chapters</h2><ol class="chapters">${b.chapters.map((c) => `<li>${esc(c)}</li>`).join("")}</ol></section>` : ""}
<section><h2>More to read</h2><div class="grid">${more.map((x) => miniCard(x, "../../")).join("")}</div></section>`,
  });
  write(`${b.url}index.html`, html);
});

/* ---------- author pages ---------- */
for (const [s, a] of authors) {
  const url = `author/${s}/`;
  const desc = `Read ${a.books.length === 1 ? "the book" : `${a.books.length} books`} by ${a.name} on ${NAME}: ${a.books.map((b) => b.title).join(", ")}.`;
  write(
    `${url}index.html`,
    page({
      depth: 2,
      url,
      title: `${a.name} – Books to read online | ${NAME}`,
      desc: trunc(desc, 158),
      image: a.books[0].cover,
      jsonld: [
        {
          "@context": "https://schema.org",
          "@type": "ProfilePage",
          mainEntity: { "@type": "Person", "@id": `${SITE}/${url}#person`, name: a.name, url: `${SITE}/${url}`, subjectOf: a.books.map((b) => ({ "@type": "Book", name: b.title, url: `${SITE}/${b.url}` })) },
        },
        crumbLd([["Library", ""], [a.name, url]]),
      ],
      body: `${crumbs([["Library", "../../catalog/"], [a.name]])}<h1>${esc(a.name)}</h1><p class="muted">${a.books.length} ${a.books.length === 1 ? "book" : "books"} on ${NAME}</p><div class="grid">${a.books.map((b) => miniCard(b, "../../")).join("")}</div>`,
    }),
  );
}

/* ---------- catalog pages ---------- */
const pages = Math.max(1, Math.ceil(byTitle.length / PER_PAGE));
const catUrl = (n) => (n === 1 ? "catalog/" : `catalog/${n}/`);
for (let n = 1; n <= pages; n++) {
  const depth = n === 1 ? 1 : 2,
    rel = "../".repeat(depth),
    list = byTitle.slice((n - 1) * PER_PAGE, n * PER_PAGE);
  const nums = [...new Set([1, n - 2, n - 1, n, n + 1, n + 2, pages])].filter((i) => i >= 1 && i <= pages).sort((x, y) => x - y);
  let nav = "", last = 0;
  for (const i of nums) {
    if (i - last > 1) nav += `<span aria-hidden="true">…</span>`;
    nav += `<a class="btn"${i === n ? ' aria-current="page"' : ""} href="${rel}${catUrl(i)}">${i}</a>`;
    last = i;
  }
  write(
    `${catUrl(n)}index.html`,
    page({
      depth,
      url: catUrl(n),
      title: `All books${n > 1 ? ` – page ${n}` : ""} | ${NAME}`,
      desc: `Browse every book in the ${NAME} library, A to Z${n > 1 ? ` (page ${n} of ${pages})` : ""}. ${byTitle.length.toLocaleString("en-US")} books to read online.`,
      extraHead: [n > 1 && `<link rel="prev" href="${SITE}/${catUrl(n - 1)}">`, n < pages && `<link rel="next" href="${SITE}/${catUrl(n + 1)}">`].filter(Boolean).join("\n"),
      jsonld: [
        {
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: `All books${n > 1 ? ` – page ${n}` : ""}`,
          url: `${SITE}/${catUrl(n)}`,
          mainEntity: { "@type": "ItemList", itemListElement: list.map((b, i) => ({ "@type": "ListItem", position: (n - 1) * PER_PAGE + i + 1, url: `${SITE}/${b.url}` })) },
        },
        crumbLd([["Library", ""], ["All books", catUrl(1)]]),
      ],
      body: `<h1>All books</h1><p class="muted">${byTitle.length.toLocaleString("en-US")} books, A–Z</p><div class="grid">${list.map((b) => miniCard(b, rel)).join("")}</div>${pages > 1 ? `<nav class="pager" aria-label="Pagination">${nav}</nav>` : ""}`,
    }),
  );
}

/* ---------- home <head> block ---------- */
const homeBlock = `<!-- seo:start (generated by scripts/build-seo.mjs) -->
<meta name="robots" content="index,follow,max-image-preview:large">
${metaTags({ url: "", title: `${NAME} – Library`, desc: SITE_DESC, image: byNew[0]?.cover })}
${ld({ "@context": "https://schema.org", "@type": "WebSite", name: NAME, url: SITE + "/", description: SITE_DESC, inLanguage: LANG })}
<link rel="alternate" type="application/atom+xml" title="${NAME} – new books" href="feed.xml">
<!-- seo:end -->`;
const homeFile = path.join(root, "index.html");
if (fs.existsSync(homeFile)) {
  let h = fs.readFileSync(homeFile, "utf8");
  h = /<!-- seo:start[\s\S]*?<!-- seo:end -->/.test(h) ? h.replace(/<!-- seo:start[\s\S]*?<!-- seo:end -->/, () => homeBlock) : h.replace("</head>", () => homeBlock + "\n  </head>");
  fs.writeFileSync(homeFile, h);
}

/* ---------- sitemap, robots, llms.txt, feed, css ---------- */
const urls = [
  [`${SITE}/`, latest],
  ...Array.from({ length: pages }, (_, i) => [`${SITE}/${catUrl(i + 1)}`, latest]),
  ...[...authors].map(([s, a]) => [`${SITE}/author/${s}/`, a.books.map((b) => b.added).sort().pop()]),
  ...books.map((b) => [`${SITE}/${b.url}`, b.added]),
];
if (urls.length > 50000) throw new Error("Over 50,000 URLs: split the sitemap into a sitemap index");
write("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(([u, d]) => `<url><loc>${esc(u)}</loc><lastmod>${d}</lastmod></url>`).join("\n")}\n</urlset>\n`);

write(
  "robots.txt",
  `# Everything public is open to search engines and AI crawlers.
# To opt out of AI training, add e.g.:  User-agent: GPTBot / Disallow: /
User-agent: *
Allow: /

Sitemap: ${SITE}/sitemap.xml
`,
);

write(
  "llms.txt",
  `# ${NAME}

> ${SITE_DESC} The library currently has ${books.length.toLocaleString("en-US")} books; each has its own page with author, chapter list, length and reading time.

## Browse
- [Library home](${SITE}/): search, sort and continue reading
- [All books, A–Z](${SITE}/catalog/): crawlable index of every book
- [Sitemap](${SITE}/sitemap.xml): every book and author URL
- [New-book feed](${SITE}/feed.xml): Atom feed of the latest additions

## Newest books
${byNew.slice(0, 20).map((b) => `- [${b.title}](${SITE}/${b.url}): by ${b.author}${b.chapters.length ? `, ${b.chapters.length} chapters, about ${time(b.words)}` : ""}`).join("\n")}

## Notes
- Book pages are the canonical source for a title; the reader (reader.html) is an app view and is not indexed.
- Favorites and reading progress are stored on the reader's own device only.
`,
);

write(
  "feed.xml",
  `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
<title>${NAME} – new books</title><id>${SITE}/</id><updated>${latest}T00:00:00Z</updated>
<link href="${SITE}/"/><link rel="self" href="${SITE}/feed.xml"/>
${byNew.slice(0, 50).map((b) => `<entry><title>${esc(b.title)}</title><id>${SITE}/${b.url}</id><link href="${SITE}/${b.url}"/><updated>${b.added}T00:00:00Z</updated><author><name>${esc(b.author)}</name></author><summary>${esc(trunc(b.summary, 300))}</summary></entry>`).join("\n")}
</feed>
`,
);

write(
  "css/static-pages.css",
  `.crumbs{margin:1.2rem 0 0;font-size:.88rem;color:var(--muted)}
.crumbs a:hover{color:var(--accent)}
.bk{display:grid;gap:1.5rem 2.5rem;margin:1rem 0 2rem}
@media(min-width:700px){.bk{grid-template-columns:260px 1fr;align-items:start}}
.bk .cover{max-width:260px;width:100%}
.bk h1{margin-top:0}
.lead{font-family:var(--serif);font-size:1.2rem;color:var(--muted)}
.lead a:hover{color:var(--accent)}
.facts{display:grid;grid-template-columns:auto 1fr;gap:.3rem 1.2rem;margin:1.2rem 0}
.facts dt{color:var(--muted)}
.facts dd{margin:0}
.facts a{text-decoration:underline}
.chapters{columns:2 260px;padding-left:1.4rem}
.chapters li{margin:.25rem 0}
`,
);

console.log(`Done: ${books.length} books, ${authors.size} authors, ${pages} catalog pages, ${urls.length} sitemap URLs.`);
