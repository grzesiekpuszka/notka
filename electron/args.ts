import path from "node:path";

/** Files named on the command line; `skip` drops the exe (and in dev the app path). */
export const argPaths = (argv: string[], cwd: string, skip: number) =>
  argv
    .slice(skip)
    .filter((a) => !a.startsWith("-"))
    .map((a) => path.win32.resolve(cwd, a));

/** Files to open: kept until the page has loaded its session, then passed on as they come. */
export class Inbox {
  private paths: string[] = [];
  private ready = false;
  constructor(private send: (paths: string[]) => void) {}

  add(paths: string[]) {
    if (this.ready) this.send(paths);
    else this.paths.push(...paths);
  }

  take() {
    this.ready = true;
    return this.paths.splice(0);
  }
}
