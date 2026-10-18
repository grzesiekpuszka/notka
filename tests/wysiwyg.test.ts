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
