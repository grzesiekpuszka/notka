// YAML front matter: kept verbatim as a block of source text; the visual editor does not edit it.
import { $nodeSchema, $remark } from "@milkdown/kit/utils";
import remarkFrontmatter from "remark-frontmatter";

const remark = $remark("frontmatter", () => remarkFrontmatter, ["yaml"]);

const schema = $nodeSchema("frontmatter", () => ({
  group: "block",
  atom: true,
  selectable: true,
  attrs: { value: { default: "" } },
  parseDOM: [{ tag: "pre.frontmatter", getAttrs: (dom) => ({ value: (dom as HTMLElement).textContent }) }],
  toDOM: (node) => ["pre", { class: "frontmatter", contenteditable: "false" }, node.attrs.value],
  parseMarkdown: {
    match: (node) => node.type === "yaml",
    runner: (state, node, type) => state.addNode(type, { value: node.value as string }),
  },
  toMarkdown: {
    match: (node) => node.type.name === "frontmatter",
    runner: (state, node) => state.addNode("yaml", undefined, node.attrs.value),
  },
}));

export const frontmatter = [remark, schema].flat();
