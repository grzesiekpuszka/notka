import { Plus, X } from "lucide-react";
import { useRef, useState, type CSSProperties } from "react";
import { t } from "./i18n";
import { basename } from "./paths";
import { dirty, type State, type Tab } from "./tabs";
import { cx } from "./ui";

export const tabName = (tab: Tab) => (tab.path ? basename(tab.path) : tab.untitled > 1 ? `${t("Untitled")} ${tab.untitled}` : t("Untitled"));

// the window's own buttons (titleBarOverlay) sit on the right of this row
const drag = { WebkitAppRegion: "drag" } as CSSProperties;
const noDrag = { WebkitAppRegion: "no-drag" } as CSSProperties;

type Props = {
  state: State;
  onActivate(id: string): void;
  onClose(id: string): void;
  onNew(): void;
  onMove(id: string, to: number): void;
};

export default function TabBar({ state, onActivate, onClose, onNew, onMove }: Props) {
  const strip = useRef<HTMLDivElement>(null);
  const [dragged, setDragged] = useState<string | null>(null);

  // index the dragged tab would take when dropped at clientX
  const dropIndex = (x: number) => {
    const tabs = [...strip.current!.querySelectorAll<HTMLElement>("[data-tab]")].filter((el) => el.dataset.tab !== dragged);
    const i = tabs.findIndex((el) => x < el.getBoundingClientRect().left + el.offsetWidth / 2);
    return i < 0 ? tabs.length : i;
  };

  return (
    <div className="flex h-10 shrink-0 items-end pl-2" style={{ ...drag, paddingRight: "calc(100vw - env(titlebar-area-width, calc(100vw - 138px)))" }}>
      <div
        ref={strip}
        className="flex min-w-0 items-end gap-0.5 overflow-x-auto [scrollbar-width:none]"
        onWheel={(e) => (strip.current!.scrollLeft += e.deltaY)}
        onDragOver={(e) => dragged && e.preventDefault()}
        onDrop={(e) => {
          if (!dragged) return;
          e.preventDefault();
          e.stopPropagation();
          onMove(dragged, dropIndex(e.clientX));
          setDragged(null);
        }}
      >
        {state.tabs.map((tab) => {
          const on = tab.id === state.active;
          return (
            <div
              key={tab.id}
              data-tab={tab.id}
              draggable
              title={tab.path ?? tabName(tab)}
              onDragStart={(e) => {
                setDragged(tab.id);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragEnd={() => setDragged(null)}
              onMouseDown={(e) => e.button === 0 && onActivate(tab.id)}
              onAuxClick={(e) => e.button === 1 && onClose(tab.id)}
              style={noDrag}
              className={cx(
                "group flex h-[34px] w-[200px] min-w-[110px] shrink cursor-default items-center gap-2 rounded-t-lg pr-1.5 pl-3 text-[13px]",
                on ? "bg-surface text-fg shadow-[0_0_0_1px_var(--c-border)] [clip-path:inset(-2px_-2px_0_-2px)]" : "text-muted hover:bg-black/4 dark:hover:bg-white/5",
                dragged === tab.id && "opacity-50",
              )}
            >
              <span className="min-w-0 flex-1 truncate">{tabName(tab)}</span>
              {dirty(tab) && <span className="size-[7px] shrink-0 rounded-full bg-accent group-hover:hidden" />}
              <button
                type="button"
                aria-label={t("Close (Ctrl+W)")}
                title={t("Close (Ctrl+W)")}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => onClose(tab.id)}
                className={cx(
                  "size-[22px] shrink-0 place-items-center rounded text-muted hover:bg-black/5 hover:text-fg dark:hover:bg-white/8",
                  on && !dirty(tab) ? "grid" : "hidden group-hover:grid",
                )}
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
      <button
        type="button"
        aria-label={t("New document (Ctrl+N)")}
        title={t("New document (Ctrl+N)")}
        onClick={onNew}
        style={noDrag}
        className="mb-0.5 ml-1 grid size-8 shrink-0 place-items-center rounded-md text-muted hover:bg-black/5 hover:text-fg dark:hover:bg-white/8"
      >
        <Plus size={16} />
      </button>
    </div>
  );
}
