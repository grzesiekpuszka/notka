import type { DocMeta, FileDoc, Mode, Session, TabState } from "./api";
import { t } from "./i18n";

export type Tab = TabState & { text: string; saved: string; meta: DocMeta; missing: boolean; changed: boolean; notice: string | null };
export type State = { tabs: Tab[]; active: string | null; closed: TabState[] };
export type Action =
  | { type: "open"; doc: FileDoc }
  | { type: "new" }
  | { type: "close"; id: string }
  | { type: "restore"; doc: FileDoc | null }
  | { type: "edit"; id: string; text: string }
  | { type: "saved"; id: string; path: string; meta: DocMeta; text: string }
  | { type: "activate"; id: string }
  | { type: "cycle"; step: 1 | -1 }
  | { type: "setMode"; id: string; mode: Mode; notice?: string | null }
  | { type: "move"; id: string; to: number }
  | { type: "scroll"; id: string; scroll: number }
  | { type: "disk"; doc: FileDoc }
  | { type: "reload"; doc: FileDoc }
  | { type: "missing"; path: string }
  | { type: "keepMine"; id: string }
  | { type: "init"; state: State };

const MAX_CLOSED = 20;
// beyond this the visual editor gets slow: such files open straight in Markdown mode
export const MAX_WYSIWYG = 1_000_000;
// new documents get Windows line endings
export const emptyMeta: DocMeta = { encoding: "utf8", eol: "\r\n" };

export const dirty = (t: Tab) => t.text !== t.saved;
export const samePath = (a: string, b: string) => a.replace(/\//g, "\\").toLowerCase() === b.replace(/\//g, "\\").toLowerCase();

// beta.3 sessions stored `editing` (split view) instead of a mode
const modeOf = (t: TabState & { editing?: boolean }): Mode => t.mode ?? (t.editing ? "markdown" : "wysiwyg");

const state = (t: TabState): TabState => ({ id: t.id, path: t.path, untitled: t.untitled, mode: modeOf(t), scroll: t.scroll });

export const toSession = (s: State): Session => ({ tabs: s.tabs.map(state), active: s.active, closed: s.closed });

const untitledTab = (number: number): Tab => ({
  id: crypto.randomUUID(),
  path: null,
  untitled: number,
  mode: "wysiwyg",
  scroll: 0,
  text: "",
  saved: "",
  meta: emptyMeta,
  missing: false,
  changed: false,
  notice: null,
});

const fileTab = (doc: FileDoc, from?: TabState): Tab => {
  const large = doc.text.length > MAX_WYSIWYG;
  return {
    id: from?.id ?? crypto.randomUUID(),
    path: doc.path,
    untitled: 0,
    mode: large ? "markdown" : from ? modeOf(from) : "wysiwyg",
    scroll: from?.scroll ?? 0,
    text: doc.text,
    saved: doc.text,
    meta: doc.meta,
    missing: false,
    changed: false,
    notice: large ? t("This file is large, so it opens as markdown.") : null,
  };
};

/** `docs`: null = the file is gone, no entry = it couldn't be read now (offline drive, locked), so the tab stays. */
export function restoreTabs(session: Session, drafts: Record<string, string>, docs: Record<string, FileDoc | null>): State {
  const tabs: Tab[] = [];
  for (const t of session.tabs) {
    const draft = drafts[t.id];
    const doc = t.path ? docs[t.path] : null;
    if (doc) tabs.push({ ...fileTab(doc, t), text: draft ?? doc.text });
    // a deleted file is kept only if it has unsaved text to rescue
    else if (draft !== undefined || !t.path || docs[t.path] === undefined) tabs.push({ ...state(t), text: draft ?? "", saved: "", meta: emptyMeta, missing: !!t.path, changed: false, notice: null });
  }
  if (!tabs.length) tabs.push(untitledTab(1));
  const active = tabs.some((t) => t.id === session.active) ? session.active : tabs[0].id;
  return { tabs, active, closed: session.closed.map(state) };
}

const patch = (s: State, id: string | undefined, p: Partial<Tab>): State =>
  id === undefined ? s : { ...s, tabs: s.tabs.map((t) => (t.id === id ? { ...t, ...p } : t)) };

const byPath = (s: State, path: string) => s.tabs.find((t) => t.path && samePath(t.path, path));

function add(s: State, tab: Tab): State {
  const open = tab.path && byPath(s, tab.path);
  if (open) return { ...s, active: open.id };
  return { ...s, tabs: [...s.tabs, tab], active: tab.id };
}

export function reducer(s: State, a: Action): State {
  switch (a.type) {
    case "open":
      return add(s, fileTab(a.doc));
    case "new": {
      return add(s, untitledTab(Math.max(0, ...s.tabs.map((t) => t.untitled)) + 1));
    }
    case "close": {
      const i = s.tabs.findIndex((t) => t.id === a.id);
      if (i < 0) return s;
      const tab = s.tabs[i];
      const tabs = s.tabs.filter((t) => t.id !== a.id);
      const active = s.active === a.id ? (tabs[i] ?? tabs[i - 1])?.id ?? null : s.active;
      const closed = tab.path && !tab.missing ? [state(tab), ...s.closed].slice(0, MAX_CLOSED) : s.closed;
      // like Notepad there is always a document to type in
      if (!tabs.length) {
        const blank = untitledTab(1);
        return { ...s, tabs: [blank], active: blank.id, closed };
      }
      return { ...s, tabs, active, closed };
    }
    case "restore": {
      const [entry, ...closed] = s.closed;
      if (!entry) return s;
      return a.doc ? add({ ...s, closed }, fileTab(a.doc, entry)) : { ...s, closed };
    }
    case "edit":
      return patch(s, a.id, { text: a.text });
    case "saved":
      // keys typed while the file was being written stay unsaved
      return patch(s, a.id, { path: a.path, meta: a.meta, untitled: 0, saved: a.text, missing: false, changed: false });
    case "activate":
      return { ...s, active: a.id };
    case "cycle": {
      if (!s.tabs.length) return s;
      const i = s.tabs.findIndex((t) => t.id === s.active);
      return { ...s, active: s.tabs[(i + a.step + s.tabs.length) % s.tabs.length].id };
    }
    case "setMode":
      return patch(s, a.id, { mode: a.mode, notice: a.notice ?? null });
    case "move": {
      const tab = s.tabs.find((t) => t.id === a.id);
      if (!tab) return s;
      const tabs = s.tabs.filter((t) => t.id !== a.id);
      tabs.splice(a.to, 0, tab);
      return { ...s, tabs };
    }
    case "scroll":
      return patch(s, a.id, { scroll: a.scroll });
    case "disk": {
      const tab = byPath(s, a.doc.path);
      // our own save, or a touch that changed nothing
      if (!tab || (a.doc.text === tab.saved && !tab.missing)) return s;
      if (dirty(tab)) return patch(s, tab.id, { changed: true, missing: false });
      return patch(s, tab.id, { text: a.doc.text, saved: a.doc.text, meta: a.doc.meta, changed: false, missing: false });
    }
    case "reload":
      return patch(s, byPath(s, a.doc.path)?.id, { text: a.doc.text, saved: a.doc.text, meta: a.doc.meta, changed: false, missing: false });
    case "missing": {
      const tab = byPath(s, a.path);
      return !tab || tab.missing ? s : patch(s, tab.id, { missing: true });
    }
    case "keepMine":
      return patch(s, a.id, { changed: false });
    case "init":
      return a.state;
  }
}
