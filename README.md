# Min budget

En personlig budgetapp för mobilen och datorn. Byggd för att ge snabb överblick över
ekonomin: transaktioner med kategorier, månadsbudget per kategori, fasta poster som
fylls i automatiskt varje månad, samt grafer och trender.

## Funktioner

- **Översikt** – månadens inkomster, utgifter och saldo, "kvar att spendera" mot
  budgeten, utgifter per kategori och sex månaders utveckling (med tabellvy).
- **Historik** – alla transaktioner grupperade per dag, med snabb registrering via
  plusknappen och filtrering på utgifter/inkomster.
- **Budget** – sätt ett månadstak per kategori och följ hur mycket som är kvar.
  Överdrag markeras tydligt.
- **Sparande** – registrera enstaka insättningar (eller låt en fast post spara
  automatiskt varje månad) och sätt sparmål per sparkategori. Sparat räknas bort
  från månadens saldo men är ingen utgift; att nå målet firas i grönt.
- **Fasta poster** – hyra, lön, el och abonnemang läggs in automatiskt i historiken
  varje månad på rätt dag. Poster kan pausas utan att historiken påverkas.
- **Kategorier** – redigerbara, med färger ur en tillgänglighetsvaliderad palett.
- **Ljust/mörkt tema** – följer systemet eller väljs manuellt.
- **Fungerar offline** – en service worker cachar appen, så att den öppnas även
  utan nätverk (datan finns ju redan lokalt).
- **Export/import** – hela datan som JSON-fil, för säkerhetskopiering och för att
  flytta datan mellan enheter.

## Var lagras datan?

All data sparas **lokalt i webbläsaren** (localStorage) på den enhet appen används.
Ingenting skickas till någon server och inget konto behövs. Det betyder också:

- Datan synkas **inte** automatiskt mellan enheter – använd export/import under
  *Mer → Data* för att flytta den.
- Rensas webbläsarens webbplatsdata försvinner appens data. **Exportera regelbundet.**

Lagringen är byggd som en utbytbar adapter (`src/data/storage.ts`), så en framtida
molnlagring med inloggning och automatisk synk (t.ex. Supabase) kan kopplas in utan
att resten av appen skrivs om.

## Kom igång på GitHub Pages

Appen deployas automatiskt av GitHub Actions vid varje push till `main`. En
engångsinställning krävs först:

1. Gå till repots **Settings → Pages**.
2. Under **Build and deployment → Source**, välj **GitHub Actions**.
3. Slå ihop den här branchen till `main` (eller kör workflowen manuellt under
   *Actions → Deploy till GitHub Pages → Run workflow*).

Appen publiceras sedan på `https://<användarnamn>.github.io/budget/`.

**Tips för mobilen:** öppna adressen i mobilens webbläsare och välj
*Lägg till på hemskärmen* – appen får egen ikon, öppnas i helskärm som en vanlig
app och fungerar även utan nätverk.

## Utveckla lokalt

```bash
npm install
npm run dev       # utvecklingsserver
npm run build     # typkontroll + produktionsbygge till dist/
npm run preview   # förhandsgranska produktionsbygget
```

Byggt med Vite, React och TypeScript. Inga övriga beroenden.

## Tekniska anteckningar

- Belopp lagras i **öre** (heltal) för att undvika flyttalsfel.
- Fasta poster materialiseras till transaktioner per månad; raderas en enskild
  månads transaktion antecknas det (tombstone) så att den inte återskapas.
- Diagrammen följer en färgpalett som är validerad för färgblindhet i både ljust
  och mörkt läge; varje stapel bär sin egen etikett och trenddiagrammet har en
  tabellvy.
- Offlinestödet (`public/sw.js`) hämtar navigeringar från nätet först – nya
  versioner når användaren direkt – med det cachade appskalet som reserv;
  byggets hashade filer serveras från cachen.
