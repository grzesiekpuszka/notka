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

test("footnotes and reference links survive", async () => {
  expect(await checkFidelity('a[^1]\n\n[^1]: note\n\n[r]: https://x "T"\n\nsee [r]\n')).toBe(true);
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
  expect(MAX_WYSIWYG).toBe(1_000_000);
  expect(initialMode("a".repeat(1_000_001))).toBe("markdown");
  expect(initialMode("a")).toBe("wysiwyg");
});

test("contentKey ignores style", () => {
  expect(contentKey("* a\n* b")).toBe(contentKey("- a\n- b"));
  expect(contentKey("- a\n- c")).not.toBe(contentKey("- a\n- b"));
});
