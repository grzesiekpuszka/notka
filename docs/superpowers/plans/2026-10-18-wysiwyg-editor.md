# WYSIWYG Markdown Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the reader into a simple markdown-based text editor: files open in an editable WYSIWYG view with a formatting toolbar, a raw Markdown mode (CodeMirror + preview) one click away, and Notepad-style tabs in the title bar instead of the sidebar.

**Architecture:** Each tab has a `mode` (`"wysiwyg" | "markdown"`). The WYSIWYG view is a lazily loaded Milkdown editor (`src/wysiwyg/`) that shows the existing fast `Reader` HTML as its loading fallback, so content is visible at once. Both editors expose one `EditorHandle` that a shared `Toolbar` drives. Raw-markdown formatting is pure text functions in `src/mdcommands.ts`. The window drops the native title bar (`titleBarStyle: "hidden"` + `titleBarOverlay`) and draws a `TabBar` in its place.

**Tech Stack:** existing (Electron 44, React 19, Tailwind 4, Vite 8, CodeMirror 6, marked, DOMPurify, vitest + jsdom) plus `@milkdown/kit` 7.22 (core, preset commonmark + gfm, history, listener, clipboard) and `remark-frontmatter`.

**Spec:** `docs/superpowers/specs/2026-10-18-wysiwyg-editor-design.md` (amends `docs/superpowers/specs/2026-10-18-simple-markdown-reader-design.md`).

**Mockup:** `.superpowers/brainstorm/11017-1792344050/content/editor-layout.html` (sections 1, 2 and variant A).

## Global Constraints

