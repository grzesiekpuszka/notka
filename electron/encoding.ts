import type { DocMeta, Encoding } from "../src/api";

const BOM: Partial<Record<Encoding, number[]>> = { utf8bom: [0xef, 0xbb, 0xbf], utf16le: [0xff, 0xfe], utf16be: [0xfe, 0xff] };

const swap = (b: Buffer) => Buffer.from(b).swap16();

function text(buf: Buffer): { text: string; encoding: Encoding } {
  for (const [encoding, bom] of Object.entries(BOM) as [Encoding, number[]][]) {
    if (!bom.every((x, i) => buf[i] === x)) continue;
    const body = buf.subarray(bom.length);
    if (encoding === "utf16le") return { text: body.toString("utf16le"), encoding };
    if (encoding === "utf16be") return { text: swap(body.subarray(0, body.length & ~1)).toString("utf16le"), encoding };
    return { text: body.toString("utf8"), encoding };
  }
  try {
    return { text: new TextDecoder("utf-8", { fatal: true }).decode(buf), encoding: "utf8" };
  } catch {
    // not UTF-8: most likely an old Polish file saved by Windows tools
    return { text: new TextDecoder("windows-1250").decode(buf), encoding: "cp1250" };
  }
}

/** Text with BOM stripped and \n line endings, plus what is needed to write it back the same way. */
export function decode(buf: Buffer): { text: string; meta: DocMeta } {
  const { text: s, encoding } = text(buf);
  return { text: s.replace(/\r\n/g, "\n"), meta: { encoding, eol: s.includes("\r\n") ? "\r\n" : "\n" } };
}

/** cp1250 is written as UTF-8: the user is told before saving. */
export function encode(s: string, meta: DocMeta): Buffer {
  const body = meta.eol === "\r\n" ? s.replace(/\n/g, "\r\n") : s;
  const bom = Buffer.from(BOM[meta.encoding] ?? []);
  if (meta.encoding === "utf16le") return Buffer.concat([bom, Buffer.from(body, "utf16le")]);
  if (meta.encoding === "utf16be") return Buffer.concat([bom, swap(Buffer.from(body, "utf16le"))]);
  return Buffer.concat([bom, Buffer.from(body, "utf8")]);
}
