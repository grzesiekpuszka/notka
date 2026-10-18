import { expect, test } from "vitest";
import { dirname, relativePath, resolveLink } from "../src/paths";

test("resolves encoded relative link with anchor", () => {
  expect(resolveLink("D:\\p\\a","../docs/My%20File.md#setup")).toEqual({ path: "D:\\p\\docs\\My File.md", hash: "setup" });
});

test("keeps absolute", () => {
  expect(resolveLink("D:\\x", "C:/y/z.md").path).toBe("C:\\y\\z.md");
});

test("dirname", () => {
  expect(dirname("D:\\a\\b.md")).toBe("D:\\a");
});

test("relativePath gives a markdown-ready relative path", () => {
  expect(relativePath("D:\\p\\docs", "D:\\p\\img\\a b.png")).toBe("../img/a%20b.png");
  expect(relativePath("D:\\p", "d:\\p\\x.png")).toBe("x.png");
  expect(relativePath("D:\\p", "C:\\x\\y.png")).toBe("C:/x/y.png");
});
