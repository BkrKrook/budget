import type { AppData, Category } from '../types'

/** Palettplatsernas namn, för färgväljaren. Index = slot.
 *  Själva färgvärdena ligger i CSS (--slot-0 … --slot-8) så att temat styr nyansen. */
export const SLOT_NAMES = [
  'Grå',
  'Blå',
  'Orange',
  'Turkos',
  'Gul',
  'Rosa',
  'Grön',
  'Lila',
  'Röd',
] as const

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat-boende', name: 'Boende', type: 'expense', slot: 1 },
  { id: 'cat-mat', name: 'Mat & dagligvaror', type: 'expense', slot: 2 },
  { id: 'cat-transport', name: 'Transport', type: 'expense', slot: 3 },
  { id: 'cat-noje', name: 'Nöje & fritid', type: 'expense', slot: 4 },
  { id: 'cat-restaurang', name: 'Restaurang & café', type: 'expense', slot: 5 },
  { id: 'cat-halsa', name: 'Hälsa', type: 'expense', slot: 6 },
  { id: 'cat-abonnemang', name: 'Abonnemang & media', type: 'expense', slot: 7 },
  { id: 'cat-klader', name: 'Kläder & shopping', type: 'expense', slot: 8 },
  { id: 'cat-ovrigt', name: 'Övrigt', type: 'expense', slot: 0 },
  { id: 'cat-lon', name: 'Lön', type: 'income', slot: 1 },
  { id: 'cat-bidrag', name: 'Bidrag & ersättningar', type: 'income', slot: 3 },
  { id: 'cat-ovrig-inkomst', name: 'Övrig inkomst', type: 'income', slot: 0 },
]

export function defaultData(): AppData {
  return {
    version: 1,
    transactions: [],
    categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
    fixed: [],
    budgets: {},
    skippedFixed: [],
    settings: { theme: 'auto' },
  }
}
