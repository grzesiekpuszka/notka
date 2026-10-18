// highlight.js is loaded on the first code block, so documents without code never pay for it.
let hljs: Promise<typeof import("highlight.js/lib/common").default> | null = null;

export async function highlightAll(root: HTMLElement) {
  const blocks = [...root.querySelectorAll<HTMLElement>("pre code:not(.hljs)")];
  if (!blocks.length) return;
  hljs ??= import("highlight.js/lib/common").then((m) => m.default);
  const h = await hljs;
  for (const block of blocks) if (block.isConnected) h.highlightElement(block);
}
