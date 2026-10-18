import { expect, test } from "vitest";
import type { FileDoc, Session } from "../src/api";
import { dirty, reducer, restoreTabs, type Action, type State } from "../src/tabs";

const meta = { encoding: "utf8", eol: "\n" } as const;
const doc = (path: string, text = `# ${path}`): FileDoc => ({ path, text, meta });
const empty: State = { tabs: [], active: null, closed: [] };
const run = (...actions: Action[]) => actions.reduce(reducer, empty);
const activeTab = (s: State) => s.tabs.find((t) => t.id === s.active)!;

test("open dedupes paths case-insensitively", () => {
  const s = run({ type: "open", doc: doc("D:\\a\\README.md") }, { type: "open", doc: doc("C:\\b.md") }, { type: "open", doc: doc("d:/A/readme.md") });
  expect(s.tabs).toHaveLength(2);
  expect(activeTab(s).path).toBe("D:\\a\\README.md");
});

test("new creates numbered untitled tabs in wysiwyg mode", () => {
  const s = run({ type: "new" }, { type: "new" });
  expect(s.tabs.map((t) => t.untitled)).toEqual([1, 2]);
  expect(s.tabs.every((t) => t.mode === "wysiwyg" && t.path === null && !dirty(t))).toBe(true);
});

test("close pushes clean file tab to closed, max 20", () => {
  let s = empty;
  for (let i = 0; i < 21; i++) {
    s = reducer(s, { type: "open", doc: doc(`C:\\${i}.md`) });
    s = reducer(s, { type: "close", id: s.active! });
  }
  expect(s.closed).toHaveLength(20);
  expect(s.closed[0].path).toBe("C:\\20.md");
  s = reducer(s, { type: "new" });
  s = reducer(s, { type: "close", id: s.active! });
  expect(s.closed).toHaveLength(20);
  expect(s.closed[0].path).toBe("C:\\20.md");
});

test("close activates the neighbour", () => {
  let s = run({ type: "open", doc: doc("A") }, { type: "open", doc: doc("B") }, { type: "open", doc: doc("C") });
  const [a, b, c] = s.tabs;
  s = reducer(reducer(s, { type: "activate", id: b.id }), { type: "close", id: b.id });
  expect(s.active).toBe(c.id);
  s = reducer(s, { type: "close", id: c.id });
  expect(s.active).toBe(a.id);
});

test("closing the last tab leaves an empty untitled tab", () => {
  let s = run({ type: "open", doc: doc("A") });
  s = reducer(s, { type: "close", id: s.active! });
  expect(s.tabs).toHaveLength(1);
  expect(s.tabs[0]).toMatchObject({ path: null, untitled: 1, mode: "wysiwyg", text: "" });
  expect(s.active).toBe(s.tabs[0].id);
  expect(s.closed[0].path).toBe("A");
});

test("move reorders tabs", () => {
  let s = run({ type: "open", doc: doc("A") }, { type: "open", doc: doc("B") }, { type: "open", doc: doc("C") });
  const c = s.tabs[2].id;
  const active = s.active;
  s = reducer(s, { type: "move", id: c, to: 0 });
  expect(s.tabs.map((t) => t.path)).toEqual(["C", "A", "B"]);
  s = reducer(s, { type: "move", id: c, to: 2 });
  expect(s.tabs.map((t) => t.path)).toEqual(["A", "B", "C"]);
  expect(s.active).toBe(active);
});

test("setMode switches and sets or clears the notice", () => {
  let s = run({ type: "open", doc: doc("A") });
  const id = s.active!;
  s = reducer(s, { type: "setMode", id, mode: "markdown", notice: "x" });
  expect(s.tabs[0]).toMatchObject({ mode: "markdown", notice: "x" });
  s = reducer(s, { type: "setMode", id, mode: "wysiwyg" });
  expect(s.tabs[0]).toMatchObject({ mode: "wysiwyg", notice: null });
  expect(dirty(s.tabs[0])).toBe(false);
});

test("restore reopens with mode and scroll", () => {
  let s = run({ type: "open", doc: doc("A") });
  const id = s.active!;
  s = reducer(s, { type: "setMode", id, mode: "markdown" });
  s = reducer(s, { type: "scroll", id, scroll: 300 });
  s = reducer(s, { type: "close", id });
  s = reducer(s, { type: "restore", doc: doc("A") });
  expect(s.tabs.map((t) => t.path)).toEqual([null, "A"]);
  expect(s.tabs[1]).toMatchObject({ mode: "markdown", scroll: 300 });
  expect(s.closed).toHaveLength(0);
  s = reducer(reducer(s, { type: "close", id: s.tabs[1].id }), { type: "restore", doc: null });
  expect(s.tabs.map((t) => t.path)).toEqual([null]);
  expect(s.closed).toHaveLength(0);
});

test("restore of an already open path activates it", () => {
  let s = run({ type: "open", doc: doc("A") }, { type: "open", doc: doc("B") });
  const a = s.tabs[0];
  s = reducer(s, { type: "close", id: s.tabs[1].id });
  s = reducer(s, { type: "open", doc: doc("B") });
  s = reducer(s, { type: "activate", id: a.id });
  s = reducer(s, { type: "restore", doc: doc("B") });
  expect(s.tabs).toHaveLength(2);
  expect(activeTab(s).path).toBe("B");
});

