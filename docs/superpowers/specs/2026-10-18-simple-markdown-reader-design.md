# Simple Markdown Reader – projekt

Data: 2026-10-18

## Cel i powód

Właściciel cały czas potrzebuje prostego czytnika plików .md dla Windows. Dostępne aplikacje są przeładowane opcjami, płatne albo brzydkie. Ma to być „Notatnik dla markdown”: prosty, szybki, lekki. Na pierwszym miejscu jest czytanie, a edycja jest dodatkiem.

Typowe treści to dokumentacja projektów: nagłówki, tabele, bloki kodu, czasem obrazki.

## Cele

- Dwuklik na pliku .md w Eksploratorze otwiera go **w trybie odczytu** (wyrenderowany dokument).
- Przycisk **„Edytuj”** (Ctrl+E) dzieli kartę na pół: po lewej edytor czystego tekstu markdown, po prawej podgląd na żywo, czyli ten sam widok co czytnik. **„Gotowe”** wraca do samego czytnika.
- Wiele dokumentów naraz jako **karty w sidebarze**. Sidebar można zwinąć do wąskiego paska z ikonami (wariant A z makiet).
- Jeśli aplikacja już działa, kolejny otwarty plik trafia jako **nowa karta w istniejącym oknie**. Gdy plik jest już otwarty, aplikacja przełącza się na jego kartę.
- **Sesja jak w Notatniku Win11:** po zamknięciu i ponownym uruchomieniu wracają otwarte karty razem z **niezapisanymi zmianami**.
- **Ctrl+N** tworzy nowy, pusty dokument bez nazwy, jak w Notatniku. Taki dokument przetrwa restart. Pierwsze Ctrl+S działa jak „Zapisz jako”.
- **Ctrl+T** (oraz Ctrl+Shift+T) przywraca ostatnio zamkniętą kartę. Kolejne naciśnięcia przywracają starsze, jak w przeglądarce.
- UI w stylu Windows 11, tryb jasny i ciemny, kolorystyka z lokaldev.
- Aplikacja **portable**, wydania i aktualizacje przez GitHub, tak jak w lokaldev.

## Anty-cele (porażka, nawet jeśli działa)

- **Wolne uruchamianie i wolne wczytywanie plików.** To główny powód, dla którego właściciel przestałby jej używać. Cele:
  - okno z treścią widoczne w mniej niż 1 s od dwukliku (zimny start na typowym PC),
  - przełączenie karty lub otwarcie pliku do ~1 MB bez odczuwalnego opóźnienia (poniżej 100 ms),
  - otwarcie pliku, gdy aplikacja już działa: karta widoczna niemal natychmiast.
  - Pomiar na PC właściciela. „Zimny start” oznacza, że aplikacja nie działa. Pierwsze uruchomienie po restarcie systemu się nie liczy (dysk i Defender). Stack zostaje Electron, bo tak zdecydował właściciel, a cel oznacza „tak szybko, jak Electron pozwala, bez marnotrawstwa”. Jeśli otwarcie pliku przy działającej aplikacji (druga instancja Electrona) okaże się w pomiarze wyraźnie wolne, można dodać mały launcher C# przekazujący ścieżki przez named pipe. Domyślnie go nie ma. *(decyzja projektanta)*
- Przeładowanie opcjami. Ustawień ma być minimum.

## Poza zakresem

- Diagramy mermaid, wzory matematyczne, eksport do PDF/HTML, wtyczki, synchronizacja, drzewo folderów lub workspace, edytor WYSIWYG.
- Tray, praca w tle. Zamknięcie okna zamyka aplikację.

## Zachowanie – szczegóły

