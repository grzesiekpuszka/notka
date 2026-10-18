import {
  Bold,
  Code,
  Image,
  Italic,
  Link,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Quote,
  SquareCode,
  Strikethrough,
  Table,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import type { Mode } from "./api";
import type { Block, EditorHandle, Format } from "./format";
import { t } from "./i18n";
import { cx } from "./ui";

type Props = {
  handle: EditorHandle | null;
  /** changes whenever the editor's selection or content changes, so active states refresh */
  tick: number;
  mode: Mode;
  onMode(m: Mode): void;
  onLink(): void;
  onImage(): void;
  menu: ReactNode;
  update: ReactNode;
};

const groups: [Format, LucideIcon, string][][] = [
  [
    ["bold", Bold, "Bold (Ctrl+B)"],
    ["italic", Italic, "Italic (Ctrl+I)"],
    ["strike", Strikethrough, "Strikethrough"],
    ["code", Code, "Code"],
    ["link", Link, "Link (Ctrl+K)"],
  ],
  [
    ["bullet", List, "Bulleted list"],
    ["ordered", ListOrdered, "Numbered list"],
    ["task", ListChecks, "Task list"],
    ["quote", Quote, "Quote"],
    ["codeblock", SquareCode, "Code block"],
    ["table", Table, "Table"],
    ["image", Image, "Image"],
    ["hr", Minus, "Horizontal line"],
  ],
];

const blocks: [Block, string][] = [
  ["p", "Paragraph"],
  ["h1", "Heading 1"],
  ["h2", "Heading 2"],
  ["h3", "Heading 3"],
];

export default function Toolbar({ handle, mode, onMode, onLink, onImage, menu, update }: Props) {
  const active = handle?.active() ?? new Set<Format>();
  const block = blocks.find(([b]) => active.has(b))?.[0] ?? "p";
  const run = (f: Format) => {
    if (f === "link") return onLink();
    if (f === "image") return onImage();
    handle?.run(f);
    handle?.focus();
  };

  return (
    <div className="flex h-11 shrink-0 items-center gap-0.5 border-b border-line bg-surface px-2">
      <select
        value={block}
        aria-label={t("Text style")}
        onChange={(e) => {
          handle?.run(e.target.value as Block);
          handle?.focus();
        }}
        className="mr-1 h-[30px] w-32 rounded-md border border-line bg-surface px-2 text-[13px] text-fg outline-none focus:border-accent"
      >
        {blocks.map(([b, label]) => (
          <option key={b} value={b}>
            {t(label)}
          </option>
        ))}
      </select>
      {groups.map((group, i) => (
        <div key={i} className="flex items-center gap-0.5 border-l border-line pl-1.5 ml-1">
          {group.map(([f, Icon, label]) => (
            <button
              key={f}
              type="button"
              title={t(label)}
              aria-label={t(label)}
              aria-pressed={active.has(f)}
              // keep the editor's selection: a click must not take focus from it
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => run(f)}
              className={cx(
                "grid size-[30px] place-items-center rounded-md",
                active.has(f) ? "bg-accent-soft text-accent" : "text-fg hover:bg-black/5 dark:hover:bg-white/8",
              )}
            >
              <Icon size={16} />
            </button>
          ))}
        </div>
      ))}
      <span className="flex-1" />
      <div className="mr-1 flex overflow-hidden rounded-[7px] border border-line text-xs" role="group" aria-label={t("Editing mode (Ctrl+E)")}>
        {(["wysiwyg", "markdown"] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            title={t("Editing mode (Ctrl+E)")}
            onClick={() => onMode(m)}
            className={cx("h-[28px] px-2.5", mode === m ? "bg-accent text-on-accent" : "text-fg hover:bg-black/5 dark:hover:bg-white/8")}
          >
            {m === "wysiwyg" ? "WYSIWYG" : "Markdown"}
          </button>
        ))}
      </div>
      {update}
      {menu}
    </div>
  );
}
