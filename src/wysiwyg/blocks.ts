// Block formats of the toolbar with word-processor behaviour: the active one switches off, another list kind converts
// the list, and blocks (rule, table) go after the current block instead of splitting it.
import { lift, setBlockType } from "@milkdown/kit/prose/commands";
import { NodeRange, type Node } from "@milkdown/kit/prose/model";
import { liftListItem, wrapInList } from "@milkdown/kit/prose/schema-list";
import { Selection, TextSelection, type EditorState } from "@milkdown/kit/prose/state";
import { findWrapping } from "@milkdown/kit/prose/transform";
import type { EditorView } from "@milkdown/kit/prose/view";
import type { Format } from "../format";

export type ListKind = "bullet" | "ordered" | "task";

const isList = (node: Node) => node.type.name === "bullet_list" || node.type.name === "ordered_list";
const kindOf = (list: Node): ListKind => (list.type.name === "ordered_list" ? "ordered" : list.firstChild?.attrs.checked != null ? "task" : "bullet");

/**
 * The innermost list around the selection; a selection that starts at the list level or above (a whole item, Ctrl+A,
 * a triple click) means the first list inside it.
 */
function listAt(state: EditorState) {
  const { $from, from, to } = state.selection;
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d);
    if (isList(node)) return { pos: $from.before(d), node, kind: kindOf(node) };
  }
  let found: { pos: number; node: Node; kind: ListKind } | null = null;
  state.doc.nodesBetween(from, to, (node, pos) => {
    if (found) return false;
    if (isList(node)) found = { pos, node, kind: kindOf(node) };
    return !found;
  });
  return found as { pos: number; node: Node; kind: ListKind } | null;
}

const within = (state: EditorState, name: string) => {
  const { $from } = state.selection;
  for (let d = $from.depth; d > 0; d--) if ($from.node(d).type.name === name) return true;
  return false;
};

/** The lists, quote and code block the cursor is in, for the toolbar's active states. */
export function blockState(state: EditorState): Format[] {
  const on: Format[] = [];
  const list = listAt(state);
  if (list) on.push(list.kind);
  if (within(state, "blockquote")) on.push("quote");
  if (state.selection.$from.parent.type.name === "code_block") on.push("codeblock");
  return on;
}

const run = (view: EditorView, command: (state: EditorState, dispatch: EditorView["dispatch"]) => boolean) => command(view.state, view.dispatch);

/** Headings and code can't be list items: they become plain paragraphs first. */
function toParagraph(view: EditorView) {
  const { parent } = view.state.selection.$from;
  if (parent.type.name === "heading" || parent.type.name === "code_block") run(view, setBlockType(view.state.schema.nodes.paragraph));
}

export function toggleList(view: EditorView, kind: ListKind) {
  const { nodes } = view.state.schema;
  const list = listAt(view.state);
  if (list?.kind === kind) {
    if (run(view, liftListItem(nodes.list_item))) return;
    // the selection isn't inside the list's items (Ctrl+A): take the whole list out
    view.dispatch(view.state.tr.setSelection(TextSelection.between(view.state.doc.resolve(list.pos + 1), view.state.doc.resolve(list.pos + list.node.nodeSize - 1))));
    run(view, liftListItem(nodes.list_item));
    return;
  }
  if (!list) {
    toParagraph(view);
    if (!run(view, wrapInList(kind === "ordered" ? nodes.ordered_list : nodes.bullet_list))) return;
  }
  // convert the whole list: its type, and every item (Milkdown keeps the list type on the items too)
  const { pos, node } = listAt(view.state)!;
  const ordered = kind === "ordered";
  const tr = view.state.tr.setNodeMarkup(pos, ordered ? nodes.ordered_list : nodes.bullet_list, { ...(ordered ? { order: 1 } : {}), spread: node.attrs.spread });
  node.forEach((item: Node, offset: number, i: number) => {
    tr.setNodeMarkup(pos + 1 + offset, undefined, {
      ...item.attrs,
      listType: ordered ? "ordered" : "bullet",
      label: ordered ? `${i + 1}.` : "•",
      checked: kind === "task" ? (item.attrs.checked ?? false) : null,
    });
  });
  view.dispatch(tr);
}

export function toggleQuote(view: EditorView) {
  if (within(view.state, "blockquote")) run(view, lift);
  else run(view, (state, dispatch) => {
    // the innermost block that may be quoted: a list item's paragraph can't, its list can (likewise a table)
    const { $from, $to } = state.selection;
    for (let d = $from.sharedDepth($to.pos); d >= 0; d--) {
      const range = new NodeRange($from, $to, d);
      const wrapping = findWrapping(range, state.schema.nodes.blockquote);
      if (wrapping) return dispatch(state.tr.wrap(range, wrapping)), true;
    }
    return false;
  });
}

export function toggleCodeBlock(view: EditorView) {
  const { nodes } = view.state.schema;
  const inCode = view.state.selection.$from.parent.type.name === "code_block";
  run(view, setBlockType(inCode ? nodes.paragraph : nodes.code_block));
}

/** Puts a block after the top-level block around the cursor (an empty paragraph is replaced), cursor inside it. */
export function insertBlock(view: EditorView, node: Node) {
  const { $from } = view.state.selection;
  const top = $from.node(1);
  const empty = top?.type.name === "paragraph" && top.content.size === 0;
  const at = $from.depth ? (empty ? $from.before(1) : $from.after(1)) : $from.pos;
  const tr = empty ? view.state.tr.replaceWith(at, $from.after(1), node) : view.state.tr.insert(at, node);
  tr.setSelection(Selection.near(tr.doc.resolve(Math.min(at + 1, tr.doc.content.size))));
  view.dispatch(tr.scrollIntoView());
}
