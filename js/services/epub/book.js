/**
 * EPUB model: parses the package (container -> OPF -> spine/TOC/metadata) and
 * turns chapters into sanitized DOM ready to be inserted into the reader.
 */
import { ZipArchive } from "./zip.js";
import { guessImageType, resolveHref, safeDecode } from "./paths.js";
import { sanitize } from "./sanitize.js";

const XLINK_NS = "http://www.w3.org/1999/xlink";
const XHTML_TYPES = new Set(["application/xhtml+xml", "text/html"]);

const byName = (root, name) => [...root.getElementsByTagNameNS("*", name)];
const firstByName = (root, name) =>
  root.getElementsByTagNameNS("*", name)[0] ?? null;
const clean = (text) => (text ?? "").replace(/\s+/g, " ").trim();

function parseXml(text, label) {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  if (doc.getElementsByTagName("parsererror").length)
    throw new Error(`Could not read ${label}.`);
  return doc;
}

function parseMarkup(text) {
  const xhtml = new DOMParser().parseFromString(text, "application/xhtml+xml");
  if (!xhtml.getElementsByTagName("parsererror").length) return xhtml;
  return new DOMParser().parseFromString(text, "text/html");
}

export async function openEpub(blob) {
  const zip = await ZipArchive.open(blob);
  const container = parseXml(
    await zip.readText("META-INF/container.xml"),
    "container.xml",
  );
  const opfPath = firstByName(container, "rootfile")?.getAttribute("full-path");
  if (!opfPath) throw new Error("This EPUB has no package file.");
  const opf = parseXml(await zip.readText(opfPath), "the package file");
  const book = new EpubBook(zip, opf, opfPath);
  await book.init();
  return book;
}

export class EpubBook {
  #zip;
  #opf;
  #opfPath;
  #manifest = new Map();
  #resourceUrls = new Map();
  #chapterByPath = new Map();

  metadata = { title: "", author: "", language: "" };
  /** @type {{id: string, path: string, size: number}[]} */
  spine = [];
  /** @type {{label: string, chapter: number, anchor: string, depth: number}[]} */
  toc = [];
  #weights = [];
  #totalWeight = 1;

  constructor(zip, opf, opfPath) {
    this.#zip = zip;
    this.#opf = opf;
    this.#opfPath = opfPath;
  }

  async init() {
    this.#readMetadata();
    this.#readManifest();
    this.#readSpine();
    if (!this.spine.length)
      throw new Error("This EPUB has no readable content.");
    this.toc = await this.#readToc();
  }

