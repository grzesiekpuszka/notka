// @vitest-environment jsdom
import { TextSelection } from "@milkdown/kit/prose/state";
import { expect, test, vi } from "vitest";
import { createEditor } from "../src/wysiwyg/setup";

const corpus = [
  "# Title",
  "",
  "Intro with **bold**, *italic*, `code` and a [link](https://x.y).",
  "",
  "- one",
  "- two",
  "",
  "- [x] done",
  "- [ ] open",
  "",
  "| a | b |",
  "| - | - |",
  "| 1 | 2 |",
  "",
  "```ts",
  "const x = 1;",
  "```",
  "",
  "![pic](img/p.png)",
  "",
].join("\n");

const make = async (markdown: string, onChange = vi.fn()) => {
  const root = document.createElement("div");
  document.body.append(root);
  const editor = await createEditor({ root, markdown, dir: null, onChange, onOpenLink: vi.fn() });
  return { editor, onChange };
};

const tick = () => new Promise((r) => setTimeout(r, 30));

/** Selects the first occurrence of `word` in the document. */
function select(view: import("@milkdown/kit/prose/view").EditorView, word: string) {
  let at = -1;
  view.state.doc.descendants((node, pos) => {
    if (at < 0 && node.isText && node.text!.includes(word)) at = pos + node.text!.indexOf(word);
  });
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, at, at + word.length)));
}

test("creating the editor never reports a change", async () => {
  const { editor, onChange } = await make(corpus);
  await tick();
  await tick();
  expect(onChange).not.toHaveBeenCalled();
  editor.destroy();
});

test("round trip keeps common markdown", async () => {
  const { editor } = await make("# T\n\n- a\n- b\n\n| a | b |\n| - | - |\n| 1 | 2 |\n\n- [x] done\n");
  const md = editor.getMarkdown();
  for (const part of ["# T", "- a", "| a | b |", "- [x] done"]) expect(md).toContain(part);
  editor.destroy();
});

test("handle.run bold after selecting text reports markdown with **", async () => {
  const { editor, onChange } = await make("some word here\n");
  select(editor.view, "word");
  editor.handle.run("bold");
  expect(onChange).toHaveBeenCalled();
  expect(onChange.mock.lastCall![0]).toContain("**word**");
  editor.destroy();
});

test("input rule makes a heading", async () => {
  const { editor, onChange } = await make("");
  const view = editor.view;
  editor.dom.dispatchEvent(new KeyboardEvent("keydown", { key: "#" }));
  for (const ch of "## x") {
    const { from, to } = view.state.selection;
    const handled = view.someProp("handleTextInput", (f) => f(view, from, to, ch, () => view.state.tr.insertText(ch, from, to)));
    if (!handled) view.dispatch(view.state.tr.insertText(ch, from, to));
  }
  editor.flush();
  expect(onChange.mock.lastCall![0]).toMatch(/^## x/);
  editor.destroy();
});

const cases: [import("../src/format").Format, string | undefined, string][] = [
  ["h2", undefined, "## "],
  ["italic", undefined, "*word*"],
  ["strike", undefined, "~~word~~"],
  ["code", undefined, "`word`"],
  ["bullet", undefined, "- "],
  ["ordered", undefined, "1. "],
  ["task", undefined, "- [ ] "],
  ["quote", undefined, "> "],
  ["codeblock", undefined, "```"],
  ["hr", undefined, "---"],
  ["table", undefined, "| "],
  ["image", "img/a.png", "![](img/a.png)"],
  ["link", "https://x", "[word](https://x)"],
];

test.each(cases)("toolbar %s formats in wysiwyg", async (f, arg, expected) => {
  const { editor, onChange } = await make("some word here\n");
  select(editor.view, "word");
  editor.handle.run(f, arg);
  expect(onChange.mock.lastCall![0]).toContain(expected);
  editor.destroy();
});

test("active reports marks and block", async () => {
  const { editor } = await make("## T **bold**\n");
  select(editor.view, "old");
  const view = editor.view;
  const { from } = view.state.selection;
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, from + 1)));
  const on = editor.handle.active();
  expect(on.has("h2")).toBe(true);
  expect(on.has("bold")).toBe(true);
  editor.destroy();
});

