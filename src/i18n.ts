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
  "New document (Ctrl+N)": "Nowy dokument (Ctrl+N)",
  "Close (Ctrl+W)": "Zamknij (Ctrl+W)",
  "Text style": "Styl tekstu",
  "Paragraph": "Akapit",
  "Heading 1": "Nagłówek 1",
  "Heading 2": "Nagłówek 2",
  "Heading 3": "Nagłówek 3",
  "Bold (Ctrl+B)": "Pogrubienie (Ctrl+B)",
  "Italic (Ctrl+I)": "Kursywa (Ctrl+I)",
  "Strikethrough": "Przekreślenie",
  "Code": "Kod",
  "Link (Ctrl+K)": "Link (Ctrl+K)",
  "Bulleted list": "Lista punktowana",
  "Numbered list": "Lista numerowana",
  "Task list": "Lista zadań",
  "Quote": "Cytat",
  "Code block": "Blok kodu",
  "Table": "Tabela",
  "Image": "Obrazek",
  "Horizontal line": "Linia pozioma",
  "Editing mode (Ctrl+E)": "Tryb edycji (Ctrl+E)",
  "Link address": "Adres linku",
  "Insert": "Wstaw",
  "Images": "Obrazy",
  "This file is large, so it opens as markdown.": "Ten plik jest duży, więc otwiera się jako markdown.",
  "This file uses markdown the visual editor can't keep exactly, so it opens as markdown.": "Ten plik używa markdown, którego edytor wizualny nie zachowa dokładnie, więc otwiera się jako markdown.",
  "Install version {version} and restart": "Zainstaluj wersję {version} i uruchom ponownie",
  "Open…": "Otwórz…",
  "Save": "Zapisz",
  "Don't save": "Nie zapisuj",
  "Cancel": "Anuluj",
  "OK": "OK",
  "Do you want to save changes?": "Czy zapisać zmiany?",
  "This file will be saved as UTF-8.": "Ten plik zostanie zapisany w kodowaniu UTF-8.",
  "Ln {line}, Col {col}": "Wiersz {line}, kol. {col}",
  "{n} words": "Słowa: {n}",
  "The file changed on disk.": "Plik zmienił się na dysku.",
  "Reload": "Przeładuj",
  "Keep mine": "Zachowaj moje",
  "Find": "Znajdź",
  "Previous (Shift+Enter)": "Poprzedni (Shift+Enter)",
  "Next (Enter)": "Następny (Enter)",
  "Close (Esc)": "Zamknij (Esc)",
  "Something went wrong": "Coś poszło nie tak",
  "System": "Systemowy",
  "Light": "Jasny",
  "Dark": "Ciemny",
  "Theme": "Motyw",
  "New document": "Nowy dokument",
  "Set as default for .md": "Ustaw jako domyślną dla .md",
  "Only available in the packaged app": "Dostępne tylko w zbudowanej aplikacji",
  "Markdown document": "Dokument Markdown",
  "Simple markdown reader and editor": "Prosty czytnik i edytor markdown",
  "Check for updates": "Sprawdź aktualizacje",
  "You have the latest version.": "Masz najnowszą wersję.",
  "Downloading… {n}%": "Pobieranie… {n}%",
  "Updated to {version}.": "Zaktualizowano do wersji {version}.",
  "The update couldn't be installed; the previous version was restored.": "Nie udało się zainstalować aktualizacji; przywrócono poprzednią wersję.",
  "The download stopped": "Pobieranie zostało przerwane",
  "No update available": "Brak dostępnej aktualizacji",
  "The downloaded update is damaged (checksum mismatch). Try again.": "Pobrana aktualizacja jest uszkodzona (niezgodna suma kontrolna). Spróbuj ponownie.",
  "The update package is invalid": "Paczka aktualizacji jest nieprawidłowa",
  "Download the update first": "Najpierw pobierz aktualizację",
  "The file can't be found or read. Save it to keep it.": "Nie można znaleźć ani odczytać pliku. Zapisz go, żeby go zachować.",
};
