import { expect, test } from "vitest";
import { format } from "../src/mdcommands";

test("bold wraps the selection", () => {
  expect(format("a word b", [2, 6], "bold")).toEqual({ text: "a **word** b", sel: [4, 8] });
});

test("bold unwraps when already bold", () => {
  expect(format("a **word** b", [4, 8], "bold")).toEqual({ text: "a word b", sel: [2, 6] });
});

test("bold with no selection inserts markers around the cursor", () => {
  expect(format("ab", [1, 1], "bold")).toEqual({ text: "a****b", sel: [3, 3] });
});

test("italic, strike and code wrap", () => {
  expect(format("w", [0, 1], "italic").text).toBe("*w*");
  expect(format("w", [0, 1], "strike").text).toBe("~~w~~");
  expect(format("w", [0, 1], "code").text).toBe("`w`");
});

test("h2 replaces the line's heading prefix", () => {
  expect(format("# T\nx", [2, 2], "h2").text).toBe("## T\nx");
  expect(format("## T", [3, 3], "p").text).toBe("T");
  expect(format("T", [0, 0], "h1").text).toBe("# T");
});

test("bullet toggles on every selected line", () => {
  expect(format("a\nb", [0, 3], "bullet").text).toBe("- a\n- b");
  expect(format("- a\n- b", [0, 7], "bullet").text).toBe("a\nb");
});

test("task, ordered and quote prefix lines", () => {
  expect(format("a\nb", [0, 3], "task").text).toBe("- [ ] a\n- [ ] b");
  expect(format("a\nb", [0, 3], "ordered").text).toBe("1. a\n2. b");
  expect(format("a\nb", [0, 3], "quote").text).toBe("> a\n> b");
});

test("link wraps the selection", () => {
  expect(format("see docs", [4, 8], "link", "https://x").text).toBe("see [docs](https://x)");
});

test("image inserts with an encoded path", () => {
  expect(format("", [0, 0], "image", "img/a b.png").text).toBe("![](img/a%20b.png)");
});

test("codeblock fences the selected lines", () => {
  expect(format("x\ny", [0, 3], "codeblock").text).toBe("```\nx\ny\n```");
});

test("hr and table go on their own lines", () => {
  expect(format("ab\nc", [1, 1], "hr").text).toBe("ab\n\n---\n\nc");
  expect(format("", [0, 0], "table").text).toBe("| Column 1 | Column 2 | Column 3 |\n| --- | --- | --- |\n|  |  |  |\n|  |  |  |\n");
});

test("blocks go after a selection instead of replacing it", () => {
  expect(format("keep me", [0, 7], "hr").text).toBe("keep me\n\n---\n");
});

test("link with no selection uses the address as its text", () => {
  expect(format("a ", [2, 2], "link", "https://x").text).toBe("a [https://x](https://x)");
});

test("a rule goes after the current line, not inside it", () => {
  expect(format("word", [2, 2], "hr").text).toBe("word\n\n---\n");
});

test("code block toggles off", () => {
  expect(format("```\nx\n```", [4, 5], "codeblock").text).toBe("x");
});
