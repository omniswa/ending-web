const W = 1080,
  H = 1350,
  PAD = 96;
const css = (n, d) =>
  getComputedStyle(document.documentElement).getPropertyValue(n).trim() || d;

function wrap(ctx, text, max) {
  const lines = [];
  let cur = "";
  const push = (w, sep) => {
    const t = cur ? cur + sep + w : w;
    if (ctx.measureText(t).width > max && cur) {
      lines.push(cur);
      cur = w;
    } else cur = t;
  };
  for (const w of text.split(" ")) {
    if (ctx.measureText(w).width <= max) push(w, " ");
    else {
      if (cur) {
        lines.push(cur);
        cur = "";
      }
      for (const ch of Array.from(w)) push(ch, "");
    }
  }
  return cur ? [...lines, cur] : lines;
}
function fit(ctx, s, max) {
  let t = s;
  while (t.length > 1 && ctx.measureText(t).width > max) t = t.slice(0, -1);
  return t === s ? s : t.trimEnd() + "…";
}

export async function quoteBlob({ text, title, author }) {
  try {
    await Promise.all([
      document.fonts.load('italic 500 60px "Newsreader"'),
      document.fonts.load('600 40px "Newsreader"'),
      document.fonts.load('400 32px "Instrument Sans"'),
    ]);
  } catch {}
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const x = c.getContext("2d"),
    bg = css("--bg", "#fbfbf8"),
    fg = css("--text", "#222"),
    mu = css("--muted", "#6b6b66"),
    ac = css("--accent", "#0f6b61"),
    serif = '"Newsreader", Georgia, serif',
    ui = '"Instrument Sans", system-ui, sans-serif',
    maxW = W - PAD * 2,
    top = 360,
    area = 700;
  x.fillStyle = bg;
  x.fillRect(0, 0, W, H);
  x.fillStyle = ac;
  x.font = `700 240px ${serif}`;
  x.fillText("\u201C", PAD - 8, 300);

  let size = 72,
    lines,
    lh;
  for (;;) {
    x.font = `italic 500 ${size}px ${serif}`;
    lines = wrap(x, text, maxW);
    lh = size * 1.4;
    if (lines.length * lh <= area || size <= 34) break;
    size -= 4;
  }
  x.fillStyle = fg;
  const y0 = top + Math.max(0, (area - lines.length * lh) / 2) + size;
  lines.forEach((l, i) => x.fillText(l, PAD, y0 + i * lh));

  x.fillStyle = ac;
  x.fillRect(PAD, 1110, 80, 6);
  x.fillStyle = fg;
  x.font = `600 42px ${serif}`;
  x.fillText(fit(x, title || "", maxW), PAD, 1180);
  x.fillStyle = mu;
  x.font = `400 32px ${ui}`;
  x.fillText(fit(x, author || "", maxW), PAD, 1232);
  x.font = `700 32px ${serif}`;
  x.textAlign = "right";
  x.fillText("3NDING", W - PAD, 1280);
  return new Promise((res) => c.toBlob(res, "image/png"));
}

export async function shareCard(h) {
  const blob = await quoteBlob(h);
  if (!blob) throw new Error("Could not create the card");
  const file = new File([blob], `quote-${h.id}.png`, { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: h.title });
      return "shared";
    } catch (e) {
      if (e.name === "AbortError") return "cancelled";
    }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = file.name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1e4);
  return "downloaded";
}
