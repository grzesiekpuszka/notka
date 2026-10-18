/** Case-insensitive matches of `query` in the text of `root`; a match never spans two text nodes. */
export function findRanges(root: Node, query: string): Range[] {
  if (!query) return [];
  const q = query.toLowerCase();
  const ranges: Range[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.nodeValue!.toLowerCase();
    for (let i = text.indexOf(q); i >= 0; i = text.indexOf(q, i + q.length)) {
      const r = document.createRange();
      r.setStart(node, i);
      r.setEnd(node, i + q.length);
      ranges.push(r);
    }
  }
  return ranges;
}
