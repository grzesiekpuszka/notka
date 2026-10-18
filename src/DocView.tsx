import { lazy, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { invoke, type Encoding, type Mode } from "./api";
import FindBar from "./FindBar";
import type { EditorHandle } from "./format";
import { t } from "./i18n";
import LinkPopover from "./LinkPopover";
import { dirname, relativePath } from "./paths";
import Reader, { followLink } from "./Reader";
import type { Action, Tab } from "./tabs";
import Toolbar from "./Toolbar";
import { Button } from "./ui";

const Editor = lazy(() => import("./Editor"));
const Wysiwyg = lazy(() => import("./wysiwyg/Wysiwyg"));

const encodings: Record<Encoding, string> = {
  utf8: "UTF-8",
  utf8bom: "UTF-8 BOM",
  utf16le: "UTF-16 LE",
  utf16be: "UTF-16 BE",
  cp1250: "Windows-1250",
};

type Props = {
  tab: Tab;
  dispatch(a: Action): void;
  onOpen(path: string, hash: string): void;
  takeHash(): string | null;
  onReload(): void;
  /** > 0 while the find bar is open; a new value focuses it again */
  finding: number;
  onFindClose(): void;
  menu: ReactNode;
  update: ReactNode;
};

/** Big documents re-render the preview after a pause in typing instead of on every key. */
function usePreview(text: string) {
  const [preview, setPreview] = useState(text);
  useEffect(() => {
    if (text.length < 100_000) return setPreview(text);
    const timer = setTimeout(() => setPreview(text), 150);
    return () => clearTimeout(timer);
  }, [text]);
  return text.length < 100_000 ? text : preview;
}

const looksLikeUrl = (s: string) => /^(https?:\/\/|mailto:|#|\.{0,2}\/)/i.test(s.trim());

export default function DocView({ tab, dispatch, onOpen, takeHash, onReload, finding, onFindClose, menu, update }: Props) {
  const [cursor, setCursor] = useState([1, 1]);
  const [tick, setTick] = useState(0);
  const [linking, setLinking] = useState<string | null>(null);
  const handle = useRef<EditorHandle | null>(null);
  const preview = useRef<HTMLDivElement>(null);
  const text = usePreview(tab.text);
  const findRoot = useCallback(() => preview.current?.querySelector<HTMLElement>(".md") ?? null, []);
  const find = finding > 0 && <FindBar root={findRoot} text={text} focus={finding} onClose={onFindClose} />;
  const setMode = (mode: Mode) => dispatch({ type: "setMode", id: tab.id, mode });

  const link = () => {
    const selected = handle.current?.selectedText() ?? "";
    setLinking(looksLikeUrl(selected) ? selected : "");
  };
  const image = async () => {
    const file = await invoke<string | null>("pick_image");
    if (!file) return;
    handle.current?.run("image", tab.path ? relativePath(dirname(tab.path), file) : file.replace(/\\/g, "/"));
    handle.current?.focus();
  };

  const reader = (
    <Reader
      key={tab.id}
      text={text}
      path={tab.path}
      scroll={tab.scroll}
      onScroll={(scroll) => dispatch({ type: "scroll", id: tab.id, scroll })}
      onOpen={onOpen}
      takeHash={takeHash}
      boxRef={preview}
    />
  );

  return (
    <div className="flex h-full flex-col">
      <Toolbar handle={handle.current} tick={tick} mode={tab.mode} onMode={setMode} onLink={link} onImage={image} menu={menu} update={update} />
      <div className="relative">
        {linking !== null && (
          <LinkPopover
            initial={linking}
            onClose={() => {
              setLinking(null);
              handle.current?.focus();
            }}
            onSubmit={(url) => {
              setLinking(null);
              handle.current?.run("link", url);
              handle.current?.focus();
            }}
          />
        )}
      </div>
      {tab.notice && <div className="shrink-0 border-b border-line bg-accent-soft px-4 py-2">{tab.notice}</div>}
      {tab.changed && (
        <div className="flex shrink-0 items-center gap-2 border-b border-line bg-warning-soft py-1.5 pr-2.5 pl-4">
          <span className="flex-1">{t("The file changed on disk.")}</span>
          <Button onClick={onReload}>{t("Reload")}</Button>
          <Button onClick={() => dispatch({ type: "keepMine", id: tab.id })}>{t("Keep mine")}</Button>
        </div>
      )}
      {tab.missing && (
        <div className="shrink-0 border-b border-line bg-surface-2 px-4 py-2.5 text-muted">{t("The file can't be found or read. Save it to keep it.")}</div>
      )}
      {tab.mode === "markdown" ? (
        <div className="flex min-h-0 flex-1">
          <Suspense fallback={<div className="flex-1 border-r border-line" />}>
            <Editor
              key={tab.id}
              text={tab.text}
              handleRef={handle}
              onLink={link}
              onChange={(text) => dispatch({ type: "edit", id: tab.id, text })}
              onCursor={(line, col) => {
                setCursor([line, col]);
                setTick((n) => n + 1);
              }}
              onScroll={(ratio) => {
                const box = preview.current;
                if (box) box.scrollTop = ratio * (box.scrollHeight - box.clientHeight);
              }}
            />
          </Suspense>
          <div className="relative min-w-0 flex-1">
            {find}
            {reader}
          </div>
        </div>
      ) : (
        <div className="relative min-h-0 flex-1">
          {find}
          <Suspense fallback={<Reader text={text} path={tab.path} scroll={tab.scroll} onScroll={() => {}} onOpen={onOpen} takeHash={() => null} />}>
            <Wysiwyg
              key={tab.id}
              tab={tab}
              handleRef={handle}
              boxRef={preview}
              onChange={(text) => dispatch({ type: "edit", id: tab.id, text })}
              onOpenLink={(href) => followLink(href, tab.path && dirname(tab.path), preview.current!, onOpen)}
              onLink={link}
              takeHash={takeHash}
              onScroll={(scroll) => dispatch({ type: "scroll", id: tab.id, scroll })}
              onUpdate={() => setTick((n) => n + 1)}
              onUnsafe={(notice) => dispatch({ type: "setMode", id: tab.id, mode: "markdown", notice })}
            />
          </Suspense>
        </div>
      )}
      <div className="flex h-6 shrink-0 items-center gap-4 border-t border-line px-3.5 text-[11px] text-muted">
        {tab.mode === "markdown" && <span>{t("Ln {line}, Col {col}", { line: cursor[0], col: cursor[1] })}</span>}
        <span>{t("{n} words", { n: tab.text.split(/\s+/).filter(Boolean).length })}</span>
        <span>{encodings[tab.meta.encoding]}</span>
      </div>
    </div>
  );
}
