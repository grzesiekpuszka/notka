import { net, protocol } from "electron";
import path from "node:path";
import { pathToFileURL } from "node:url";

const IMAGES = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp", ".ico", ".avif"]);

protocol.registerSchemesAsPrivileged([{ scheme: "mdimg", privileges: { standard: true, secure: true } }]);

/** Local images of a document as mdimg://f/<encoded absolute path>; only image files are served. */
export function serveImages() {
  protocol.handle("mdimg", (req) => {
    const file = decodeURIComponent(new URL(req.url).pathname.slice(1));
    if (!path.isAbsolute(file) || !IMAGES.has(path.extname(file).toLowerCase())) return new Response(null, { status: 404 });
    return net.fetch(pathToFileURL(file).href);
  });
}
