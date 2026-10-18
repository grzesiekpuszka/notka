// UI strings: English source text is the key, `pl` holds the Polish translation. Shared by the renderer and electron/.
export type Lang = "en" | "pl";

let lang: Lang = "en";
export const setLang = (l: Lang) => {
  lang = l;
};

const fill = (s: string, vars?: Record<string, string | number>) =>
  vars ? s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : s;

export function t(text: string, vars?: Record<string, string | number>): string {
  return fill((lang === "pl" && pl[text]) || text, vars);
}

const pl: Record<string, string> = {
  "Only http and https links can be opened": "Można otwierać tylko linki http i https",
  "Unknown command: {cmd}": "Nieznane polecenie: {cmd}",
};
