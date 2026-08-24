# Designunderlag – Min budget

Statiska mockups av appens skärmar, återskapade från källkoden med appens exakta
designtokens (färger, typografi och mått ur `src/styles.css`, ikoner ur
`src/components/Icons.tsx`). Filerna är underlaget till designcanvasen i Claude
Design och kan redigeras och sås om därifrån.

## Filer

| Fil | Skärm | Ram (px) |
| --- | --- | --- |
| `Main.dc.html` | Översikt, full scrollhöjd | 390 × 1136 |
| `Historik.dc.html` | Historik med daggrupper och filter | 390 × 936 |
| `Budget.dc.html` | Budget, inkl. överdrag och "Utan budget" | 390 × 972 |
| `FastaPoster.dc.html` | Fasta poster, inkl. en pausad post | 390 × 844 |
| `Mer.dc.html` | Mer: tema, kategorier | 390 × 984 |
| `NyTransaktion.dc.html` | Bottensheeten Ny transaktion över Historik | 390 × 844 |
| `canvas.json` | Layoutmanifest: artboardpositioner och startvy | – |

## Att veta

- Mockuperna visar ljust tema. Färgvärdena är de upplösta ljus-värdena ur
  `light-dark()`-tokens i `src/styles.css`; mörkt tema har egna nyanser.
- Exempeldatan (augusti 2026) är påhittad men internt konsekvent: samma summor,
  kategorier och färger återkommer på alla skärmar, och fasta poster summerar
  till månadens utfall.
- Skärmarna är statiska bilder av UI:t, inte prototyper – inga klickbara flöden.
