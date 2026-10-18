import { useEffect, useRef } from "react";
import { invoke, on } from "./api";
import { dirty, toSession, type State } from "./tabs";

/**
 * Keeps data\session.json and the drafts of unsaved tabs up to date, like Notepad: nothing typed is lost on quit or
 * crash. On window close the main process asks for a final flush before it lets the window go.
 */
export function usePersistence(state: State, ready: boolean) {
  const current = useRef(state);
  current.current = state;
  // text of each draft as last written; a tab is in here exactly while it has a draft file
  const drafts = useRef(new Map<string, string>());
  const timers = useRef(new Map<string, number>());

  const writeDraft = (id: string, text: string) => {
    timers.current.delete(id);
    drafts.current.set(id, text);
    invoke("save_draft", { id, text }).catch(() => {});
  };

  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => invoke("save_session", toSession(state)).catch(() => {}), 300);
    return () => clearTimeout(timer);
  }, [state, ready]);

  useEffect(() => {
    if (!ready) return;
    const open = new Set(state.tabs.map((t) => t.id));
    for (const tab of state.tabs) {
      if (!dirty(tab) || drafts.current.get(tab.id) === tab.text) continue;
      clearTimeout(timers.current.get(tab.id));
      timers.current.set(tab.id, window.setTimeout(() => writeDraft(tab.id, tab.text), 500));
    }
    for (const id of [...drafts.current.keys(), ...timers.current.keys()]) {
      const tab = state.tabs.find((t) => t.id === id);
      if (open.has(id) && tab && dirty(tab)) continue;
      clearTimeout(timers.current.get(id));
      timers.current.delete(id);
      if (drafts.current.delete(id)) invoke("drop_draft", { id }).catch(() => {});
    }
  }, [state.tabs, ready]);

  useEffect(
    () =>
      on("flush", async () => {
        const s = current.current;
        const pending = s.tabs.filter((t) => timers.current.has(t.id));
        for (const t of pending) clearTimeout(timers.current.get(t.id));
        await Promise.all([invoke("save_session", toSession(s)), ...pending.map((t) => invoke("save_draft", { id: t.id, text: t.text }))]).catch(() => {});
        invoke("flushed");
      }),
    [],
  );

  // drafts loaded at startup are already on disk
  return (loaded: Record<string, string>) => {
    for (const [id, text] of Object.entries(loaded)) drafts.current.set(id, text);
  };
}
