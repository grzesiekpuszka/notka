// What the toolbar can do; both editors (WYSIWYG and raw markdown) implement it.
export type Block = "p" | "h1" | "h2" | "h3";
export type Format = Block | "bold" | "italic" | "strike" | "code" | "link" | "bullet" | "ordered" | "task" | "quote" | "codeblock" | "table" | "image" | "hr";

export interface EditorHandle {
  /** arg: the URL for "link", the path for "image" */
  run(f: Format, arg?: string): void;
  /** the current block and the marks under the cursor */
  active(): Set<Format>;
  selectedText(): string;
  focus(): void;
}
