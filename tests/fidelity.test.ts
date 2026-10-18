// @vitest-environment jsdom
import { expect, test, vi } from "vitest";
import { checkFidelity, contentKey, initialMode, MAX_WYSIWYG, roundTrip } from "../src/wysiwyg/fidelity";
import { createEditor } from "../src/wysiwyg/setup";

test("front matter survives", async () => {
  expect(await roundTrip("---\ntitle: X\n---\n\n# A\n")).toMatch(/^---\ntitle: X\n---/);
});

test("html comment and block html survive", async () => {
  const md = await roundTrip('<!-- c -->\n\n<div align="center">x</div>\n\ntext\n');
  expect(md).toContain("<!-- c -->");
  expect(md).toContain('<div align="center">x</div>');
});

test("footnotes and link titles survive", async () => {
  expect(await checkFidelity('a[^1]\n\n[^1]: note\n\nsee [r](https://x "T")\n')).toBe(true);
});

test("no escaping inside words", async () => {
  expect(await roundTrip("snake_case and a*b\n")).toContain("snake_case");
});

test("raw html shows as text", async () => {
  const root = document.createElement("div");
  document.body.append(root);
  const md = '<script>window.x=1</script><img src=x onerror="window.y=1">\n';
  const editor = await createEditor({ root, markdown: md, dir: null, onChange: vi.fn(), onOpenLink: vi.fn() });
  await new Promise((r) => setTimeout(r, 30));
  expect(root.querySelector("script, img[onerror]")).toBeNull();
  expect((window as any).x).toBeUndefined();
  expect((window as any).y).toBeUndefined();
  expect(root.textContent).toContain("window.x=1");
  editor.destroy();
});

test("large files open in markdown mode", () => {
  expect(MAX_WYSIWYG).toBe(200_000);
  expect(initialMode("a".repeat(200_001))).toBe("markdown");
  expect(initialMode("a")).toBe("wysiwyg");
});

test("contentKey ignores style", () => {
  expect(contentKey("* a\n* b")).toBe(contentKey("- a\n- b"));
  expect(contentKey("- a\n- c")).not.toBe(contentKey("- a\n- b"));
});

test("reference definitions make a file markdown-only", async () => {
  expect(await checkFidelity("text\n\n[r]: https://x\n")).toBe(false);
  expect(await checkFidelity("see [r]\n\n[r]: https://x\n")).toBe(false);
});

test("no needless escaping of brackets and spaced stars", async () => {
  const md = await roundTrip("[not a link] and [x], 2 * 3 * 4, a[^x]\n");
  expect(md).toContain("[not a link] and [x], 2 * 3 * 4, a[^x]");
});

test("escapes that matter stay", async () => {
  const input = "\\*not emphasis\\* and \\[a](b)\n";
  expect(await roundTrip(input)).toContain("\\*not emphasis\\*");
  // still text, not a link (remark may escape the "(" instead of the "[")
  expect(await checkFidelity(input)).toBe(true);
});