- Everything in AGENTS.md still holds: `t()` for every UI string with a Polish entry, portable `data\`, security rules, small commits, Node via `export PATH="$LOCALAPPDATA/Author Software/nvm/.nodejs:$PATH"`, patch scripts via the Write tool.
- Speed: window with content < 1 s; opening a file ≤ 1 MB shows content < 100 ms. Milkdown, CodeMirror and highlight.js are never imported statically from the startup path.
- No false changes: opening, scrolling, clicking, switching modes never set the dirty dot. Until a real WYSIWYG edit, `tab.text` is exactly the file text.
- Content never disappears in a WYSIWYG round trip: front matter, HTML (block, inline, comments), footnotes, reference definitions, link titles survive; no new escaping of `_` inside words. A file whose content key changes in a round trip opens in Markdown mode with a notice.
- Files > 1 MB open in Markdown mode with the same notice mechanism.
- Raw HTML never executes or restyles the app in either mode.
- Last tab closed → a new empty untitled tab; there is no empty screen.
- Tabs reorder by dragging; order is saved in the session.
- Version `1.1.0-beta.1`, notes in `notes/v1.1.0-beta.1.md`.

## Review Focus

1. Opening a file, switching WYSIWYG ↔ Markdown and closing it without typing: no dot, no save prompt, file bytes unchanged — test in Task 4 (`creating the editor never reports a change`) and E2E in Task 7.
2. Polish typing in WYSIWYG (AltGr letters `ąęółśżźćń`, dead keys) inserts the right characters and marks the tab dirty — E2E step in Task 7.
3. A document with `<script>`, `<img onerror>` or `<style>` shown in WYSIWYG executes nothing and keeps the app's look — test in Task 5 (`raw html shows as text`).
4. A 1 MB document: WYSIWYG not used (Markdown mode + notice), tab content visible < 100 ms — test in Task 5 (`large files open in markdown mode`) + E2E timing in Task 7.
5. Clicking a tab, its ✕ and `+` inside the draggable title-bar row works (not swallowed as window drag), and dragging empty space moves the window — E2E step in Task 2.

---

## File Structure

```
electron/main.ts           window chrome (titleBarStyle/overlay), overlay colors on theme change, pick_image handler
src/api.ts                 Mode type; TabState.mode replaces editing; Session without collapsed
src/tabs.ts                reducer: move, setMode, close-last → untitled, notice; restoreTabs migration
src/paths.ts               + relativePath()
src/mdcommands.ts          raw-markdown formatting (pure)
src/format.ts              Format type + EditorHandle interface shared by both editors
src/TabBar.tsx             tabs in the title bar (replaces Sidebar.tsx)
src/Toolbar.tsx            formatting toolbar, mode switch, update icon, "…" menu
src/LinkPopover.tsx        URL input for Ctrl+K / link button
src/Editor.tsx             CodeMirror: + EditorHandle via ref (Markdown mode)
src/DocView.tsx            per-tab body: WYSIWYG or Markdown split, bars, status bar
src/wysiwyg/Wysiwyg.tsx    lazy Milkdown editor component (EditorHandle via ref)
src/wysiwyg/setup.ts       createEditor(): Milkdown config, plugins, touched/onChange, links, images
src/wysiwyg/frontmatter.ts remark-frontmatter + "frontmatter" node (verbatim, non-editable block)
src/wysiwyg/highlight.ts   code block highlighting decorations (lazy highlight.js)
src/wysiwyg/fidelity.ts    contentKey(), roundTrip() check
src/Menu.tsx               opens downward, right-aligned
src/App.tsx                layout without sidebar/empty state
src/Sidebar.tsx            deleted
tests/tabs.test.ts, tests/mdcommands.test.ts, tests/paths.test.ts, tests/wysiwyg.test.ts, tests/fidelity.test.ts
```

---

### Task 1: Tab model — modes, reorder, never empty

**Files:**
- Modify: `src/api.ts`, `src/tabs.ts`, `src/persist.ts` (types only), `src/App.tsx`, `src/DocView.tsx`, `src/Sidebar.tsx` (keep compiling until Task 2 deletes it)
- Test: `tests/tabs.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // src/api.ts
  export type Mode = "wysiwyg" | "markdown";
  export type TabState = { id: string; path: string | null; untitled: number; mode: Mode; scroll: number };
  export type Session = { tabs: TabState[]; active: string | null; closed: TabState[] };
  // src/tabs.ts
  export type Tab = TabState & { text: string; saved: string; meta: DocMeta; missing: boolean; changed: boolean; notice: string | null };
  export type State = { tabs: Tab[]; active: string | null; closed: TabState[] };
  // Action: removes "toggleEdit" and "collapse"; adds
  | { type: "setMode"; id: string; mode: Mode; notice?: string | null }
  | { type: "move"; id: string; to: number }   // `to` = index in the new order
  ```
  - `new` creates `mode: "wysiwyg"` (was editing: true). `open`/`restore` keep the entry's mode or `"wysiwyg"`.
  - `close` of the last tab leaves exactly one new empty untitled tab (number 1), active.
  - `restoreTabs` accepts legacy entries `{ editing?: boolean }` (beta.3 sessions): `editing: true` → `"markdown"`, else `"wysiwyg"`; legacy `collapsed` ignored; an empty restored session gets one untitled tab.
  - `notice` is shown by DocView as a bar (Task 5 sets it); `setMode` without `notice` clears it.

- [ ] **Step 1: Write failing tests** (update existing ones that used `toggleEdit`/`editing`/`collapsed`):
  - `closing the last tab leaves an empty untitled tab`: open A, close it → `tabs.length === 1`, `path === null`, `untitled === 1`, `mode === "wysiwyg"`, active is it; `closed[0].path === "A"`.
  - `move reorders tabs`: A B C, `move(C, 0)` → C A B; `move(C, 2)` → A B C; active unchanged.
  - `setMode switches and sets/clears notice`: `setMode(id,"markdown","x")` → mode markdown, notice "x"; `setMode(id,"wysiwyg")` → notice null.
  - `restoreTabs migrates beta.3 sessions`: legacy tabs `{editing:true}` → markdown, `{editing:false}` → wysiwyg.
  - `restoreTabs never returns no tabs`: empty session → one untitled tab, active.
  - `restore reopens with mode and scroll` (replaces the editing variant).
- [ ] **Step 2: Run** `pnpm test tests/tabs.test.ts` → FAIL.
- [ ] **Step 3: Implement** the types and reducer changes; adapt `App.tsx`/`DocView.tsx`/`Sidebar.tsx` minimally (Ctrl+E dispatches `setMode` toggling; DocView treats `mode === "markdown"` as today's split view and `"wysiwyg"` as today's reader for now).
- [ ] **Step 4: Run** `pnpm test` → PASS; `npx tsc --noEmit` clean.
- [ ] **Step 5: Commit** `feat: tab modes, reorder, never empty`.

---

### Task 2: Window chrome and tab bar

**Files:**
- Create: `src/TabBar.tsx`
- Modify: `electron/main.ts`, `src/App.tsx`, `src/Menu.tsx`, `src/styles.css`, `src/i18n.ts`
- Delete: `src/Sidebar.tsx` (move `tabName` to `src/TabBar.tsx`)

**Interfaces:**
- Consumes: `move`, `activate`, `new`, close flow (Task 1, App's `close(id)`).
- Produces:
  - `export const tabName: (tab: Tab) => string` from `src/TabBar.tsx`.
  - `TabBar` props `{ state: State; onActivate(id): void; onClose(id): void; onNew(): void; onMove(id: string, to: number): void }`.
  - `const BAR = 40` (px) — title-bar height used by main (`titleBarOverlay.height`) and the renderer (`h-10`).
  - Handler `set_theme` also calls `win.setTitleBarOverlay({ color, symbolColor })`; `nativeTheme.on("updated")` does the same. Colors: light `color "#f3f3f3", symbolColor "#1c1c1f"`, dark `color "#202020", symbolColor "#f4f4f5"`.

- [ ] **Step 1: Window**: `BrowserWindow` gets `titleBarStyle: "hidden"`, `titleBarOverlay: { color, symbolColor, height: 40 }` (remove `autoHideMenuBar`). Keep everything else.
- [ ] **Step 2: TabBar** per mockup variant A: row `h-10` on window background, `-webkit-app-region: drag` on the row, `no-drag` on tabs and `+`; right padding `env(titlebar-area-width)`-based (fallback 140 px) so tabs never go under the window buttons. Tab: min 120 px, max 220 px, shrinks, then the tab strip scrolls horizontally (wheel scrolls it); active tab `bg-surface` joined to the toolbar below; name truncated; accent dot when dirty; ✕ on active and hover; middle-click closes; `title` = full path or name. Double-click on empty row space maximizes (native behaviour of a drag region — verify). Reorder with HTML5 drag & drop (`draggable` tabs, drop index from pointer x) → `onMove`.
- [ ] **Step 3: App layout**: column = `TabBar` + (placeholder toolbar row with the existing `Menu` at the right) + DocView. Remove Sidebar, empty state, theme cycle button, `collapse`. `Menu` opens downward, right-aligned (`top-full right-0 mt-1`).
- [ ] **Step 4: Verify** (dev build over CDP + screenshots light/dark): tabs render like the mockup; `+` creates a tab; clicking tabs, ✕ and middle-click work; drag a tab to the first place → order changes and survives restart; window buttons recolor when switching theme; dragging the empty part of the row moves the window (manual, note in ledger if not automatable).
- [ ] **Step 5: Commit** `feat: Notepad-style tabs in the title bar`.

---

### Task 3: Toolbar and Markdown-mode formatting

**Files:**
- Create: `src/format.ts`, `src/mdcommands.ts`, `src/Toolbar.tsx`, `src/LinkPopover.tsx`, `tests/mdcommands.test.ts`
- Modify: `src/Editor.tsx`, `src/DocView.tsx`, `src/App.tsx`, `src/paths.ts`, `tests/paths.test.ts`, `electron/main.ts`, `src/i18n.ts`

**Interfaces:**
- Produces:
  ```ts
  // src/format.ts
  export type Block = "p" | "h1" | "h2" | "h3";
  export type Format = Block | "bold" | "italic" | "strike" | "code" | "link" | "bullet" | "ordered" | "task" | "quote" | "codeblock" | "table" | "image" | "hr";
  export interface EditorHandle {
    run(f: Format, arg?: string): void;   // arg: URL for "link", path for "image"
    active(): Set<Format>;                // current block + active marks under the cursor
    selectedText(): string;
    focus(): void;
  }
  // src/mdcommands.ts — sel is [from, to] in text, result is new text + new selection
  export type Edit = { text: string; sel: [number, number] };
  export function format(text: string, sel: [number, number], f: Format, arg?: string): Edit;
  // src/paths.ts
  export function relativePath(fromDir: string, to: string): string;  // Windows paths in, "/"-separated relative path out, spaces encoded as %20
  ```
  - `Toolbar` props `{ handle: EditorHandle | null; mode: Mode; onMode(m: Mode): void; onLink(): void; onImage(): void; menu: ReactNode; update: ReactNode }`; refreshes `active()` on `selectionchange`/editor updates (DocView passes a `tick` number).
  - `LinkPopover` props `{ initial: string; onSubmit(url: string): void; onClose(): void }`.
  - Handler `pick_image() → string | null` (`dialog.showOpenDialog`, filters png jpg jpeg gif webp svg).
  - Editor (CodeMirror) accepts `handleRef: RefObject<EditorHandle | null>`; `run` applies `format()` to the doc and selection; `active()` returns the block of the cursor line (`#`→h1…) only.

