// Code block colors in the visual editor: highlight.js classes as decorations, the document itself stays plain text.
import type { Node } from "@milkdown/kit/prose/model";
import { Plugin, PluginKey, type Transaction } from "@milkdown/kit/prose/state";
import { Decoration, DecorationSet } from "@milkdown/kit/prose/view";
import { $prose } from "@milkdown/kit/utils";

type Hljs = typeof import("highlight.js/lib/common").default;

const key = new PluginKey<DecorationSet>("code-highlight");
let hljs: Hljs | null = null;
let loading: Promise<void> | null = null;

// language + code → ranges: typing re-decorates every block, only the edited one needs highlight.js again
const cache = new Map<string, [number, number, string][]>();

function ranges(h: Hljs, code: string, language: string) {
  const key = `${language}\0${code}`;
  let r = cache.get(key);
  if (!r) {
    if (cache.size > 500) cache.clear();
    cache.set(key, (r = highlight(h, code, language)));
  }
  return r;
}

/** [from, to, class] ranges of one code block's text, from highlight.js's HTML. */
function highlight(h: Hljs, code: string, language: string): [number, number, string][] {
  const html = h.getLanguage(language) ? h.highlight(code, { language }).value : h.highlightAuto(code).value;
  const out: [number, number, string][] = [];
  let at = 0;
  const walk = (node: ChildNode, cls: string[]) => {
    if (node.nodeType === 3) {
      const len = node.textContent!.length;
      if (cls.length) out.push([at, at + len, cls.join(" ")]);
      at += len;
    } else for (const child of node.childNodes) walk(child, [...cls, ...(node as Element).classList]);
  };
  const box = document.createElement("div");
  box.innerHTML = html;
  for (const child of box.childNodes) walk(child, []);
  return out;
}

function decorations(doc: Node) {
  if (!hljs) return DecorationSet.empty;
  const decos: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name !== "code_block") return;
    for (const [from, to, cls] of ranges(hljs!, node.textContent, node.attrs.language ?? "")) decos.push(Decoration.inline(pos + 1 + from, pos + 1 + to, { class: cls }));
    return false;
  });
  return DecorationSet.create(doc, decos);
}

/** Whether a change touched a code block; other edits only move the existing decorations. */
function touchesCode(tr: Transaction) {
  let hit = false;
  tr.mapping.maps.forEach((map, i) => {
    const doc = tr.docs[i];
    map.forEach((from, to) => {
      if (hit) return;
      const $from = doc.resolve(Math.min(from, doc.content.size));
      for (let d = $from.depth; d > 0; d--) if ($from.node(d).type.name === "code_block") hit = true;
      doc.nodesBetween(from, Math.min(to, doc.content.size), (n) => ((hit ||= n.type.name === "code_block"), !hit));
    });
  });
  return hit;
}

export const codeHighlight = $prose(
  () =>
    new Plugin({
      key,
      state: {
        init: (_, state) => decorations(state.doc),
        apply: (tr, old) => {
          if (tr.getMeta(key)) return decorations(tr.doc);
          if (!tr.docChanged) return old;
          return touchesCode(tr) ? decorations(tr.doc) : old.map(tr.mapping, tr.doc);
        },
      },
      props: { decorations: (state) => key.getState(state) },
      view: (view) => {
        let hasCode = false;
        view.state.doc.descendants((n) => ((hasCode ||= n.type.name === "code_block"), !hasCode));
        // highlight.js loads on the first document that has code, like in the reader
        if (hasCode && !hljs) {
          loading ??= import("highlight.js/lib/common").then((m) => void (hljs = m.default));
          loading.then(() => !view.isDestroyed && view.dispatch(view.state.tr.setMeta(key, true)));
        }
        return {};
      },
    }),
);