test("changed is ignored when disk text equals saved text", () => {
  const s = run({ type: "open", doc: doc("A", "x") });
  expect(reducer(s, { type: "disk", doc: doc("A", "x") })).toBe(s);
});

test("disk reloads a clean tab silently", () => {
  const s = run({ type: "open", doc: doc("A", "x") }, { type: "disk", doc: doc("A", "y") });
  expect(s.tabs[0]).toMatchObject({ text: "y", saved: "y", changed: false });
});

test("disk flags a dirty tab", () => {
  let s = run({ type: "open", doc: doc("A", "x") });
  s = reducer(s, { type: "edit", id: s.active!, text: "mine" });
  s = reducer(s, { type: "disk", doc: doc("A", "y") });
  expect(s.tabs[0]).toMatchObject({ text: "mine", changed: true });
});

test("reload replaces mine", () => {
  let s = run({ type: "open", doc: doc("A", "x") });
  s = reducer(s, { type: "edit", id: s.active!, text: "mine" });
  s = reducer(s, { type: "disk", doc: doc("A", "y") });
  s = reducer(s, { type: "reload", doc: doc("A", "y") });
  expect(dirty(s.tabs[0])).toBe(false);
  expect(s.tabs[0]).toMatchObject({ text: "y", changed: false });
});

test("saved clears dirty and turns untitled into file", () => {
  let s = run({ type: "new" });
  s = reducer(s, { type: "edit", id: s.active!, text: "hi" });
  s = reducer(s, { type: "saved", id: s.active!, path: "C:\\n.md", meta, text: "hi" });
  expect(s.tabs[0]).toMatchObject({ path: "C:\\n.md", untitled: 0, saved: "hi" });
  expect(dirty(s.tabs[0])).toBe(false);
});

test("cycle wraps", () => {
  let s = run({ type: "open", doc: doc("A") }, { type: "open", doc: doc("B") });
  s = reducer(s, { type: "cycle", step: 1 });
  expect(activeTab(s).path).toBe("A");
  s = reducer(s, { type: "cycle", step: -1 });
  expect(activeTab(s).path).toBe("B");
});

test("restoreTabs", () => {
  const tab = (id: string, path: string | null, untitled = 0) => ({ id, path, untitled, mode: "wysiwyg" as const, scroll: 0 });
  const session: Session = {
    tabs: [tab("1", "A"), tab("2", "B"), tab("3", "C"), tab("4", "D"), tab("5", null, 1)],
    active: "4",
    closed: [],
  };
  const s = restoreTabs(session, { "2": "x", "3": "kept", "5": "draft" }, { A: doc("A", "a"), B: doc("B", "b"), C: null, D: null });
  expect(s.tabs.map((t) => t.id)).toEqual(["1", "2", "3", "5"]);
  expect(dirty(s.tabs[0])).toBe(false);
  expect(s.tabs[1]).toMatchObject({ text: "x", saved: "b" });
  expect(s.tabs[2]).toMatchObject({ text: "kept", missing: true });
  expect(s.tabs[3]).toMatchObject({ text: "draft", saved: "" });
  expect(s.active).toBe("1");
});

test("restoreTabs migrates beta.3 sessions", () => {
  const legacy = { tabs: [{ id: "1", path: "A", untitled: 0, editing: true, scroll: 0 }, { id: "2", path: "B", untitled: 0, editing: false, scroll: 0 }], active: "1", closed: [], collapsed: true };
  const s = restoreTabs(legacy as unknown as Session, {}, { A: doc("A"), B: doc("B") });
  expect(s.tabs.map((t) => t.mode)).toEqual(["markdown", "wysiwyg"]);
});

test("restoreTabs never returns no tabs", () => {
  const s = restoreTabs({ tabs: [], active: null, closed: [] }, {}, {});
  expect(s.tabs).toHaveLength(1);
  expect(s.tabs[0]).toMatchObject({ path: null, untitled: 1, mode: "wysiwyg" });
  expect(s.active).toBe(s.tabs[0].id);
});

test("saved marks the written text, not keys typed during the save", () => {
  let s = run({ type: "open", doc: doc("A", "x") });
  s = reducer(s, { type: "edit", id: s.active!, text: "written" });
  s = reducer(s, { type: "edit", id: s.active!, text: "written and more" });
  s = reducer(s, { type: "saved", id: s.active!, path: "A", meta, text: "written" });
  expect(dirty(s.tabs[0])).toBe(true);
  expect(reducer(s, { type: "disk", doc: doc("A", "written") })).toBe(s);
});

test("restoreTabs keeps a tab whose file can't be read now", () => {
  const session: Session = { tabs: [{ id: "1", path: "N:/x.md", untitled: 0, mode: "wysiwyg", scroll: 0 }], active: "1", closed: [] };
  const s = restoreTabs(session, {}, {});
  expect(s.tabs).toHaveLength(1);
  expect(s.tabs[0].missing).toBe(true);
});

test("large files open in markdown mode with a notice", () => {
  const s = run({ type: "open", doc: doc("A", "a".repeat(1_000_001)) });
  expect(s.tabs[0].mode).toBe("markdown");
  expect(s.tabs[0].notice).toBeTruthy();
  expect(run({ type: "open", doc: doc("B", "small") }).tabs[0]).toMatchObject({ mode: "wysiwyg", notice: null });
});
