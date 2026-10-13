/**
 * Anchors highlights to text and paints them as <mark> elements.
 *
 * Positions are measured on the chapter's text with all whitespace removed, so
 * they do not depend on how the browser lays out line breaks or blocks (a
 * selection's text and the DOM's text agree once whitespace is ignored).
 */
const PREFIX_LENGTH = 24;
const WHITESPACE = /\s/;
const strip = (text) => text.replace(/\s+/g, "");

/** Where `range` starts inside `root`: `{ offset, prefix }` in whitespace-free characters. */
export function anchorOf(root, range) {
  const before = document.createRange();
  before.selectNodeContents(root);
  before.setEnd(range.startContainer, range.startOffset);
  const text = strip(before.toString());
  return { offset: text.length, prefix: text.slice(-PREFIX_LENGTH) };
}

/** Whitespace-free text of `root`, with the text node and offset behind every character. */
function buildIndex(root) {
  const parts = [];
  const nodes = [];
  const offsets = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const { data } = node;
    for (let i = 0; i < data.length; i++) {
      if (WHITESPACE.test(data[i])) continue;
      parts.push(data[i]);
      nodes.push(node);
      offsets.push(i);
    }
  }
  return { text: parts.join(""), nodes, offsets };
}

/** Picks the occurrence matching the saved context, else the one nearest the saved offset. */
function locate(index, needle, highlight) {
  const hits = [];
  for (
    let at = index.text.indexOf(needle);
    at !== -1;
    at = index.text.indexOf(needle, at + 1)
  )
    hits.push(at);
  if (!hits.length) return -1;
  if (hits.length === 1) return hits[0];

  const { prefix, offset } = highlight;
  if (prefix) {
    const exact = hits.find(
      (at) =>
        index.text.slice(Math.max(0, at - prefix.length), at) === prefix,
    );
    if (exact !== undefined) return exact;
  }
  if (Number.isFinite(offset) && offset >= 0)
    return hits.reduce((best, at) =>
      Math.abs(at - offset) < Math.abs(best - offset) ? at : best,
    );
  return hits[0];
}

function wrap(index, start, length, highlight) {
  const pieces = new Map();
  for (let i = start; i < start + length; i++) {
    const node = index.nodes[i];
    const offset = index.offsets[i];
    const piece = pieces.get(node);
    if (piece) piece.end = offset + 1;
    else pieces.set(node, { start: offset, end: offset + 1 });
  }
  for (const [node, { start: from, end }] of pieces) {
    let target = node;
    if (from > 0) target = node.splitText(from);
    if (end - from < target.length) target.splitText(end - from);
    const mark = document.createElement("mark");
    mark.className = "hl";
    mark.dataset.hl = highlight.id;
    mark.dataset.color = highlight.color;
    target.parentNode.insertBefore(mark, target);
    mark.append(target);
  }
}

export function clearHighlights(root) {
  for (const mark of root.querySelectorAll("mark[data-hl]"))
    mark.replaceWith(...mark.childNodes);
  root.normalize();
}

/**
 * Replaces any painted highlights in `root` with `highlights`. Highlights whose
 * text cannot be found are skipped. Returns how many were painted.
 */
export function paintHighlights(root, highlights) {
  clearHighlights(root);
  let painted = 0;
  for (const highlight of highlights) {
    const needle = strip(highlight.text);
    if (!needle) continue;
    // Rebuilt each time: wrapping splits text nodes, which invalidates the index.
    const index = buildIndex(root);
    const start = locate(index, needle, highlight);
    if (start < 0) continue;
    wrap(index, start, needle.length, highlight);
    painted++;
  }
  return painted;
}
