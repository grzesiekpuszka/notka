# Simple Markdown Reader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A portable, fast Windows 11 markdown reader/editor (Electron) with tabs in a collapsible sidebar, Notepad-like session restore and GitHub-based updates.

**Architecture:** Electron main process (`electron/`) owns files, session/drafts persistence in `data\` next to the exe, file watching, the `mdimg:` image protocol, `.md` association and updates (ported from lokaldev). The React renderer (`src/`) holds all tab state in one pure reducer (`src/tabs.ts`), renders markdown with `marked` + DOMPurify, and lazy-loads CodeMirror 6 (editor) and highlight.js (code colors) on first use, so startup stays light. One IPC channel `invoke(cmd, args)` like lokaldev.

**Tech Stack:** Electron ^44.7, TypeScript ~6.0 strict, React 19, Tailwind v4, Vite 8, esbuild (main/preload → CJS), pnpm 12, electron-builder ^26 (`--win dir`), marked + marked-gfm-heading-id, dompurify, highlight.js, CodeMirror 6, vitest + happy-dom (pure-logic tests only), C# `updater.exe` via Windows `csc.exe`.

**Spec:** `docs/superpowers/specs/2026-10-18-simple-markdown-reader-design.md`

**Reference project:** `D:\Projekty\Aplikacje\lokaldev` — many files are copied and trimmed from there; paths are named in each task.

## Global Constraints

- Node in Git Bash: `export PATH="$LOCALAPPDATA/Author Software/nvm/.nodejs:$PATH"` (Node 22, pnpm 12.11.2). Write patch scripts with the Write tool (heredocs mangle backslashes).
- Code, commits, README, release notes in English. Every UI string is an English source string through `t()` with a Polish entry in `src/i18n.ts`; language = `pl` when `app.getLocale()` starts with `pl`, else `en`.
- KISS, lokaldev style, minimal comments (only non-obvious "why").
- Security as lokaldev: `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`; IPC accepted only from `win.webContents.mainFrame`; `will-navigate` blocked; new windows denied; CSP meta injected at build only; raw HTML in markdown sanitized by DOMPurify.
- Product name `Simple Markdown Reader`, `appId` `dev.smr.app`, `win.executableName` `simple-markdown-reader`, repo `grzesiekpuszka/simple-markdown-reader`, version starts at `1.0.0-beta.1`. Never publish a pre-release on GitHub (the app reads `releases/latest`).
- Portable: `ROOT = app.isPackaged ? dirname(process.execPath) : process.cwd()`, `DATA = ROOT\data`. Nothing is written elsewhere except the HKCU keys of "Set as default for .md".
- Colors: token values 1:1 from `lokaldev/src/styles.css` (bg, surface, surface-2, border, text, muted, accent, accent-hover, accent-soft, on-accent, success, warning, danger + their -soft). Window `backgroundColor` `#202020` dark / `#f3f3f3` light. Fonts: `"Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif` and `"Cascadia Mono", Consolas, ui-monospace, monospace`.
- Performance: window with content visible < 1 s on owner's PC with the app not running (first start after reboot excluded); tab switch / opening a file ≤ 1 MB < 100 ms. Never import CodeMirror or highlight.js statically from the startup path.
- Closed-tab history max 20 entries. Text column max width 760 px.
- Commit after every task (small commits, message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`).

## Review Focus

1. A file open in two places (`D:\a\README.md` vs `d:\A\readme.md`, or via a relative path from the second instance's cwd) must map to one tab — test in Task 4 (`open dedupes paths case-insensitively`) and Task 5 (`argPaths resolves against cwd`).
2. A file whose own save triggers the watcher must not show "changed on disk" — test in Task 4 (`changed is ignored when disk text equals saved text`).
3. Quitting (window ✕, Alt+F4, update restart) right after typing must not lose the last keystrokes — Task 7 flushes drafts before the window closes; verification step types and closes within 200 ms.
4. A UTF-8 file with BOM and CRLF opened, edited and saved must keep BOM and CRLF byte-for-byte except the edit — test in Task 2 (`round-trips utf8bom crlf`).
5. A markdown link/image with spaces, `%20`, `..\` or a `#anchor` (`[x](../docs/My%20File.md#setup)`) must resolve to the right file — test in Task 3 (`resolves encoded relative link with anchor`).

---

## File Structure

```
package.json, pnpm-workspace.yaml, tsconfig.json, vite.config.ts, vitest.config.ts, index.html, .gitignore, AGENTS.md, README.md
scripts/dev.mjs            Vite + esbuild + electron dev loop (copy of lokaldev)
scripts/build-updater.mjs  csc.exe → resources/updater.exe
scripts/icon.cjs           svg → ico/png (copy of lokaldev)
scripts/release.mjs        GitHub release (copy of lokaldev, renamed)
shim/updater.cs            update installer (copy of lokaldev, adapted)
resources/icon.svg|ico|png
electron/main.ts           app lifecycle, window, IPC handlers, single instance, close/flush
electron/preload.ts        window.smr bridge
electron/util.ts           ROOT, DATA, p(), errorText()
electron/encoding.ts       decode/encode buffers (pure)
electron/files.ts          readDoc/writeDoc
electron/session.ts        session.json, drafts, window bounds, settings
electron/watch.ts          fs.watch per open path
electron/images.ts         mdimg: protocol
electron/assoc.ts          .md association (HKCU)
electron/updates.ts        GitHub update check/download/apply (ported)
src/api.ts                 shared types + invoke()/on()
src/i18n.ts                t() + pl dictionary
src/paths.ts               dirname/resolveLink (pure)
src/markdown.ts            render(text, dir) → safe HTML
src/highlight.ts           lazy highlight.js
src/tabs.ts                reducer + restoreTabs (pure)
src/App.tsx                layout, effects, shortcuts
src/Sidebar.tsx, src/DocView.tsx, src/Reader.tsx, src/Editor.tsx, src/FindBar.tsx, src/Menu.tsx, src/Dialog.tsx, src/ui.tsx
src/styles.css             tokens + .md prose styles
tests/*.test.ts
```

---

### Task 1: Scaffold, window, IPC bridge

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `index.html`, `scripts/dev.mjs`, `electron/main.ts`, `electron/preload.ts`, `electron/util.ts`, `src/api.ts`, `src/i18n.ts`, `src/main.tsx`, `src/App.tsx`, `src/styles.css`, `AGENTS.md`
- Modify: `.gitignore` (add `release-test/`)

**Interfaces:**
- Produces:
  - `window.smr = { invoke(cmd: string, args?: unknown): Promise<{ok:true,value:any}|{ok:false,error:string}>, on(event: string, cb: (payload: any) => void): () => void, pathFor(file: File): string }` (`pathFor` = `webUtils.getPathForFile`).
  - `src/api.ts`: `invoke<T>(cmd: string, args?: object): Promise<T>` (throws `Error(error)` on `ok:false`), `on(event, cb)`, and the types below — the contract used by every later task:
    ```ts
    export type Encoding = "utf8" | "utf8bom" | "utf16le" | "utf16be" | "cp1250";
    export type DocMeta = { encoding: Encoding; eol: "\n" | "\r\n" };
    export type FileDoc = { path: string; text: string; meta: DocMeta };
    export type Theme = "system" | "light" | "dark";
    export type TabState = { id: string; path: string | null; untitled: number; editing: boolean; scroll: number };
    export type Session = { tabs: TabState[]; active: string | null; closed: TabState[]; collapsed: boolean };
    export type UpdateState = { current: string; available: { version: string; notes: string; page: string } | null; downloaded: boolean };
    export type Startup = { session: Session; drafts: Record<string, string>; open: string[]; theme: Theme; lang: Lang; version: string; updated: "ok" | "failed" | null };
    ```
  - `electron/main.ts`: `const handlers: Record<string, (args: any) => unknown>`; later tasks add entries. `emit(event: string, payload: unknown)` in `util.ts`.
  - `src/i18n.ts`: `t(text, vars?)`, `setLang(lang)`, `type Lang = "en" | "pl"` (copy lokaldev's `t`/`fill`, drop `languages`/`plural`).

- [ ] **Step 1: Create config files.** `package.json` from lokaldev's with: `name` `simple-markdown-reader`, `version` `1.0.0-beta.1`, `description` `Simple markdown reader and editor`, scripts `dev` (`pnpm build:updater && node scripts/dev.mjs`), `build:updater`, `build:main` (same esbuild line), `build` (`pnpm build:updater && tsc --noEmit && vite build && pnpm build:main`), `dist`, `icon`, `release`, `test` (`vitest run`); deps: lokaldev's minus node-forge/@types/node-forge, plus `marked`, `marked-gfm-heading-id`, `dompurify`, `highlight.js`, `@codemirror/state`, `@codemirror/view`, `@codemirror/commands`, `@codemirror/language`, `@codemirror/lang-markdown`, `@codemirror/search`, `vitest`, `happy-dom` (add with `pnpm add`, latest). `build` section: lokaldev's with appId/productName/executableName from Global Constraints, `extraResources` only `updater.exe` and `icon.ico`. `pnpm-workspace.yaml`, `tsconfig.json` (include `src`, `electron`, `tests`), `scripts/dev.mjs`, `index.html` (title `Simple Markdown Reader`): copies of lokaldev. `vite.config.ts`: lokaldev's, CSP `img-src 'self' data: mdimg: https: http:`. `vitest.config.ts`: `test: { include: ["tests/**/*.test.ts"], environment: "node" }`.
- [ ] **Step 2: `electron/util.ts`** with `ROOT`, `DATA`, `p(...parts)`, `exists`, `errorText`, `emit`, and `fs.mkdirSync(p("drafts"), { recursive: true })`.
- [ ] **Step 3: `electron/main.ts`**: `app.requestSingleInstanceLock()` first (else `app.exit(0)`); `createWindow()` with lokaldev's `webPreferences`, `width 1100, height 760, minWidth 640, minHeight 420`, `show: false`, `autoHideMenuBar: true`, `backgroundColor` per `nativeTheme.shouldUseDarkColors`, `win.once("ready-to-show", () => win.show())`; when `process.argv` contains `--perf` print `ready <process.uptime() ms>` to stdout at ready-to-show. Copy lokaldev's `ipcMain.handle("invoke")` guard, `openLink`, `setWindowOpenHandler`, `will-navigate` block. Window close quits the app (no tray). Handler `open_external({url})` → `openLink`.
- [ ] **Step 4: `electron/preload.ts`** exposing `window.smr` as above; `src/api.ts` with the types and wrappers; `src/main.tsx` copy; `src/App.tsx` placeholder rendering the sidebar/card shell from the mockup (`.superpowers/brainstorm/*/content/layout.html`) with static content; `src/styles.css` = lokaldev's minus the framework colors (`laravel`…`php`, `idle-soft`).
- [ ] **Step 5: `AGENTS.md`** with this project's rules: the Global Constraints above, build/run commands, E2E verification recipe from Task 12, "owner pushes and releases".
- [ ] **Step 6: Verify.** Run `pnpm install && pnpm build`. Expected: exit 0. Run `pnpm dev`. Expected: window opens with the mockup shell, correct light/dark background, no console errors.
- [ ] **Step 7: Commit** `chore: scaffold electron app`.

---

### Task 2: Encoding and file I/O

**Files:**
- Create: `electron/encoding.ts`, `electron/files.ts`, `tests/encoding.test.ts`
- Modify: `electron/main.ts` (handlers)

**Interfaces:**
- Consumes: `DocMeta`, `FileDoc`, `Encoding` (Task 1).
- Produces:
  - `decode(buf: Buffer): { text: string; meta: DocMeta }` — BOM `EF BB BF` → `utf8bom`; `FF FE` → `utf16le`; `FE FF` → `utf16be`; else strict UTF-8 (`new TextDecoder("utf-8", { fatal: true })`) → `utf8`; on failure `windows-1250` → `cp1250`. `eol` = `"\r\n"` if the text contains `\r\n`, else `"\n"`. Returned text has BOM stripped and `\r\n` → `\n`.
  - `encode(text: string, meta: DocMeta): Buffer` — `\n` → `meta.eol`; writes BOM for `utf8bom`/`utf16*`; `cp1250` encodes as UTF-8 (caller has warned the user).
  - `readDoc(path: string): Promise<FileDoc | null>` (`null` on ENOENT), `writeDoc(path: string, text: string, meta: DocMeta): Promise<void>` (write to `path + ".smr-tmp"` then rename, so a crash never truncates the file).
  - Handlers: `read_file({path}) → FileDoc|null`, `write_file({path,text,meta}) → null`, `save_as({text,meta,name}) → string|null` (`dialog.showSaveDialog`, filters `Markdown: md, markdown`, `defaultPath` = `name`), `open_dialog() → string[]` (`multiSelections`, same filters + `All files`).

- [ ] **Step 1: Write failing tests** in `tests/encoding.test.ts`:
  - `round-trips utf8bom crlf`: `encode(decode(b).text.replace("a","b"), decode(b).meta)` equals the original bytes with that one change, for `b = Buffer.from("\uFEFFa\r\nż\r\n")` (as UTF-8).
  - `plain utf8 lf`: `decode(Buffer.from("x\ny"))` → `{ text: "x\ny", meta: { encoding: "utf8", eol: "\n" } }`.
  - `utf16le with bom`: `decode(Buffer.from([0xff,0xfe,0x41,0x00]))` → text `"A"`, encoding `utf16le`; `encode("A", meta)` equals the input.
  - `utf16be with bom`: `[0xfe,0xff,0x00,0x41]` → `"A"`, `utf16be`, round-trips.
  - `cp1250 fallback`: `decode(Buffer.from([0xb9,0x9c]))` → text `"ąś"`, encoding `cp1250`; `encode("ąś", meta)` equals `Buffer.from("ąś")` (UTF-8).
- [ ] **Step 2: Run** `pnpm test tests/encoding.test.ts`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement** `electron/encoding.ts`, `electron/files.ts` and the four handlers.
- [ ] **Step 4: Run** `pnpm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: read and write markdown files with their encoding`.

---

### Task 3: Markdown rendering, link resolution, local images

**Files:**
- Create: `src/paths.ts`, `src/markdown.ts`, `src/highlight.ts`, `electron/images.ts`, `tests/paths.test.ts`, `tests/markdown.test.ts`
- Modify: `electron/main.ts` (register protocol)

**Interfaces:**
- Produces:
  - `dirname(path: string): string`, `resolveLink(baseDir: string, href: string): { path: string; hash: string }` — Windows-style, accepts `/` and `\`, decodes `%xx`, normalizes `.`/`..`, absolute hrefs (`C:\…`, `C:/…`) kept.
  - `imageUrl(absPath: string): string` → `"mdimg://f/" + encodeURIComponent(absPath)`.
  - `render(text: string, dir: string | null): string` — `marked` with `gfm: true`, `marked-gfm-heading-id`; relative `<img src>` rewritten via `resolveLink`+`imageUrl` (only when `dir` set); result through `DOMPurify.sanitize` allowing the `mdimg:` scheme (`ALLOWED_URI_REGEXP` extended); task-list checkboxes kept `disabled`.
  - `highlightAll(root: HTMLElement): Promise<void>` — on first call `await import("highlight.js/lib/common")`, then `hljs.highlightElement` on each `pre code` not yet highlighted.
  - `electron/images.ts`: `registerImages()` — `protocol.registerSchemesAsPrivileged([{ scheme: "mdimg", privileges: { standard: true, secure: true } }])` before ready, and after ready `protocol.handle("mdimg", …)` serving only extensions `png jpg jpeg gif webp svg bmp ico avif` via `net.fetch(pathToFileURL(file))`, else 404.

- [ ] **Step 1: Write failing tests.** `tests/paths.test.ts`:
  - `resolves encoded relative link with anchor`: `resolveLink("D:\\p\\docs\\a", "../docs/My%20File.md#setup")` → `{ path: "D:\\p\\docs\\My File.md", hash: "setup" }`.
  - `keeps absolute`: `resolveLink("D:\\x", "C:/y/z.md").path` → `"C:\\y\\z.md"`.
  - `dirname`: `dirname("D:\\a\\b.md")` → `"D:\\a"`.
  `tests/markdown.test.ts` (`// @vitest-environment happy-dom`):
  - `renders gfm table and task list`: output contains `<table>` and `<input` with `disabled`.
  - `strips scripts`: `render("<script>alert(1)</script><img src=x onerror=alert(1)>", null)` contains neither `<script` nor `onerror`.
  - `rewrites relative image`: `render("![a](img/p%20q.png)", "D:\\d")` contains `src="mdimg://f/D%3A%5Cd%5Cimg%5Cp%20q.png"`.
  - `keeps remote image`: `render("![a](https://x.y/i.png)", "D:\\d")` contains `src="https://x.y/i.png"`.
  - `adds heading ids`: `render("## Set up", null)` contains `id="set-up"`.
- [ ] **Step 2: Run** `pnpm test`. Expected: FAIL.
- [ ] **Step 3: Implement** the four modules and call `registerImages()` in main.
- [ ] **Step 4: Run** `pnpm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: render GitHub-flavored markdown safely`.

---

### Task 4: Tab state reducer

**Files:**
- Create: `src/tabs.ts`, `tests/tabs.test.ts`

**Interfaces:**
- Consumes: `TabState`, `Session`, `FileDoc`, `DocMeta` (Task 1).
- Produces:
  ```ts
  export type Tab = TabState & { text: string; saved: string; meta: DocMeta; missing: boolean; changed: boolean };
  export type State = { tabs: Tab[]; active: string | null; closed: TabState[]; collapsed: boolean };
  export type Action =
    | { type: "open"; doc: FileDoc }
    | { type: "new" }
    | { type: "close"; id: string }
    | { type: "restore"; doc: FileDoc | null }        // pops closed[0]
    | { type: "edit"; id: string; text: string }
    | { type: "saved"; id: string; path: string; meta: DocMeta }
    | { type: "activate"; id: string }
    | { type: "cycle"; step: 1 | -1 }
    | { type: "toggleEdit"; id: string }
    | { type: "scroll"; id: string; scroll: number }
    | { type: "disk"; doc: FileDoc }                    // file changed on disk
    | { type: "reload"; doc: FileDoc }                  // user chose Reload: text = saved = disk, changed cleared
    | { type: "missing"; path: string }
    | { type: "keepMine"; id: string }                  // dismiss the "changed" bar
    | { type: "collapse" }
    | { type: "init"; state: State };
  export const dirty: (t: Tab) => boolean;            // t.text !== t.saved
  export const samePath: (a: string, b: string) => boolean; // case-insensitive, `/` == `\`
  export const toSession: (s: State) => Session;
  export function restoreTabs(session: Session, drafts: Record<string, string>, docs: Record<string, FileDoc | null>): State;
  export function reducer(s: State, a: Action): State;
  export const emptyMeta: DocMeta; // { encoding: "utf8", eol: "\r\n" } — new files get CRLF, Windows default
  ```
  Ids: `crypto.randomUUID()`. Untitled numbers: `max(untitled of open tabs) + 1`.

- [ ] **Step 1: Write failing tests** in `tests/tabs.test.ts`:
  - `open dedupes paths case-insensitively`: open `D:\a\README.md`, then `d:/A/readme.md` → 1 tab, active is it.
  - `new creates numbered untitled in edit mode`: two `new` → `untitled` 1 and 2, `editing: true`, `path: null`, not dirty.
  - `close pushes clean file tab to closed, max 20`: open+close 21 files → `closed.length === 20`, `closed[0]` is the last closed; closing an untitled tab adds nothing.
  - `close activates the neighbour`: tabs A B C, active B, close B → active C; close C → active A.
  - `restore reopens with editing and scroll`: close a tab with `editing: true, scroll: 300`, `restore` with its doc → tab back, same `editing`/`scroll`, `closed` shrinks; `restore` with `doc: null` only pops.
  - `restore of an already open path activates it`.
  - `changed is ignored when disk text equals saved text`: `disk` with identical text → state unchanged (`toBe` same object).
  - `disk reloads a clean tab silently`: text/saved replaced, `changed: false`.
  - `disk flags a dirty tab`: `changed: true`, text kept.
  - `reload replaces mine`: after `disk` on a dirty tab, `reload` → not dirty, `changed: false`, text = disk text.
  - `saved clears dirty and turns untitled into file`: `path` set, `untitled: 0`, `saved === text`.
  - `cycle wraps`: last + 1 → first; first − 1 → last.
  - `restoreTabs`: session with a file tab (doc present), a file tab with draft `"x"` (dirty, text `"x"`), a missing file tab with draft (kept, `missing: true`), a missing file tab without draft (dropped), an untitled tab with draft → state in session order, `active` kept or falls back to first tab.
- [ ] **Step 2: Run** `pnpm test tests/tabs.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `src/tabs.ts`.
- [ ] **Step 4: Run** `pnpm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: tab state reducer`.

---

### Task 5: Reader UI, sidebar, opening files

**Files:**
- Create: `src/Sidebar.tsx`, `src/DocView.tsx`, `src/Reader.tsx`, `src/ui.tsx`, `electron/args.ts`, `tests/args.test.ts`
- Modify: `src/App.tsx`, `src/styles.css`, `electron/main.ts`, `scripts/dev.mjs` (forward `process.argv.slice(2)` to electron)

**Interfaces:**
- Consumes: `reducer`, `State`, `Tab` (Task 4), `render`, `highlightAll`, `resolveLink`, `dirname` (Task 3), `read_file`, `open_dialog` (Task 2).
- Produces:
  - `argPaths(argv: string[], cwd: string): string[]` (`electron/args.ts`) — drops the exe (and in dev the script) and anything starting with `-`, resolves relative paths against `cwd`.
  - Event `open` (payload `string[]`) emitted by main on `second-instance` (with the `workingDirectory` argument) — main also restores/focuses the window.
  - `startup` handler — this task returns `{ session: empty, drafts: {}, open: argPaths(process.argv, process.cwd()), theme: "system", lang, version: app.getVersion(), updated: null }`; Task 7/10/11 fill the rest.
  - `src/ui.tsx`: `Button` (variants primary/default/subtle like lokaldev `ui.tsx:48-53`), `IconButton`; icons from `lucide-react`.
  - `openPaths(paths: string[])` in `App.tsx`: `read_file` each, dispatch `open`; non-existing paths ignored.

- [ ] **Step 1: Write failing test** `tests/args.test.ts`: `argPaths(["C:\\app\\smr.exe", "--updated", "notes.md", "D:\\x.md"], "C:\\w")` → `["C:\\w\\notes.md", "D:\\x.md"]`; `argPaths resolves against cwd` covered by the same case.
- [ ] **Step 2: Run** → FAIL. **Step 3:** implement `args.ts`. **Step 4: Run** → PASS.
- [ ] **Step 5: Build the UI** per the approved mockup (Global Constraints + spec "Karty i sidebar"):
  - Sidebar 240 px: header (collapse toggle, `+` = `new`), tab list (file icon, name, folder in muted 11 px, accent dot when dirty, ✕ on hover), bottom row: theme toggle placeholder and `…` menu placeholder (Task 10). Collapsed 52 px: icon-only tabs with `title` = file name; collapse is `collapse` action.
  - Main card `rounded-2xl border bg-surface`, bar 46 px: name, folder, `Edit` button (Task 6 wires it).
  - `Reader`: `dangerouslySetInnerHTML={{ __html: useMemo(() => render(text, dir)) }}`, `.md` prose styles in `styles.css` (column max 760 px centered, tables/code on `surface-2`, rounded 8 px, Cascadia Mono 12.5 px), `highlightAll` in an effect after render. Clicks on `<a>`: `#x` → scroll to `#x`; `http(s):` → `open_external`; otherwise `resolveLink`, and if it ends `.md`/`.markdown` → `openPaths` and scroll to hash; other links ignored.
  - Only the active tab's `Reader` is mounted; scroll position stored via `scroll` action (throttled 200 ms) and restored on activation.
  - Drag & drop on the window: `window.smr.pathFor(file)` for each dropped file → `openPaths`.
  - Window title via `document.title` = `(dirty ? "● " : "") + name + " – Simple Markdown Reader"` (Electron mirrors it to the window title).
  - Empty state (no tabs): centered muted text "Open a file (Ctrl+O) or create a new one (Ctrl+N)" + two buttons.
- [ ] **Step 6: Verify** with `pnpm dev -- D:\Projekty\Aplikacje\lokaldev\AGENTS.md`: document renders with tables/code colored; second `pnpm exec electron . <other.md>` while running adds a tab to the same window; dropping a .md file opens it; relative link to another .md opens a new tab.
- [ ] **Step 7: Commit** `feat: reader with tabs in a collapsible sidebar`.

---

### Task 6: Edit mode, saving, closing tabs

**Files:**
- Create: `src/Editor.tsx`, `src/Dialog.tsx`
- Modify: `src/DocView.tsx`, `src/App.tsx`, `src/i18n.ts`

**Interfaces:**
- Consumes: `write_file`, `save_as` (Task 2), `edit`/`saved`/`toggleEdit`/`close` actions (Task 4).
- Produces:
  - `Editor` (default export, loaded with `React.lazy(() => import("./Editor"))`): props `{ text: string; onChange(text: string): void; onCursor(line: number, col: number): void; onScroll(ratio: number): void }`. CodeMirror 6: `markdown()`, `history`, default + search keymaps, line wrapping, theme from CSS variables (bg `surface`, text `fg`, selection `accent-soft`, font Cascadia Mono 13 px, line height 1.6). New `EditorView` per tab id (key by id).
  - `save(tab: Tab, as?: boolean): Promise<boolean>` in `App.tsx`: untitled, `missing`, or `as` → `save_as` (default name = file name or `Untitled.md`); `meta.encoding === "cp1250"` → first a `Dialog` "This file will be saved as UTF-8." (OK/Cancel) and meta becomes `utf8`; then `write_file`, dispatch `saved`. Returns false when cancelled.
  - `Dialog`: `confirm(title: string, body: string, buttons: string[]): Promise<number>` (index of pressed button, Escape = last), modal in a portal, `#root` inert (lokaldev pattern).

- [ ] **Step 1: Split view** in `DocView` when `tab.editing`: editor left, `Reader` right, 50/50, divider `border-line`; preview re-renders on change (debounced 150 ms for texts > 100 kB, immediate otherwise); editor scroll ratio drives preview `scrollTop` (one-way). Bar in edit mode: `Save` (with muted `Ctrl+S`) and primary `Done`. Status bar 24 px: `Ln {line}, Col {col}`, `{n} words`, encoding label (`UTF-8`, `UTF-8 BOM`, `UTF-16 LE`, `UTF-16 BE`, `Windows-1250`).
- [ ] **Step 2: Close flow**: closing a dirty tab → `confirm(name, t("Do you want to save changes?"), [Save, Don't save, Cancel])`; Save → `save` then close; Don't save → close (changes dropped); Cancel → nothing. Empty untitled tab closes without asking.
- [ ] **Step 3: Polish strings** for every new UI text in `src/i18n.ts`.
- [ ] **Step 4: Verify** in `pnpm dev`: Edit splits the card; typing updates preview live; dot appears; Ctrl+S writes (check file in an editor: BOM/CRLF preserved for a CRLF file); Done returns to reader; closing dirty tab asks; Ctrl+N tab → Ctrl+S opens Save dialog and the tab becomes the file. Network tab / DevTools: CodeMirror chunk loads only after the first Edit.
- [ ] **Step 5: Commit** `feat: split edit mode with live preview`.

---

### Task 7: Session, drafts, window bounds

**Files:**
- Create: `electron/session.ts`, `tests/session.test.ts`
- Modify: `electron/main.ts`, `src/App.tsx`

**Interfaces:**
- Consumes: `Session`, `Startup` (Task 1), `toSession`, `restoreTabs`, `dirty` (Task 4).
- Produces (`electron/session.ts`, all paths under a `dir` parameter so tests use a temp dir; main passes `DATA`):
  - `loadSession(dir): { session: Session; drafts: Record<string, string> }` — reads `session.json` (missing/corrupt → empty session), reads `drafts/<id>.txt` for ids in `session.tabs`, deletes other draft files.
  - `saveSession(dir, s: Session): void` — write `session.json.tmp` then rename.
  - `saveDraft(dir, id, text)`, `dropDraft(dir, id)`.
  - `loadSettings(dir): { theme: Theme; bounds?: Rectangle; maximized?: boolean }`, `saveSettings(dir, patch)` — `settings.json`.
  - Handlers: `save_session(Session)`, `save_draft({id,text})`, `drop_draft({id})`, `flushed()`. `startup` now returns the loaded session + drafts.
  - Event `flush` (main → renderer) on window `close`.

- [ ] **Step 1: Write failing tests** `tests/session.test.ts` (temp dir via `fs.mkdtempSync`):
  - `round-trips session and drafts`.
  - `deletes orphan drafts on load`: draft for an id not in `session.tabs` is gone after `loadSession`.
  - `corrupt session.json gives empty session`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Wire renderer**: on startup `restoreTabs` using `read_file` for every file tab (parallel; active first), then `openPaths(startup.open)`. Effects: `save_session(toSession(state))` debounced 300 ms on any state change; per tab `save_draft` debounced 500 ms while dirty, `drop_draft` when it becomes clean or closes. On `flush` event: send pending session + drafts immediately, then `invoke("flushed")`.
- [ ] **Step 6: Wire main**: `close` handler — first time `preventDefault`, save bounds/maximized to settings, `emit("flush")`, destroy the window on `flushed` or after 2 s. Window created with saved bounds when they fit a current display (`screen.getAllDisplays()`), maximized restored.
- [ ] **Step 7: Verify**: open 3 tabs, edit one, type and press Alt+F4 within 200 ms, restart → same tabs, order, active tab, scroll, edit mode and the last keystrokes; untitled tab with text survives; size/position kept.
- [ ] **Step 8: Commit** `feat: restore tabs and unsaved changes like Notepad`.

---

### Task 8: File watching and missing files

**Files:**
- Create: `electron/watch.ts`
- Modify: `electron/main.ts`, `src/App.tsx`, `src/DocView.tsx`, `src/i18n.ts`

**Interfaces:**
- Consumes: `disk`, `missing`, `keepMine` actions (Task 4), `readDoc` (Task 2).
- Produces: handler `watch({paths: string[]})` — replaces the watched set (`fs.watch` per file, events debounced 150 ms per path); on change `readDoc` → `emit("file_changed", FileDoc)` or, when gone, `emit("file_missing", path)`. Renderer calls `watch` whenever the set of open paths changes.

- [ ] **Step 1: Implement** watcher and renderer dispatch (`file_changed` → `disk`, `file_missing` → `missing`).
- [ ] **Step 2: Bars** in `DocView` above the content: `changed` → warning-soft bar "The file changed on disk." `Reload` (`read_file` then `reload`) / `Keep mine` (`keepMine`); `missing` → muted bar "The file was deleted or moved. Save to keep it." (Ctrl+S goes to Save As via Task 6 `save`).
- [ ] **Step 3: Verify**: edit file externally while clean → reader updates without a bar; while dirty → bar; own Ctrl+S → no bar; delete file → missing bar, Ctrl+S opens Save As.
- [ ] **Step 4: Commit** `feat: follow file changes on disk`.

---

### Task 9: Shortcuts and find

**Files:**
- Create: `src/FindBar.tsx`, `src/find.ts`, `tests/find.test.ts`
- Modify: `src/App.tsx`, `src/i18n.ts`

**Interfaces:**
- Produces: `findRanges(root: Node, query: string): Range[]` (case-insensitive, across text nodes of one element only). `FindBar` props `{ root: HTMLElement | null; onClose(): void }` — input, `n / total`, Enter/Shift+Enter next/prev, Escape closes; highlights via `CSS.highlights.set("find", new Highlight(...ranges))` and `"find-current"`, styled in `styles.css` (`::highlight(find)` accent-soft, `::highlight(find-current)` accent with on-accent text); current range scrolled into view.

- [ ] **Step 1: Write failing test** `tests/find.test.ts` (happy-dom): `findRanges` on `<p>Foo <b>foo</b> FOO</p>` with `"foo"` → 3 ranges; empty query → 0.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Shortcuts** (one `keydown` listener in `App.tsx`, `preventDefault` for handled ones): Ctrl+N `new`; Ctrl+O `open_dialog` → `openPaths`; Ctrl+S `save`; Ctrl+Shift+S `save(tab, true)`; Ctrl+W close flow; Ctrl+T and Ctrl+Shift+T restore (`read_file(closed[0].path)` then `restore`); Ctrl+Tab / Ctrl+Shift+Tab `cycle`; Ctrl+E `toggleEdit`; Ctrl+F → if focus is in the editor let CodeMirror handle it, else open `FindBar` over the reader.
- [ ] **Step 6: Verify** each shortcut in `pnpm dev`; Ctrl+T after closing 3 tabs reopens them newest first.
- [ ] **Step 7: Commit** `feat: keyboard shortcuts and find in document`.

---

### Task 10: Menu, theme, default app for .md

**Files:**
- Create: `src/Menu.tsx`, `electron/assoc.ts`
- Modify: `src/Sidebar.tsx`, `src/App.tsx`, `electron/main.ts`, `electron/session.ts` usage, `src/i18n.ts`

**Interfaces:**
- Consumes: `loadSettings`/`saveSettings` (Task 7).
- Produces:
  - Handler `set_theme({theme})` → `nativeTheme.themeSource = theme`, saved in settings; `startup.theme` from settings; renderer toggles `.dark` like lokaldev `App.tsx:29-93` (matchMedia for `system`).
  - Sidebar bottom: theme icon button cycles system → light → dark (icon Monitor/Sun/Moon).
  - `Menu` (`…` button, popover): New, Open…, Theme (System/Light/Dark), Set as default for .md, Check for updates (Task 11), `Version {version}`.
  - `setDefaultApp(exe: string): Promise<void>` (`electron/assoc.ts`) using `reg.exe add` (HKCU only):
    - `HKCU\Software\Classes\SimpleMarkdownReader.md` default = `Markdown document`, `DefaultIcon` = `"<exe>",0`, `shell\open\command` = `"<exe>" "%1"`
    - `HKCU\Software\Classes\.md\OpenWithProgids` and `.markdown\OpenWithProgids` value `SimpleMarkdownReader.md`
    - `HKCU\Software\SimpleMarkdownReader\Capabilities` (`ApplicationName` = `Simple Markdown Reader`, `FileAssociations\.md` and `\.markdown` = `SimpleMarkdownReader.md`) and `HKCU\Software\RegisteredApplications` `Simple Markdown Reader` = `Software\SimpleMarkdownReader\Capabilities`
    - then `shell.openExternal("ms-settings:defaultapps?registeredAppUser=Simple%20Markdown%20Reader")` (direct call in main, not `openLink`).
    Handler `set_default_app()`; in dev (not packaged) it throws "Only available in the packaged app".

- [ ] **Step 1: Implement** theme, menu, assoc.
- [ ] **Step 2: Verify**: theme switches instantly and persists; on the packaged build (Task 12) "Set as default" opens Windows Default apps on this app's page and, after choosing it, double-click on a .md opens it.
- [ ] **Step 3: Commit** `feat: menu, theme and .md association`.

---

### Task 11: Updates, updater, release, icon

**Files:**
- Create: `electron/updates.ts`, `shim/updater.cs`, `scripts/build-updater.mjs`, `scripts/release.mjs`, `scripts/icon.cjs`, `resources/icon.svg`, `tests/version.test.ts`
- Modify: `electron/main.ts`, `src/App.tsx`, `src/Menu.tsx`, `src/i18n.ts`, `package.json` (build section)

**Interfaces:**
- Consumes: `emit`, `p`, `ROOT` (Task 1).
- Produces (`electron/updates.ts`, ported from `lokaldev/electron/updates.ts` with `download`/`extract` from `lokaldev/electron/install.ts:219-275` inlined; REPO `grzesiekpuszka/simple-markdown-reader`; no binaries, no tray, no `resume.json`):
  - `newerVersion(a, b): boolean` (verbatim copy), `checkUpdates(): Promise<UpdateState>`, `scheduleChecks()` (first tick 15 s after start, then hourly, only when last check > 1 day; emits `update` when a newer version appears), `downloadUpdate()` (progress event `progress` `{id:"update",done,total}`), `applyUpdate()` (spawn updater, `app.quit()` — the normal close/flush path saves the session), `afterUpdate(): "ok" | "failed" | null` (fills `startup.updated`).
  - Handlers: `check_updates`, `download_update`, `apply_update`.
  - `shim/updater.cs` = lokaldev's with `Keep = { "data" }` and exe `simple-markdown-reader.exe`; `scripts/build-updater.mjs` = lokaldev's `build-shim.mjs` compiling only `updater.cs` (`/target:winexe`).
  - `scripts/release.mjs` = lokaldev's with REPO, zip `simple-markdown-reader-<ver>-win-x64.zip`, excluded entries `["data"]`, release name `Simple Markdown Reader <ver>`, User-Agent `smr-release`.
  - UI: when `available`, a small accent-soft card at the bottom of the sidebar (hidden when collapsed; collapsed shows an accent dot on the menu button): `Version {version} is available` + `Install` → `download_update` with progress → `apply_update`. Startup toast for `updated` (`Updated to {version}.` / `The update couldn't be installed; the previous version was restored.`).
  - `resources/icon.svg`: simple document glyph with an "M↓" mark in accent blue `#0067c0` on white rounded square; `pnpm icon` produces `icon.ico`/`icon.png`.

- [ ] **Step 1: Write failing test** `tests/version.test.ts`: `newerVersion("1.0.1-beta.5","1.0.1")` false; `newerVersion("1.0.1","1.0.1-beta.5")` true; `newerVersion("1.0.0-beta.10","1.0.0-beta.9")` true.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** all of the above. **Step 4: Run** `pnpm test` → PASS.
- [ ] **Step 5: Verify** `pnpm dist` → `release\win-unpacked\simple-markdown-reader.exe` and `release\win-unpacked\resources\updater.exe` exist. The full update flow can only be checked against real releases: after the owner publishes beta.1 and later beta.2, beta.1 must find, download and install beta.2 (note this in AGENTS.md). The owner runs `pnpm release`.
- [ ] **Step 6: Commit** `feat: GitHub updates and release script`.

---

### Task 12: End-to-end verification, performance, README

**Files:**
- Create: `README.md`, `notes/v1.0.0-beta.1.md`
- Modify: whatever the checks below expose

- [ ] **Step 1: Scratch build**: `pnpm build && pnpm exec electron-builder --win dir -c.directories.output=release-test`, copy `release-test\win-unpacked` to the scratchpad.
- [ ] **Step 2: Performance**: run `simple-markdown-reader.exe --perf <sample.md>` 5 times (app not running before each). Expected: every `ready` value < 1000 ms. With the app running, time from launching a second `simple-markdown-reader.exe other.md` to the new tab being active (CDP: poll `document.title`) — record the number in the commit message; if > 500 ms, report it to the owner (spec allows a C# launcher later, not in this plan).
- [ ] **Step 3: Functional pass over CDP** (`--remote-debugging-port=9222`, screenshots via `Page.captureScreenshot`, light and dark): reader with table/code/image (relative and https), edit split, collapsed sidebar, menu, dialogs, find bar, changed-on-disk bar, empty state. Compare against the mockup.
- [ ] **Step 4: Review Focus checks**: run items 1–5 of Review Focus by hand on the packaged build.
- [ ] **Step 5: README.md** (English): what it is, download/run (unzip anywhere), set as default for .md, shortcuts, data folder, development commands. `notes/v1.0.0-beta.1.md`: first release notes.
- [ ] **Step 6: Commit** `docs: readme and first release notes`. Tell the owner the build is ready for `pnpm release` (owner creates the GitHub repo, pushes and releases).
