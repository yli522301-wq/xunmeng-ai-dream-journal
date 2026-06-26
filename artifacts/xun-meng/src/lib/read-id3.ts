/**
 * Minimal inline ID3 tag reader for MP3 files.
 * Only extracts TIT2 (title) and TPE1 (artist).
 */
export async function readId3Meta(file: File): Promise<{ title?: string; artist?: string }> {
  const buf = await file.arrayBuffer();
  const d = new DataView(buf);
  let offset = 0;

  // Check ID3 header
  const id3 = String.fromCharCode(d.getUint8(0), d.getUint8(1), d.getUint8(2));
  if (id3 !== "ID3") return {};

  const version = d.getUint8(3);
  const flags = d.getUint8(5);
  const size =
    ((d.getUint8(6) & 0x7f) << 21) |
    ((d.getUint8(7) & 0x7f) << 14) |
    ((d.getUint8(8) & 0x7f) << 7) |
    (d.getUint8(9) & 0x7f);

  offset = 10;
  const extendedHeader = flags & 0x40;
  if (extendedHeader) {
    const extSize =
      (d.getUint8(offset) << 24) |
      (d.getUint8(offset + 1) << 16) |
      (d.getUint8(offset + 2) << 8) |
      d.getUint8(offset + 3);
    offset += 4 + extSize;
  }

  const textDecoder = new TextDecoder();
  const result: { title?: string; artist?: string } = {};

  while (offset < 10 + size) {
    const frameId = String.fromCharCode(
      d.getUint8(offset), d.getUint8(offset + 1),
      d.getUint8(offset + 2), d.getUint8(offset + 3)
    );
    if (frameId === "\x00\x00\x00\x00") break;

    const frameSize =
      version >= 3
        ? (d.getUint8(offset + 4) << 24) |
          (d.getUint8(offset + 5) << 16) |
          (d.getUint8(offset + 6) << 8) |
          d.getUint8(offset + 7)
        : ((d.getUint8(offset + 4) & 0x7f) << 21) |
          ((d.getUint8(offset + 5) & 0x7f) << 14) |
          ((d.getUint8(offset + 6) & 0x7f) << 7) |
          (d.getUint8(offset + 7) & 0x7f);

    if (frameId === "TIT2" || frameId === "TPE1") {
      const encoding = d.getUint8(offset + 10);
      const raw = new Uint8Array(buf, offset + 11, frameSize - 1);
      let text = "";
      if (encoding === 0) {
        text = textDecoder.decode(raw);
      } else if (encoding === 1 || encoding === 2) {
        text = new TextDecoder("utf-16").decode(raw);
      } else if (encoding === 3) {
        text = new TextDecoder("utf-8").decode(raw);
      }
      // Strip BOM if present
      text = text.replace(/^\uFEFF/, "").replace(/\0/g, "").trim();
      if (frameId === "TIT2") result.title = text;
      if (frameId === "TPE1") result.artist = text;
    }

    offset += 10 + frameSize;
  }

  return result;
}
