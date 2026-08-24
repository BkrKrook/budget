import { createContext, useContext, useEffect, useReducer, useState } from 'react'
import type { ReactNode } from 'react'
import type { AppData, Category, FixedItem, Theme, Transaction } from '../types'
import { currentMonthKey, dateInMonth, monthKeyOf, monthsBetween } from '../lib/dates'
import { uid } from '../lib/id'
import { isCategoryUsed } from '../lib/selectors'
import { defaultData } from './defaults'
import { storage, THEME_KEY } from './storage'

type Action =
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

/** Enda byggaren av nycklarna i skippedFixed – formatet är persisterat
 *  (localStorage/export) och delas av materialize och tombstone-hanteringen. */
const fixedKey = (fixedId: string, monthKey: string) => `${fixedId}:${monthKey}`

/** Skapar månadens transaktioner från aktiva fasta poster – från postens
 *  startmånad till och med innevarande månad, utom där en transaktion redan
 *  finns eller användaren raderat den (tombstone i skippedFixed). */
function materialize(data: AppData): AppData {
  const nowMonth = currentMonthKey()
  const skipped = new Set(data.skippedFixed)
  const existing = new Set(
    data.transactions
      .filter((t) => t.fixedId)
      .map((t) => fixedKey(t.fixedId as string, monthKeyOf(t.date))),
  )
  const created: Transaction[] = []
  for (const f of data.fixed) {
    if (!f.active) continue
    for (const m of monthsBetween(f.startMonth, nowMonth)) {
      const key = fixedKey(f.id, m)
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

function reducer(data: AppData, action: Action): AppData {
  switch (action.type) {
    case 'tx/add':
      return { ...data, transactions: [...data.transactions, action.tx] }

    case 'tx/update': {
      const prev = data.transactions.find((t) => t.id === action.tx.id)
      // Kopplingen till en fast post ägs av reducern: en redigering kan
      // aldrig tappa fixedId, oavsett vad formuläret skickar.
      const next = { ...action.tx, fixedId: prev?.fixedId }
      const transactions = data.transactions.map((t) => (t.id === next.id ? next : t))
      // Om en fast posts transaktion flyttas till en annan månad får ursprungs-
      // månaden en tombstone, annars återskapas posten där som dubblett.
      let skippedFixed = data.skippedFixed
      if (prev?.fixedId && monthKeyOf(prev.date) !== monthKeyOf(next.date)) {
        skippedFixed = [...skippedFixed, fixedKey(prev.fixedId, monthKeyOf(prev.date))]
      }
      return { ...data, transactions, skippedFixed }
    }

    case 'tx/delete': {
      const prev = data.transactions.find((t) => t.id === action.id)
      const transactions = data.transactions.filter((t) => t.id !== action.id)
      let skippedFixed = data.skippedFixed
      if (prev?.fixedId) {
        skippedFixed = [...skippedFixed, fixedKey(prev.fixedId, monthKeyOf(prev.date))]
      }
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
      // UI:t förhindrar detta; skyddet finns kvar här med samma delade regel.
      if (isCategoryUsed(data, action.id)) return data
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
  // Speglas till en egen liten nyckel så att anti-flash-skriptet i index.html
  // slipper läsa och parsa hela datablobben före first paint.
  useEffect(() => {
    const theme = data.settings.theme
    if (theme === 'auto') delete document.documentElement.dataset.theme
    else document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem(THEME_KEY, theme)
    } catch {
      // Blockerad lagring hanteras redan av persistError.
    }
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