### Karty i sidebar
- Karta pokazuje nazwę pliku, pod nią folder (wyszarzony), a kropkę w kolorze akcentu przy niezapisanych zmianach. Najechanie pokazuje ✕ do zamknięcia.
- Nagłówek sidebara: przycisk zwijania i „+” (nowy dokument, jak w Notatniku). Otwieranie pliku przez Ctrl+O, przeciągnięcie lub menu „…”. Na dole sidebara: przełącznik motywu. *(decyzja projektanta: „+” = nowy dokument, a nie „otwórz” jak w makiecie)*
- Dokument bez nazwy: karta „Untitled” / „Bez tytułu” (kolejne z numerem), bez folderu, otwiera się od razu w trybie edycji. Pusty dokument bez nazwy zamyka się bez pytania. Karty, sesja i kopie robocze identyfikują kartę po własnym id, a nie po ścieżce pliku.
- Zwinięty sidebar (około 52 px) pokazuje same ikony kart, a nazwa pliku jest w podpowiedzi. Stan zwinięcia jest zapamiętywany.
- Pasek dokumentu: nazwa, ścieżka, „Edytuj”. W trybie edycji: „Zapisz” (Ctrl+S) i „Gotowe”. Pasek stanu w edycji pokazuje wiersz/kolumnę i liczbę słów.
- Tytuł okna: `● nazwa.md – Simple Markdown Reader` (● przy niezapisanych zmianach).
- Przeciągnięcie pliku .md na okno otwiera go w nowej karcie.

### Skróty
Ctrl+N nowy dokument, Ctrl+O otwórz, Ctrl+S zapisz, Ctrl+Shift+S zapisz jako, Ctrl+W zamknij kartę, Ctrl+T / Ctrl+Shift+T przywróć zamkniętą kartę, Ctrl+Tab / Ctrl+Shift+Tab następna/poprzednia karta, Ctrl+E edycja, Ctrl+F szukaj w dokumencie.

### Zapis i sesja
- Zapis jest ręczny (Ctrl+S). Nie ma autozapisu do pliku źródłowego.
- Niezapisane zmiany są trzymane w kopii roboczej w folderze danych aplikacji (obok exe, portable). Kopia zapisuje się na bieżąco z krótkim opóźnieniem, więc przetrwa też awarię lub wyłączenie prądu.
- Zamknięcie aplikacji nie pyta o niezapisane zmiany: zostają w kopii roboczej i wracają przy starcie.
- Zamknięcie **karty** z niezapisanymi zmianami pyta: Zapisz / Nie zapisuj / Anuluj.
- Ctrl+T przywraca kartę w stanie z chwili zamknięcia. Lista zamkniętych kart jest ograniczona do około 20 i przetrwa restart.
- Plik zmieniony na dysku: jeśli karta nie ma niezapisanych zmian, przeładuj go po cichu. Jeśli ma, pokaż pasek „Plik zmienił się na dysku – Przeładuj / Zachowaj moje”.
- Plik usunięty lub przeniesiony: karta zostaje z treścią i komunikatem. Ctrl+S w takiej sytuacji działa jak „Zapisz jako”.
- Kodowanie: UTF-8 (z BOM lub bez) i UTF-16 rozpoznawane po BOM, zapisywane z powrotem bez zmian, z zachowaniem końców linii. Plik, który nie jest poprawnym UTF-8, jest czytany jako Windows-1250 (`TextDecoder`, bez dodatkowych bibliotek). Przy zapisie takiego pliku pojawia się jednorazowa informacja, że zostanie zapisany jako UTF-8. *(decyzja projektanta)*
- Przy starcie karty wracają w tej samej kolejności, z ostatnio aktywną kartą i pozycją przewinięcia. Okno pamięta rozmiar i położenie.

### Renderowanie
- Markdown w standardzie GitHuba (GFM): tabele, listy zadań (tylko do odczytu), przekreślenia, autolinki, bloki kodu z kolorowaniem składni.
- Obrazki ze ścieżką względną do pliku .md oraz obrazki z sieci.
- Linki: do innego pliku .md otwierają go w nowej karcie, linki http/https otwierają się w domyślnej przeglądarce, kotwice `#` przewijają dokument.
- Czytelny układ: kolumna tekstu o szerokości ~760 px, wyśrodkowana. Bloki kodu i tabele w stylu kart lokaldev (`surface-2`, zaokrąglenia).
- Surowy HTML w markdown jest sanityzowany (bez skryptów).

