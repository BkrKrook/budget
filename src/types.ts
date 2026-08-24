/** 'saving' är pengar som flyttas undan (sparkonto, buffert) – varken utgift
 *  eller inkomst, men räknas bort från månadens saldo. */
export type TxType = 'expense' | 'income' | 'saving'

/** Färg anges som palettplats (slot) 0–8 så att ljust/mörkt tema kan byta nyans.
 *  Slot 0 är neutral grå (för "Övrigt" och hopvikta rester i grafer). */
export interface Category {
  id: string
  name: string
  type: TxType
  slot: number
}

/** Belopp lagras alltid i öre (heltal) för att undvika flyttalsfel. */
export interface Transaction {
  id: string
  type: TxType
  amountOre: number
  categoryId: string
  date: string // 'YYYY-MM-DD' (lokal tid)
  note?: string
  /** Satt när transaktionen skapats automatiskt från en fast post. */
  fixedId?: string
}

export interface FixedItem {
  id: string
  name: string
  type: TxType
  amountOre: number
  categoryId: string
  dayOfMonth: number // 1–31, begränsas till månadens sista dag
  active: boolean
  /** Första månaden ('YYYY-MM') som posten ska skapas för. */
  startMonth: string
}

export type Theme = 'auto' | 'light' | 'dark'

export interface AppData {
  version: 1
  transactions: Transaction[]
  categories: Category[]
  fixed: FixedItem[]
  /** Månadsbudget per kategori-id, i öre. För utgiftskategorier ett tak,
   *  för sparkategorier ett mål. */
  budgets: Record<string, number>
  /** Nycklar '<fixedId>:<YYYY-MM>' för månader där en fast post raderats
   *  manuellt och inte ska återskapas. */
  skippedFixed: string[]
  settings: { theme: Theme }
}