  #readMetadata() {
    const text = (name) => clean(firstByName(this.#opf, name)?.textContent);
    this.metadata = {
      title: text("title"),
      author: byName(this.#opf, "creator")
        .map((node) => clean(node.textContent))
        .filter(Boolean)
        .join(", "),
      language: text("language"),
    };
  }

  #readManifest() {
    for (const item of byName(this.#opf, "item")) {
      const id = item.getAttribute("id");
      const href = item.getAttribute("href");
      if (!id || !href) continue;
      this.#manifest.set(id, {
        id,
        path: resolveHref(this.#opfPath, href).path,
        mediaType: item.getAttribute("media-type") ?? "",
        properties: (item.getAttribute("properties") ?? "").split(/\s+/),
      });
    }
  }

  #readSpine() {
    for (const ref of byName(this.#opf, "itemref")) {
      const item = this.#manifest.get(ref.getAttribute("idref"));
      if (
        !item ||
        ref.getAttribute("linear") === "no" ||
        !XHTML_TYPES.has(item.mediaType)
      )
        continue;
      if (!this.#zip.has(item.path)) continue;
      this.#chapterByPath.set(item.path, this.spine.length);
      this.spine.push({
        id: item.id,
        path: item.path,
        size: this.#zip.size(item.path),
      });
    }
    this.#weights = this.spine.map((chapter) => Math.max(chapter.size, 1));
    this.#totalWeight = this.#weights.reduce((sum, weight) => sum + weight, 0);
  }

  async #readToc() {
    let entries = [];
    try {
      const nav = [...this.#manifest.values()].find((item) =>
        item.properties.includes("nav"),
      );
      if (nav)
        entries = this.#parseNav(await this.#zip.readText(nav.path), nav.path);
      if (!entries.length) {
        const spineToc = firstByName(this.#opf, "spine")?.getAttribute("toc");
        const ncx =
          this.#manifest.get(spineToc) ??
          [...this.#manifest.values()].find(
            (i) => i.mediaType === "application/x-dtbncx+xml",
          );
        if (ncx)
          entries = this.#parseNcx(
            await this.#zip.readText(ncx.path),
            ncx.path,
          );
      }
    } catch (error) {
      console.warn("Could not read table of contents.", error);
    }
    const mapped = entries
      .map((entry) => ({
        ...entry,
        chapter: this.#chapterByPath.get(entry.path) ?? -1,
      }))
      .filter((entry) => entry.chapter >= 0 && entry.label)
      .map(({ label, chapter, anchor, depth }) => ({
        label,
        chapter,
        anchor,
        depth,
      }));
    return mapped.length
      ? mapped
      : this.spine.map((_, index) => ({
          label: `Section ${index + 1}`,
          chapter: index,
          anchor: "",
          depth: 0,
        }));
  }

  #parseNav(html, navPath) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const navs = [...doc.querySelectorAll("nav")];
    const nav =
      navs.find((n) =>
        (n.getAttribute("epub:type") ?? "").split(/\s+/).includes("toc"),
      ) ?? navs[0];
    const root = nav?.querySelector("ol");
    const entries = [];
    const walk = (list, depth) => {
      for (const li of list.children) {
        if (li.tagName !== "LI") continue;
        const label = li.querySelector(":scope > a, :scope > span");
        const href = label?.getAttribute("href");
        if (label && href)
          entries.push({
            label: clean(label.textContent),
            ...this.#locate(navPath, href),
            depth,
          });
        const nested = li.querySelector(":scope > ol");
        if (nested) walk(nested, depth + 1);
      }
    };
    if (root) walk(root, 0);
    return entries;
  }

  #parseNcx(xml, ncxPath) {
    const doc = parseXml(xml, "the table of contents");
    const entries = [];
    const walk = (parent, depth) => {
      for (const point of parent.children) {
        if (point.localName !== "navPoint") continue;
        const label = clean(firstByName(point, "text")?.textContent);
        const src = firstByName(point, "content")?.getAttribute("src");
        if (src) entries.push({ label, ...this.#locate(ncxPath, src), depth });
        walk(point, depth + 1);
      }
    };
    const map = firstByName(doc, "navMap");
    if (map) walk(map, 0);
    return entries;
  }

  #locate(fromPath, href) {
    const { path, fragment } = resolveHref(fromPath, href);
    return { path, anchor: fragment };
  }

  indexOfPath(path) {
    return this.#chapterByPath.get(path) ?? -1;
  }

  /** Display title of a chapter, taken from the first matching TOC entry. */
  titleOf(index) {
    return (
      this.toc.find((entry) => entry.chapter === index)?.label ??
      `Section ${index + 1}`
    );
  }

