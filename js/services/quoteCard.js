/**
 * Renders a highlight as a shareable quote card (PNG) on a canvas, and shares
 * or downloads it. Pure canvas drawing: no fonts or images are fetched.
 */
import { APP_NAME, HIGHLIGHT } from "../config.js";
import { downloadBlob } from "../core/utils.js";

export const CARD_THEMES = Object.freeze({
  paper: { bg: "#fbfaf7", fg: "#25231f", muted: "#7a766c", accent: "#0e7466" },
  sepia: { bg: "#f4ecd8", fg: "#4a3a2a", muted: "#8b7a63", accent: "#8a5a2b" },
  dark: { bg: "#1c1d21", fg: "#d6d6da", muted: "#8d8e96", accent: "#6fcfb2" },
  oled: { bg: "#000000", fg: "#e2e2e2", muted: "#7a7a7a", accent: "#6fcfb2" },
});

const WIDTH = 1080;
const HEIGHT = 1350;
const PAD = 100;
const SERIF =
  '"Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Charter, Georgia, serif';
const SANS =
  'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

const TEXT_TOP = 330;
const TEXT_BOTTOM = HEIGHT - 330;
const MAX_FONT = 72;
const MIN_FONT = 34;

/** Greedy word wrap that also breaks words (or unspaced CJK text) wider than a line. */
function wrapText(ctx, text, maxWidth) {
  const lines = [];
  let line = "";
  for (const word of text.split(" ")) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      line = candidate;
      continue;
    }
    if (line) {
      lines.push(line);
      line = "";
    }
    if (ctx.measureText(word).width <= maxWidth) {
      line = word;
      continue;
    }
    for (const char of word) {
      const next = line + char;
      if (line && ctx.measureText(next).width > maxWidth) {
        lines.push(line);
        line = char;
      } else {
        line = next;
      }
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Largest font size at which the whole quote fits the text area. */
function fitQuote(ctx, text, maxWidth, maxHeight) {
  for (let size = MAX_FONT; size >= MIN_FONT; size -= 2) {
    ctx.font = `400 ${size}px ${SERIF}`;
    const lines = wrapText(ctx, text, maxWidth);
    const lineHeight = Math.round(size * 1.38);
    if (lines.length * lineHeight <= maxHeight)
      return { size, lines, lineHeight };
  }
  ctx.font = `400 ${MIN_FONT}px ${SERIF}`;
  const lineHeight = Math.round(MIN_FONT * 1.38);
  const lines = wrapText(ctx, text, maxWidth);
  const fits = Math.max(1, Math.floor(maxHeight / lineHeight));
  if (lines.length > fits) {
    lines.length = fits;
    lines[fits - 1] = `${lines[fits - 1].replace(/\s+\S*$/, "")}…`;
  }
  return { size: MIN_FONT, lines, lineHeight };
}

function ellipsize(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let end = text.length;
  while (end > 1 && ctx.measureText(`${text.slice(0, end)}…`).width > maxWidth)
    end--;
  return `${text.slice(0, end).trimEnd()}…`;
}

const toBlob = (canvas) =>
  new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Could not create the image.")),
      "image/png",
    ),
  );

/** @returns {Promise<Blob>} a 1080×1350 PNG. */
export async function renderQuoteCard(highlight, themeName = "paper") {
  const base = CARD_THEMES[themeName] ?? CARD_THEMES.paper;
  // The quote mark and divider take the highlight's color.
  const accent =
    HIGHLIGHT.colors.find((c) => c.value === highlight.color)?.hex ??
    base.accent;
  const theme = { ...base, accent };
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  const contentWidth = WIDTH - PAD * 2;

  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";

  // Opening quotation mark.
  ctx.fillStyle = theme.accent;
  ctx.font = `700 240px ${SERIF}`;
  ctx.fillText("“", PAD - 8, 330);

  // Quote text, vertically centered in the text area.
  const { size, lines, lineHeight } = fitQuote(
    ctx,
    highlight.text,
    contentWidth,
    TEXT_BOTTOM - TEXT_TOP,
  );
  ctx.fillStyle = theme.fg;
  ctx.font = `400 ${size}px ${SERIF}`;
  const blockHeight = lines.length * lineHeight;
  let y =
    TEXT_TOP +
    (TEXT_BOTTOM - TEXT_TOP - blockHeight) / 2 +
    lineHeight * 0.78;
  for (const line of lines) {
    ctx.fillText(line, PAD, y);
    y += lineHeight;
  }

  // Attribution.
  const footerY = HEIGHT - 270;
  ctx.fillStyle = theme.accent;
  ctx.fillRect(PAD, footerY, 72, 6);

  ctx.fillStyle = theme.fg;
  ctx.font = `600 44px ${SERIF}`;
  ctx.fillText(
    ellipsize(ctx, highlight.bookTitle, contentWidth),
    PAD,
    footerY + 74,
  );
  ctx.fillStyle = theme.muted;
  ctx.font = `400 34px ${SANS}`;
  ctx.fillText(
    ellipsize(ctx, highlight.author, contentWidth),
    PAD,
    footerY + 126,
  );

  // App name.
  ctx.font = `600 26px ${SANS}`;
  if ("letterSpacing" in ctx) ctx.letterSpacing = "6px";
  ctx.fillText(APP_NAME, PAD, HEIGHT - 70);

  return toBlob(canvas);
}

function fileName(highlight) {
  const slug = highlight.bookTitle
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `${slug || "quote"}-quote.png`;
}

export const canShareFiles = () =>
  typeof navigator.share === "function" &&
  typeof navigator.canShare === "function" &&
  typeof File === "function";

/** Downloads the card as a PNG. */
export async function downloadQuoteCard(highlight, themeName) {
  downloadBlob(await renderQuoteCard(highlight, themeName), fileName(highlight));
}

/**
 * Shares the card image through the native share sheet; falls back to a
 * download when file sharing is unsupported.
 * @returns {Promise<"shared"|"downloaded"|"cancelled">}
 */
export async function shareQuoteCard(highlight, themeName) {
  const blob = await renderQuoteCard(highlight, themeName);
  const name = fileName(highlight);
  if (canShareFiles()) {
    const file = new File([blob], name, { type: "image/png" });
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: highlight.bookTitle,
          text: `“${highlight.text}” — ${highlight.author}, ${highlight.bookTitle}`,
        });
        return "shared";
      } catch (error) {
        if (error.name === "AbortError") return "cancelled";
      }
    }
  }
  downloadBlob(blob, name);
  return "downloaded";
}