test("tab in the last table cell adds a row", async () => {
  const { editor, onChange } = await make("| a | b |\n| - | - |\n| 1 | 2 |\n");
  select(editor.view, "2");
  const view = editor.view;
  editor.dom.dispatchEvent(new KeyboardEvent("keydown", { key: "x" }));
  view.someProp("handleKeyDown", (f) => f(view, new KeyboardEvent("keydown", { key: "Tab" })));
  const rows = onChange.mock.lastCall![0].trim().split("\n");
  expect(rows).toHaveLength(4);
  editor.destroy();
});

test("ctrl+click opens links, click doesn't", async () => {
  const onOpenLink = vi.fn();
  const root = document.createElement("div");
  document.body.append(root);
  const editor = await createEditor({ root, markdown: "see [docs](other.md#x)\n", dir: null, onChange: vi.fn(), onOpenLink });
  const a = root.querySelector("a")!;
  a.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  expect(onOpenLink).not.toHaveBeenCalled();
  a.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, ctrlKey: true }));
  expect(onOpenLink).toHaveBeenCalledWith("other.md#x");
  editor.destroy();
});

test("relative images display through mdimg", async () => {
  const root = document.createElement("div");
  document.body.append(root);
  const editor = await createEditor({ root, markdown: "![a](img/p.png)\n", dir: "D:\\d", onChange: vi.fn(), onOpenLink: vi.fn() });
  expect(root.querySelector("img[alt=a]")!.getAttribute("src")).toMatch(/^mdimg:\/\/f\//);
  expect(editor.getMarkdown()).toContain("img/p.png");
  editor.destroy();
});

const key = (view: import("@milkdown/kit/prose/view").EditorView, init: KeyboardEventInit) =>
  view.someProp("handleKeyDown", (f) => f(view, new KeyboardEvent("keydown", init)));

test("ctrl+e is left to the app (switches mode), it doesn't format", async () => {
  const { editor, onChange } = await make("# Title\n");
  select(editor.view, "Tit");
  editor.dom.dispatchEvent(new KeyboardEvent("keydown", { key: "x" }));
  expect(key(editor.view, { key: "e", ctrlKey: true })).toBeFalsy();
  expect(onChange).not.toHaveBeenCalled();
  editor.destroy();
});

test("empty paragraphs are not saved as html", async () => {
  const { editor } = await make("a\n\nb\n");
  select(editor.view, "a");
  const view = editor.view;
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, view.state.selection.to)));
  editor.dom.dispatchEvent(new KeyboardEvent("keydown", { key: "x" }));
  key(view, { key: "Enter" });
  key(view, { key: "Enter" });
  expect(editor.getMarkdown()).not.toContain("<br");
  editor.destroy();
});

test("ctrl+k on a link changes its address instead of removing it", async () => {
  const { editor, onChange } = await make("see [docs](https://old)\n");
  select(editor.view, "docs");
  editor.handle.run("link", "https://new");
  expect(onChange.mock.lastCall![0]).toContain("[docs](https://new)");
  editor.destroy();
});

test("absolute image paths display through mdimg even without a folder", async () => {
  const root = document.createElement("div");
  document.body.append(root);
  const editor = await createEditor({ root, markdown: "![a](C:/x/y.png)\n", dir: null, onChange: vi.fn(), onOpenLink: vi.fn() });
  expect(root.querySelector("img[alt=a]")!.getAttribute("src")).toMatch(/^mdimg:\/\/f\//);
  editor.destroy();
});

test("typing is serialized after a pause, flush gives the text at once", async () => {
  const { editor, onChange } = await make("ab\n");
  const view = editor.view;
  editor.dom.dispatchEvent(new KeyboardEvent("keydown", { key: "x" }));
  view.dispatch(view.state.tr.insertText("X", 2));
  expect(onChange).not.toHaveBeenCalled();
  expect(editor.flush()).toContain("aXb");
  expect(onChange).toHaveBeenCalledTimes(1);
  expect(editor.flush()).toBeNull();
  editor.destroy();
});

/** Puts the cursor inside the first "word" (or at offset) and runs a toolbar format. */
async function apply(md: string, f: import("../src/format").Format, offset = 1) {
  const { editor, onChange } = await make(md);
  const view = editor.view;
  let at = -1;
  view.state.doc.descendants((n, pos) => {
    if (at < 0 && n.isText && n.text!.includes("word")) at = pos + n.text!.indexOf("word");
  });
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, at + offset)));
  editor.handle.run(f);
  const active = editor.handle.active();
  const out = onChange.mock.lastCall?.[0] ?? editor.getMarkdown();
  editor.destroy();
  return { md: out as string, active };
}

