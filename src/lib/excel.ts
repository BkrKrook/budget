/** Gemensam Excel-semantik för de båda läsarna (xlsx.ts och xls.ts) och
 *  kontoutdragstolkningen: celltypen samt datumformat och seriedatum, som är
 *  desamma oavsett om filen är zip/XML eller binär BIFF. */

import { pad } from './dates'

export type Cell = string | number | null

/** Excels inbyggda datum-/tidsformat (numFmtId/ifmt). */
export const BUILTIN_DATE_FMT = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47])

/** En egen formatkod är ett datumformat om den innehåller dag/månad/år/tid-
 *  tecken när citerade avsnitt, [villkor] och \-escapade tecken räknats bort. */
export function isDateCode(code: string): boolean {
  return /[dmyhs]/i.test(code.replace(/"[^"]*"|\[[^\]]*\]|\\./g, ''))
}

/** Excelserie → 'YYYY-MM-DD'. UTC-aritmetik så att sommartid inte förskjuter
 *  dygnet; tidsdelen (bråkdelen) ignoreras. */
export function serialToISO(serial: number, epoch1904: boolean): string {
  const base = epoch1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 30)
  const d = new Date(base + Math.floor(serial) * 86400000)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}
