import type { DocMeta, FileDoc, Session, TabState } from "./api";

export type Tab = TabState & { text: string; saved: string; meta: DocMeta; missing: boolean; changed: boolean };
export type State = { tabs: Tab[]; active: string | null; closed: TabState[]; collapsed: boolean };
export type Action =
  | { type: "open"; doc: FileDoc }
  | { type: "new" }
  | { type: "close"; id: string }
  | { type: "restore"; doc: FileDoc | null }
  | { type: "edit"; id: string; text: string }
  | { type: "saved"; id: string; path: string; meta: DocMeta; text: string }
  | { type: "activate"; id: string }
  | { type: "cycle"; step: 1 | -1 }
  | { type: "toggleEdit"; id: string }
  | { type: "scroll"; id: string; scroll: number }
  | { type: "disk"; doc: FileDoc }
  | { type: "reload"; doc: FileDoc }
  | { type: "missing"; path: string }
  | { type: "keepMine"; id: string }
  | { type: "collapse" }
  | { type: "init"; state: State };

const MAX_CLOSED = 20;
// new documents get Windows line endings
export const emptyMeta: DocMeta = { encoding: "utf8", eol: "\r\n" };

export const dirty = (t: Tab) => t.text !== t.saved;
export const samePath = (a: string, b: string) => a.replace(/\//g, "\\").toLowerCase() === b.replace(/\//g, "\\").toLowerCase();

const state = ({ id, path, untitled, editing, scroll }: TabState): TabState => ({ id, path, untitled, editing, scroll });

export const toSession = (s: State): Session => ({ tabs: s.tabs.map(state), active: s.active, closed: s.closed, collapsed: s.collapsed });

const fileTab = (doc: FileDoc, from?: TabState): Tab => ({
  id: from?.id ?? crypto.randomUUID(),
  path: doc.path,
  untitled: 0,
  editing: from?.editing ?? false,
  scroll: from?.scroll ?? 0,
  text: doc.text,
  saved: doc.text,
  meta: doc.meta,
  missing: false,
  changed: false,
});

/** `docs`: null = the file is gone, no entry = it couldn't be read now (offline drive, locked), so the tab stays. */
export function restoreTabs(session: Session, drafts: Record<string, string>, docs: Record<string, FileDoc | null>): State {
  const tabs: Tab[] = [];
  for (const t of session.tabs) {
    const draft = drafts[t.id];
    const doc = t.path ? docs[t.path] : null;
    if (doc) tabs.push({ ...fileTab(doc, t), text: draft ?? doc.text });
    // a deleted file is kept only if it has unsaved text to rescue
    else if (draft !== undefined || !t.path || docs[t.path] === undefined) tabs.push({ ...state(t), text: draft ?? "", saved: "", meta: emptyMeta, missing: !!t.path, changed: false });
  }
  const active = tabs.some((t) => t.id === session.active) ? session.active : (tabs[0]?.id ?? null);
  return { tabs, active, closed: session.closed, collapsed: session.collapsed };
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
      const untitled = Math.max(0, ...s.tabs.map((t) => t.untitled)) + 1;
      const id = crypto.randomUUID();
      return add(s, { id, path: null, untitled, editing: true, scroll: 0, text: "", saved: "", meta: emptyMeta, missing: false, changed: false });
    }
    case "close": {
      const i = s.tabs.findIndex((t) => t.id === a.id);
      if (i < 0) return s;
      const tab = s.tabs[i];
      const tabs = s.tabs.filter((t) => t.id !== a.id);
      const active = s.active === a.id ? (tabs[i] ?? tabs[i - 1])?.id ?? null : s.active;
      const closed = tab.path && !tab.missing ? [state(tab), ...s.closed].slice(0, MAX_CLOSED) : s.closed;
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
    case "toggleEdit":
      return patch(s, a.id, { editing: !s.tabs.find((t) => t.id === a.id)?.editing });
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
    case "collapse":
      return { ...s, collapsed: !s.collapsed };
    case "init":
      return a.state;
  }
}
