// @vitest-environment jsdom
import { expect, test } from "vitest";
import { render } from "../src/markdown";

test("renders gfm table and task list", () => {
  const html = render("| a | b |\n|---|---|\n| 1 | 2 |\n\n- [x] done\n", null);
  expect(html).toContain("<table>");
  expect(html).toMatch(/<input[^>]*disabled/);
});

test("strips scripts", () => {
  const html = render("<script>alert(1)</script><img src=x onerror=alert(1)>", null);
  expect(html).not.toContain("<script");
  expect(html).not.toContain("onerror");
});

test("rewrites relative image", () => {
  expect(render("![a](img/p%20q.png)", "D:\\d")).toContain('src="mdimg://f/D%3A%5Cd%5Cimg%5Cp%20q.png"');
});

test("keeps remote image", () => {
  expect(render("![a](https://x.y/i.png)", "D:\\d")).toContain('src="https://x.y/i.png"');
});

test("adds heading ids", () => {
  expect(render("## Set up", null)).toContain('id="set-up"');
});

test("documents can't restyle the app", () => {
  const html = render('<style>body{display:none}</style><div style="position:fixed;inset:0">x</div>', null);
  expect(html).not.toContain("<style");
  expect(html).not.toContain("position:fixed");
});
