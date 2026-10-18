import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// the built app loads no scripts from outside (the dev server needs inline scripts and websockets, so no CSP there);
// images may come from the web and from local files through mdimg:
const csp = {
  name: "csp",
  apply: "build" as const,
  transformIndexHtml: (html: string) =>
    html.replace(
      "<head>",
      `<head>
    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: mdimg: https: http:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'" />`,
    ),
};

export default defineConfig({
  plugins: [react(), tailwindcss(), csp],
  base: "./",
  // the editor chunk is big on purpose: it loads only on the first Edit
  build: { outDir: "out/renderer", emptyOutDir: true, chunkSizeWarningLimit: 600 },
  server: { port: 5174, strictPort: true },
});