- [ ] **Step 1: Write failing tests** `tests/mdcommands.test.ts`:
  - `bold wraps the selection`: `format("a word b",[2,6],"bold")` → `{ text: "a **word** b", sel: [4,8] }`.
  - `bold unwraps when already bold`: `format("a **word** b",[4,8],"bold")` → `{ text: "a word b", sel: [2,6] }`.
  - `bold with no selection inserts markers around the cursor`: `format("ab",[1,1],"bold")` → `{ text: "a****b", sel: [3,3] }`.
  - `h2 replaces the line's heading prefix`: `format("# T\nx",[2,2],"h2")` → text `"## T\nx"`; `"p"` on `"## T"` → `"T"`.
  - `bullet toggles on every selected line`: `format("a\nb",[0,3],"bullet")` → `"- a\n- b"`; again → `"a\nb"`.
  - `task`, `ordered` (`1. `, `2. `), `quote` (`> `) behave like bullet.
  - `link`: `format("see docs",[4,8],"link","https://x")` → `"see [docs](https://x)"`.
  - `image`: `format("",[0,0],"image","img/a b.png")` → `"![](img/a%20b.png)"`.
  - `codeblock` wraps selected lines in ```` ``` ```` fences; `hr` inserts `"\n---\n"` on its own line; `table` inserts a 3×3 GFM table (`| Column 1 | Column 2 | Column 3 |` + `|---|---|---|` + 2 empty rows) on its own lines.
  `tests/paths.test.ts`: `relativePath("D:\\p\\docs", "D:\\p\\img\\a b.png")` → `"../img/a%20b.png"`; different drive → absolute `"C:/x/y.png"`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** `format.ts`, `mdcommands.ts`, `relativePath`. **Step 4: Run** → PASS.
- [ ] **Step 5: UI**: `Toolbar` per mockup (block select with Akapit/Nagłówek 1–3, B I S, code, link | bullet, ordered, task, quote, codeblock, table, image, hr | spacer | segmented WYSIWYG/Markdown | update icon | `…`). Active buttons `bg-accent-soft text-accent`. Every button has `title` with name and shortcut (Ctrl+B, Ctrl+I, Ctrl+K). Link button / Ctrl+K opens `LinkPopover` under the toolbar prefilled with the selected text if it looks like a URL. Image button → `pick_image` → `relativePath(dirname(tab.path), file)` (untitled: absolute path with `/`) → `run("image", path)`. Update icon replaces the sidebar card (same install flow, tooltip with version / progress). DocView loses its header bar (name lives in the tab); bars (changed/missing/notice) sit under the toolbar; status bar always visible (words, encoding; line/col in Markdown mode).
- [ ] **Step 6: Verify** in Markdown mode over CDP: each toolbar button changes the text as the tests say; Ctrl+B/I/K work in CodeMirror; segmented switch flips mode.
- [ ] **Step 7: Commit** `feat: formatting toolbar and markdown-mode commands`.

---

### Task 4: WYSIWYG editor core

**Files:**
- Create: `src/wysiwyg/Wysiwyg.tsx`, `src/wysiwyg/setup.ts`, `tests/wysiwyg.test.ts`
- Modify: `src/DocView.tsx`, `src/App.tsx`, `src/FindBar.tsx` (root getter), `package.json`

**Interfaces:**
- Consumes: `EditorHandle`, `Format` (Task 3), `Reader` (fallback), `findRanges` (FindBar).
- Produces:
  ```ts
  // src/wysiwyg/setup.ts
  export type WysiwygOptions = { root: HTMLElement; markdown: string; dir: string | null; onChange(md: string): void; onOpenLink(href: string): void };
  export async function createEditor(o: WysiwygOptions): Promise<{ handle: EditorHandle; getMarkdown(): string; setMarkdown(md: string): void; dom: HTMLElement; destroy(): void }>;
  ```
  - Plugins: `commonmark`, `gfm`, `history`, `listener`, `clipboard` from `@milkdown/kit`.
  - `onChange` fires only after a user edit: a `touched` flag set by `beforeinput`, `paste`, `drop`, `keydown` producing a doc change, or `handle.run`. Doc changes before that (normalization on load) are ignored.
  - `Wysiwyg` (default export, `React.lazy`) props `{ tab: Tab; onChange(md): void; onOpenLink(href): void; handleRef; onReady(dom: HTMLElement): void }`; `Suspense` fallback is `Reader` with the same text so the document is visible while Milkdown loads. Editor root uses the `.md` class so it looks exactly like the reader. Scroll position restored like Reader.
  - External text changes (reload from disk, mode switch from Markdown) call `setMarkdown` when `tab.text` differs from the last markdown the editor produced.

- [ ] **Step 1: `pnpm add -D @milkdown/kit`**.
- [ ] **Step 2: Write failing tests** `tests/wysiwyg.test.ts` (`// @vitest-environment jsdom`):
  - `creating the editor never reports a change`: for a corpus string with heading, list, task list, table, code block, link, image → after `createEditor` and two ticks, `onChange` not called.
  - `round trip keeps common markdown`: `getMarkdown()` of `"# T\n\n- a\n- b\n\n| a | b |\n| - | - |\n| 1 | 2 |\n\n- [x] done\n"` contains `"# T"`, `"- a"`, `"| a | b |"`, `"- [x] done"`.
  - `handle.run("bold") after selecting text reports markdown with **`: select a word via ProseMirror selection, run bold → last onChange arg contains `**word**`.
  - `input rule makes a heading`: simulate typing `## x` at start of an empty paragraph through the view's `someProp("handleTextInput")` → markdown starts with `"## x"`.
