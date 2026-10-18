// The raw markdown editor, loaded with React.lazy the first time a tab switches to Markdown mode.
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import { EditorState, Prec } from "@codemirror/state";
import { drawSelection, EditorView, keymap } from "@codemirror/view";
import { tags } from "@lezer/highlight";
import { useEffect, useRef, type RefObject } from "react";
import type { EditorHandle, Format } from "./format";
import { format } from "./mdcommands";

type Props = {
  text: string;
  onChange(text: string): void;
  onCursor(line: number, col: number): void;
  onScroll(ratio: number): void;
  onLink(): void;
  handleRef: RefObject<EditorHandle | null>;
};

const HEADING = /^(#{1,3}) /;

/** Applies a toolbar command as the smallest change, so undo steps stay small and the cursor stays put. */
function apply(v: EditorView, f: Format, arg?: string) {
  const old = v.state.doc.toString();
  const { from, to } = v.state.selection.main;
  const e = format(old, [from, to], f, arg);
  let start = 0;
  while (start < old.length && start < e.text.length && old[start] === e.text[start]) start++;
  let end = 0;
  while (end < old.length - start && end < e.text.length - start && old[old.length - 1 - end] === e.text[e.text.length - 1 - end]) end++;
  v.dispatch({ changes: { from: start, to: old.length - end, insert: e.text.slice(start, e.text.length - end) }, selection: { anchor: e.sel[0], head: e.sel[1] } });
}

const theme = EditorView.theme({
  "&": { height: "100%", color: "var(--c-text)", backgroundColor: "var(--c-surface)", fontSize: "13px" },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": { fontFamily: "var(--font-mono)", lineHeight: "1.6", padding: "12px 0" },
  ".cm-content": { padding: "0 18px", caretColor: "var(--c-accent)" },
  ".cm-cursor": { borderLeftColor: "var(--c-accent)", borderLeftWidth: "2px" },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": { backgroundColor: "var(--c-accent-soft) !important" },
  ".cm-selectionMatch": { backgroundColor: "color-mix(in srgb, var(--c-accent) 18%, transparent)" },
  ".cm-panels": { backgroundColor: "var(--c-surface-2)", color: "var(--c-text)", borderColor: "var(--c-border)" },
  ".cm-searchMatch": { backgroundColor: "color-mix(in srgb, var(--c-warning) 30%, transparent)" },
  ".cm-searchMatch-selected": { backgroundColor: "color-mix(in srgb, var(--c-accent) 35%, transparent)" },
  ".cm-textfield, .cm-button": { borderRadius: "6px", border: "1px solid var(--c-border)", background: "var(--c-surface)", color: "var(--c-text)" },
});

const colors = HighlightStyle.define([
  { tag: tags.heading, fontWeight: "600", color: "var(--c-accent)" },
  { tag: [tags.processingInstruction, tags.contentSeparator, tags.list, tags.quote, tags.meta], color: "var(--c-muted)" },
  { tag: tags.strong, fontWeight: "600" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.strikethrough, textDecoration: "line-through" },
  { tag: [tags.link, tags.url], color: "var(--c-accent)" },
  { tag: tags.monospace, color: "var(--c-success)" },
]);

export default function Editor({ text, onChange, onCursor, onScroll, onLink, handleRef }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView>(null);
  // the text this editor produced itself; anything else (a reload from disk) replaces the document
  const own = useRef(text);
  const props = useRef({ onChange, onCursor, onScroll, onLink });
  props.current = { onChange, onCursor, onScroll, onLink };

  useEffect(() => {
    const v = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: text,
        extensions: [
          history(),
          drawSelection(),
          highlightSelectionMatches(),
          // ahead of the default keymap: there Mod-i selects the parent syntax node
          Prec.highest(
            keymap.of([
              { key: "Mod-b", run: (v) => (apply(v, "bold"), true) },
              { key: "Mod-i", run: (v) => (apply(v, "italic"), true) },
              { key: "Mod-k", run: () => (props.current.onLink(), true) },
            ]),
          ),
          keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, indentWithTab]),
          markdown(),
          syntaxHighlighting(colors),
          EditorView.lineWrapping,
          theme,
          EditorView.updateListener.of((u) => {
            if (u.docChanged) {
              own.current = u.state.doc.toString();
              props.current.onChange(own.current);
            }
            if (u.docChanged || u.selectionSet) {
              const head = u.state.selection.main.head;
              const line = u.state.doc.lineAt(head);
              props.current.onCursor(line.number, head - line.from + 1);
            }
          }),
        ],
      }),
    });
    v.scrollDOM.addEventListener("scroll", () => {
      const s = v.scrollDOM;
      props.current.onScroll(s.scrollHeight > s.clientHeight ? s.scrollTop / (s.scrollHeight - s.clientHeight) : 0);
    });
    view.current = v;
    handleRef.current = {
      run: (f, arg) => apply(v, f, arg),
      active: () => {
        const m = HEADING.exec(v.state.doc.lineAt(v.state.selection.main.head).text);
        return new Set<Format>([m ? (`h${m[1].length}` as Format) : "p"]);
      },
      selectedText: () => v.state.sliceDoc(v.state.selection.main.from, v.state.selection.main.to),
      focus: () => v.focus(),
    };
    // the toolbar picks the new editor up
    props.current.onCursor(1, 1);
    v.focus();
    return () => {
      handleRef.current = null;
      v.destroy();
    };
  }, []);

  useEffect(() => {
    const v = view.current;
    if (!v || text === own.current) return;
    own.current = text;
    v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: text } });
  }, [text]);

  return <div ref={host} className="h-full min-w-0 flex-1 border-r border-line" />;
}
