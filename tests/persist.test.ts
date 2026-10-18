// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { usePersistence } from "../src/persist";
import type { State } from "../src/tabs";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

test("flush before startup finished never overwrites the session", async () => {
  const listeners: Record<string, (p: unknown) => void> = {};
  const invoke = vi.fn(async () => ({ ok: true, value: null }));
  (window as any).smr = { invoke, on: (e: string, cb: (p: unknown) => void) => ((listeners[e] = cb), () => {}) };
  const empty: State = { tabs: [], active: null, closed: [], collapsed: false };
  const Probe = () => (usePersistence(empty, false), null);
  await act(async () => createRoot(document.createElement("div")).render(createElement(Probe)));
  await act(async () => listeners.flush(undefined));
  expect(invoke.mock.calls.map((c) => (c as unknown[])[0])).toEqual(["flushed"]);
});
