import fs from "node:fs";
import { readDoc } from "./files";
import { emit } from "./util";

const watchers = new Map<string, fs.FSWatcher>();
const timers = new Map<string, NodeJS.Timeout>();

// editors often write a file in several steps; read it once they are done
function changed(path: string) {
  clearTimeout(timers.get(path));
  timers.set(
    path,
    setTimeout(async () => {
      timers.delete(path);
      const doc = await readDoc(path).catch(() => undefined);
      if (doc) emit("file_changed", doc);
      else if (doc === null) emit("file_missing", path);
    }, 150),
  );
}

/** Watches exactly these files (the open tabs). */
export function watchFiles(paths: string[]) {
  for (const [path, w] of watchers) {
    if (paths.includes(path)) continue;
    w.close();
    watchers.delete(path);
  }
  for (const path of paths) {
    if (watchers.has(path)) continue;
    try {
      const w = fs.watch(path, () => changed(path));
      w.on("error", () => {
        w.close();
        watchers.delete(path);
        changed(path);
      });
      watchers.set(path, w);
    } catch {} // a missing file: its tab already says so
  }
}