### Skojarzenie z .md
- Aplikacja portable sama nie rejestruje się przy instalacji. W prostym menu (np. „…” w sidebarze) jest akcja „Ustaw jako domyślną dla .md”. Rejestruje ProgID w HKCU i otwiera systemowe okno wyboru aplikacji, bo Windows 11 wymaga potwierdzenia przez użytkownika.
- Do tego samego menu trafiają: motyw (System / Jasny / Ciemny), „Sprawdź aktualizacje”, wersja aplikacji.

## Wygląd

- Z makiet (`.superpowers/brainstorm/…/content/layout.html`), zaakceptowanych przez właściciela: natywny pasek tytułu Windows, sidebar na tle okna, treść na zaokrąglonej karcie `rounded-2xl` z obramowaniem, aktywna karta w sidebarze wyróżniona jak aktywna pozycja menu w lokaldev.
- Tokeny kolorów 1:1 z `lokaldev/src/styles.css` (bg, surface, surface-2, border, text, muted, accent, accent-hover, accent-soft, on-accent, danger). Tło okna `#f3f3f3` / `#202020`.
- Czcionki: Segoe UI Variable Text (UI i tekst dokumentu), Cascadia Mono (edytor i kod).
- Motyw: System / Jasny / Ciemny, jak w lokaldev (`nativeTheme.themeSource` + klasa `.dark`).

## Wydania i aktualizacje

Mechanizm jak w lokaldev, przeniesiony i uproszczony:
- electron-builder `--win dir`, zip `simple-markdown-reader-<ver>-win-x64.zip` + `.sha256`.
- `scripts/release.mjs` (lokalnie, `GITHUB_TOKEN`): tag, release przez GitHub API, nigdy pre-release.
- W aplikacji: sprawdzanie `releases/latest` raz dziennie (pierwsze kilkanaście sekund po starcie, w tle, bez wpływu na czas uruchomienia) oraz ręcznie z menu. O nowej wersji informuje dyskretny komunikat. Pobranie i instalacja dopiero po kliknięciu.
- Podmiana plików przez `updater.exe` (C#, kompilowany przez `csc.exe` z Windows) z lokaldev. Nie rusza folderu danych. Po aktualizacji aplikacja startuje ponownie i przywraca sesję.
- Folder danych obok exe: `data\` (sesja, kopie robocze, ustawienia, tmp aktualizacji).

## Ograniczenia techniczne

- Stack jak w lokaldev: Electron, TypeScript, React, Tailwind v4, Vite, esbuild dla main/preload, pnpm. Bezpieczeństwo jak w lokaldev: sandbox, contextIsolation, IPC tylko z głównej ramki, blokada nawigacji, CSP w buildzie.
- Jedna instancja (`requestSingleInstanceLock`). Druga instancja przekazuje ścieżki pliku do pierwszej i kończy działanie.
- Żeby start był szybki, edytor i kolorowanie składni ładują się dopiero przy pierwszym użyciu. Okno pokazuje się na `ready-to-show` z gotowym kolorem tła.
- Konwencje z lokaldev/AGENTS.md: kod, commity, README i release notes po angielsku. UI po angielsku z polskim tłumaczeniem przez `t()`, język według systemu. KISS, minimum komentarzy.

## Decyzje projektanta (do sprawdzenia przez właściciela)

- Nazwa aplikacji „Simple Markdown Reader”, repo `grzesiekpuszka/simple-markdown-reader`.
- Ten sam stack co lokaldev, ze względu na spójność i ponowne użycie kodu.
- Zamknięcie aplikacji bez pytania o zmiany, zamknięcie karty z pytaniem.
- Skojarzenie z .md przez akcję w menu, a nie automatycznie.
- UI dwujęzyczne EN/PL jak w lokaldev.

## Pozostawione budującemu

- Wybór bibliotek: parser markdown, sanitizer, edytor (CodeMirror 6 lub podobny, ładowany leniwie), kolorowanie składni. Kryteria: rozmiar i czas startu.
- Wyszukiwarka Ctrl+F: `webContents.findInPage` albo własna.
- Ikona aplikacji.
- Format plików sesji i kopii roboczych.
- Proporcje podziału edytor/podgląd (domyślnie 50/50, opcjonalnie przeciągany separator) i synchronizacja przewijania.
