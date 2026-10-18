import { Check, Pencil, Save } from "lucide-react";
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import type { Encoding } from "./api";
import { t } from "./i18n";
import FindBar from "./FindBar";
import { dirname } from "./paths";
import Reader from "./Reader";
import { tabName } from "./TabBar";
import type { Action, Tab } from "./tabs";
import { Button } from "./ui";

const Editor = lazy(() => import("./Editor"));

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
  onSave(): void;
  onReload(): void;
  /** > 0 while the find bar is open; a new value focuses it again */
  finding: number;
  onFindClose(): void;
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

export default function DocView({ tab, dispatch, onOpen, takeHash, onSave, onReload, finding, onFindClose }: Props) {
  const [cursor, setCursor] = useState([1, 1]);
  const preview = useRef<HTMLDivElement>(null);
  const text = usePreview(tab.text);
  const findRoot = useCallback(() => preview.current?.querySelector<HTMLElement>(".md") ?? null, []);
  const find = finding > 0 && <FindBar root={findRoot} text={text} focus={finding} onClose={onFindClose} />;
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
      <div className="flex h-[46px] shrink-0 items-center gap-2 border-b border-line pr-2.5 pl-4">
        <span className="shrink-0 font-semibold">{tabName(tab)}</span>
        {tab.path && <span className="truncate text-xs text-muted">{dirname(tab.path)}</span>}
        <span className="flex-1" />
        {tab.mode === "markdown" ? (
          <>
            <Button icon={Save} title={t("Save (Ctrl+S)")} aria-label={t("Save (Ctrl+S)")} onClick={onSave} />
            <Button variant="primary" icon={Check} title={t("Done (Ctrl+E)")} aria-label={t("Done (Ctrl+E)")} onClick={() => dispatch({ type: "setMode", id: tab.id, mode: tab.mode === "wysiwyg" ? "markdown" : "wysiwyg" })} />
          </>
        ) : (
          <Button variant="primary" icon={Pencil} title={t("Edit (Ctrl+E)")} aria-label={t("Edit (Ctrl+E)")} onClick={() => dispatch({ type: "setMode", id: tab.id, mode: tab.mode === "wysiwyg" ? "markdown" : "wysiwyg" })} />
        )}
      </div>
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
        <>
          <div className="flex min-h-0 flex-1">
            <Suspense fallback={<div className="flex-1 border-r border-line" />}>
              <Editor
                key={tab.id}
                text={tab.text}
                onChange={(text) => dispatch({ type: "edit", id: tab.id, text })}
                onCursor={(line, col) => setCursor([line, col])}
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
          <div className="flex h-6 shrink-0 items-center gap-4 border-t border-line px-3.5 text-[11px] text-muted">
            <span>{t("Ln {line}, Col {col}", { line: cursor[0], col: cursor[1] })}</span>
            <span>{t("{n} words", { n: tab.text.split(/\s+/).filter(Boolean).length })}</span>
            <span>{encodings[tab.meta.encoding]}</span>
          </div>
        </>
      ) : (
        <div className="relative min-h-0 flex-1">
          {find}
          {reader}
        </div>
      )}
    </div>
  );
}
