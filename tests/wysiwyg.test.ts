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
