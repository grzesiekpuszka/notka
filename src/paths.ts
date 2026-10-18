// Windows path helpers for the renderer, which has no node:path.

export function dirname(path: string) {
  const i = Math.max(path.lastIndexOf("\\"), path.lastIndexOf("/"));
  return i < 0 ? "" : path.slice(0, i);
}

export const basename = (path: string) => path.slice(Math.max(path.lastIndexOf("\\"), path.lastIndexOf("/")) + 1);

function normalize(path: string) {
  const unc = path.startsWith("\\\\");
  const out: string[] = [];
  for (const part of path.split("\\")) {
    if (part === "..") {
      if (out.length > 1) out.pop();
    } else if (part && part !== ".") out.push(part);
  }
  return (unc ? "\\\\" : "") + out.join("\\");
}

/** A markdown link or image source relative to the document's folder: `../a%20b.md#x` → path and anchor. */
export function resolveLink(baseDir: string, href: string): { path: string; hash: string } {
  const i = href.indexOf("#");
  const [raw, hash] = i < 0 ? [href, ""] : [href.slice(0, i), href.slice(i + 1)];
  let rel = raw;
  try {
    rel = decodeURIComponent(raw);
  } catch {} // a stray % stays as written
  rel = rel.replace(/\//g, "\\");
  const absolute = /^[a-zA-Z]:\\/.test(rel) || rel.startsWith("\\\\");
  return { path: normalize(absolute ? rel : `${baseDir}\\${rel}`), hash };
}

export const imageUrl = (absPath: string) => `mdimg://f/${encodeURIComponent(absPath)}`;

/** `to` relative to the folder `fromDir`, written the way markdown wants it ("/" and %20); another drive stays absolute. */
export function relativePath(fromDir: string, to: string) {
  const a = fromDir.split(/[\\/]/).filter(Boolean);
  const b = to.split(/[\\/]/).filter(Boolean);
  const out = (parts: string[]) => parts.join("/").replace(/ /g, "%20");
  if (a[0]?.toLowerCase() !== b[0]?.toLowerCase()) return out(b);
  let i = 0;
  while (i < a.length && i < b.length - 1 && a[i].toLowerCase() === b[i].toLowerCase()) i++;
  return out([...Array(a.length - i).fill(".."), ...b.slice(i)]);
}
