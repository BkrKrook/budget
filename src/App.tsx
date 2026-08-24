import { useState } from 'react'
import type { Tab } from './components/BottomNav'
import { BottomNav } from './components/BottomNav'
import { PlusIcon } from './components/Icons'
import { TxForm } from './components/TxForm'
import { currentMonthKey, dateInMonth, todayISO } from './lib/dates'
import type { Transaction } from './types'
import { useApp } from './data/AppState'
import { Budget } from './views/Budget'
import { Fixed } from './views/Fixed'
import { More } from './views/More'
import { Overview } from './views/Overview'
import { Transactions } from './views/Transactions'

export default function App() {
  const { persistError } = useApp()
  const [tab, setTab] = useState<Tab>('overview')
  const [month, setMonth] = useState(currentMonthKey())
  const [txSheet, setTxSheet] = useState<Transaction | 'new' | null>(null)

  // Ny transaktion i en annan månad än den pågående får månadens första dag som förslag.
  const defaultDate = month === currentMonthKey() ? todayISO() : dateInMonth(month, 1)
  const showFab = tab === 'overview' || tab === 'history' || tab === 'budget'

  return (
    <>
      {persistError && (
        <div className="warn-banner" role="alert">
          Datan kan inte sparas i den här webbläsaren – ändringar går förlorade när sidan stängs.
          Kontrollera att webbplatsdata är tillåten (inte privat läge).
        </div>
      )}
      <main className="content">
        {tab === 'overview' && (
          <Overview
            month={month}
            onMonth={setMonth}
            onAddTx={() => setTxSheet('new')}
            goTo={setTab}
          />
        )}
        {tab === 'history' && (
          <Transactions
            month={month}
            onMonth={setMonth}
            onEditTx={setTxSheet}
            onAddTx={() => setTxSheet('new')}
          />
        )}
        {tab === 'budget' && <Budget month={month} onMonth={setMonth} />}
        {tab === 'fixed' && <Fixed />}
        {tab === 'more' && <More />}
      </main>

      {showFab && (
        <button
          type="button"
          className="fab"
          onClick={() => setTxSheet('new')}
          aria-label="Ny transaktion"
        >
          <PlusIcon size={26} />
        </button>
      )}

      <BottomNav tab={tab} onChange={setTab} />

      {txSheet && (
        <TxForm
          initial={txSheet === 'new' ? undefined : txSheet}
          defaultDate={defaultDate}
          onClose={() => setTxSheet(null)}
        />
      )}
    </>
  )
}
