import { app, BrowserWindow } from "electron";
import fs from "node:fs";
import path from "node:path";

export const ROOT = app.isPackaged ? path.dirname(process.execPath) : process.cwd();
export const DATA = path.join(ROOT, "data");
export const p = (...parts: string[]) => path.join(DATA, ...parts);
export const exists = (f: string) => fs.existsSync(f);

fs.mkdirSync(p("drafts"), { recursive: true });

export function emit(event: string, payload?: unknown) {
  for (const w of BrowserWindow.getAllWindows()) w.webContents.send(event, payload);
}

export function errorText(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}
