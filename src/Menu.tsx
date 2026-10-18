import { Check, Ellipsis, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cx, IconButton } from "./ui";

export type Item = { label: string; icon?: LucideIcon; checked?: boolean; onClick(): void } | "-" | { heading: string };

/** The "…" menu at the right end of the toolbar. */
export default function Menu({ items, footer }: { items: Item[]; footer?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: Event) => !box.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", away);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("pointerdown", away);
      window.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <div ref={box} className="relative">
      <IconButton icon={Ellipsis} label="Menu" onClick={() => setOpen(!open)} />
      {open && (
        <div className="absolute top-full right-0 z-20 mt-1 w-64 rounded-xl border border-line bg-surface p-1 shadow-xl">
          {items.map((item, i) =>
            item === "-" ? (
              <div key={i} className="my-1 border-t border-line" />
            ) : "heading" in item ? (
              <div key={i} className="px-2.5 pt-1.5 pb-0.5 text-[11px] font-semibold text-muted uppercase">
                {item.heading}
              </div>
            ) : (
              <button
                key={i}
                type="button"
                onClick={() => {
                  setOpen(false);
                  item.onClick();
                }}
                className="flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-left hover:bg-black/5 dark:hover:bg-white/8"
              >
                <span className="grid w-4 shrink-0 place-items-center text-muted">
                  {item.checked ? <Check size={15} className="text-accent" /> : item.icon && <item.icon size={15} />}
                </span>
                <span className={cx("truncate", item.checked && "font-medium")}>{item.label}</span>
              </button>
            ),
          )}
          {footer && <div className="mt-1 border-t border-line px-2.5 pt-1.5 pb-1 text-xs text-muted">{footer}</div>}
        </div>
      )}
    </div>
  );
}
