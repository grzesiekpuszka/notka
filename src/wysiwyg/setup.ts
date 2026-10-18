// The visual (WYSIWYG) editor: Milkdown, i.e. ProseMirror with markdown as its source format.
import { defaultValueCtx, Editor, editorViewCtx, editorViewOptionsCtx, remarkStringifyOptionsCtx, rootCtx, serializerCtx } from "@milkdown/kit/core";
import { clipboard } from "@milkdown/kit/plugin/clipboard";
import { history } from "@milkdown/kit/plugin/history";
import {
  commonmark,
  toggleEmphasisCommand,
  toggleInlineCodeCommand,
  toggleStrongCommand,
  turnIntoTextCommand,
  wrapInHeadingCommand,
} from "@milkdown/kit/preset/commonmark";
import { gfm, toggleStrikethroughCommand } from "@milkdown/kit/preset/gfm";
import type { Node } from "@milkdown/kit/prose/model";
import { Plugin } from "@milkdown/kit/prose/state";
import type { EditorView } from "@milkdown/kit/prose/view";
import { $prose, callCommand, replaceAll } from "@milkdown/kit/utils";
import type { EditorHandle, Format } from "../format";
import { frontmatter } from "./frontmatter";

export type WysiwygOptions = { root: HTMLElement; markdown: string; dir: string | null; onChange(md: string): void; onOpenLink(href: string): void };

export type Wysiwyg = { handle: EditorHandle; view: EditorView; dom: HTMLElement; getMarkdown(): string; setMarkdown(md: string): void; destroy(): void };

const MARKS: [Format, string][] = [
  ["bold", "strong"],
  ["italic", "emphasis"],
  ["strike", "strike_through"],
  ["code", "inlineCode"],
  ["link", "link"],
];

export async function createEditor(o: WysiwygOptions): Promise<Wysiwyg> {
  // Loading a document normalizes it (that is not an edit): changes count only after the user did something.
  let touched = false;
  let silent = false;
  let serialize: (doc: Node) => string = () => "";
  const touch = () => ((touched = true), false);

  const watch = $prose(
    () =>
      new Plugin({
        props: { handleDOMEvents: { keydown: touch, beforeinput: touch, paste: touch, drop: touch, cut: touch } },
        view: () => ({
          update: (view, prev) => {
            if (touched && !silent && !view.state.doc.eq(prev.doc)) o.onChange(serialize(view.state.doc));
          },
        }),
      }),
  );

  const editor = await Editor.make()
    .config((ctx) => {
      ctx.set(rootCtx, o.root);
      ctx.set(defaultValueCtx, o.markdown);
      ctx.update(editorViewOptionsCtx, (prev) => ({ ...prev, attributes: { class: "md" } }));
      // one house style when the document is written back: "-" bullets, "*" emphasis, "**" strong
      ctx.update(remarkStringifyOptionsCtx, (prev) => ({ ...prev, bullet: "-" as const, emphasis: "*" as const, strong: "*" as const, rule: "-" as const }));
    })
    .use(commonmark)
    .use(gfm)
    .use(frontmatter)
    .use(history)
    .use(clipboard)
    .use(watch)
    .create();

  const view = editor.ctx.get(editorViewCtx);
  serialize = (doc) => editor.ctx.get(serializerCtx)(doc);
  const command = (key: Parameters<typeof callCommand>[0], payload?: unknown) => editor.action(callCommand(key, payload));

  const handle: EditorHandle = {
    run(f) {
      touched = true;
      if (f === "bold") command(toggleStrongCommand.key);
      else if (f === "italic") command(toggleEmphasisCommand.key);
      else if (f === "strike") command(toggleStrikethroughCommand.key);
      else if (f === "code") command(toggleInlineCodeCommand.key);
      else if (f === "p") command(turnIntoTextCommand.key);
      else if (f === "h1" || f === "h2" || f === "h3") command(wrapInHeadingCommand.key, Number(f[1]));
    },
    active() {
      const { $from, empty } = view.state.selection;
      const marks = empty ? (view.state.storedMarks ?? $from.marks()) : $from.marks();
      const on = new Set<Format>();
      for (const [f, name] of MARKS) if (marks.some((m) => m.type.name === name)) on.add(f);
      const parent = $from.parent;
      on.add(parent.type.name === "heading" ? (`h${parent.attrs.level}` as Format) : "p");
      return on;
    },
    selectedText: () => view.state.doc.textBetween(view.state.selection.from, view.state.selection.to, "\n"),
    focus: () => view.focus(),
  };

  return {
    handle,
    view,
    dom: view.dom,
    getMarkdown: () => serialize(view.state.doc),
    setMarkdown(md) {
      silent = true;
      editor.action(replaceAll(md));
      silent = false;
    },
    destroy: () => void editor.destroy(),
  };
}
