import { ChevronDown, ChevronUp, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { findRanges } from "./find";
import { t } from "./i18n";
import { IconButton } from "./ui";

// Tailwind's CSS optimizer doesn't know ::highlight() yet and warns about it, so these rules stay out of styles.css
const style = document.createElement("style");
style.textContent = `::highlight(find) { background-color: color-mix(in srgb, var(--c-warning) 35%, transparent); }
::highlight(find-current) { background-color: var(--c-accent); color: var(--c-on-accent); }`;
document.head.append(style);

type Props = { root: () => HTMLElement | null; text: string; focus: number; onClose(): void };

export default function FindBar({ root, text, focus, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [ranges, setRanges] = useState<Range[]>([]);
  const [i, setI] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, [focus]);

  // after the document is in the DOM (it is replaced whenever the text changes)
  useEffect(() => {
    const el = root();
    setRanges(el ? findRanges(el, query) : []);
    setI(0);
  }, [query, text, root]);

  useEffect(() => {
    CSS.highlights.set("find", new Highlight(...ranges));
    const current = ranges[i];
    if (current) {
      CSS.highlights.set("find-current", new Highlight(current));
      current.startContainer.parentElement?.scrollIntoView({ block: "center" });
    } else CSS.highlights.delete("find-current");
  }, [ranges, i]);

  useEffect(() => () => CSS.highlights.clear(), []);

  const step = (d: number) => ranges.length && setI((x) => (x + d + ranges.length) % ranges.length);

  return (
    <div className="absolute top-2 right-4 z-10 flex items-center gap-1 rounded-lg border border-line bg-surface p-1 shadow-lg">
      <input
        ref={input}
        value={query}
        placeholder={t("Find")}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") step(e.shiftKey ? -1 : 1);
          if (e.key === "Escape") onClose();
        }}
        className="h-7 w-52 rounded-md border border-line bg-surface px-2 outline-none focus:border-accent"
      />
      <span className="w-14 text-center text-xs text-muted">{query ? `${ranges.length ? i + 1 : 0} / ${ranges.length}` : ""}</span>
      <IconButton icon={ChevronUp} label={t("Previous (Shift+Enter)")} onClick={() => step(-1)} className="size-7" />
      <IconButton icon={ChevronDown} label={t("Next (Enter)")} onClick={() => step(1)} className="size-7" />
      <IconButton icon={X} label={t("Close (Esc)")} onClick={onClose} className="size-7" />
    </div>
  );
}
