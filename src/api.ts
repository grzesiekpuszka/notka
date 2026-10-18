// THE contract between the renderer and electron/main.ts; keep both sides in sync.
import type { Lang } from "./i18n";

export type Encoding = "utf8" | "utf8bom" | "utf16le" | "utf16be" | "cp1250";
export type DocMeta = { encoding: Encoding; eol: "\n" | "\r\n" };
export type FileDoc = { path: string; text: string; meta: DocMeta };
export type Theme = "system" | "light" | "dark";
export type Mode = "wysiwyg" | "markdown";
export type TabState = { id: string; path: string | null; untitled: number; mode: Mode; scroll: number };
export type Session = { tabs: TabState[]; active: string | null; closed: TabState[] };
export type UpdateState = { current: string; available: { version: string; notes: string; page: string } | null; downloaded: boolean };
export type Startup = {
  session: Session;
  drafts: Record<string, string>;
  theme: Theme;
  lang: Lang;
  version: string;
  updated: "ok" | "failed" | null;
  update: UpdateState;
};

type Result = { ok: true; value: any } | { ok: false; error: string };

declare global {
  interface Window {
    smr: {
      invoke(cmd: string, args?: unknown): Promise<Result>;
      on(event: string, cb: (payload: any) => void): () => void;
      pathFor(file: File): string;
    };
  }
}

export async function invoke<T = void>(cmd: string, args?: object): Promise<T> {
  const r = await window.smr.invoke(cmd, args);
  if (!r.ok) throw new Error(r.error);
  return r.value;
}

export const on = (event: string, cb: (payload: any) => void) => window.smr.on(event, cb);
