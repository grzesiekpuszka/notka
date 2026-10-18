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
  "All files": "Wszystkie pliki",
  "Untitled": "Bez tytułu",
  "Expand sidebar": "Rozwiń panel boczny",
  "Collapse sidebar": "Zwiń panel boczny",
  "New document (Ctrl+N)": "Nowy dokument (Ctrl+N)",
  "Close (Ctrl+W)": "Zamknij (Ctrl+W)",
  "Edit": "Edytuj",
  "Open a file (Ctrl+O) or create a new one (Ctrl+N)": "Otwórz plik (Ctrl+O) albo utwórz nowy (Ctrl+N)",
  "Open…": "Otwórz…",
  "New": "Nowy",
};
