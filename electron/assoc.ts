import { app, shell } from "electron";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { t } from "../src/i18n";

const run = promisify(execFile);
const PROGID = "SimpleMarkdownReader.md";
const NAME = "Simple Markdown Reader";
const CAPS = "Software\\SimpleMarkdownReader\\Capabilities";

/** HKCU keys as [key, value name (null = default), data]. */
export function entries(exe: string, icon: string): [string, string | null, string][] {
  return [
    [`Software\\Classes\\${PROGID}`, null, t("Markdown document")],
    // a document icon of its own: the app icon on every file looks wrong
    [`Software\\Classes\\${PROGID}\\DefaultIcon`, null, icon],
    [`Software\\Classes\\${PROGID}\\shell\\open\\command`, null, `"${exe}" "%1"`],
    ...[".md", ".markdown"].flatMap((ext): [string, string | null, string][] => [
      [`Software\\Classes\\${ext}\\OpenWithProgids`, PROGID, ""],
      [`${CAPS}\\FileAssociations`, ext, PROGID],
    ]),
    [CAPS, "ApplicationName", NAME],
    [CAPS, "ApplicationDescription", t("Simple markdown reader and editor")],
    ["Software\\RegisteredApplications", NAME, CAPS],
  ];
}

/**
 * Registers the app for .md/.markdown for the current user only and opens the Windows Default apps page for it:
 * since Windows 10 only the user can make an app the default.
 */
export async function setDefaultApp(exe: string) {
  if (!app.isPackaged) throw new Error(t("Only available in the packaged app"));
  for (const [key, name, value] of entries(exe, path.join(process.resourcesPath, "md-file.ico"))) {
    await run("reg.exe", ["add", `HKCU\\${key}`, ...(name === null ? ["/ve"] : ["/v", name]), "/t", "REG_SZ", "/d", value, "/f"], { windowsHide: true });
  }
  // Explorer caches file icons; this makes it pick up the new one
  await run("ie4uinit.exe", ["-show"], { windowsHide: true }).catch(() => {});
  await shell.openExternal(`ms-settings:defaultapps?registeredAppUser=${encodeURIComponent(NAME)}`);
}