- [ ] **Step 3: Run** → FAIL. **Step 4: Implement** `setup.ts` + `Wysiwyg.tsx`; DocView renders `Wysiwyg` for `mode === "wysiwyg"`, Markdown split for `"markdown"`; FindBar root = the editor DOM in WYSIWYG; Ctrl+E / segmented switch use `setMode`. Mode switch never dispatches `edit`.
- [ ] **Step 5: Run** `pnpm test` → PASS.
- [ ] **Step 6: Measure**: `pnpm build`; renderer chunk sizes in the log (Milkdown in its own lazy chunk, `index-*.js` grows < 30 kB); packaged `--perf` ready < 1000 ms; time to visible text unchanged (Reader fallback). Record in the ledger. If Milkdown makes the WYSIWYG chunk > 600 kB or breaks the tests in ways that can't be fixed, switch to Tiptap 3 + `@tiptap/markdown` behind the same `createEditor` signature and record why.
- [ ] **Step 7: Commit** `feat: WYSIWYG editing with Milkdown`.

---

### Task 5: Round-trip fidelity and safety

**Files:**
- Create: `src/wysiwyg/frontmatter.ts`, `src/wysiwyg/fidelity.ts`, `tests/fidelity.test.ts`
- Modify: `src/wysiwyg/setup.ts`, `src/wysiwyg/Wysiwyg.tsx`, `src/App.tsx` (open path), `src/i18n.ts`, `package.json`

