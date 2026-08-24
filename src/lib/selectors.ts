import type { AppData, Category, Transaction } from '../types'
import { addMonths, monthKeyOf } from './dates'

export function categoryById(data: AppData, id: string): Category | undefined {
  return data.categories.find((c) => c.id === id)
}

/** Sant om kategorin refereras av transaktioner eller fasta poster –
 *  regeln för när radering är tillåten, delad av reducer och UI. */
export function isCategoryUsed(data: AppData, categoryId: string): boolean {
  return (
    data.transactions.some((t) => t.categoryId === categoryId) ||
    data.fixed.some((f) => f.categoryId === categoryId)
  )
}

export function txForMonth(data: AppData, monthKey: string): Transaction[] {
  return data.transactions.filter((t) => monthKeyOf(t.date) === monthKey)
}

export interface MonthTotals {
  incomeOre: number
  expenseOre: number
  netOre: number
}

export function monthTotals(data: AppData, monthKey: string): MonthTotals {
  let incomeOre = 0
  let expenseOre = 0
  for (const t of txForMonth(data, monthKey)) {
    if (t.type === 'income') incomeOre += t.amountOre
    else expenseOre += t.amountOre
  }
  return { incomeOre, expenseOre, netOre: incomeOre - expenseOre }
}

/** Månadens utgiftssumma per kategori-id – delas av expenseByCategory och budgetRows. */
function expenseSumsByCategory(data: AppData, monthKey: string): Map<string, number> {
  const sums = new Map<string, number>()
  for (const t of txForMonth(data, monthKey)) {
    if (t.type !== 'expense') continue
    sums.set(t.categoryId, (sums.get(t.categoryId) ?? 0) + t.amountOre)
  }
  return sums
}

export interface CategorySum {
  category: Category
  amountOre: number
}

/** Månadens utgifter per kategori, störst först. */
export function expenseByCategory(data: AppData, monthKey: string): CategorySum[] {
  const rows: CategorySum[] = []
  for (const [categoryId, amountOre] of expenseSumsByCategory(data, monthKey)) {
    const category = categoryById(data, categoryId)
    if (category && amountOre > 0) rows.push({ category, amountOre })
  }
  return rows.sort((a, b) => b.amountOre - a.amountOre)
}

export interface TrendPoint extends MonthTotals {
  monthKey: string
}

/** De senaste n månaderna till och med endMonth, i ett pass över transaktionerna. */
export function trend(data: AppData, endMonth: string, n = 6): TrendPoint[] {
  const byMonth = new Map<string, TrendPoint>()
  for (let i = n - 1; i >= 0; i--) {
    const mk = addMonths(endMonth, -i)
    byMonth.set(mk, { monthKey: mk, incomeOre: 0, expenseOre: 0, netOre: 0 })
  }
  for (const t of data.transactions) {
    const p = byMonth.get(monthKeyOf(t.date))
    if (!p) continue
    if (t.type === 'income') p.incomeOre += t.amountOre
    else p.expenseOre += t.amountOre
  }
  for (const p of byMonth.values()) p.netOre = p.incomeOre - p.expenseOre
  return [...byMonth.values()]
}

export interface BudgetRow {
  category: Category
  capOre: number
  spentOre: number
}

/** Budgeterade utgiftskategorier med månadens utfall, i kategorilistans ordning. */
export function budgetRows(data: AppData, monthKey: string): BudgetRow[] {
  const spent = expenseSumsByCategory(data, monthKey)
  return data.categories
    .filter((c) => c.type === 'expense' && data.budgets[c.id] !== undefined)
    .map((category) => ({
      category,
      capOre: data.budgets[category.id],
      spentOre: spent.get(category.id) ?? 0,
    }))
}

/** Summerar redan beräknade budgetrader. */
export function totalBudget(rows: BudgetRow[]): { capOre: number; spentOre: number } {
  let capOre = 0
  let spentOre = 0
  for (const row of rows) {
    capOre += row.capOre
    spentOre += row.spentOre
  }
  return { capOre, spentOre }
}

/** Har det någonsin funnits data? Styr tomtillstånd/onboarding. */
export function hasAnyData(data: AppData): boolean {
  return data.transactions.length > 0 || data.fixed.length > 0
}
