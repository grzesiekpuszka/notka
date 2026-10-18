import path from "node:path";

/** Files named on the command line; `skip` drops the exe (and in dev the app path). */
export const argPaths = (argv: string[], cwd: string, skip: number) =>
  argv
    .slice(skip)
    .filter((a) => !a.startsWith("-"))
    .map((a) => path.win32.resolve(cwd, a));
