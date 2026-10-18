import { expect, test } from "vitest";
import { argPaths } from "../electron/args";

test("argPaths resolves against cwd", () => {
  expect(argPaths(["C:\\app\\smr.exe", "--updated", "notes.md", "D:\\x.md"], "C:\\w", 1)).toEqual(["C:\\w\\notes.md", "D:\\x.md"]);
});

test("argPaths skips the dev script", () => {
  expect(argPaths(["electron.exe", ".", "a.md"], "C:\\w", 2)).toEqual(["C:\\w\\a.md"]);
});
