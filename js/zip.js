const EOCD = 0x06054b50,
  CENTRAL = 0x02014b50,
  LOCAL = 0x04034b50,
  UTF8_FLAG = 1 << 11,
  DATA_DESCRIPTOR_FLAG = 1 << 3,
  CORRUPT = "Corrupt book archive",
  CP437 =
    "ÇüéâäàåçêëèïîìÄÅ" +
    "ÉæÆôöòûùÿÖÜ¢£¥₧ƒ" +
    "áíóúñÑªº¿⌐¬½¼¡«»" +
    "░▒▓│┤╡╢╖╕╣║╗╝╜╛┐" +
    "└┴┬├─┼╞╟╚╔╩╦╠═╬╧" +
    "╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀" +
    "αßΓπΣσµτΦΘΩδ∞φε∩" +
    "≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ ";

const crcTable = new Uint32Array(256);
for (let i = 0; i < crcTable.length; i++) {
  let c = i;
  for (let bit = 0; bit < 8; bit++)
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[i] = c >>> 0;
}

function inRange(offset, length, limit) {
  return (
    Number.isSafeInteger(offset) &&
    Number.isSafeInteger(length) &&
    offset >= 0 &&
    length >= 0 &&
    offset <= limit &&
    length <= limit - offset
  );
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes)
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function decodeName(bytes, flags, utf8) {
  if (flags & UTF8_FLAG) {
    try {
      return utf8.decode(bytes);
    } catch {
      throw new Error(CORRUPT);
    }
  }
  let name = "";
  for (const byte of bytes)
    name += byte < 128 ? String.fromCharCode(byte) : CP437[byte - 128];
  return name;
}

async function inflate(data, expectedSize) {
  if (typeof DecompressionStream === "undefined")
    throw new Error("Your browser is too old to open this book");
  try {
    const reader = new Blob([data])
      .stream()
      .pipeThrough(new DecompressionStream("deflate-raw"))
      .getReader();
    const chunks = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > expectedSize) {
        await reader.cancel();
        throw new Error(CORRUPT);
      }
      chunks.push(value);
    }
    if (size !== expectedSize) throw new Error(CORRUPT);
    const output = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      output.set(chunk, offset);
      offset += chunk.length;
    }
    return output;
  } catch (e) {
    throw e.message === CORRUPT ? e : new Error(CORRUPT);
  }
}

export async function readZip(buffer) {
  if (!(buffer instanceof ArrayBuffer))
    throw new TypeError("Book archive must be an ArrayBuffer");
  const v = new DataView(buffer),
    u8 = new Uint8Array(buffer),
    utf8 = new TextDecoder("utf-8", { fatal: true }),
    text = new TextDecoder(),
    entries = new Map();
  const searchStart = Math.max(0, buffer.byteLength - 22 - 0xffff);
  let e = -1;
  for (let i = buffer.byteLength - 22; i >= searchStart; i--) {
    if (
      inRange(i, 22, buffer.byteLength) &&
      v.getUint32(i, true) === EOCD &&
      i + 22 + v.getUint16(i + 20, true) === buffer.byteLength
    ) {
      e = i;
      break;
    }
  }
  if (e < 0) throw new Error("Invalid book archive");
  const disk = v.getUint16(e + 4, true),
    centralDisk = v.getUint16(e + 6, true),
    diskCount = v.getUint16(e + 8, true),
    entryCount = v.getUint16(e + 10, true),
    centralSize = v.getUint32(e + 12, true),
    centralOffset = v.getUint32(e + 16, true);
  if (disk || centralDisk || diskCount !== entryCount)
    throw new Error("Multi-disk book archives are not supported");
  if (
    diskCount === 0xffff ||
    entryCount === 0xffff ||
    centralSize === 0xffffffff ||
    centralOffset === 0xffffffff
  )
    throw new Error("ZIP64 book archives are not supported");
  if (
    !inRange(centralOffset, centralSize, e) ||
    centralOffset + centralSize > e
  )
    throw new Error(CORRUPT);

  let p = centralOffset;
  for (let i = 0; i < entryCount; i++) {
    if (!inRange(p, 46, centralOffset + centralSize))
      throw new Error(CORRUPT);
    if (v.getUint32(p, true) !== CENTRAL) throw new Error(CORRUPT);
    const flags = v.getUint16(p + 8, true),
      method = v.getUint16(p + 10, true),
      crc = v.getUint32(p + 16, true),
      compressedSize = v.getUint32(p + 20, true),
      size = v.getUint32(p + 24, true),
      nl = v.getUint16(p + 28, true),
      xl = v.getUint16(p + 30, true),
      cl = v.getUint16(p + 32, true),
      startDisk = v.getUint16(p + 34, true),
      off = v.getUint32(p + 42, true),
      recordLength = 46 + nl + xl + cl;
    if (!inRange(p, recordLength, centralOffset + centralSize))
      throw new Error(CORRUPT);
    if (startDisk) throw new Error("Multi-disk book archives are not supported");
    if (compressedSize === 0xffffffff || size === 0xffffffff || off === 0xffffffff)
      throw new Error("ZIP64 book archives are not supported");
    const name = decodeName(u8.subarray(p + 46, p + 46 + nl), flags, utf8);
    if (entries.has(name))
      throw new Error("Duplicate file in book archive");
    entries.set(name, {
      flags,
      method,
      crc,
      compressedSize,
      size,
      off,
      name: u8.slice(p + 46, p + 46 + nl),
    });
    p += recordLength;
  }

  return async (name) => {
    const key = entries.has(name)
      ? name
      : [...entries.keys()].find(
          (k) => !k.split("/").includes("__MACOSX") && k.endsWith("/" + name),
        );
    if (!key) throw new Error(`Missing ${name} in book`);
    const { flags, method, crc, compressedSize, size, off, name: entryName } =
      entries.get(key);
    if (flags & 0x41)
      throw new Error("Encrypted book archives are not supported");
    if (method !== 0 && method !== 8)
      throw new Error("Unsupported compression in book");
    if (!inRange(off, 30, centralOffset) || v.getUint32(off, true) !== LOCAL)
      throw new Error(CORRUPT);
    const localFlags = v.getUint16(off + 6, true),
      localMethod = v.getUint16(off + 8, true),
      localCrc = v.getUint32(off + 14, true),
      localCompressedSize = v.getUint32(off + 18, true),
      localSize = v.getUint32(off + 22, true),
      nl = v.getUint16(off + 26, true),
      xl = v.getUint16(off + 28, true),
      dataStart = off + 30 + nl + xl;
    if (
      localFlags !== flags ||
      localMethod !== method ||
      !inRange(off + 30, nl + xl, centralOffset) ||
      nl !== entryName.length ||
      !u8.subarray(off + 30, off + 30 + nl).every((byte, i) => byte === entryName[i])
    )
      throw new Error(CORRUPT);
    if (
      !(flags & DATA_DESCRIPTOR_FLAG) &&
      (localCrc !== crc ||
        localCompressedSize !== compressedSize ||
        localSize !== size)
    )
      throw new Error(CORRUPT);
    if (!inRange(dataStart, compressedSize, centralOffset))
      throw new Error(CORRUPT);
    const compressed = u8.subarray(dataStart, dataStart + compressedSize);
    let data;
    if (method === 0) {
      if (compressedSize !== size) throw new Error(CORRUPT);
      data = compressed;
    } else {
      data = await inflate(compressed, size);
    }
    if (crc32(data) !== crc) throw new Error(CORRUPT);
    return text.decode(data);
  };
}
