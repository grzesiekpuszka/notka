// @vitest-environment jsdom
import { act, createElement, createRef } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import type { EditorHandle } from "../src/format";
import Toolbar from "../src/Toolbar";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

test("the toolbar uses the editor that exists when a button is clicked", async () => {
  const handleRef = createRef<EditorHandle | null>() as { current: EditorHandle | null };
  const box = document.createElement("div");
  await act(async () =>
    createRoot(box).render(
      createElement(Toolbar, { handleRef, tick: 0, mode: "markdown", onMode: vi.fn(), onLink: vi.fn(), onImage: vi.fn(), menu: null, update: null }),
    ),
  );
  const run = vi.fn();
  handleRef.current = { run, active: () => new Set(), selectedText: () => "", focus: vi.fn() };
  box.querySelector<HTMLButtonElement>('button[aria-label^="Bold"]')!.click();
  expect(run).toHaveBeenCalledWith("bold");
});
