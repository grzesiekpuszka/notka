import { expect, test, vi } from "vitest";

vi.mock("electron", () => ({ app: {}, shell: {} }));
const { entries } = await import("../electron/assoc");

const list = entries("C:\\smr\\notka.exe", "C:\\smr\\resources\\md-file.ico");

test(".md files get the document icon, not the app icon", () => {
  expect(list).toContainEqual(["Software\\Classes\\Notka.md\\DefaultIcon", null, "C:\\smr\\resources\\md-file.ico"]);
});

test("open command passes the file to the exe", () => {
  expect(list).toContainEqual(["Software\\Classes\\Notka.md\\shell\\open\\command", null, '"C:\\smr\\notka.exe" "%1"']);
});
