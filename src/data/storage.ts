import type { AppData, Category, FixedItem, Theme, Transaction } from '../types'
import { isISODate, isMonthKey } from '../lib/dates'
import { defaultData, SLOT_NAMES } from './defaults'

/** Lagringslagret är en utbytbar adapter. Idag localStorage; en framtida
 *  molnadapter (t.ex. Supabase med inloggning och synk mellan enheter)
 *  implementerar samma gränssnitt utan att resten av appen ändras. */
export interface StorageAdapter {
  load(): AppData | null
  /** Returnerar false när sparningen misslyckas (t.ex. blockerad lagring),
   *  så att appen kan varna om att ändringar inte överlever en omladdning. */
  save(data: AppData): boolean
}

const STORAGE_KEY = 'minbudget:data:v1'

/** Spegel av valt tema, läses av anti-flash-skriptet i index.html
 *  (som inte kan importera konstanten – håll dem i synk). */
export const THEME_KEY = 'minbudget:theme'

export const storage: StorageAdapter = {
  load(): AppData | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return null
      return sanitize(JSON.parse(raw))
    } catch {
      return null
    }
  },

  save(data: AppData): boolean {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
      return true
    } catch {
      return false
    }
  },
}

const isStr = (v: unknown): v is string => typeof v === 'string'
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isTxType = (v: unknown): v is 'expense' | 'income' => v === 'expense' || v === 'income'
const isMonth = (v: unknown): v is string => isStr(v) && isMonthKey(v)
const isDate = (v: unknown): v is string => isStr(v) && isISODate(v)

/** Validerar och städar okänd JSON (import eller lagrad data) till ett giltigt
 *  AppData. Ogiltiga poster hoppas över i stället för att fälla hela läsningen. */
export function sanitize(raw: unknown): AppData | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  if (r.version !== 1) return null

  const base = defaultData()

  const categories: Category[] = Array.isArray(r.categories)
    ? r.categories.flatMap((c: unknown): Category[] => {
        const o = c as Record<string, unknown>
        if (!o || !isStr(o.id) || !isStr(o.name) || !isTxType(o.type)) return []
        const slot = isNum(o.slot) ? Math.min(SLOT_NAMES.length - 1, Math.max(0, Math.round(o.slot))) : 0
        return [{ id: o.id, name: o.name, type: o.type, slot }]
      })
    : base.categories
  if (categories.length === 0) categories.push(...base.categories)
  const catIds = new Set(categories.map((c) => c.id))

  const transactions: Transaction[] = Array.isArray(r.transactions)
    ? r.transactions.flatMap((t: unknown): Transaction[] => {
        const o = t as Record<string, unknown>
        if (!o || !isStr(o.id) || !isTxType(o.type) || !isNum(o.amountOre)) return []
        if (!isDate(o.date) || !isStr(o.categoryId) || !catIds.has(o.categoryId)) return []
        return [
          {
            id: o.id,
            type: o.type,
            amountOre: Math.max(0, Math.round(o.amountOre)),
            categoryId: o.categoryId,
            date: o.date,
            note: isStr(o.note) && o.note ? o.note : undefined,
            fixedId: isStr(o.fixedId) ? o.fixedId : undefined,
          },
        ]
      })
    : []

  const fixed: FixedItem[] = Array.isArray(r.fixed)
    ? r.fixed.flatMap((f: unknown): FixedItem[] => {
        const o = f as Record<string, unknown>
        if (!o || !isStr(o.id) || !isStr(o.name) || !isTxType(o.type)) return []
        if (!isNum(o.amountOre) || !isStr(o.categoryId) || !catIds.has(o.categoryId)) return []
        if (!isMonth(o.startMonth)) return []
        const day = isNum(o.dayOfMonth) ? Math.min(31, Math.max(1, Math.round(o.dayOfMonth))) : 1
        return [
          {
            id: o.id,
            name: o.name,
            type: o.type,
            amountOre: Math.max(0, Math.round(o.amountOre)),
            categoryId: o.categoryId,
            dayOfMonth: day,
            active: o.active !== false,
            startMonth: o.startMonth,
          },
        ]
      })
    : []

  const budgets: Record<string, number> = {}
  if (typeof r.budgets === 'object' && r.budgets !== null) {
    for (const [k, v] of Object.entries(r.budgets as Record<string, unknown>)) {
      if (catIds.has(k) && isNum(v) && v > 0) budgets[k] = Math.round(v)
    }
  }

  const skippedFixed = Array.isArray(r.skippedFixed) ? r.skippedFixed.filter(isStr) : []

  const settingsRaw = (r.settings ?? {}) as Record<string, unknown>
  const theme: Theme =
    settingsRaw.theme === 'light' || settingsRaw.theme === 'dark' ? settingsRaw.theme : 'auto'

  return { version: 1, transactions, categories, fixed, budgets, skippedFixed, settings: { theme } }
}

export function exportJson(data: AppData): string {
  return JSON.stringify(data, null, 2)
}
