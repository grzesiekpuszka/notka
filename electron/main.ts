import { app, BrowserWindow, dialog, ipcMain, Menu, nativeTheme, screen, shell, type Rectangle } from "electron";
import path from "node:path";
import type { DocMeta, Session, Startup, Theme } from "../src/api";
import { argPaths, Inbox } from "./args";
import { setDefaultApp } from "./assoc";
import { readDoc, writeDoc } from "./files";
import { serveImages } from "./images";
import { dropDraft, loadSession, loadSettings, saveDraft, saveSession, saveSettings } from "./session";
import { applyUpdate, afterUpdate, checkUpdates, downloadUpdate, scheduleChecks, updateState } from "./updates";
import { DATA, emit, errorText, p } from "./util";
import { watchFiles } from "./watch";
import { setLang, t, type Lang } from "../src/i18n";

// portable: Chromium's caches stay next to the exe too, and each copy of the app has its own single-instance lock
app.setPath("userData", p("electron"));
// a second launch only hands its arguments to the running instance (see "second-instance") and exits at once
if (!app.requestSingleInstanceLock()) app.exit(0);

let win: BrowserWindow | undefined;
let updated: Startup["updated"] = null;
let lang: Lang = "en";
// the exe, plus the app path when run through electron.exe in dev
const SKIP = app.isPackaged ? 1 : 2;
const inbox = new Inbox((paths) => emit("open", paths));
inbox.add(argPaths(process.argv, process.cwd(), SKIP));

/** Only web links leave the app; file:, ms-settings: and other schemes could start programs. */
function openLink(url: string) {
  if (!/^https?:$/.test(new URL(url).protocol)) throw new Error(t("Only http and https links can be opened"));
  return shell.openExternal(url);
}

const handlers: Record<string, (args: any) => unknown> = {
  startup: (): Startup => ({
    ...loadSession(DATA),
    theme: loadSettings(DATA).theme,
    lang,
    version: app.getVersion(),
    updated,
    update: updateState(),
  }),
  take_open: () => inbox.take(),
  open_external: ({ url }: { url: string }) => openLink(url),
  save_session: (s: Session) => saveSession(DATA, s),
  save_draft: ({ id, text }: { id: string; text: string }) => saveDraft(DATA, id, text),
  drop_draft: ({ id }: { id: string }) => dropDraft(DATA, id),
  flushed: () => win?.destroy(),
  watch: ({ paths }: { paths: string[] }) => watchFiles(paths),
  set_theme: ({ theme }: { theme: Theme }) => {
    nativeTheme.themeSource = theme;
    saveSettings(DATA, { theme });
  },
  set_default_app: () => setDefaultApp(process.execPath),
  check_updates: () => checkUpdates(),
  download_update: () => downloadUpdate(),
  apply_update: () => applyUpdate(),
  read_file: ({ path }: { path: string }) => readDoc(path),
  write_file: ({ path, text, meta }: { path: string; text: string; meta: DocMeta }) => writeDoc(path, text, meta),
  save_as: async ({ text, meta, name }: { text: string; meta: DocMeta; name: string }) => {
    const r = await dialog.showSaveDialog(win!, { defaultPath: name, filters: [{ name: "Markdown", extensions: ["md", "markdown"] }] });
    if (r.canceled || !r.filePath) return null;
    await writeDoc(r.filePath, text, meta);
    return r.filePath;
  },
  open_dialog: async () => {
    const r = await dialog.showOpenDialog(win!, {
      properties: ["openFile", "multiSelections"],
      filters: [{ name: "Markdown", extensions: ["md", "markdown"] }, { name: t("All files"), extensions: ["*"] }],
    });
    return r.canceled ? [] : r.filePaths;
  },
};

ipcMain.handle("invoke", async (e, cmd: string, args: unknown) => {
  try {
    // only the app's own page may call into the main process
    if (!win || e.sender !== win.webContents || e.senderFrame !== win.webContents.mainFrame) throw new Error(t("Unknown command: {cmd}", { cmd }));
    const handler = handlers[cmd];
    if (!handler) throw new Error(t("Unknown command: {cmd}", { cmd }));
    return { ok: true, value: (await handler(args ?? {})) ?? null };
  } catch (e) {
    return { ok: false, error: errorText(e) };
  }
});

const visible = (b: Rectangle) =>
  screen.getAllDisplays().some(({ workArea: a }) => b.x < a.x + a.width - 100 && b.x + b.width > a.x + 100 && b.y >= a.y - 10 && b.y < a.y + a.height - 50);

function createWindow() {
  const { bounds, maximized, theme } = loadSettings(DATA);
  nativeTheme.themeSource = theme;
  win = new BrowserWindow({
    width: 1100,
    height: 760,
    ...(bounds && visible(bounds) ? bounds : {}),
    minWidth: 640,
    minHeight: 420,
    title: "Simple Markdown Reader",
    show: false,
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#202020" : "#f3f3f3",
    autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, "preload.cjs"), sandbox: true, contextIsolation: true, nodeIntegration: false },
  });
  win.once("ready-to-show", () => {
    if (maximized) win!.maximize();
    win!.show();
    if (process.argv.includes("--perf")) console.log(`ready ${Math.round(process.uptime() * 1000)} ms`);
  });
  // links open in the browser; the window itself never navigates away from the app
  win.webContents.setWindowOpenHandler(({ url }) => (openLink(url).catch(() => {}), { action: "deny" }));
  win.webContents.on("will-navigate", (e, url) => {
    if (url !== win?.webContents.getURL()) e.preventDefault();
  });
  // the page writes what isn't saved yet (session, drafts) before the window goes; a hung page gets 2 s
  let closing = false;
  win.on("close", (e) => {
    if (closing) return;
    e.preventDefault();
    closing = true;
    saveSettings(DATA, { bounds: win!.getNormalBounds(), maximized: win!.isMaximized() });
    emit("flush");
    setTimeout(() => win?.destroy(), 2000);
  });
  if (process.env.ELECTRON_RENDERER_URL) win.loadURL(process.env.ELECTRON_RENDERER_URL);
  else win.loadFile(path.join(__dirname, "renderer", "index.html"));
}

app.on("window-all-closed", () => app.quit());

app.on("second-instance", (_e, argv, cwd) => {
  inbox.add(argPaths(argv, cwd, SKIP));
  if (!win || win.isDestroyed()) return;
  if (win.isMinimized()) win.restore();
  win.focus();
});

app.whenReady().then(() => {
  lang = app.getLocale().startsWith("pl") ? "pl" : "en";
  setLang(lang);
  // the default menu's accelerators (Ctrl+W closes the window, Ctrl+R reloads) would beat the app's shortcuts
  Menu.setApplicationMenu(null);
  updated = afterUpdate();
  scheduleChecks();
  serveImages();
  createWindow();
});
