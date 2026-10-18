import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, expect, test } from "vitest";
import type { Session } from "../src/api";
import { dropDraft, loadSession, saveDraft, saveSession } from "../electron/session";

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "smr-"));
});

const session: Session = {
  tabs: [{ id: "a", path: "C:\\a.md", untitled: 0, mode: "markdown" as const, scroll: 120 }, { id: "b", path: null, untitled: 1, mode: "markdown" as const, scroll: 0 }],
  active: "b",
  closed: [{ id: "c", path: "C:\\c.md", untitled: 0, mode: "wysiwyg" as const, scroll: 0 }],
};

test("round-trips session and drafts", () => {
  saveSession(dir, session);
  saveDraft(dir, "b", "draft text");
  saveDraft(dir, "a", "x");
  dropDraft(dir, "a");
  expect(loadSession(dir)).toEqual({ session, drafts: { b: "draft text" } });
});

test("deletes orphan drafts on load", () => {
  saveSession(dir, session);
  saveDraft(dir, "gone", "old");
  loadSession(dir);
  expect(fs.existsSync(path.join(dir, "drafts", "gone.txt"))).toBe(false);
});

test("corrupt session.json gives empty session", () => {
  fs.writeFileSync(path.join(dir, "session.json"), "{oops");
  expect(loadSession(dir).session).toEqual({ tabs: [], active: null, closed: [] });
});

test("keeps drafts when session.json can't be parsed", () => {
  saveDraft(dir, "b", "precious");
  fs.writeFileSync(path.join(dir, "session.json"), "\0\0\0");
  loadSession(dir);
  expect(fs.readFileSync(path.join(dir, "drafts", "b.txt"), "utf8")).toBe("precious");
});
