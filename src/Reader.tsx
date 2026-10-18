import { useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from "react";
import { invoke } from "./api";
import { highlightAll } from "./highlight";
import { render } from "./markdown";
import { dirname, resolveLink } from "./paths";

type Props = {
  text: string;
  path: string | null;
  scroll: number;
  onScroll(top: number): void;
  onOpen(path: string, hash: string): void;
  /** an anchor to jump to once the document is shown (a link from another document) */
  takeHash(): string | null;
  boxRef?: RefObject<HTMLDivElement | null>;
};

const scrollTo = (root: HTMLElement, hash: string) => root.querySelector(`[id="${CSS.escape(decodeURIComponent(hash))}"]`)?.scrollIntoView();

export default function Reader({ text, path, scroll, onScroll, onOpen, takeHash, boxRef }: Props) {
  const own = useRef<HTMLDivElement>(null);
  const box = boxRef ?? own;
  const doc = useRef<HTMLDivElement>(null);
  const dir = path && dirname(path);
  const html = useMemo(() => render(text, dir), [text, dir]);

  useEffect(() => {
    highlightAll(doc.current!);
  }, [html]);

  // restore where the reader left this document
  useLayoutEffect(() => {
    const hash = takeHash();
    if (hash) scrollTo(doc.current!, hash);
    else box.current!.scrollTop = scroll;
  }, []);

  const onClick = (e: React.MouseEvent) => {
    const a = (e.target as HTMLElement).closest("a");
    const href = a?.getAttribute("href");
    if (!href) return;
    e.preventDefault();
    if (href.startsWith("#")) scrollTo(doc.current!, href.slice(1));
    else if (/^https?:/i.test(href)) invoke("open_external", { url: href }).catch(() => {});
    else if (dir && !/^[a-z][a-z0-9+.-]*:/i.test(href)) {
      const link = resolveLink(dir, href);
      if (/\.(md|markdown)$/i.test(link.path)) onOpen(link.path, link.hash);
    }
  };

  const timer = useRef<number>(undefined);
  return (
    <div
      ref={box}
      className="h-full overflow-y-auto"
      onScroll={(e) => {
        const top = e.currentTarget.scrollTop;
        clearTimeout(timer.current);
        timer.current = window.setTimeout(() => onScroll(top), 200);
      }}
    >
      <div ref={doc} className="md" onClick={onClick} dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
