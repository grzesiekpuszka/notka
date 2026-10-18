import { app, shell } from "electron";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { t } from "../src/i18n";

const run = promisify(execFile);
const PROGID = "SimpleMarkdownReader.md";
const NAME = "Simple Markdown Reader";
const CAPS = "Software\\SimpleMarkdownReader\\Capabilities";

const reg = (key: string, name: string | null, value: string) =>
  run("reg.exe", ["add", `HKCU\\${key}`, ...(name === null ? ["/ve"] : ["/v", name]), "/t", "REG_SZ", "/d", value, "/f"], { windowsHide: true });

/**
 * Registers the app for .md/.markdown for the current user only and opens the Windows Default apps page for it:
 * since Windows 10 only the user can make an app the default.
 */
export async function setDefaultApp(exe: string) {
  if (!app.isPackaged) throw new Error(t("Only available in the packaged app"));
  await reg(`Software\\Classes\\${PROGID}`, null, t("Markdown document"));
  await reg(`Software\\Classes\\${PROGID}\\DefaultIcon`, null, `"${exe}",0`);
  await reg(`Software\\Classes\\${PROGID}\\shell\\open\\command`, null, `"${exe}" "%1"`);
  for (const ext of [".md", ".markdown"]) {
    await reg(`Software\\Classes\\${ext}\\OpenWithProgids`, PROGID, "");
    await reg(`${CAPS}\\FileAssociations`, ext, PROGID);
  }
  await reg(CAPS, "ApplicationName", NAME);
  await reg(CAPS, "ApplicationDescription", t("Simple markdown reader and editor"));
  await reg("Software\\RegisteredApplications", NAME, CAPS);
  await shell.openExternal(`ms-settings:defaultapps?registeredAppUser=${encodeURIComponent(NAME)}`);
}
