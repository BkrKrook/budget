/** Tolkning av kontoutdrag från banken (Excel/CSV) till transaktionskandidater.
 *  Bankernas exporter ser olika ut, så kolumnerna för datum, belopp och text
 *  letas upp – i första hand via rubrikraden, annars på innehållet. Raderna
 *  granskas i importvyn innan något sparas, så heuristiken behöver vara god
 *  men inte perfekt. */

import { parseXls } from './xls'
import type { Cell } from './xlsx'
import { parseXlsx } from './xlsx'

export interface StatementRow {
  date: string // 'YYYY-MM-DD'
  /** Signerat belopp i öre: negativt = pengar ut, positivt = pengar in. */
  amountOre: number
  text: string
}

export interface ParsedStatement {
  rows: StatementRow[]
  /** Icke-tomma rader i dataområdet som inte gick att tolka (t.ex. sidfötter). */
  skipped: number
}

/** Läser en kontoutdragsfil oavsett format: .xlsx, gammalt binärt .xls,
 *  CSV/TSV, eller "Excel"-filer som egentligen är HTML-tabeller (vanligt
 *  från äldre internetbanker). Formatet avgörs av innehållet, inte filnamnet. */
export async function parseStatementFile(file: File): Promise<ParsedStatement> {
  const buf = await file.arrayBuffer()
  const bytes = new Uint8Array(buf)
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) return interpret(await parseXlsx(buf))
  if (bytes[0] === 0xd0 && bytes[1] === 0xcf) return interpret(parseXls(buf))
  const text = decodeText(bytes)
  if (/<(table|html|!doctype)/i.test(text.slice(0, 2000))) return interpret(parseHtmlTable(text))
  return interpret(parseCsv(text))
}

/** Bankfiler är ofta Latin-1/Windows-1252 (åäö!) eller UTF-16 – prova UTF-8
 *  strikt först och fall tillbaka utifrån BOM respektive avkodningsfel. */
function decodeText(bytes: Uint8Array): string {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes)
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes)
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^\uFEFF/, '')
  } catch {
    return new TextDecoder('windows-1252').decode(bytes)
  }
}

/** Vanligast förekommande avgränsare utanför citattecken vinner. */
function sniffDelimiter(text: string): string {
  const counts: Record<string, number> = { ';': 0, ',': 0, '\t': 0 }
  let inQuotes = false
  for (const ch of text.slice(0, 4000)) {
    if (ch === '"') inQuotes = !inQuotes
    else if (!inQuotes && ch in counts) counts[ch]++
  }
  return ['\t', ';', ','].reduce((a, b) => (counts[b] > counts[a] ? b : a))
}

export function parseCsv(text: string): Cell[][] {
  const delimiter = sniffDelimiter(text)
  const rows: Cell[][] = []
  let row: Cell[] = []
  let cell = ''
  let inQuotes = false
  const endCell = () => {
    row.push(cell)
    cell = ''
  }
  const endRow = () => {
    endCell()
    rows.push(row)
    row = []
  }
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"'
          i++
        } else inQuotes = false
      } else cell += ch
    } else if (ch === '"') inQuotes = true
    else if (ch === delimiter) endCell()
    else if (ch === '\n') endRow()
    else if (ch !== '\r') cell += ch
  }
  if (cell !== '' || row.length > 0) endRow()
  return rows
}

/** Största tabellen i ett HTML-dokument som matris. */
function parseHtmlTable(html: string): Cell[][] {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  let best: Cell[][] = []
  for (const table of doc.querySelectorAll('table')) {
    const rows = [...table.querySelectorAll('tr')].map((tr) =>
      [...tr.querySelectorAll('th,td')].map((cellEl): Cell => cellEl.textContent ?? ''),
    )
    if (rows.length > best.length) best = rows
  }
  return best
}

const pad = (n: number) => String(n).padStart(2, '0')

function makeISO(y: number, m: number, d: number): string | null {
  if (y < 1990 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null
  return `${y}-${pad(m)}-${pad(d)}`
}

/** Datumformat som förekommer i bankfiler → ISO. Excelserier hanteras bara
 *  när kolumnen pekats ut av en rubrik (allowSerial) – annars skulle heltals-
 *  belopp kunna misstas för datum. */
export function parseStatementDate(cell: Cell, allowSerial = false): string | null {
  if (typeof cell === 'number') {
    if (!allowSerial || !Number.isInteger(cell) || cell < 32874 || cell > 73415) return null
    // 32874 = 1990-01-01, 73415 = 2100-12-31 i Excels 1900-system.
    const d = new Date(Date.UTC(1899, 11, 30) + cell * 86400000)
    return makeISO(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate())
  }
  if (typeof cell !== 'string') return null
  const s = cell.trim()
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:\b|T)/)
  if (m) return makeISO(Number(m[1]), Number(m[2]), Number(m[3]))
  m = s.match(/^(\d{4})(\d{2})(\d{2})$/)
  if (m) return makeISO(Number(m[1]), Number(m[2]), Number(m[3]))
  m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/)
  if (m) return makeISO(Number(m[3]), Number(m[2]), Number(m[1]))
  m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2})$/)
  if (m) return makeISO(2000 + Number(m[3]), Number(m[2]), Number(m[1]))
  return null
}

