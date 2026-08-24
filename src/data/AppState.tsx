import { createContext, useContext, useEffect, useReducer, useState } from 'react'
import type { ReactNode } from 'react'
import type { AppData, Category, FixedItem, Theme, Transaction } from '../types'
import { currentMonthKey, dateInMonth, monthKeyOf, monthsBetween } from '../lib/dates'
import { uid } from '../lib/id'
import { defaultData } from './defaults'
import { storage } from './storage'

export type Action =
  | { type: 'tx/add'; tx: Transaction }
  | { type: 'tx/update'; tx: Transaction }
  | { type: 'tx/delete'; id: string }
  | { type: 'cat/add'; category: Category }
  | { type: 'cat/update'; category: Category }
  | { type: 'cat/delete'; id: string }
  | { type: 'fixed/add'; item: FixedItem }
  | { type: 'fixed/update'; item: FixedItem }
  | { type: 'fixed/delete'; id: string }
  | { type: 'budget/set'; categoryId: string; amountOre: number | null }
  | { type: 'theme/set'; theme: Theme }
  | { type: 'data/import'; data: AppData }
  | { type: 'data/reset' }
  | { type: 'materialize' }

/** Skapar månadens transaktioner från aktiva fasta poster – från postens
 *  startmånad till och med innevarande månad, utom där en transaktion redan
 *  finns eller användaren raderat den (tombstone i skippedFixed). */
function materialize(data: AppData): AppData {
  const nowMonth = currentMonthKey()
  const skipped = new Set(data.skippedFixed)
  const existing = new Set(
    data.transactions.filter((t) => t.fixedId).map((t) => `${t.fixedId}:${monthKeyOf(t.date)}`),
  )
  const created: Transaction[] = []
  for (const f of data.fixed) {
    if (!f.active) continue
    for (const m of monthsBetween(f.startMonth, nowMonth)) {
      const key = `${f.id}:${m}`
      if (skipped.has(key) || existing.has(key)) continue
      created.push({
        id: uid(),
        type: f.type,
        amountOre: f.amountOre,
        categoryId: f.categoryId,
        date: dateInMonth(m, f.dayOfMonth),
        note: f.name,
        fixedId: f.id,
      })
    }
  }
  if (created.length === 0) return data
  return { ...data, transactions: [...data.transactions, ...created] }
}

const tombstone = (fixedId: string, date: string) => `${fixedId}:${monthKeyOf(date)}`

function reducer(data: AppData, action: Action): AppData {
  switch (action.type) {
    case 'tx/add':
      return { ...data, transactions: [...data.transactions, action.tx] }

    case 'tx/update': {
      const prev = data.transactions.find((t) => t.id === action.tx.id)
      const transactions = data.transactions.map((t) => (t.id === action.tx.id ? action.tx : t))
      // Om en fast posts transaktion flyttas till en annan månad får ursprungs-
      // månaden en tombstone, annars återskapas posten där som dubblett.
      let skippedFixed = data.skippedFixed
      if (prev?.fixedId && monthKeyOf(prev.date) !== monthKeyOf(action.tx.date)) {
        skippedFixed = [...skippedFixed, tombstone(prev.fixedId, prev.date)]
      }
      return { ...data, transactions, skippedFixed }
    }

    case 'tx/delete': {
      const prev = data.transactions.find((t) => t.id === action.id)
      const transactions = data.transactions.filter((t) => t.id !== action.id)
      let skippedFixed = data.skippedFixed
      if (prev?.fixedId) skippedFixed = [...skippedFixed, tombstone(prev.fixedId, prev.date)]
      return { ...data, transactions, skippedFixed }
    }

    case 'cat/add':
      return { ...data, categories: [...data.categories, action.category] }

    case 'cat/update':
      return {
        ...data,
        categories: data.categories.map((c) => (c.id === action.category.id ? action.category : c)),
      }

    case 'cat/delete': {
      const used =
        data.transactions.some((t) => t.categoryId === action.id) ||
        data.fixed.some((f) => f.categoryId === action.id)
      if (used) return data // UI:t förhindrar detta; skyddet finns kvar här.
      const budgets = { ...data.budgets }
      delete budgets[action.id]
      return { ...data, categories: data.categories.filter((c) => c.id !== action.id), budgets }
    }

    case 'fixed/add':
      return materialize({ ...data, fixed: [...data.fixed, action.item] })

    case 'fixed/update': {
      const prev = data.fixed.find((f) => f.id === action.item.id)
      let item = action.item
      // Återaktivering börjar gälla från innevarande månad – inga retroaktiva poster.
      if (prev && !prev.active && item.active) item = { ...item, startMonth: currentMonthKey() }
      return materialize({
        ...data,
        fixed: data.fixed.map((f) => (f.id === item.id ? item : f)),
      })
    }

    case 'fixed/delete':
      // Redan skapade transaktioner behålls som historik.
      return { ...data, fixed: data.fixed.filter((f) => f.id !== action.id) }

    case 'budget/set': {
      const budgets = { ...data.budgets }
      if (action.amountOre && action.amountOre > 0) budgets[action.categoryId] = action.amountOre
      else delete budgets[action.categoryId]
      return { ...data, budgets }
    }

    case 'theme/set':
      return { ...data, settings: { ...data.settings, theme: action.theme } }

    case 'data/import':
      return materialize(action.data)

    case 'data/reset':
      return defaultData()

    case 'materialize':
      return materialize(data)
  }
}

interface Ctx {
  data: AppData
  dispatch: (action: Action) => void
  /** true när datan inte kan sparas i webbläsaren (t.ex. privat läge). */
  persistError: boolean
}

const AppContext = createContext<Ctx | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, dispatch] = useReducer(reducer, undefined, () =>
    materialize(storage.load() ?? defaultData()),
  )
  const [persistError, setPersistError] = useState(false)

  useEffect(() => {
    setPersistError(!storage.save(data))
  }, [data])

  // Tema: 'auto' följer systemet, annars låses via data-theme på <html>.
  useEffect(() => {
    const theme = data.settings.theme
    if (theme === 'auto') delete document.documentElement.dataset.theme
    else document.documentElement.dataset.theme = theme
  }, [data.settings.theme])

  // Fångar månadsskiften i en flik/PWA som stått öppen länge.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') dispatch({ type: 'materialize' })
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  return (
    <AppContext.Provider value={{ data, dispatch, persistError }}>{children}</AppContext.Provider>
  )
}

export function useApp(): Ctx {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp måste användas inom AppProvider')
  return ctx
}
