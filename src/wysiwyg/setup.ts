// The visual (WYSIWYG) editor: Milkdown, i.e. ProseMirror with markdown as its source format.
import { defaultValueCtx, Editor, editorViewCtx, editorViewOptionsCtx, remarkStringifyOptionsCtx, rootCtx, serializerCtx } from "@milkdown/kit/core";
import { clipboard } from "@milkdown/kit/plugin/clipboard";
import { history } from "@milkdown/kit/plugin/history";
import {
  commonmark,
  createCodeBlockCommand,
  imageSchema,
  inlineCodeKeymap,
  insertHrCommand,
  insertImageCommand,
  toggleEmphasisCommand,
  toggleInlineCodeCommand,
  toggleLinkCommand,
  remarkPreserveEmptyLinePlugin,
  toggleStrongCommand,
  turnIntoTextCommand,
  updateLinkCommand,
  wrapInBlockquoteCommand,
  wrapInBulletListCommand,
  wrapInHeadingCommand,
  wrapInOrderedListCommand,
} from "@milkdown/kit/preset/commonmark";
import { addRowAfterCommand, gfm, goToNextTableCellCommand, insertTableCommand, toggleStrikethroughCommand } from "@milkdown/kit/preset/gfm";
import type { Node } from "@milkdown/kit/prose/model";
import { Plugin, TextSelection } from "@milkdown/kit/prose/state";
import type { EditorView } from "@milkdown/kit/prose/view";
import { $prose, $view, callCommand, replaceAll } from "@milkdown/kit/utils";
import type { EditorHandle, Format } from "../format";
import { imageUrl, resolveLink } from "../paths";
import { frontmatter } from "./frontmatter";
import { codeHighlight } from "./highlight";

export type WysiwygOptions = {
  root: HTMLElement;
  markdown: string;
  dir: string | null;
  onChange(md: string): void;
  onOpenLink(href: string): void;
  /** Ctrl+K: ask for a link address */
  onLink?(): void;
};

export type Wysiwyg = {
  handle: EditorHandle;
  view: EditorView;
  dom: HTMLElement;
  getMarkdown(): string;
  setMarkdown(md: string): void;
  /** reports pending edits now; the markdown, or null if there was nothing to report */
  flush(): string | null;
  destroy(): void;
};

