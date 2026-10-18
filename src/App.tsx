import { FilePlus, FolderOpen } from "lucide-react";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { invoke, on, type FileDoc, type Startup } from "./api";
import DocView from "./DocView";
import { setLang, t } from "./i18n";
import Sidebar, { tabName } from "./Sidebar";
import { dirty, reducer, type State } from "./tabs";
import { Button } from "./ui";

const empty: State = { tabs: [], active: null, closed: [], collapsed: false };
const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");

export default function App() {
  const [state, dispatch] = useReducer(reducer, empty);
  const [ready, setReady] = useState(false);
  const hash = useRef<string | null>(null);
  const tab = state.tabs.find((x) => x.id === state.active);

  const openPaths = useCallback(async (paths: string[]) => {
    for (const path of paths) {
      const doc = await invoke<FileDoc | null>("read_file", { path }).catch(() => null);
      if (doc) dispatch({ type: "open", doc });
    }
  }, []);

  useEffect(() => {
    invoke<Startup>("startup").then(async (s) => {
      setLang(s.lang);
      await openPaths(s.open);
      setReady(true);
    });
    return on("open", openPaths);
  }, [openPaths]);

  // the main process sets nativeTheme, which drives prefers-color-scheme
  useEffect(() => {
    const apply = () => document.documentElement.classList.toggle("dark", darkQuery.matches);
    apply();
    darkQuery.addEventListener("change", apply);
    return () => darkQuery.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    document.title = tab ? `${dirty(tab) ? "● " : ""}${tabName(tab)} – Simple Markdown Reader` : "Simple Markdown Reader";
  }, [tab]);

  const openDialog = async () => openPaths(await invoke<string[]>("open_dialog"));
  const newDoc = () => dispatch({ type: "new" });

  return (
    <div
      className="flex h-full"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        openPaths([...e.dataTransfer.files].map((f) => window.smr.pathFor(f)).filter(Boolean));
      }}
    >
      <Sidebar
        state={state}
        onActivate={(id) => dispatch({ type: "activate", id })}
        onClose={(id) => dispatch({ type: "close", id })}
        onNew={newDoc}
        onCollapse={() => dispatch({ type: "collapse" })}
        footer={null}
      />
      <main className="my-2 mr-2 min-w-0 flex-1 overflow-hidden rounded-2xl border border-line bg-surface">
        {tab ? (
          <DocView
            key={tab.id}
            tab={tab}
            dispatch={dispatch}
            onOpen={(path, h) => {
              hash.current = h || null;
              openPaths([path]);
            }}
            takeHash={() => {
              const h = hash.current;
              hash.current = null;
              return h;
            }}
          />
        ) : (
          ready && (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-muted">
              <p>{t("Open a file (Ctrl+O) or create a new one (Ctrl+N)")}</p>
              <div className="flex gap-2">
                <Button icon={FolderOpen} onClick={openDialog}>
                  {t("Open…")}
                </Button>
                <Button icon={FilePlus} onClick={newDoc}>
                  {t("New")}
                </Button>
              </div>
            </div>
          )
        )}
      </main>
    </div>
  );
}
