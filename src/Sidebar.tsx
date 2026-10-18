import { FileText, PanelLeft, Plus, X } from "lucide-react";
import type { ReactNode } from "react";
import { t } from "./i18n";
import { basename, dirname } from "./paths";
import { dirty, type State, type Tab } from "./tabs";
import { cx, IconButton } from "./ui";

export const tabName = (tab: Tab) => (tab.path ? basename(tab.path) : tab.untitled > 1 ? `${t("Untitled")} ${tab.untitled}` : t("Untitled"));

type Props = {
  state: State;
  onActivate(id: string): void;
  onClose(id: string): void;
  onNew(): void;
  onCollapse(): void;
  footer: ReactNode;
  notice?: ReactNode;
};

export default function Sidebar({ state, onActivate, onClose, onNew, onCollapse, footer, notice }: Props) {
  const mini = state.collapsed;
  return (
    <aside className={cx("flex shrink-0 flex-col gap-0.5 px-2 pb-2", mini ? "w-[52px] items-center" : "w-60")}>
      <div className={cx("mb-1 flex h-10 items-center", mini ? "justify-center" : "justify-between")}>
        <IconButton icon={PanelLeft} label={mini ? t("Expand sidebar") : t("Collapse sidebar")} onClick={onCollapse} />
        {!mini && <IconButton icon={Plus} label={t("New document (Ctrl+N)")} onClick={onNew} />}
      </div>
      <nav className={cx("flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto", mini && "items-center")}>
        {state.tabs.map((tab) => {
          const on = tab.id === state.active;
          const name = tabName(tab);
          return (
            <div
              key={tab.id}
              title={mini ? name : tab.path ?? name}
              onClick={() => onActivate(tab.id)}
              onAuxClick={(e) => e.button === 1 && onClose(tab.id)}
              className={cx(
                "group relative flex h-11 shrink-0 cursor-default items-center gap-2.5 rounded-lg",
                mini ? "w-[38px] justify-center" : "px-2.5",
                on ? "bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.06)] ring-1 ring-line" : "hover:bg-black/4 dark:hover:bg-white/5",
              )}
            >
              <FileText size={16} className={cx("shrink-0", on ? "text-accent" : "text-muted")} />
              {!mini && (
                <div className="min-w-0 flex-1 leading-tight">
                  <div className="truncate text-[13px]">{name}</div>
                  {tab.path && <div className="truncate text-[11px] text-muted">{dirname(tab.path)}</div>}
                </div>
              )}
              {dirty(tab) && (
                <span className={cx("size-[7px] shrink-0 rounded-full bg-accent", mini ? "absolute top-1.5 right-1.5" : "group-hover:hidden")} />
              )}
              {!mini && (
                <button
                  type="button"
                  aria-label={t("Close (Ctrl+W)")}
                  title={t("Close (Ctrl+W)")}
                  onClick={(e) => {
                    e.stopPropagation();
                    onClose(tab.id);
                  }}
                  className="hidden size-6 shrink-0 place-items-center rounded text-muted group-hover:grid hover:bg-black/5 hover:text-fg dark:hover:bg-white/8"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          );
        })}
      </nav>
      {!mini && notice}
      <div className={cx("flex items-center gap-0.5", mini && "flex-col")}>{footer}</div>
    </aside>
  );
}