const blocks: [string, string, import("../src/format").Format, string][] = [
  ["quote toggles off", "> word\n", "quote", "word\n"],
  ["bullet becomes numbered", "- word\n- two\n", "ordered", "1. word\n2. two\n"],
  ["numbered becomes bullet", "1. word\n2. two\n", "bullet", "- word\n- two\n"],
  ["bullet toggles off for the item", "- word\n- two\n", "bullet", "word\n\n- two\n"],
  ["numbered toggles off for the item", "1. word\n2. two\n", "ordered", "word\n\n1. two\n"],
  ["tasks toggle off for the item", "- [ ] word\n- [x] two\n", "task", "word\n\n- [x] two\n"],
  ["bullet becomes tasks", "- word\n- two\n", "task", "- [ ] word\n- [ ] two\n"],
  ["tasks become bullet", "- [ ] word\n- [x] two\n", "bullet", "- word\n- two\n"],
  ["tasks become numbered", "- [ ] word\n- [x] two\n", "ordered", "1. word\n2. two\n"],
  ["code block toggles off", "```\nword\n```\n", "codeblock", "word\n"],
  ["heading becomes a list item", "## word\n", "bullet", "- word\n"],
  ["code block becomes a list item", "```\nword\n```\n", "bullet", "- word\n"],
  ["rule goes after the paragraph", "word\n", "hr", "word\n\n---\n"],
  ["table inside a table goes after it", "| word | b |\n| - | - |\n| 1 | 2 |\n", "table", "| word | b |\n| ---- | - |\n| 1    | 2 |\n\n|    |    |    |\n| :- | :- | :- |\n|    |    |    |\n|    |    |    |\n"],
];

test.each(blocks)("%s", async (_, md, f, expected) => {
  expect((await apply(md, f)).md).toBe(expected);
});

test.each([
  ["- [ ] word\n", "task"],
  ["1. word\n", "ordered"],
  ["- word\n", "bullet"],
  ["> word\n", "quote"],
  ["```\nword\n```\n", "codeblock"],
] as const)("active shows the block of %j", async (md, f) => {
  const { editor } = await make(md);
  select(editor.view, "word");
  expect(editor.handle.active().has(f)).toBe(true);
  editor.destroy();
});

test("quote on a list item quotes the list", async () => {
  expect((await apply("- word\n- two\n", "quote")).md).toBe("> - word\n> - two\n");
});

test("quote in a table quotes the table", async () => {
  expect((await apply("| word | b |\n| - | - |\n| 1 | 2 |\n", "quote")).md).toMatch(/^> \| word/);
});

/** Runs a toolbar format with a selection that starts at the list level or above. */
async function withSelection(md: string, f: import("../src/format").Format, pick: (doc: import("@milkdown/kit/prose/model").Node) => import("@milkdown/kit/prose/state").Selection) {
  const { editor, onChange } = await make(md);
  const view = editor.view;
  view.dispatch(view.state.tr.setSelection(pick(view.state.doc)));
  editor.handle.run(f);
  const out = onChange.mock.lastCall?.[0] ?? "(no change)";
  editor.destroy();
  return out as string;
}

const { AllSelection, NodeSelection } = await import("@milkdown/kit/prose/state");

test.each([
  ["ordered", "1. one\n2. two\n"],
  ["task", "- [ ] one\n- [ ] two\n"],
] as const)("with everything selected, %s converts the list", async (f, expected) => {
  expect(await withSelection("- one\n- two\n", f, (doc) => new AllSelection(doc))).toBe(expected);
});

test("with a whole item selected, numbered converts the list", async () => {
  expect(await withSelection("- one\n- two\n", "ordered", (doc) => NodeSelection.create(doc, 1))).toBe("1. one\n2. two\n");
});

test("with everything selected, the active list kind switches the list off", async () => {
  expect(await withSelection("- one\n- two\n", "bullet", (doc) => new AllSelection(doc))).toBe("one\n\ntwo\n");
});
