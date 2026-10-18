import type { Rectangle } from "electron";
import fs from "node:fs";
import path from "node:path";
import type { Session, Theme } from "../src/api";

export type Settings = { theme: Theme; bounds?: Rectangle; maximized?: boolean };

const EMPTY: Session = { tabs: [], active: null, closed: [], collapsed: false };

function readJson<T>(file: string, fallback: T): T {
  try {
    return { ...fallback, ...JSON.parse(fs.readFileSync(file, "utf8")) };
  } catch {
    return fallback;
  }
}

/** Written aside and renamed, so a crash never leaves half a file. */
function writeJson(file: string, value: unknown) {
  fs.writeFileSync(`${file}.tmp`, JSON.stringify(value));
  fs.renameSync(`${file}.tmp`, file);
}

// ids come from the renderer and become file names
const draftFile = (dir: string, id: string) => {
  if (!/^[\w-]+$/.test(id)) throw new Error(`Invalid tab id: ${id}`);
  return path.join(dir, "drafts", `${id}.txt`);
};

/** The saved session with the drafts of its tabs; drafts of tabs no longer in it are deleted. */
export function loadSession(dir: string) {
  const session = readJson(path.join(dir, "session.json"), EMPTY);
  const ids = new Set(session.tabs.map((t) => t.id));
  const drafts: Record<string, string> = {};
  fs.mkdirSync(path.join(dir, "drafts"), { recursive: true });
  for (const name of fs.readdirSync(path.join(dir, "drafts"))) {
    const id = name.replace(/\.txt$/, "");
    const file = path.join(dir, "drafts", name);
    if (ids.has(id)) drafts[id] = fs.readFileSync(file, "utf8");
    else fs.rmSync(file, { force: true });
  }
  return { session, drafts };
}

export const saveSession = (dir: string, s: Session) => writeJson(path.join(dir, "session.json"), s);

export function saveDraft(dir: string, id: string, text: string) {
  fs.mkdirSync(path.join(dir, "drafts"), { recursive: true });
  fs.writeFileSync(draftFile(dir, id), text);
}

export const dropDraft = (dir: string, id: string) => fs.rmSync(draftFile(dir, id), { force: true });

export const loadSettings = (dir: string): Settings => readJson(path.join(dir, "settings.json"), { theme: "system" } as Settings);

export const saveSettings = (dir: string, patch: Partial<Settings>) => writeJson(path.join(dir, "settings.json"), { ...loadSettings(dir), ...patch });
