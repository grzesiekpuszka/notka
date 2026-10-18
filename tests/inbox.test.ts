import { expect, test } from "vitest";
import { Inbox } from "../electron/args";

test("paths arriving before the page is ready are kept for it", () => {
  const sent: string[][] = [];
  const inbox = new Inbox((paths) => sent.push(paths));
  inbox.add(["a.md"]);
  inbox.add(["b.md", "c.md"]);
  expect(sent).toEqual([]);
  expect(inbox.take()).toEqual(["a.md", "b.md", "c.md"]);
  inbox.add(["d.md"]);
  expect(sent).toEqual([["d.md"]]);
  expect(inbox.take()).toEqual([]);
});