**Interfaces:**
- Produces:
  - `contentKey(md: string): string` — `render(md, null)` (existing `src/markdown.ts`) → text content with whitespace collapsed + every `href` and `src` in order + count of HTML comments in the source; formatting style does not affect it.
  - `async function checkFidelity(md: string): Promise<boolean>` — `contentKey(md) === contentKey(roundTrip(md))` where `roundTrip` uses a detached `createEditor`.
  - `const MAX_WYSIWYG = 1_000_000` (characters).
  - Opening a file (and restoring a WYSIWYG tab) runs: `text.length > MAX_WYSIWYG` → `setMode(id, "markdown", t("This file is large, so it opens as markdown."))`; else `checkFidelity` (after the content is visible) false → `setMode(id, "markdown", t("This file uses markdown the visual editor can't keep exactly, so it opens as markdown."))`.
  - `frontmatter` node: `remark-frontmatter` (`yaml`) + Milkdown `$node` rendering a non-editable `<pre class="frontmatter">` block, serialized verbatim.
  - Raw HTML (`html` node of commonmark) renders as escaped text in a muted monospace block/inline span; never as live DOM.

- [ ] **Step 1: `pnpm add -D remark-frontmatter`**.
- [ ] **Step 2: Write failing tests** `tests/fidelity.test.ts` (jsdom):
  - `front matter survives`: `"---\ntitle: X\n---\n\n# A\n"` → round trip starts with `"---\ntitle: X\n---"`.
  - `html comment and block html survive`: `"<!-- c -->\n\n<div align=\"center\">x</div>\n\ntext\n"` → round trip contains both verbatim.
  - `footnotes and reference links survive`: `"a[^1]\n\n[^1]: note\n\n[r]: https://x \"T\"\n\nsee [r]\n"` → `checkFidelity` true.
  - `no escaping inside words`: round trip of `"snake_case and a*b\n"` contains `"snake_case"`.
  - `raw html shows as text`: editor DOM for `"<script>window.x=1</script><img src=x onerror=\"window.y=1\">\n"` has no `script`/`img[onerror]` element, `window.x`/`window.y` undefined, and the text is visible.
  - `large files open in markdown mode`: `MAX_WYSIWYG` = 1_000_000 and the open path helper `initialMode(text)` returns `"markdown"` for `"a".repeat(1_000_001)`.
  - `contentKey ignores style`: `contentKey("* a\n* b")` === `contentKey("- a\n- b")`; differs for `"- a\n- c"`.
