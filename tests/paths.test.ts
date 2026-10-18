import { expect, test } from "vitest";
import { dirname, resolveLink } from "../src/paths";

test("resolves encoded relative link with anchor", () => {
  expect(resolveLink("D:\\p\\a","../docs/My%20File.md#setup")).toEqual({ path: "D:\\p\\docs\\My File.md", hash: "setup" });
});

test("keeps absolute", () => {
  expect(resolveLink("D:\\x", "C:/y/z.md").path).toBe("C:\\y\\z.md");
});

test("dirname", () => {
  expect(dirname("D:\\a\\b.md")).toBe("D:\\a");
});
