import { expect, test } from "vitest";
import { newerVersion } from "../electron/version";

test("release beats its prerelease", () => {
  expect(newerVersion("1.0.1-beta.5", "1.0.1")).toBe(false);
  expect(newerVersion("1.0.1", "1.0.1-beta.5")).toBe(true);
});

test("numeric prerelease parts compare as numbers", () => {
  expect(newerVersion("1.0.0-beta.10", "1.0.0-beta.9")).toBe(true);
});
