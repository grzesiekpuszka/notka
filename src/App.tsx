import { Download, FilePlus, FileType, FolderOpen, Monitor, Moon, RefreshCw, Sun } from "lucide-react";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { invoke, on, type FileDoc, type Startup, type Theme, type UpdateState } from "./api";
import { confirm, DialogHost } from "./Dialog";
import DocView from "./DocView";
import Menu from "./Menu";
import { usePersistence } from "./persist";
import { setLang, t } from "./i18n";
import Sidebar, { tabName } from "./Sidebar";
import { dirty, reducer, restoreTabs, type State, type Tab } from "./tabs";
import { Button, IconButton } from "./ui";

const empty: State = { tabs: [], active: null, closed: [], collapsed: false };
const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
const themes: [Theme, string, typeof Sun][] = [
  ["system", "System", Monitor],
  ["light", "Light", Sun],
  ["dark", "Dark", Moon],
];

export default function App() {
  const [state, dispatch] = useReducer(reducer, empty);
  const [ready, setReady] = useState(false);
  const [finding, setFinding] = useState(0);
  const [theme, setTheme] = useState<Theme>("system");
  const [version, setVersion] = useState("");
  const [update, setUpdate] = useState<UpdateState | null>(null);
  const [installing, setInstalling] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => setFinding(0), [state.active]);
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
      setTheme(s.theme);
      setVersion(s.version);
      setUpdate(s.update);
      if (s.updated) setToast(s.updated === "ok" ? t("Updated to {version}.", { version: s.version }) : t("The update couldn't be installed; the previous version was restored."));
      const paths = s.session.tabs.flatMap((t) => (t.path ? [t.path] : []));
      // a file that can't be read in time (offline drive, cloud placeholder) keeps its tab without holding up the rest
      const read = (path: string) =>
        Promise.race([invoke<FileDoc | null>("read_file", { path }), new Promise<undefined>((r) => setTimeout(r, 3000))]).catch(() => undefined);
      const docs = await Promise.all(paths.map(read));
      loadedDrafts(s.drafts);
      dispatch({ type: "init", state: restoreTabs(s.session, s.drafts, Object.fromEntries(paths.flatMap((p, i) => (docs[i] === undefined ? [] : [[p, docs[i]]])))) });
      setReady(true);
      await openPaths(await invoke<string[]>("take_open"));
    });
    const offs = [on("open", openPaths), on("file_changed", (doc: FileDoc) => dispatch({ type: "disk", doc })), on("file_missing", (path: string) => dispatch({ type: "missing", path })),
      on("update", setUpdate),
      on("progress", (p: { done: number; total: number }) => setInstalling(p.total ? Math.round((p.done / p.total) * 100) : 0)),
    ];
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
    dispatch({ type: "saved", id: tab.id, path, meta, text: tab.text });
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

  const pickTheme = (theme: Theme) => {
    setTheme(theme);
    invoke("set_theme", { theme }).catch(() => {});
  };
  const fail = (err: any) => confirm(t("Something went wrong"), String(err?.message ?? err), [t("OK")]);
  const [, themeLabel, ThemeIcon] = themes.find(([x]) => x === theme)!;

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  const checkUpdates = async () => {
    const s = await invoke<UpdateState>("check_updates");
    setUpdate(s);
    if (!s.available) setToast(t("You have the latest version."));
  };

  const install = async () => {
    setInstalling(0);
    try {
      if (!update?.downloaded) await invoke("download_update");
      await invoke("apply_update");
    } catch (e) {
      setInstalling(null);
      fail(e);
    }
  };

  const restore = async () => {
    const entry = current.current.closed[0];
    if (!entry) return;
    dispatch({ type: "restore", doc: await invoke<FileDoc | null>("read_file", { path: entry.path }).catch(() => null) });
  };

  const keys = useRef<(e: KeyboardEvent) => void>(null);
  keys.current = (e) => {
    // CodeMirror handles its own keys (Ctrl+F opens its search panel)
    if (e.defaultPrevented || !e.ctrlKey || e.altKey || document.getElementById("root")!.inert) return;
    const tab = current.current.tabs.find((x) => x.id === current.current.active);
    const k = e.key.toLowerCase();
    const run = (f: () => unknown) => {
      e.preventDefault();
      Promise.resolve(f()).catch((err) => confirm(t("Something went wrong"), String(err.message ?? err), [t("OK")]));
    };
    if (k === "n") run(newDoc);
    else if (k === "o") run(openDialog);
    else if (k === "s" && tab) run(() => save(tab, e.shiftKey));
    else if (k === "w" && tab) run(() => close(tab.id));
    else if (k === "t") run(restore);
    else if (k === "tab") run(() => dispatch({ type: "cycle", step: e.shiftKey ? -1 : 1 }));
    else if (k === "e" && tab) run(() => dispatch({ type: "toggleEdit", id: tab.id }));
    else if (k === "f" && tab) run(() => setFinding((n) => n + 1));
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keys.current!(e);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
        notice={
          update?.available &&
          (state.collapsed ? (
            <IconButton
              icon={Download}
              label={installing === null ? t("Install version {version} and restart", { version: update.available.version }) : t("Downloading… {n}%", { n: installing })}
              disabled={installing !== null}
              onClick={install}
              className="mb-1 bg-accent-soft text-accent hover:bg-accent-soft hover:text-accent-hover dark:hover:bg-accent-soft"
            />
          ) : (
            <div className="mb-1.5 rounded-lg bg-accent-soft p-2.5 text-[13px]">
              <div className="mb-2">{t("Version {version} is available.", { version: update.available.version })}</div>
              <Button variant="primary" icon={Download} disabled={installing !== null} onClick={install} className="h-7 w-full">
                {installing === null ? t("Install and restart") : t("Downloading… {n}%", { n: installing })}
              </Button>
            </div>
          ))
        }
        footer={
          <>
            <IconButton
              icon={ThemeIcon}
              label={t("Theme: {theme}", { theme: t(themeLabel) })}
              onClick={() => pickTheme(themes[(themes.findIndex(([x]) => x === theme) + 1) % themes.length][0])}
            />
            <Menu
              items={[
                { label: t("New document"), icon: FilePlus, onClick: newDoc },
                { label: t("Open…"), icon: FolderOpen, onClick: () => openDialog().catch(fail) },
                "-",
                { heading: t("Theme") },
                ...themes.map(([value, label, icon]) => ({ label: t(label), icon, checked: theme === value, onClick: () => pickTheme(value) })),
                "-",
                { label: t("Set as default for .md"), icon: FileType, onClick: () => invoke("set_default_app").catch(fail) },
                { label: t("Check for updates"), icon: RefreshCw, onClick: () => checkUpdates().catch(fail) },
              ]}
              footer={`Simple Markdown Reader ${version}`}
            />
          </>
        }
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
            finding={finding}
            onFindClose={() => setFinding(0)}
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
      {toast && (
        <div className="fixed right-4 bottom-4 z-40 max-w-sm rounded-lg border border-line bg-surface px-4 py-2.5 shadow-lg" onClick={() => setToast(null)}>
          {toast}
        </div>
      )}
    </div>
  );
}
