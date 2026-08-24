const pad = (n: number) => String(n).padStart(2, '0')

/** Lokal tid – aldrig toISOString(), som ger UTC och fel datum kvällstid. */
function toISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export const isISODate = (s: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(s)
export const isMonthKey = (s: string): boolean => /^\d{4}-\d{2}$/.test(s)

export const todayISO = () => toISO(new Date())
export const currentMonthKey = () => todayISO().slice(0, 7)
export const monthKeyOf = (iso: string) => iso.slice(0, 7)

export function daysInMonth(monthKey: string): number {
  const [y, m] = monthKey.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

export function addMonths(monthKey: string, n: number): string {
  const [y, m] = monthKey.split('-').map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}

/** Inklusive båda ändar; tom lista om a > b. */
export function monthsBetween(a: string, b: string): string[] {
  const out: string[] = []
  let cur = a
  let guard = 0
  while (cur <= b && guard++ < 1200) {
    out.push(cur)
    cur = addMonths(cur, 1)
  }
  return out
}

/** Datum för en fast post i en given månad, med dagen begränsad till månadens längd. */
export function dateInMonth(monthKey: string, dayOfMonth: number): string {
  return `${monthKey}-${pad(Math.min(Math.max(1, dayOfMonth), daysInMonth(monthKey)))}`
}

const monthNameFmt = new Intl.DateTimeFormat('sv-SE', { month: 'long' })
const monthShortFmt = new Intl.DateTimeFormat('sv-SE', { month: 'short' })
const dayFmt = new Intl.DateTimeFormat('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' })

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number)
  return `${cap(monthNameFmt.format(new Date(y, m - 1, 1)))} ${y}`
}

export function shortMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number)
  return monthShortFmt.format(new Date(y, m - 1, 1)).replace('.', '')
}

export function dayLabel(iso: string): string {
  if (iso === todayISO()) return 'Idag'
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  if (iso === toISO(yesterday)) return 'Igår'
  const [y, m, d] = iso.split('-').map(Number)
  return cap(dayFmt.format(new Date(y, m - 1, d)).replace(/\./g, ''))
}
