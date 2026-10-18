# Simple Markdown Reader 2 – edytor WYSIWYG – projekt

Data: 2026-10-18. Zastępuje część „Zachowanie” i „Wygląd” z `2026-10-18-simple-markdown-reader-design.md`. Reszta tamtego
dokumentu (portable, sesja, aktualizacje, wydania, bezpieczeństwo, szybkość) obowiązuje dalej.

## Cel i powód

Po pierwszych wersjach (beta.1–beta.3) właściciel chce, żeby aplikacja była **prostym edytorem tekstu opartym o markdown**,
a nie czytnikiem z trybem edycji. Plik otwiera się od razu jako sformatowany, edytowalny dokument, jak w zwykłym edytorze
tekstu. Markdown jest formatem zapisu, a nie czymś, co trzeba widzieć. Sidebar znika, a karty przechodzą na górę okna
jak w Notatniku Win11.

## Cele

- **Tryb WYSIWYG (domyślny):** otwarcie pliku pokazuje sformatowany dokument, który od razu można edytować (kursor,
  zaznaczanie, pisanie).
  - **Pasek formatowania** nad dokumentem: typ bloku (Akapit, Nagłówek 1–3) jako lista rozwijana, pogrubienie,
    kursywa, przekreślenie, kod w tekście, link, lista punktowana, lista numerowana, lista zadań, cytat, blok kodu,
    tabela, obrazek, linia pozioma.
  - Przyciski pokazują aktywny stan pod kursorem, np. B podświetlone w pogrubionym tekście.
  - **Znaczniki markdown działają na żywo:** `# `–`### ` na początku akapitu tworzą nagłówek, `- `/`* ` listę, `1. `
    listę numerowaną, `[ ] ` zadanie, `> ` cytat, ```` ``` ```` blok kodu, `---` linię. `**x**`, `*x*`, `~~x~~` i `` `x` ``
    formatują po domknięciu.
  - Skróty: Ctrl+B, Ctrl+I, Ctrl+K (link), Ctrl+Z/Ctrl+Y.
- **Tryb Markdown:** surowy kod po lewej (obecny edytor CodeMirror) i podgląd na żywo po prawej (obecny Reader, tylko do
  odczytu). Pasek formatowania jest ten sam i wstawia znaczniki do kodu (np. B owija zaznaczenie w `**`).
- **Przełącznik WYSIWYG / Markdown** po prawej stronie paska. Ctrl+E przełącza. Każda karta pamięta swój tryb, a nowe
  karty i otwierane pliki zaczynają w WYSIWYG.
- **Karty w pasku tytułu (wariant A z makiety):** okno bez systemowego paska tytułu. W jednym rzędzie są karty (nazwa
  pliku, kropka przy niezapisanych zmianach, ✕ przy aktywnej i przy najechaniu), „+” (nowy dokument) i systemowe
  przyciski okna (minimalizuj, maksymalizuj, zamknij).
  - Wolne miejsce w rzędzie kart przeciąga okno, dwuklik maksymalizuje.
  - Gdy kart jest dużo, karty się zwężają, a potem rząd przewija się poziomo.
  - Pełna ścieżka pliku jest w podpowiedzi karty.
- **Menu „…”** na końcu paska formatowania: Nowy, Otwórz…, Motyw (System/Jasny/Ciemny), Ustaw jako domyślną dla .md,
  Sprawdź aktualizacje, wersja.
  - Dostępna aktualizacja to ikona pobierania obok „…” (akcent).
  - Przełącznik motywu z sidebara przechodzi do menu.
- **Pasek stanu** na dole: liczba słów, kodowanie. W trybie Markdown także wiersz i kolumna.

- **Ostatnia karta** (decyzja właściciela): po zamknięciu ostatniej karty od razu pojawia się nowy pusty dokument, a okno
  zostaje. Pustego ekranu „Otwórz / Nowy” nie ma.
- **Przestawianie kart** (decyzja właściciela): karty można przeciągać w rzędzie, a kolejność zapisuje się w sesji.

## Zachowanie edycji

- **Formatowanie może być porządkowane** (decyzja właściciela): zapis z WYSIWYG serializuje cały dokument do markdown
  w jednym stylu (np. `-` w listach, wyrównane tabele). Diff w gicie może pokazać zmiany w nieruszanych miejscach i to jest
  akceptowane.
- **Treść nigdy nie znika** *(decyzja projektanta)*: porządkowanie dotyczy stylu, a nie treści.
  - Front matter YAML, komentarze HTML, surowy HTML (blokowy i w tekście), przypisy, definicje linków referencyjnych i
    tytuły linków przechodzą przez WYSIWYG bez utraty. Konstrukcji, których edytor nie modeluje, nie da się edytować
    wizualnie: front matter i bloki HTML pokazują się jako wyróżnione bloki tekstu źródłowego i zapisują się dosłownie.
  - Plik z konstrukcją, której WYSIWYG nie potrafi zachować, otwiera się w trybie Markdown z krótką informacją dlaczego.
    Budujący ustala tę listę testem: zestaw plików przykładowych, który przechodzi parse → serialize bez utraty treści.
  - Nadmiarowe escapowanie (`snake_case` → `snake\_case`) jest błędem do usunięcia, a nie akceptowanym porządkowaniem.
- **Tryb Markdown pokazuje oryginalny tekst** *(decyzja projektanta)*: dopóki w WYSIWYG nie było faktycznej edycji, tekst
  karty to dokładnie tekst z pliku, więc przełączenie na Markdown pokazuje plik jak jest. Edycje tylko w trybie Markdown
  dają minimalny diff. Pierwsza faktyczna edycja w WYSIWYG zastępuje tekst karty serializacją całego dokumentu. Od tej chwili
  karta jest zmieniona, nawet jeśli cofnie się edycję (porządkowanie zostaje do zapisu albo odrzucenia).
- **Samo otwarcie, przewijanie i klikanie nie oznacza zmian:** kropka i ● pojawiają się dopiero po faktycznej edycji, a
  plik zmienia się na dysku tylko po Ctrl+S. Wczytanie pliku do WYSIWYG nie może go oznaczyć jako zmienionego, mimo że
  serializacja dałaby inny tekst niż w pliku.
- Przełączenie trybu przenosi bieżący tekst: WYSIWYG → Markdown pokazuje serializowany markdown, Markdown → WYSIWYG
  parsuje kod. Przełączenie samo w sobie nie oznacza dokumentu jako zmienionego.
- **Linki w WYSIWYG:** zwykłe kliknięcie ustawia kursor, a Ctrl+klik otwiera, jak w Wordzie. Linki do .md otwierają
  kartę, http(s) przeglądarkę, `#kotwica` przewija. Przycisk linku (Ctrl+K) pyta o adres w małym okienku przy
  zaznaczeniu.