// remark escapes every "[" and "*"; these can't start a link or emphasis, so they stay as the user wrote them
const relaxEscapes = (md: string) =>
  md.replace(/\\\[(?![^\]\n]*\][(\[:])/g, "[").replace(/(^|[ \t])\\\*(?=[ \t]|$)/gm, "$1*");

// a local file: no scheme (a drive letter is not one), not protocol-relative
const local = (src: string) => !/^([a-z][a-z0-9+.-]+:|\/\/)/i.test(src);

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
  // serializing the whole document is the slow part of an edit: it happens after a pause in typing, or on flush
  let pending = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const report = () => {
    clearTimeout(timer);
    if (!pending) return null;
    pending = false;
    const md = serialize(view.state.doc);
    o.onChange(md);
    return md;
  };
  let serialize: (doc: Node) => string = () => "";
  const touch = () => ((touched = true), false);

  const watch = $prose(
    () =>
      new Plugin({
        props: {
          handleDOMEvents: {
            keydown: touch,
            beforeinput: touch,
            paste: touch,
            drop: touch,
            cut: touch,
            // like Word: a click edits the link text, Ctrl+click follows it
            click: (view, e) => {
              // the checkbox of a task is drawn in the item's left gutter
              const task = (e.target as HTMLElement).closest<HTMLElement>('li[data-item-type="task"]');
              if (task && e.clientX < task.getBoundingClientRect().left) {
                const pos = view.posAtDOM(task, 0) - 1;
                touched = true;
                view.dispatch(view.state.tr.setNodeAttribute(pos, "checked", task.dataset.checked !== "true"));
                return true;
              }
              const a = (e.target as HTMLElement).closest("a");
              if (!a) return false;
              e.preventDefault();
              if (e.ctrlKey) o.onOpenLink(a.getAttribute("href") ?? "");
              return e.ctrlKey;
            },
          },
          handleKeyDown: (view, e) => {
            if (e.ctrlKey && !e.altKey && e.key.toLowerCase() === "k") return o.onLink?.(), true;
            if (e.key !== "Tab" || e.shiftKey) return false;
            // Tab in the last cell of a table adds a row (the table keymap only moves between existing cells)
            const { $head } = view.state.selection;
            for (let d = $head.depth; d > 0; d--) {
              if ($head.node(d).type.name !== "table") continue;
              const table = $head.node(d);
              const last = table.lastChild!.lastChild!;
              if ($head.end(d) - 2 - last.nodeSize > $head.pos) return false;
              touched = true;
              const done = command(addRowAfterCommand.key) && command(goToNextTableCellCommand.key);
              report();
              return done;
            }
            return false;
          },
        },
        view: () => ({
          update: (view, prev) => {
            if (!touched || silent || view.state.doc.eq(prev.doc)) return;
            pending = true;
            clearTimeout(timer);
            timer = setTimeout(report, 300);
          },
        }),
      }),
  );

  // relative images show from the document's folder; the markdown keeps the path as written
  const images = $view(imageSchema.node, () => (node) => {
    const img = document.createElement("img");
    const src: string = node.attrs.src;
    img.src = local(src) && (o.dir || /^[a-z]:[\\/]/i.test(src)) ? imageUrl(resolveLink(o.dir ?? "", src).path) : src;
    img.alt = node.attrs.alt;
    if (node.attrs.title) img.title = node.attrs.title;
    return { dom: img };
  });

  const editor = await Editor.make()
    .config((ctx) => {
      ctx.set(rootCtx, o.root);
      ctx.set(defaultValueCtx, o.markdown);
      ctx.update(editorViewOptionsCtx, (prev) => ({ ...prev, attributes: { class: "md" } }));
      // one house style when the document is written back: "-" bullets, "*" emphasis, "**" strong
      ctx.update(remarkStringifyOptionsCtx, (prev) => ({
        ...prev,
        bullet: "-" as const,
        emphasis: "*" as const,
        strong: "*" as const,
        rule: "-" as const,
        handlers: { ...prev.handlers, text: (...args: any[]) => relaxEscapes((prev.handlers!.text as any)(...args)) },
      }));
      // Ctrl+E switches between WYSIWYG and Markdown in this app
      ctx.update(inlineCodeKeymap.ctx.key, (prev) => ({ ...prev, ToggleInlineCode: { ...prev.ToggleInlineCode, shortcuts: [] } }));
    })
    // without it empty paragraphs would be written as <br />
    .use(commonmark.filter((p) => p !== remarkPreserveEmptyLinePlugin.plugin && p !== remarkPreserveEmptyLinePlugin.options))
    .use(gfm)
    .use(frontmatter)
    .use(history)
    .use(clipboard)
    .use(watch)
    .use(images)
    .use(codeHighlight)
    .create();

  const view = editor.ctx.get(editorViewCtx);
  serialize = (doc) => editor.ctx.get(serializerCtx)(doc);
  const command = (key: Parameters<typeof callCommand>[0], payload?: unknown) => editor.action(callCommand(key, payload));
  // blocks go after the selection instead of replacing it
  const collapse = () => view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, view.state.selection.to)));
  const inList = () => {
    const { $from } = view.state.selection;
    for (let d = $from.depth; d > 0; d--) if ($from.node(d).type.name === "list_item") return $from.before(d);
    return -1;
  };

  const handle: EditorHandle = {
    run(f, arg) {
      touched = true;
      if (f === "bold") command(toggleStrongCommand.key);
      else if (f === "italic") command(toggleEmphasisCommand.key);
      else if (f === "strike") command(toggleStrikethroughCommand.key);
      else if (f === "code") command(toggleInlineCodeCommand.key);
      else if (f === "p") command(turnIntoTextCommand.key);
      else if (f === "h1" || f === "h2" || f === "h3") command(wrapInHeadingCommand.key, Number(f[1]));
      else if (f === "bullet") command(wrapInBulletListCommand.key);
      else if (f === "ordered") command(wrapInOrderedListCommand.key);
      else if (f === "quote") command(wrapInBlockquoteCommand.key);
      else if (f === "codeblock") command(createCodeBlockCommand.key);
      else if (f === "task") {
        if (inList() < 0) command(wrapInBulletListCommand.key);
        const pos = inList();
        if (pos >= 0) view.dispatch(view.state.tr.setNodeAttribute(pos, "checked", false));
      } else if (f === "hr") {
        collapse();
        command(insertHrCommand.key);
      } else if (f === "table") {
        collapse();
        command(insertTableCommand.key, { row: 3, col: 3 });
      } else if (f === "image") command(insertImageCommand.key, { src: arg, alt: "" });
      else if (f === "link") {
        if (view.state.selection.empty) {
          const { from } = view.state.selection;
          view.dispatch(view.state.tr.insertText(arg!, from).addMark(from, from + arg!.length, view.state.schema.marks.link.create({ href: arg })));
        } else if (view.state.doc.rangeHasMark(view.state.selection.from, view.state.selection.to, view.state.schema.marks.link))
          command(updateLinkCommand.key, { href: arg });
        else command(toggleLinkCommand.key, { href: arg });
      }
      report();
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
    flush: report,
    setMarkdown(md) {
      silent = true;
      editor.action(replaceAll(md));
      silent = false;
    },
    destroy: () => {
      clearTimeout(timer);
      void editor.destroy();
    },
  };
}