/** Belopp med svensk eller engelsk formatering → signerade öre.
 *  Hanterar '−1 234,56', '-1.234,56', '1,234.56', efterställt minus och
 *  parenteser för negativa tal. */
export function parseStatementAmount(cell: Cell): number | null {
  if (typeof cell === 'number') return Math.round(cell * 100)
  if (typeof cell !== 'string') return null
  // \s täcker även hårda/smala mellanslag som banker använder som tusentalsavgränsare.
  let s = cell.replace(/[\s']/g, '').replace(/(kr|sek)\.?$/i, '')
  if (!s) return null
  let sign = 1
  if (/^\(.*\)$/.test(s)) {
    sign = -1
    s = s.slice(1, -1)
  }
  if (/^[-−–]/.test(s)) {
    sign = -1
    s = s.slice(1)
  } else if (s.startsWith('+')) s = s.slice(1)
  if (/[-−–]$/.test(s)) {
    sign = -1
    s = s.slice(0, -1)
  }
  if (!s || /[^0-9.,]/.test(s)) return null
  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')
  if (lastComma >= 0 && lastDot >= 0) {
    // Båda tecknen: det sista är decimaltecken, det andra tusentalsavgränsare.
    s = lastComma > lastDot ? s.split('.').join('').replace(',', '.') : s.split(',').join('')
  } else if (lastComma >= 0 || lastDot >= 0) {
    const sep = lastComma >= 0 ? ',' : '.'
    const esc = sep === '.' ? '\\.' : sep
    if (new RegExp(`${esc}\\d{1,2}$`).test(s) && s.indexOf(sep) === s.lastIndexOf(sep))
      s = s.replace(sep, '.')
    else if (new RegExp(`^\\d{1,3}(${esc}\\d{3})+$`).test(s)) s = s.split(sep).join('')
    else return null
  }
  if (!/^\d+(\.\d+)?$/.test(s)) return null
  return sign * Math.round(Number(s) * 100)
}

const DATE_HEAD = /datum|date|bokförd|köpdag|dag\b/i
const AMOUNT_HEAD = /belopp|amount|summa/i
const BALANCE_HEAD = /saldo|balance|disponibelt|behållning/i
const IN_HEAD = /insättning|inbetalning|kredit|^in$/i
const OUT_HEAD = /uttag|utbetalning|debet|^ut$/i
const TEXT_HEAD =
  /text|beskrivning|specifikation|rubrik|mottagare|meddelande|referens|transaktion|butik|händelse|inköpsställe|notering|typ/i

const asHeader = (c: Cell): string => (typeof c === 'string' ? c.trim() : '')

/** Poäng för hur bra en rubrik pekar ut datumkolumnen: transaktions-/köpdatum
 *  (dagen det hände) föredras före bokföringsdag. */
function dateHeadScore(h: string): number {
  if (!DATE_HEAD.test(h)) return 0
  if (/transaktion|köp/i.test(h)) return 3
  if (/bokförd|bokföring/i.test(h)) return 1
  return 2
}

interface Columns {
  date: number
  amount: number
  /** Vid skilda kolumner för in-/utbetalningar: uttagskolumnen (negeras). */
  amountOut: number | null
  text: number | null
  headerBased: boolean
}

/** Hittar rubrikraden bland de första raderna och mappar kolumnerna. */
function columnsFromHeader(matrix: Cell[][]): { cols: Columns; dataStart: number } | null {
  for (let r = 0; r < Math.min(matrix.length, 30); r++) {
    const headers = matrix[r].map(asHeader)
    let date = -1
    let dateScore = 0
    let amount = -1
    let amountIn = -1
    let amountOut = -1
    let text = -1
    let textScore = 0
    for (let c = 0; c < headers.length; c++) {
      const h = headers[c]
      if (!h) continue
      const ds = dateHeadScore(h)
      if (ds > dateScore) {
        date = c
        dateScore = ds
      }
      if (AMOUNT_HEAD.test(h) && !BALANCE_HEAD.test(h) && amount < 0) amount = c
      if (IN_HEAD.test(h) && amountIn < 0) amountIn = c
      if (OUT_HEAD.test(h) && amountOut < 0) amountOut = c
      if (TEXT_HEAD.test(h) && !DATE_HEAD.test(h)) {
        const ts = /text|beskrivning|specifikation|rubrik|mottagare/i.test(h) ? 2 : 1
        if (ts > textScore) {
          text = c
          textScore = ts
        }
      }
    }
    if (date < 0) continue
    if (amount < 0 && amountIn >= 0 && amountOut >= 0 && amountIn !== amountOut) {
      return {
        cols: { date, amount: amountIn, amountOut, text: text >= 0 ? text : null, headerBased: true },
        dataStart: r + 1,
      }
    }
    // En kombinerad kolumn ("Insättning/Uttag") matchar både in och ut –
    // det är beloppskolumnen, med tecknet i värdet.
    if (amount < 0 && amountIn >= 0 && amountIn === amountOut) amount = amountIn
    if (amount >= 0) {
      return {
        cols: { date, amount, amountOut: null, text: text >= 0 ? text : null, headerBased: true },
        dataStart: r + 1,
      }
    }
  }
  return null
}

/** Utan rubrikrad: peka ut kolumnerna på innehållet – flest tolkningsbara
 *  datum, flest tolkningsbara belopp (helst med båda tecknen; ett saldo är
 *  oftare enbart positivt), mest övrig text. */
function columnsFromContent(matrix: Cell[][]): Columns | null {
  const width = Math.max(0, ...matrix.map((r) => r.length))
  const stats = Array.from({ length: width }, () => ({ dates: 0, amounts: 0, negatives: 0, texts: 0, filled: 0 }))
  for (const row of matrix) {
    for (let c = 0; c < width; c++) {
      const cell = row[c]
      if (cell === null || cell === undefined || cell === '') continue
      const st = stats[c]
      st.filled++
      const amount = parseStatementAmount(cell)
      if (parseStatementDate(cell)) st.dates++
      else if (amount !== null) {
        st.amounts++
        if (amount < 0) st.negatives++
      } else if (typeof cell === 'string') st.texts++
    }
  }
  let date = -1
  for (let c = 0; c < width; c++) {
    const st = stats[c]
    if (st.filled >= 2 && st.dates / st.filled >= 0.6 && (date < 0 || st.dates > stats[date].dates)) date = c
  }
  if (date < 0) return null
  let amount = -1
  for (let c = 0; c < width; c++) {
    if (c === date) continue
    const st = stats[c]
    if (st.filled < 2 || st.amounts / st.filled < 0.6) continue
    if (amount < 0) amount = c
    else if (stats[amount].negatives === 0 && st.negatives > 0) amount = c
  }
  if (amount < 0) return null
  let text: number | null = null
  for (let c = 0; c < width; c++) {
    if (c === date || c === amount) continue
    if (stats[c].texts > (text === null ? 0 : stats[text].texts)) text = c
  }
  return { date, amount, amountOut: null, text, headerBased: false }
}

/** Tolkar en cellmatris till transaktionsrader. */
export function interpret(matrix: Cell[][]): ParsedStatement {
  const cleaned = matrix.map((row) => row.map((c) => (typeof c === 'string' ? c.trim() : c)))
  const fromHeader = columnsFromHeader(cleaned)
  const cols = fromHeader?.cols ?? columnsFromContent(cleaned)
  if (!cols) throw new Error('Hittade inga kolumner med datum och belopp i filen')
  const dataStart = fromHeader?.dataStart ?? 0
  const rows: StatementRow[] = []
  let skipped = 0
  for (let r = dataStart; r < cleaned.length; r++) {
    const row = cleaned[r]
    if (row.every((c) => c === null || c === '')) continue
    const date = parseStatementDate(row[cols.date] ?? null, cols.headerBased)
    let amount = parseStatementAmount(row[cols.amount] ?? null)
    if (cols.amountOut !== null && (amount === null || amount === 0)) {
      const out = parseStatementAmount(row[cols.amountOut] ?? null)
      if (out !== null && out !== 0) amount = -Math.abs(out)
    }
    if (!date || amount === null || amount === 0) {
      skipped++
      continue
    }
    const textCell = cols.text !== null ? row[cols.text] : null
    rows.push({ date, amountOre: amount, text: typeof textCell === 'string' ? textCell : '' })
  }
  return { rows: rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)), skipped }
}

/** Slår ihop rader från flera filer. Utdrag överlappar ofta (t.ex. ett per
 *  månad plus ett för hela året), så identiska rader räknas per fil och
 *  max-antalet per fil behålls – två likadana köp i samma fil är äkta,
 *  samma rad i två filer är samma transaktion. */
export function mergeStatements(perFile: StatementRow[][]): StatementRow[] {
  const kept = new Map<string, StatementRow[]>()
  for (const rows of perFile) {
    const seen = new Map<string, number>()
    for (const row of rows) {
      const key = `${row.date}|${row.amountOre}|${row.text.toLowerCase()}`
      const n = (seen.get(key) ?? 0) + 1
      seen.set(key, n)
      const list = kept.get(key) ?? []
      if (n > list.length) {
        list.push(row)
        kept.set(key, list)
      }
    }
  }
  return [...kept.values()]
    .flat()
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
}