- [ ] **Step 3: Run** → FAIL. **Step 4: Implement** (fix escaping via the serializer's `unsafe`/handlers option or a remark-stringify setting; keep link titles and reference definitions — if Milkdown can't keep reference-style links, `checkFidelity` must return false for them so such files open in Markdown mode; record which). **Step 5: Run** → PASS.
- [ ] **Step 6: Commit** `feat: keep every markdown construct through the visual editor`.

---

### Task 6: WYSIWYG features — toolbar, links, images, tables, code

**Files:**
- Create: `src/wysiwyg/highlight.ts`
- Modify: `src/wysiwyg/setup.ts`, `src/wysiwyg/Wysiwyg.tsx`, `tests/wysiwyg.test.ts`

**Interfaces:**
- Consumes: `EditorHandle`/`Format` (Task 3), `resolveLink`, `imageUrl` (existing), `highlightAll`'s lazy hljs loader pattern.
- Produces: full `handle.run`/`handle.active` for every `Format` in WYSIWYG (Milkdown commands: heading/paragraph, strong, emphasis, strikethrough, inlineCode, link (update/remove), bullet/ordered list, task item (`checked` attr), blockquote, code block, table 3×3 with header, image (`src` = given path), hr).

- [ ] **Step 1: Write failing tests** (append to `tests/wysiwyg.test.ts`):
  - `toolbar formats in wysiwyg`: for `h2`, `italic`, `strike`, `code`, `bullet`, `ordered`, `task`, `quote`, `codeblock`, `hr`, `table`, `image` (arg `img/a.png`), `link` (arg `https://x`) — run on a selected word/paragraph, assert the markdown fragment (`"## "`, `"*w*"` or `"_w_"`, `"~~w~~"`, `` "`w`" ``, `"- "`, `"1. "`, `"- [ ] "`, `"> "`, ```` "```" ````, `"---"`, `"| "`, `"![](img/a.png)"`, `"[w](https://x)"`).
  - `active reports marks and block`: cursor in bold text inside `## T **b**` → `active()` has `"h2"` and `"bold"`.
  - `tab in the last table cell adds a row`: table with 2 rows, cursor in last cell, Tab → serialized table has 3 body rows.
  - `ctrl+click opens links, click doesn't`: dispatch `mousedown`/`click` on the link DOM with and without `ctrlKey` → `onOpenLink` called once with the href.
  - `relative images display through mdimg`: editor with `dir "D:\\d"` and `![a](img/p.png)` → `img.src` starts with `mdimg://f/`, markdown still `img/p.png`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement**: commands; Ctrl+K opens the LinkPopover (App passes the handler down); ctrl+click via a ProseMirror `handleClick` plugin; image `toDOM` override using `resolveLink(dir, src)` + `imageUrl`; Tab-in-last-cell keymap; code highlighting as ProseMirror decorations from lazily loaded highlight.js (no change to the document), same colors as the reader. **Step 4: Run** → PASS.
