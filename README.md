# Simple Markdown Reader

A small, fast markdown reader for Windows 11 — think Notepad for `.md` files. Documents open rendered; **Edit** splits
the window into a plain-text editor and a live preview.

- Tabs in a sidebar that collapses to icons
- Notepad-style sessions: open tabs and unsaved changes come back after a restart
- GitHub-flavored markdown: tables, task lists, code highlighting, local and web images
- Light and dark theme (or follow Windows)
- Portable: one folder, nothing installed; updates itself from GitHub releases

## Install

Download `simple-markdown-reader-<version>-win-x64.zip` from the
[latest release](https://github.com/grzesiekpuszka/simple-markdown-reader/releases/latest), unzip it anywhere and run
`markdown-reader.exe`. To open `.md` files with a double-click, choose **… → Set as default for .md** and confirm
the choice in Windows Settings.

Everything the app stores (session, unsaved drafts, settings) lives in the `data` folder next to the exe.

## Shortcuts

| Keys | Action |
|---|---|
| Ctrl+N | New document |
| Ctrl+O | Open file |
| Ctrl+S / Ctrl+Shift+S | Save / Save as |
| Ctrl+E | Edit / back to reading |
| Ctrl+W | Close tab |
| Ctrl+T / Ctrl+Shift+T | Reopen closed tab |
| Ctrl+Tab / Ctrl+Shift+Tab | Next / previous tab |
| Ctrl+F | Find |

Files can also be dropped onto the window.

## Development

Requires Node 22 and pnpm.

```sh
pnpm install
pnpm dev [file.md]   # run with hot reload
pnpm test            # unit tests
pnpm dist            # portable build in release/win-unpacked
pnpm release         # build, zip and publish a GitHub release (needs GITHUB_TOKEN)
```
