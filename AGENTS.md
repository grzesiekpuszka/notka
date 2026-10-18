# Simple Markdown Reader — agent notes

Portable Windows 11 markdown reader/editor (Electron). Spec: `docs/superpowers/specs/2026-10-18-simple-markdown-reader-design.md`.
Sister project with the same stack and conventions: `D:\Projekty\Aplikacje\lokaldev`.

## Owner

Writes in Polish and wants short answers. Code, commits, README and release notes are in English.

## Conventions

- KISS, concise idiomatic code in the existing style; minimal comments (only the non-obvious "why").
- Every UI string: English source string through `t()`, Polish entry in `src/i18n.ts`. Backend messages too.
- `src/api.ts` is the contract between renderer and `electron/main.ts` (one `invoke(cmd, args)` channel); keep both in sync.
- Security: sandboxed renderer, contextIsolation, IPC only from the main frame, navigation blocked, CSP meta at build time
  only, markdown HTML sanitized with DOMPurify.
- Portable: everything the app writes goes to `data\` next to the exe (`ROOT` in `electron/util.ts`), except the HKCU keys
  of "Set as default for .md".
- Speed is a hard requirement (window < 1 s, tab switch / file open < 100 ms): never import CodeMirror or highlight.js
  statically on the startup path.
- Commit every finished change in small commits. Bump `version` in package.json for user-visible changes and write
  `notes/v<version>.md` for each release. Never publish a pre-release on GitHub: the app only reads `releases/latest`.

## Build, run, test

- Node from nvm in Git Bash: `export PATH="$LOCALAPPDATA/Author Software/nvm/.nodejs:$PATH"`.
- `pnpm dev [file.md]`, `pnpm build` (updater + tsc + vite + esbuild), `pnpm dist` (portable dir build), `pnpm icon`,
  `pnpm test` (vitest, pure logic only).
- After moving the folder: `pnpm exec install-electron`.
- E2E: `pnpm build && pnpm exec electron-builder --win dir -c.directories.output=release-test`, copy
  `release-test\win-unpacked` to the scratchpad, run it with `--remote-debugging-port=9222`, drive it over CDP
  (`Runtime.evaluate`, `window.smr.invoke(cmd, args)`), screenshot with `Page.captureScreenshot`.
  `--perf` prints the time to the first shown window.
- The full update flow can only be checked against real GitHub releases (an older build must find, download and install
  a newer published one).
- In Bash heredocs / `node -e`, backslashes in JS strings get mangled: write patch scripts with the Write tool.

## Releasing

Bump the version, write `notes/v<version>.md`, commit; the owner runs `$env:GITHUB_TOKEN=…; pnpm release` (needs a clean
tree; builds, zips without `data`, tags, pushes, publishes). Agents have no GitHub credentials; the owner pushes.