- [ ] **Step 5: Verify** over CDP in WYSIWYG: every toolbar button, active states while moving the caret, link popover, image picker, typing `## `, `- `, `**x**`, table Tab, code block colors, Ctrl+F highlights, Ctrl+click on a link to another .md opens a tab.
- [ ] **Step 6: Commit** `feat: WYSIWYG toolbar, links, images, tables and code`.

---

### Task 7: Polish, docs, end-to-end, release prep

**Files:**
- Modify: `src/i18n.ts`, `README.md`, `AGENTS.md`, `package.json` (version), `notes/v1.1.0-beta.1.md` (create)

- [ ] **Step 1: i18n**: every new string has a Polish entry; remove unused entries (sidebar).
- [ ] **Step 2: Docs**: README (editor description, toolbar, modes, shortcuts incl. Ctrl+B/I/K, Ctrl+E = switch mode, tabs drag), AGENTS.md (WYSIWYG notes: lazy Milkdown, fidelity rule, no false changes), version `1.1.0-beta.1`, release notes.
- [ ] **Step 3: E2E on a packaged scratch build** (AGENTS.md recipe): `--perf` 5× < 1000 ms; open sample.md → WYSIWYG, no dot; switch to Markdown → original text (byte-equal to file), no dot; close → no prompt, file unchanged (Review Focus 1); type `ąęółśżźćń` via `Input.insertText` and via `Input.dispatchKeyEvent` with AltGr → characters appear, dot shown (Review Focus 2); open a 1 MB file → markdown mode + notice, content visible < 100 ms (Review Focus 4); front-matter + html file → WYSIWYG shows them as blocks, save keeps them; restart restores tabs, order, modes; beta.3 session in `data\session.json` loads (modes migrated); last tab close → new empty tab; screenshots light/dark vs mockup.
- [ ] **Step 4: Run** `pnpm test` → all pass; `pnpm build` → no warnings.
- [ ] **Step 5: Commit** `docs: editor docs and 1.1.0-beta.1 notes`.
