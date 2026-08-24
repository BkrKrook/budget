import type { AppData, Category, Transaction } from '../types'
import { addMonths, monthKeyOf } from './dates'

export function categoryById(data: AppData, id: string): Category | undefined {
  return data.categories.find((c) => c.id === id)
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

export interface CategorySum {
  category: Category
  amountOre: number
}

/** Månadens utgifter per kategori, störst först. */
export function expenseByCategory(data: AppData, monthKey: string): CategorySum[] {
  const sums = new Map<string, number>()
  for (const t of txForMonth(data, monthKey)) {
    if (t.type !== 'expense') continue
    sums.set(t.categoryId, (sums.get(t.categoryId) ?? 0) + t.amountOre)
  }
  const rows: CategorySum[] = []
  for (const [categoryId, amountOre] of sums) {
    const category = categoryById(data, categoryId)
    if (category && amountOre > 0) rows.push({ category, amountOre })
  }
  return rows.sort((a, b) => b.amountOre - a.amountOre)
}

export interface TrendPoint {
  monthKey: string
  incomeOre: number
  expenseOre: number
}

/** De senaste n månaderna till och med endMonth. */
export function trend(data: AppData, endMonth: string, n = 6): TrendPoint[] {
  const out: TrendPoint[] = []
  for (let i = n - 1; i >= 0; i--) {
    const mk = addMonths(endMonth, -i)
    const t = monthTotals(data, mk)
    out.push({ monthKey: mk, incomeOre: t.incomeOre, expenseOre: t.expenseOre })
  }
  return out
}

export interface BudgetRow {
  category: Category
  capOre: number
  spentOre: number
}

/** Budgeterade utgiftskategorier med månadens utfall, i kategorilistans ordning. */
export function budgetRows(data: AppData, monthKey: string): BudgetRow[] {
  const spent = new Map<string, number>()
  for (const t of txForMonth(data, monthKey)) {
    if (t.type !== 'expense') continue
    spent.set(t.categoryId, (spent.get(t.categoryId) ?? 0) + t.amountOre)
  }
  return data.categories
    .filter((c) => c.type === 'expense' && data.budgets[c.id] !== undefined)
    .map((category) => ({
      category,
      capOre: data.budgets[category.id],
      spentOre: spent.get(category.id) ?? 0,
    }))
}

/** Summerad budget: tak och utfall räknas bara för budgeterade kategorier. */
export function totalBudget(data: AppData, monthKey: string): { capOre: number; spentOre: number } {
  let capOre = 0
  let spentOre = 0
  for (const row of budgetRows(data, monthKey)) {
    capOre += row.capOre
    spentOre += row.spentOre
  }
  return { capOre, spentOre }
}

/** Har det någonsin funnits data? Styr tomtillstånd/onboarding. */
export function hasAnyData(data: AppData): boolean {
  return data.transactions.length > 0 || data.fixed.length > 0
}
