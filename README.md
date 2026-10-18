# Notka

A small, fast markdown editor for Windows 11 — think Notepad, but for `.md` files. Documents open formatted and you edit
them like in any word processor; markdown is just how they are saved.

- WYSIWYG editing with a formatting toolbar; markdown typed as you go works too (`## `, `- `, `**bold**`, `` `code` ``)
- Markdown mode: the raw text with a live preview next to it, one click away
- Notepad-style tabs in the title bar (drag to reorder) and sessions: open tabs and unsaved changes come back after a restart
- GitHub-flavored markdown: tables, task lists, code highlighting, local and web images; front matter and HTML are kept
- Light and dark theme (or follow Windows)
- Portable: one folder, nothing installed; updates itself from GitHub releases

Saving from the visual editor writes the whole document in one consistent markdown style. Files the visual editor can't
keep exactly, and files over 200 kB, open in Markdown mode.

## Install

Download `notka-<version>-win-x64.zip` from the
[latest release](https://github.com/grzesiekpuszka/notka/releases/latest), unzip it anywhere and run `notka.exe`. To open `.md` files with a double-click, choose **… → Set as default for .md** and confirm
the choice in Windows Settings.

Everything the app stores (session, unsaved drafts, settings) lives in the `data` folder next to the exe.

## Shortcuts

| Keys | Action |
|---|---|
| Ctrl+N | New document |
| Ctrl+O | Open file |
| Ctrl+S / Ctrl+Shift+S | Save / Save as |
| Ctrl+E | Switch between WYSIWYG and Markdown |
| Ctrl+B / Ctrl+I / Ctrl+K | Bold / italic / link |
| Ctrl+W | Close tab |
| Ctrl+T / Ctrl+Shift+T | Reopen closed tab |
| Ctrl+Tab / Ctrl+Shift+Tab | Next / previous tab |
| Ctrl+F | Find |
| Ctrl+click | Follow a link |

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
