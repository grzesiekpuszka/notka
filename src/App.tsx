import { FilePlus, FolderOpen } from "lucide-react";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { invoke, on, type FileDoc, type Startup } from "./api";
import { confirm, DialogHost } from "./Dialog";
import DocView from "./DocView";
import { usePersistence } from "./persist";
import { setLang, t } from "./i18n";
import Sidebar, { tabName } from "./Sidebar";
import { dirty, reducer, restoreTabs, type State, type Tab } from "./tabs";
import { Button } from "./ui";

const empty: State = { tabs: [], active: null, closed: [], collapsed: false };
const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");

export default function App() {
  const [state, dispatch] = useReducer(reducer, empty);
  const [ready, setReady] = useState(false);
  const hash = useRef<string | null>(null);
  const tab = state.tabs.find((x) => x.id === state.active);
  // async handlers (dialogs, saving) must see the state as it is when they continue, not when they started
  const current = useRef(state);
  current.current = state;
  const loadedDrafts = usePersistence(state, ready);

  const openPaths = useCallback(async (paths: string[]) => {
    for (const path of paths) {
      const doc = await invoke<FileDoc | null>("read_file", { path }).catch(() => null);
      if (doc) dispatch({ type: "open", doc });
    }
  }, []);

  useEffect(() => {
    invoke<Startup>("startup").then(async (s) => {
      setLang(s.lang);
      const paths = s.session.tabs.flatMap((t) => (t.path ? [t.path] : []));
      const docs = await Promise.all(paths.map((path) => invoke<FileDoc | null>("read_file", { path }).catch(() => null)));
      loadedDrafts(s.drafts);
      dispatch({ type: "init", state: restoreTabs(s.session, s.drafts, Object.fromEntries(paths.map((p, i) => [p, docs[i]]))) });
      await openPaths(s.open);
      setReady(true);
    });
    const offs = [on("open", openPaths), on("file_changed", (doc: FileDoc) => dispatch({ type: "disk", doc })), on("file_missing", (path: string) => dispatch({ type: "missing", path }))];
    return () => offs.forEach((off) => off());
  }, [openPaths]);

  // "|" can't appear in a Windows path
  const watched = state.tabs.flatMap((t) => (t.path && !t.missing ? [t.path] : [])).join("|");
  useEffect(() => {
    if (ready) invoke("watch", { paths: watched ? watched.split("|") : [] }).catch(() => {});
  }, [watched, ready]);

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

  const save = async (tab: Tab, as = false) => {
    let meta = tab.meta;
    if (meta.encoding === "cp1250") {
      if ((await confirm(tabName(tab), t("This file will be saved as UTF-8."), [t("OK"), t("Cancel")])) !== 0) return false;
      meta = { ...meta, encoding: "utf8" };
    }
    let path = tab.path;
    if (!path || tab.missing || as) {
      path = await invoke<string | null>("save_as", { text: tab.text, meta, name: tab.path ?? `${tabName(tab)}.md` });
      if (!path) return false;
    } else await invoke("write_file", { path, text: tab.text, meta });
    dispatch({ type: "saved", id: tab.id, path, meta });
    return true;
  };

  const close = async (id: string) => {
    const tab = current.current.tabs.find((x) => x.id === id);
    if (!tab) return;
    if (dirty(tab)) {
      const choice = await confirm(tabName(tab), t("Do you want to save changes?"), [t("Save"), t("Don't save"), t("Cancel")]);
      if (choice === 2 || (choice === 0 && !(await save(tab)))) return;
    }
    dispatch({ type: "close", id });
  };

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
        onClose={close}
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
            onReload={async () => {
              const doc = await invoke<FileDoc | null>("read_file", { path: tab.path });
              dispatch(doc ? { type: "reload", doc } : { type: "missing", path: tab.path! });
            }}
            onSave={() => save(tab).catch((e) => confirm(t("Saving failed"), String(e.message ?? e), [t("OK")]))}
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
      <DialogHost />
    </div>
  );
}