- **Obrazki:** wyświetlane jak dotąd (lokalne przez `mdimg:`, z sieci). Przycisk „obrazek” otwiera wybór pliku i wstawia
  ścieżkę względną do folderu dokumentu. Dokument bez nazwy wstawia ścieżkę bezwzględną.
- **Tabele (GFM):** wstawienie tabeli 3×3 z nagłówkiem. Edycja w komórkach, Tab i Shift+Tab przechodzą między
  komórkami, a Tab w ostatniej komórce dodaje wiersz. Dodawanie i usuwanie kolumn nie jest wymagane.
- **Bloki kodu:** czcionka monospace, kolorowanie składni (leniwie, jak dotąd), język z info string (```` ```ts ````).
- Wklejanie: tekst z zewnątrz wkleja się jako zwykły tekst z zachowaniem podstawowej struktury (akapity, listy, linki,
  pogrubienie). Wklejanie obrazków ze schowka nie jest wymagane.
- Ctrl+F w WYSIWYG wyszukuje w dokumencie, z podświetleniem i przechodzeniem jak dotąd. Zamiana nie jest wymagana.
- Undo/redo działa w obrębie trybu. Po przełączeniu trybu historia może zacząć się od nowa.

## Bez zmian (z pierwszego projektu)

Sesja jak w Notatniku (karty, tryb karty, przewinięcie i kopie robocze wracają po restarcie), Ctrl+N/O/S/Shift+S/W/T/Tab,
Ctrl+T przywraca zamknięte karty, śledzenie zmian na dysku (paski „zmienił się na dysku” / „nie można odczytać”),
kodowanie i końce linii, przeciąganie plików, aktualizacje, wydania, `data\` obok exe, bezpieczeństwo, EN/PL.

## Poza zakresem

Tryb tylko do odczytu, sidebar, pusty ekran startowy, drzewo folderów, mermaid/wzory, eksport, komentarze, zamiana w
wyszukiwaniu, edycja kolumn tabel, wklejanie obrazków ze schowka, przeciąganie kart między oknami, wiele okien.

## Anty-cele

- Wolne uruchamianie: okno z treścią nadal ma się pojawiać w < 1 s, a otwarcie pliku ≤ 1 MB w < 100 ms do widocznej
  treści. Edytor WYSIWYG jest teraz na ścieżce startu, więc musi być lekki albo ładowany tak, żeby treść była widoczna od
  razu (np. najpierw szybki render HTML, potem edytor).
- Utrata tekstu: wszystkie gwarancje sesji i kopii roboczych z beta.3 zostają. Krytyczne poprawki z przeglądu (flush
  przed startem, kolejka plików, `saved` z zapisanym tekstem, kopie przy uszkodzonej sesji) nie mogą wrócić jako błędy.
- „Fałszywe zmiany”: pliki oznaczane jako zmienione, choć użytkownik nic nie zrobił.

## Ograniczenia techniczne

- Stack bez zmian (Electron, React, Tailwind, Vite, CodeMirror 6 w trybie Markdown).
- **Edytor WYSIWYG** *(decyzja projektanta)*: Milkdown (ProseMirror + remark) z presetami commonmark i GFM (tabele,
  listy zadań, przekreślenie), history, listener. Zapewnia markdown jako format źródłowy, input rules dla znaczników i
  serializację remark. Jeśli w pomiarze startu albo integracji okaże się za ciężki lub problematyczny, alternatywą jest
  Tiptap 3 z oficjalnym rozszerzeniem markdown. Wybór uzasadnić pomiarem.
- Okno: `titleBarStyle: "hidden"` + `titleBarOverlay` (systemowe przyciski Windows 11 z kolorami motywu, aktualizowane
  przy zmianie motywu). Obszar kart z `-webkit-app-region: drag`, same karty i przyciski `no-drag`.
- Sanitizacja jak dotąd: HTML z markdown w WYSIWYG nie może wykonywać skryptów ani restylować aplikacji. Surowy HTML w
  dokumencie wyświetla się jako blok kodu albo bezpiecznie, nigdy jako wykonywany.
- Sesja: pole `editing` w `TabState` zamienia się na tryb karty (`"wysiwyg" | "markdown"`). Stare sesje z beta.3 muszą
  się wczytać: `editing: true` oznacza markdown, a brak lub `false` WYSIWYG. Pole `collapsed` jest ignorowane.

## Decyzje projektanta (do sprawdzenia)

- Milkdown jako edytor WYSIWYG (alternatywa Tiptap).
- Treść nigdy nie znika: front matter i HTML zachowane dosłownie, a plik nie do zachowania otwiera się w trybie Markdown.
- Tryb Markdown pokazuje oryginalny plik, dopóki nie było edycji w WYSIWYG.
- Ctrl+klik otwiera linki, zwykłe kliknięcie edytuje.
- Każda karta pamięta tryb, nowe zaczynają w WYSIWYG.
- Ikona aktualizacji obok „…”, motyw tylko w menu.
- Tabele bez dodawania kolumn, wklejanie bez obrazków.
- Wersja `1.1.0-beta.1` (duża zmiana zachowania).

## Pozostawione budującemu

- Dokładny wygląd listy typów bloku i okienka linku.
- Zachowanie przy bardzo dużych plikach w WYSIWYG (np. > 1 MB: można otwierać od razu w trybie Markdown z komunikatem).
- Synchronizacja przewijania przy przełączaniu trybów (wystarczy przybliżona).
