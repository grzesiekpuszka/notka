// Loaded with React.lazy: until Milkdown is ready the fast read-only render stands in, so text shows at once.
import { useEffect, useRef, useState, type RefObject } from "react";
import type { EditorHandle } from "../format";
import { dirname } from "../paths";
import Reader from "../Reader";
import type { Tab } from "../tabs";
import { createEditor, type Wysiwyg as Instance } from "./setup";

type Props = {
  tab: Tab;
  handleRef: RefObject<EditorHandle | null>;
  boxRef: RefObject<HTMLDivElement | null>;
  onChange(md: string): void;
  onOpenLink(href: string): void;
  onScroll(top: number): void;
  /** the selection or the document changed (toolbar states) */
  onUpdate(): void;
};

export default function Wysiwyg({ tab, handleRef, boxRef, onChange, onOpenLink, onScroll, onUpdate }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const editor = useRef<Instance | null>(null);
  const [ready, setReady] = useState(false);
  // the markdown this editor produced itself; any other text (reload from disk) replaces the document
  const own = useRef(tab.text);
  const props = useRef({ onChange, onOpenLink, onUpdate });
  props.current = { onChange, onOpenLink, onUpdate };

  useEffect(() => {
    let alive = true;
    createEditor({
      root: host.current!,
      markdown: tab.text,
      dir: tab.path && dirname(tab.path),
      onChange: (md) => {
        own.current = md;
        props.current.onChange(md);
        props.current.onUpdate();
      },
      onOpenLink: (href) => props.current.onOpenLink(href),
    }).then((e) => {
      if (!alive) return e.destroy();
      editor.current = e;
      handleRef.current = e.handle;
      setReady(true);
      requestAnimationFrame(() => {
        if (boxRef.current) boxRef.current.scrollTop = tab.scroll;
      });
      e.view.focus();
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
