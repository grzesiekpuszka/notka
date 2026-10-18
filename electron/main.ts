import { app, BrowserWindow, ipcMain, nativeTheme, shell } from "electron";
import path from "node:path";
import { errorText } from "./util";
import { t } from "../src/i18n";

// a second launch only hands its arguments to the running instance (see "second-instance") and exits at once
if (!app.requestSingleInstanceLock()) app.exit(0);

let win: BrowserWindow | undefined;

/** Only web links leave the app; file:, ms-settings: and other schemes could start programs. */
function openLink(url: string) {
  if (!/^https?:$/.test(new URL(url).protocol)) throw new Error(t("Only http and https links can be opened"));
  return shell.openExternal(url);
}

const handlers: Record<string, (args: any) => unknown> = {
  open_external: ({ url }: { url: string }) => openLink(url),
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

function createWindow() {
  win = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 640,
    minHeight: 420,
    title: "Simple Markdown Reader",
    show: false,
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#202020" : "#f3f3f3",
    autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, "preload.cjs"), sandbox: true, contextIsolation: true, nodeIntegration: false },
  });
  win.once("ready-to-show", () => {
    win!.show();
    if (process.argv.includes("--perf")) console.log(`ready ${Math.round(process.uptime() * 1000)} ms`);
  });
  // links open in the browser; the window itself never navigates away from the app
  win.webContents.setWindowOpenHandler(({ url }) => (openLink(url).catch(() => {}), { action: "deny" }));
  win.webContents.on("will-navigate", (e, url) => {
    if (url !== win?.webContents.getURL()) e.preventDefault();
  });
  if (process.env.ELECTRON_RENDERER_URL) win.loadURL(process.env.ELECTRON_RENDERER_URL);
  else win.loadFile(path.join(__dirname, "renderer", "index.html"));
}

app.on("window-all-closed", () => app.quit());

app.whenReady().then(createWindow);
