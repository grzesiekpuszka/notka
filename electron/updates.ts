import { app } from "electron";
import { execFile, spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { promisify } from "node:util";
import type { UpdateState } from "../src/api";
import { t } from "../src/i18n";
import { emit, exists, p, ROOT } from "./util";
import { newerVersion } from "./version";

const REPO = "grzesiekpuszka/simple-markdown-reader";
const EXE = "simple-markdown-reader.exe";
const DIR = p("tmp", "update");
const STATE = p("updates.json");
const DAY = 24 * 60 * 60 * 1000;
const headers = { "User-Agent": "simple-markdown-reader", Accept: "application/vnd.github+json" };

type Saved = { checked: string | null; available: UpdateState["available"]; zip?: string; sha?: string; notified?: string };

let saved: Saved = load();

function load(): Saved {
  try {
    return JSON.parse(fs.readFileSync(STATE, "utf8"));
  } catch {
    return { checked: null, available: null };
  }
}

function save(patch: Partial<Saved>) {
  saved = { ...saved, ...patch };
  fs.writeFileSync(STATE, JSON.stringify(saved, null, 2));
}

const readText = (file: string) => (exists(file) ? fs.readFileSync(file, "utf8").trim() : "");
const downloaded = () => !!saved.available && exists(path.join(DIR, "app", EXE)) && readText(path.join(DIR, "app.version")) === saved.available.version;

export function updateState(): UpdateState {
  // an update installed meanwhile (or a manual copy) makes a stored release stale
  const current = app.getVersion();
  const available = saved.available && newerVersion(saved.available.version, current) ? saved.available : null;
  return { current, available, downloaded: !!available && downloaded() };
}

/** Looks for a newer GitHub release that has both the zip and its checksum. */
export async function checkUpdates() {
  const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers });
  let available: Saved["available"] = null;
  let zip: string | undefined;
  let sha: string | undefined;
  let incomplete = false;
  if (res.ok) {
    const r = await res.json();
    const version = String(r.tag_name).replace(/^v/, "");
    const asset = (suffix: string) => r.assets.find((a: any) => a.name.endsWith(suffix))?.browser_download_url;
    zip = asset("-win-x64.zip");
    sha = asset("-win-x64.zip.sha256");
    if (zip && sha && newerVersion(version, app.getVersion())) available = { version, notes: r.body ?? "", page: r.html_url };
    // a release still getting its files: look again at the next hourly tick instead of tomorrow
    else if (newerVersion(version, app.getVersion())) incomplete = true;
  } else if (res.status !== 404) throw new Error(`GitHub: HTTP ${res.status}`); // 404 = nothing published yet
  save({ checked: incomplete ? saved.checked : new Date().toISOString(), available, zip, sha });
  return updateState();
}

/** Once a day in the background; a version not announced before is sent to the page. */
export function scheduleChecks() {
  const tick = () => {
    if (saved.checked && Date.now() - Date.parse(saved.checked) < DAY) return;
    checkUpdates().then((s) => {
      if (s.available && saved.notified !== s.available.version) {
        save({ notified: s.available.version });
        emit("update", s);
      }
    }, () => {});
  };
  setTimeout(tick, 15000);
  setInterval(tick, 60 * 60 * 1000);
}

async function sha256(file: string) {
  const hash = crypto.createHash("sha256");
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk as Buffer);
  return hash.digest("hex");
}

async function download(url: string, file: string) {
  // a connection that stops sending data never ends on its own
  const abort = new AbortController();
  let idle: NodeJS.Timeout | undefined;
  const alive = () => {
    clearTimeout(idle);
    idle = setTimeout(() => abort.abort(new Error(t("The download stopped"))), 60_000);
  };
  alive();
  let done = 0;
  let last = 0;
  try {
    const r = await fetch(url, { headers: { "User-Agent": headers["User-Agent"] }, signal: abort.signal });
    if (!r.ok || !r.body) throw new Error(`${url}: HTTP ${r.status}`);
    const total = Number(r.headers.get("content-length") ?? 0);
    const progress = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        alive();
        done += chunk.length;
        if (done - last > 1 << 19) {
          last = done;
          emit("progress", { id: "update", done, total });
        }
        callback(null, chunk);
      },
    });
    await pipeline(Readable.fromWeb(r.body as never), progress, fs.createWriteStream(file));
  } catch (e) {
    fs.rmSync(file, { force: true });
    throw e;
  } finally {
    clearTimeout(idle);
  }
}

/** Downloads and unpacks the new version into data\tmp\update\app; nothing of the running app is touched. */
export function downloadUpdate() {
  downloading ??= fetchUpdate().finally(() => (downloading = null));
  return downloading;
}
let downloading: Promise<void> | null = null;

async function fetchUpdate() {
  // one consistent release: a check during the download may already see a newer one
  const release = updateState().available;
  const { zip: zipUrl, sha: shaUrl } = saved;
  if (!release || !zipUrl || !shaUrl) throw new Error(t("No update available"));
  fs.rmSync(DIR, { recursive: true, force: true });
  fs.mkdirSync(DIR, { recursive: true });
  const zip = path.join(DIR, "app.zip");
  await download(zipUrl, zip);
  const expected = (await (await fetch(shaUrl, { headers: { "User-Agent": headers["User-Agent"] } })).text()).trim().split(/\s+/)[0].toLowerCase();
  if ((await sha256(zip)) !== expected) {
    fs.rmSync(DIR, { recursive: true, force: true });
    throw new Error(t("The downloaded update is damaged (checksum mismatch). Try again."));
  }
  const out = path.join(DIR, "app");
  fs.mkdirSync(out, { recursive: true });
  const tar = path.join(process.env.SystemRoot ?? "C:\\Windows", "System32", "tar.exe");
  await promisify(execFile)(tar, ["-xf", zip, "-C", out], { windowsHide: true });
  if (!exists(path.join(out, EXE))) throw new Error(t("The update package is invalid"));
  fs.rmSync(zip, { force: true });
  fs.writeFileSync(path.join(DIR, "app.version"), release.version);
}

/**
 * Quits and lets updater.exe (window-less, from shim/updater.cs) swap the files once the app has exited: the entries
 * the new package contains go to data\tmp\update\backup, the new ones are copied in, the new exe starts. If anything
 * fails, the backup is put back and the old version starts. It runs from a copy, as the app folder gets replaced.
 * Quitting goes through the normal window close, so the session and drafts are saved first.
 */
export function applyUpdate() {
  if (!downloaded()) throw new Error(t("Download the update first"));
  const updater = path.join(DIR, "updater.exe");
  fs.copyFileSync(app.isPackaged ? path.join(process.resourcesPath, "updater.exe") : path.join(ROOT, "resources", "updater.exe"), updater);
  spawn(updater, [ROOT, path.join(DIR, "app"), path.join(DIR, "backup"), String(process.pid)], { detached: true, stdio: "ignore" }).unref();
  app.quit();
}

/** On start: the result of an update that just ran; otherwise removes what the previous one left behind. */
export function afterUpdate(): "ok" | "failed" | null {
  // files the updater couldn't put back stay out of data\tmp, so nothing cleans them up before a manual restore
  if (exists(path.join(DIR, "rollback-failed"))) {
    fs.renameSync(DIR, p(`update-backup-${Date.now()}`));
    return "failed";
  }
  if (process.argv.includes("--updated")) return "ok";
  if (process.argv.includes("--update-failed")) return "failed";
  fs.rmSync(DIR, { recursive: true, force: true });
  return null;
}
