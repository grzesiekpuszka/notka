import DOMPurify from "dompurify";
import { Marked } from "marked";
import { gfmHeadingId } from "marked-gfm-heading-id";
import { imageUrl, resolveLink } from "./paths";

const remote = /^([a-z][a-z0-9+.-]*:|\/\/)/i;
let dir: string | null = null;

const marked = new Marked({ gfm: true });
marked.use(gfmHeadingId(), {
  walkTokens(token) {
    if (token.type === "image" && dir && !remote.test(token.href)) token.href = imageUrl(resolveLink(dir, token.href).path);
  },
});

/** GitHub-flavored markdown → sanitized HTML; relative images point at the document's folder through mdimg:. */
export function render(text: string, docDir: string | null): string {
  dir = docDir;
  return DOMPurify.sanitize(marked.parse(text, { async: false }), {
    // a document must not be able to restyle or cover the app
    FORBID_TAGS: ["style"],
    FORBID_ATTR: ["style"],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|mdimg):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
  });
}