  /** Overall reading progress (0-100), weighting chapters by their size. */
  percentAt(chapter, offset) {
    let done = 0;
    for (let i = 0; i < chapter; i++) done += this.#weights[i] ?? 0;
    done += (this.#weights[chapter] ?? 0) * offset;
    return Math.min(100, (done / this.#totalWeight) * 100);
  }

  async getCoverBlob() {
    const items = [...this.#manifest.values()];
    const metaId = byName(this.#opf, "meta")
      .find((m) => m.getAttribute("name") === "cover")
      ?.getAttribute("content");
    const cover =
      items.find((item) => item.properties.includes("cover-image")) ??
      this.#manifest.get(metaId) ??
      items.find(
        (item) => /cover/i.test(item.id) && item.mediaType.startsWith("image/"),
      );
    if (!cover || !this.#zip.has(cover.path)) return null;
    try {
      return await this.#zip.readBlob(
        cover.path,
        cover.mediaType || guessImageType(cover.path),
      );
    } catch {
      return null;
    }
  }

  /** Loads a chapter as a sanitized <div> whose children can be moved into the page. */
  async loadChapter(index) {
    const chapter = this.spine[index];
    if (!chapter) throw new Error("Chapter not found.");
    const doc = parseMarkup(await this.#zip.readText(chapter.path));
    const body = firstByName(doc, "body") ?? doc.documentElement;

    // Sanitize and rewrite while the markup is still inside the inert parsed
    // document. Importing it into the live page first would let the browser
    // start fetching <img src> (and similar) before they are stripped.
    sanitize(body);
    this.#rewriteLinks(body, chapter.path);
    await this.#rewriteImages(body, chapter.path);

    const node = document.createElement("div");
    node.append(...document.importNode(body, true).childNodes);
    return { node };
  }

  #rewriteLinks(root, chapterPath) {
    for (const link of root.querySelectorAll("a[href]")) {
      const href = link.getAttribute("href").trim();
      if (/^(https?:|mailto:)/i.test(href)) {
        link.setAttribute("target", "_blank");
        link.setAttribute("rel", "noopener noreferrer");
      } else if (href.startsWith("#")) {
        link.dataset.anchor = safeDecode(href.slice(1));
        link.setAttribute("href", "#");
      } else {
        const { path, fragment } = resolveHref(chapterPath, href);
        const target = this.indexOfPath(path);
        if (target < 0) {
          link.removeAttribute("href");
          continue;
        }
        link.dataset.chapter = String(target);
        if (fragment) link.dataset.anchor = fragment;
        link.setAttribute("href", "#");
      }
    }
  }

  async #rewriteImages(root, chapterPath) {
    const jobs = [];
    for (const image of root.querySelectorAll("img, image")) {
      const isSvgImage = image.localName === "image";
      const source = isSvgImage
        ? image.getAttributeNS(XLINK_NS, "href") || image.getAttribute("href")
        : image.getAttribute("src");
      if (!source) {
        image.remove();
        continue;
      }
      if (/^data:image\//i.test(source)) continue;
      if (/^[a-z][a-z0-9+.-]*:/i.test(source)) {
        image.remove(); // remote or unknown schemes are never loaded
        continue;
      }
      const { path } = resolveHref(chapterPath, source);
      jobs.push(
        this.#resourceUrl(path).then((url) => {
          if (!url) return image.remove();
          if (isSvgImage) {
            image.setAttributeNS(XLINK_NS, "xlink:href", url);
            image.setAttribute("href", url);
          } else {
            image.setAttribute("src", url);
            image.setAttribute("loading", "lazy");
          }
        }),
      );
    }
    await Promise.all(jobs);
  }

  #resourceUrl(path) {
    if (!this.#resourceUrls.has(path)) {
      const type = this.#typeOf(path);
      const promise = this.#zip.has(path)
        ? this.#zip
            .readBlob(path, type)
            .then((blob) => URL.createObjectURL(blob))
            .catch(() => null)
        : Promise.resolve(null);
      this.#resourceUrls.set(path, promise);
    }
    return this.#resourceUrls.get(path);
  }

  #typeOf(path) {
    const item = [...this.#manifest.values()].find(
      (entry) => entry.path === path,
    );
    return item?.mediaType || guessImageType(path);
  }

  /** Releases object URLs created for chapter images. */
  destroy() {
    for (const promise of this.#resourceUrls.values())
      promise.then((url) => url && URL.revokeObjectURL(url));
    this.#resourceUrls.clear();
  }
}
