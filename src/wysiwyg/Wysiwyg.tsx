// Loaded with React.lazy: until Milkdown is ready the fast read-only render stands in, so text shows at once.
import { useEffect, useRef, useState, type RefObject } from "react";
import type { EditorHandle } from "../format";
import { dirname } from "../paths";
import Reader from "../Reader";
import type { Tab } from "../tabs";
import { t } from "../i18n";
import { checkFidelity, MAX_WYSIWYG } from "./fidelity";
import { createEditor, type Wysiwyg as Instance } from "./setup";

// tab id → the text that passed the check, so switching tabs doesn't check again
const trusted = new Map<string, string>();

async function unsafe(tab: Tab) {
  if (tab.text.length > MAX_WYSIWYG) return t("This file is large, so it opens as markdown.");
  if (trusted.get(tab.id) === tab.text) return null;
  if (!(await checkFidelity(tab.text))) return t("This file uses markdown the visual editor can't keep exactly, so it opens as markdown.");
  trusted.set(tab.id, tab.text);
  return null;
}

type Props = {
  tab: Tab;
  handleRef: RefObject<EditorHandle | null>;
  boxRef: RefObject<HTMLDivElement | null>;
  onChange(md: string): void;
  onOpenLink(href: string): void;
  onLink(): void;
  /** an anchor to jump to once the document is shown (a link from another document) */
  takeHash(): string | null;
  onScroll(top: number): void;
  /** the selection or the document changed (toolbar states) */
  onUpdate(): void;
  /** the document can't go through the visual editor without losing something */
  onUnsafe(notice: string): void;
};

export default function Wysiwyg({ tab, handleRef, boxRef, onChange, onOpenLink, onLink, takeHash, onScroll, onUpdate, onUnsafe }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const editor = useRef<Instance | null>(null);
  const [ready, setReady] = useState(false);
  // the markdown this editor produced itself; any other text (reload from disk) replaces the document
  const own = useRef(tab.text);
  const props = useRef({ onChange, onOpenLink, onLink, onUpdate });
  props.current = { onChange, onOpenLink, onLink, onUpdate };

  useEffect(() => {
    let alive = true;
    // nothing is editable before the check: an edit would already write the document back
    unsafe(tab).then((notice) => {
      if (!alive) return;
      if (notice) return onUnsafe(notice);
      return createEditor({
        root: host.current!,
        markdown: tab.text,
        dir: tab.path && dirname(tab.path),
        onChange: (md) => {
          own.current = md;
          props.current.onChange(md);
          props.current.onUpdate();
        },
        onOpenLink: (href) => props.current.onOpenLink(href),
        onLink: () => props.current.onLink(),
      }).then((e) => {
        if (!alive) return e.destroy();
        editor.current = e;
        handleRef.current = e.handle;
        setReady(true);
      });
    });
    const selection = () => editor.current?.view.hasFocus() && props.current.onUpdate();
    document.addEventListener("selectionchange", selection);
    return () => {
      alive = false;
      document.removeEventListener("selectionchange", selection);
      handleRef.current = null;
      editor.current?.destroy();
      editor.current = null;
    };
  }, []);

  // once the editor is shown (a hidden element can't take focus): focus it, then restore the scroll or jump to an anchor
  useEffect(() => {
    const e = editor.current;
    if (!ready || !e) return;
    e.view.focus();
    const hash = takeHash();
    const target = hash && e.dom.querySelector(`[id="${CSS.escape(decodeURIComponent(hash))}"]`);
    if (target) target.scrollIntoView();
    else if (boxRef.current) boxRef.current.scrollTop = tab.scroll;
  }, [ready]);

  useEffect(() => {
    if (!editor.current || tab.text === own.current) return;
    own.current = tab.text;
    editor.current.setMarkdown(tab.text);
  }, [tab.text]);

  const timer = useRef<number>(undefined);
  return (
    <div
      ref={boxRef}
      className="relative h-full overflow-y-auto"
      onScroll={(e) => {
        const top = e.currentTarget.scrollTop;
        clearTimeout(timer.current);
        timer.current = window.setTimeout(() => onScroll(top), 200);
      }}
    >
      <div ref={host} className={ready ? "wysiwyg" : "hidden"} />
      {!ready && <Reader text={tab.text} path={tab.path} scroll={tab.scroll} onScroll={() => {}} onOpen={() => {}} takeHash={() => null} />}
    </div>
  );
}
