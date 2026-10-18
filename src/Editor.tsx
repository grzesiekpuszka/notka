// Loaded with React.lazy on the first Edit, so CodeMirror never slows down opening a document for reading.
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import { EditorState } from "@codemirror/state";
import { drawSelection, EditorView, keymap } from "@codemirror/view";
import { tags } from "@lezer/highlight";
import { useEffect, useRef } from "react";

type Props = {
  text: string;
  onChange(text: string): void;
  onCursor(line: number, col: number): void;
  onScroll(ratio: number): void;
};

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

export default function Editor({ text, onChange, onCursor, onScroll }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView>(null);
  // the text this editor produced itself; anything else (a reload from disk) replaces the document
  const own = useRef(text);
  const props = useRef({ onChange, onCursor, onScroll });
  props.current = { onChange, onCursor, onScroll };

  useEffect(() => {
    const v = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: text,
        extensions: [
          history(),
          drawSelection(),
          highlightSelectionMatches(),
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
    v.focus();
    return () => v.destroy();
  }, []);

  useEffect(() => {
    const v = view.current;
    if (!v || text === own.current) return;
    own.current = text;
    v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: text } });
  }, [text]);

  return <div ref={host} className="h-full min-w-0 flex-1 border-r border-line" />;
}
