// Whether the visual editor can be trusted with a document: style may change on save, content may not.
import type { Mode } from "../api";
import { render } from "../markdown";
import { MAX_WYSIWYG } from "../tabs";

export { MAX_WYSIWYG };

export const initialMode = (text: string): Mode => (text.length > MAX_WYSIWYG ? "markdown" : "wysiwyg");

/** What a reader sees and what the links point to, independent of how the markdown is written. */
export function contentKey(md: string): string {
  const doc = new DOMParser().parseFromString(render(md, null), "text/html");
  const urls = [...doc.querySelectorAll("[href], [src]")].map((el) => el.getAttribute("href") ?? el.getAttribute("src"));
  const comments = md.match(/<!--[\s\S]*?-->/g) ?? [];
  return [doc.body.textContent!.replace(/\s+/g, " ").trim(), ...urls, ...comments].join("\n");
}

/** The document as the visual editor would save it. */
export async function roundTrip(md: string): Promise<string> {
  const { createEditor } = await import("./setup");
  const root = document.createElement("div");
  const editor = await createEditor({ root, markdown: md, dir: null, onChange: () => {}, onOpenLink: () => {} });
  try {
    return editor.getMarkdown();
  } finally {
    editor.destroy();
  }
}

export const checkFidelity = async (md: string) => contentKey(md) === contentKey(await roundTrip(md));
