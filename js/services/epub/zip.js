/**
 * Minimal read-only ZIP reader built on Blob.slice and DecompressionStream.
 * Only the central directory is parsed up front; entries are decompressed on demand,
 * so large EPUBs never have to be fully loaded into memory.
 */
const SIG_EOCD = 0x06054b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_LOCAL = 0x04034b50;
const MAX_EOCD_SEARCH = 65_557; // 22-byte record + 65,535-byte max comment
const decoder = new TextDecoder("utf-8");

export class ZipArchive {
  #blob;
  #entries = new Map();
  #lowerCase = new Map();

  static async open(blob) {
    const archive = new ZipArchive(blob);
    await archive.#readDirectory();
    return archive;
  }

  constructor(blob) {
    this.#blob = blob;
  }

  async #readDirectory() {
    const size = this.#blob.size;
    const tailSize = Math.min(size, MAX_EOCD_SEARCH);
    const tail = new DataView(
      await this.#blob.slice(size - tailSize).arrayBuffer(),
    );

    let eocd = -1;
    for (let i = tail.byteLength - 22; i >= 0; i--) {
      if (tail.getUint32(i, true) === SIG_EOCD) {
        eocd = i;
        break;
      }
    }
    if (eocd < 0) throw new Error("Not a valid EPUB: ZIP directory not found.");

    const total = tail.getUint16(eocd + 10, true);
    const directorySize = tail.getUint32(eocd + 12, true);
    const directoryOffset = tail.getUint32(eocd + 16, true);
    if (directoryOffset === 0xffffffff || total === 0xffff)
      throw new Error("ZIP64 archives are not supported.");

    const view = new DataView(
      await this.#blob
        .slice(directoryOffset, directoryOffset + directorySize)
        .arrayBuffer(),
    );
    let pos = 0;
    for (let n = 0; n < total && pos + 46 <= view.byteLength; n++) {
      if (view.getUint32(pos, true) !== SIG_CENTRAL)
        throw new Error("Corrupt ZIP directory.");
      const method = view.getUint16(pos + 10, true);
      const compressedSize = view.getUint32(pos + 20, true);
      const uncompressedSize = view.getUint32(pos + 24, true);
      const nameLength = view.getUint16(pos + 28, true);
      const extraLength = view.getUint16(pos + 30, true);
      const commentLength = view.getUint16(pos + 32, true);
      const offset = view.getUint32(pos + 42, true);
      const name = decoder.decode(
        new Uint8Array(view.buffer, pos + 46, nameLength),
      );
      if (!name.endsWith("/")) {
        this.#entries.set(name, {
          method,
          compressedSize,
          size: uncompressedSize,
          offset,
        });
        this.#lowerCase.set(name.toLowerCase(), name);
      }
      pos += 46 + nameLength + extraLength + commentLength;
    }
  }

  /** Finds an entry by exact name, then URL-decoded name, then case-insensitively. */
  #find(path) {
    if (this.#entries.has(path)) return path;
    try {
      const decoded = decodeURIComponent(path);
      if (this.#entries.has(decoded)) return decoded;
    } catch {
      /* ignore malformed escapes */
    }
    return this.#lowerCase.get(path.toLowerCase()) ?? null;
  }

  has(path) {
    return this.#find(path) !== null;
  }

  size(path) {
    const name = this.#find(path);
    return name ? this.#entries.get(name).size : 0;
  }

  async readBytes(path) {
    const name = this.#find(path);
    if (!name) throw new Error(`Missing file in EPUB: ${path}`);
    const entry = this.#entries.get(name);

    const header = new DataView(
      await this.#blob.slice(entry.offset, entry.offset + 30).arrayBuffer(),
    );
    if (header.getUint32(0, true) !== SIG_LOCAL)
      throw new Error("Corrupt ZIP entry.");
    const start =
      entry.offset +
      30 +
      header.getUint16(26, true) +
      header.getUint16(28, true);
    const raw = this.#blob.slice(start, start + entry.compressedSize);

    if (entry.method === 0) return raw.arrayBuffer();
    if (entry.method === 8) {
      const stream = raw
        .stream()
        .pipeThrough(new DecompressionStream("deflate-raw"));
      return new Response(stream).arrayBuffer();
    }
    throw new Error(`Unsupported compression method (${entry.method}).`);
  }

  async readText(path) {
    return decoder.decode(await this.readBytes(path));
  }

  async readBlob(path, type = "") {
    return new Blob([await this.readBytes(path)], { type });
  }
}
