import fs from "node:fs/promises";
import type { DocMeta, FileDoc } from "../src/api";
import { decode, encode } from "./encoding";

export async function readDoc(path: string): Promise<FileDoc | null> {
  try {
    return { path, ...decode(await fs.readFile(path)) };
  } catch (e: any) {
    if (e.code === "ENOENT") return null;
    throw e;
  }
}

/** Written next to the file and renamed over it, so a crash mid-write never leaves a truncated document. */
export async function writeDoc(path: string, text: string, meta: DocMeta) {
  const tmp = `${path}.smr-tmp`;
  await fs.writeFile(tmp, encode(text, meta));
  await fs.rename(tmp, path);
}
