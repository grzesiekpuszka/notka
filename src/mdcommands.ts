// Toolbar commands for the raw markdown editor, as pure text edits.
import type { Format } from "./format";

export type Edit = { text: string; sel: [number, number] };

const MARKS: Partial<Record<Format, string>> = { bold: "**", italic: "*", strike: "~~", code: "`" };
const HEADINGS: Partial<Record<Format, string>> = { p: "", h1: "# ", h2: "## ", h3: "### " };
const LIST = /^(?:[-*+] \[[ xX]\] |[-*+] |\d+\. )/;
const PREFIX: Partial<Record<Format, (i: number) => string>> = { bullet: () => "- ", task: () => "- [ ] ", ordered: (i) => `${i + 1}. `, quote: () => "> " };
const HAS: Partial<Record<Format, RegExp>> = { bullet: /^[-*+] (?!\[[ xX]\] )/, task: /^[-*+] \[[ xX]\] /, ordered: /^\d+\. /, quote: /^> / };

const TABLE = ["| Column 1 | Column 2 | Column 3 |", "| --- | --- | --- |", "|  |  |  |", "|  |  |  |"].join("\n");

function wrap(text: string, [from, to]: [number, number], m: string): Edit {
  const n = m.length;
  if (text.slice(from - n, from) === m && text.slice(to, to + n) === m)
    return { text: text.slice(0, from - n) + text.slice(from, to) + text.slice(to + n), sel: [from - n, to - n] };
  return { text: text.slice(0, from) + m + text.slice(from, to) + m + text.slice(to), sel: [from + n, to + n] };
}

/** Applies `f(line, index)` to every line the selection touches. */
function lines(text: string, [from, to]: [number, number], f: (line: string, i: number, all: string[]) => string): Edit {
  const start = text.lastIndexOf("\n", from - 1) + 1;
  const nl = text.indexOf("\n", to);
  const end = nl < 0 ? text.length : nl;
  const all = text.slice(start, end).split("\n");
  const block = all.map((l, i) => f(l, i, all)).join("\n");
  return { text: text.slice(0, start) + block + text.slice(end), sel: [start, start + block.length] };
}

/** Inserts a block (table, rule) on lines of its own, after the selection rather than over it. */
function insertBlock(text: string, [, to]: [number, number], snippet: string): Edit {
  const before = text.slice(0, to);
  const after = text.slice(to);
  const pre = !before || before.endsWith("\n\n") ? "" : before.endsWith("\n") ? "\n" : "\n\n";
  const post = !after ? "\n" : after.startsWith("\n\n") ? "" : after.startsWith("\n") ? "\n" : "\n\n";
  const at = before.length + pre.length + snippet.length;
  return { text: before + pre + snippet + post + after, sel: [at, at] };
}

export function format(text: string, sel: [number, number], f: Format, arg = ""): Edit {
  const [from, to] = sel;
  const mark = MARKS[f];
  if (mark) return wrap(text, sel, mark);
  const heading = HEADINGS[f];
  if (heading !== undefined) return lines(text, sel, (l) => heading + l.replace(/^#{1,6} /, ""));
  const prefix = PREFIX[f];
  if (prefix) {
    return lines(text, sel, (l, i, all) => {
      if (all.every((x) => HAS[f]!.test(x))) return l.replace(HAS[f]!, "");
      return prefix(i) + (f === "quote" ? l : l.replace(LIST, ""));
    });
  }
  const selected = text.slice(from, to);
  const put = (s: string, cursor: number): Edit => ({ text: text.slice(0, from) + s + text.slice(to), sel: [from + cursor, from + cursor] });
  switch (f) {
    case "link":
      return put(`[${selected}](${arg})`, selected.length + arg.length + 4);
    case "image": {
      const s = `![](${arg.replace(/ /g, "%20")})`;
      return put(s, s.length);
    }
    case "codeblock":
      return lines(text, sel, (l, i, all) => (i === 0 ? "```\n" : "") + l + (i === all.length - 1 ? "\n```" : ""));
    case "hr":
      return insertBlock(text, sel, "---");
    case "table":
      return insertBlock(text, sel, TABLE);
  }
  return { text, sel };
}
