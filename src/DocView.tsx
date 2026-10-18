import { Pencil } from "lucide-react";
import { t } from "./i18n";
import { dirname } from "./paths";
import Reader from "./Reader";
import { tabName } from "./Sidebar";
import type { Action, Tab } from "./tabs";
import { Button } from "./ui";

type Props = {
  tab: Tab;
  dispatch(a: Action): void;
  onOpen(path: string, hash: string): void;
  takeHash(): string | null;
};

export default function DocView({ tab, dispatch, onOpen, takeHash }: Props) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-[46px] shrink-0 items-center gap-2 border-b border-line pr-2.5 pl-4">
        <span className="shrink-0 font-semibold">{tabName(tab)}</span>
        {tab.path && <span className="truncate text-xs text-muted">{dirname(tab.path)}</span>}
        <span className="flex-1" />
        <Button variant="primary" icon={Pencil} onClick={() => dispatch({ type: "toggleEdit", id: tab.id })}>
          {t("Edit")}
        </Button>
      </div>
      <div className="min-h-0 flex-1">
        <Reader
          key={tab.id}
          text={tab.text}
          path={tab.path}
          scroll={tab.scroll}
          onScroll={(scroll) => dispatch({ type: "scroll", id: tab.id, scroll })}
          onOpen={onOpen}
          takeHash={takeHash}
        />
      </div>
    </div>
  );
}
