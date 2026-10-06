/** Minimal ZIP reader (stored + deflate) using the native DecompressionStream. */
export async function readZip(buffer) {
  const v = new DataView(buffer),
    u8 = new Uint8Array(buffer),
    dec = new TextDecoder(),
    entries = new Map();
  let e = buffer.byteLength - 22;
  while (e >= 0 && v.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) throw new Error("Invalid book archive");
  let p = v.getUint32(e + 16, true);
  for (let i = 0, n = v.getUint16(e + 10, true); i < n; i++) {
    const nl = v.getUint16(p + 28, true),
      xl = v.getUint16(p + 30, true),
      cl = v.getUint16(p + 32, true);
    entries.set(dec.decode(u8.subarray(p + 46, p + 46 + nl)), {
      method: v.getUint16(p + 10, true),
      size: v.getUint32(p + 20, true),
      off: v.getUint32(p + 42, true),
    });
    p += 46 + nl + xl + cl;
  }
  return async (name) => {
    const key = [...entries.keys()].find(
      (k) => k === name || k.endsWith("/" + name),
    );
    if (!key) throw new Error(`Missing ${name} in book`);
    const { method, size, off } = entries.get(key),
      start =
        off + 30 + v.getUint16(off + 26, true) + v.getUint16(off + 28, true),
      data = u8.subarray(start, start + size);
    if (method === 0) return dec.decode(data);
    return new Response(
      new Blob([data])
        .stream()
        .pipeThrough(new DecompressionStream("deflate-raw")),
    ).text();
  };
}
