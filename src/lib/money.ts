import type { TxType } from '../types'

const nf0 = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 0 })
const nf2 = new Intl.NumberFormat('sv-SE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** Formaterar öre till t.ex. '1 234 kr' eller '1 234,50 kr'. Negativa belopp får '−'. */
export function formatKr(ore: number): string {
  const abs = Math.abs(ore)
  const num = abs % 100 === 0 ? nf0.format(abs / 100) : nf2.format(abs / 100)
  return `${ore < 0 ? '−' : ''}${num} kr`
}

/** '+1 234 kr' för inkomster, '−1 234 kr' för utgifter. */
export function formatSignedKr(ore: number, type: TxType): string {
  return `${type === 'income' ? '+' : '−'}${formatKr(Math.abs(ore))}`
}

/** Nettobelopp med tecken: '+1 234 kr' / '−1 234 kr' / '0 kr'. */
export function formatNetKr(ore: number): string {
  return ore > 0 ? `+${formatKr(ore)}` : formatKr(ore)
}

/** Öre → redigerbar inmatningssträng ('12500' / '129,50'); inversen av parseKr. */
export function oreToInput(ore: number): string {
  const kr = ore / 100
  return (Number.isInteger(kr) ? String(kr) : kr.toFixed(2)).replace('.', ',')
}

/** Tolkar användarinmatning som '129', '129,50', '1 234.50', '1.234,56' → öre. */
export function parseKr(input: string): number | null {
  let s = input.trim().replace(/[\s  ]/g, '').replace(/kr$/i, '')
  if (!s) return null
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.')
  // Punkt som tusentalsavgränsare ('12.500') – aldrig tvetydigt med decimaler,
  // som alltid är en eller två siffror.
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '')
  if (!/^\d+(\.\d{0,2})?$/.test(s)) return null
  const n = Number(s)
  if (!Number.isFinite(n)) return null
  return Math.round(n * 100)
}
