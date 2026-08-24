import { useMemo, useState } from 'react'
import { useApp } from '../data/AppState'
import { dayLabel } from '../lib/dates'
import { formatSignedKr, formatKr } from '../lib/money'
import { categoryById, monthTotals, txForMonth } from '../lib/selectors'
import type { Transaction, TxType } from '../types'
import { MonthSwitcher } from '../components/MonthSwitcher'
import { RepeatIcon } from '../components/Icons'

interface Props {
  month: string
  onMonth: (m: string) => void
  onEditTx: (tx: Transaction) => void
  onAddTx: () => void
}

type Filter = 'all' | TxType

export function Transactions({ month, onMonth, onEditTx, onAddTx }: Props) {
  const { data } = useApp()
  const [filter, setFilter] = useState<Filter>('all')
  const totals = monthTotals(data, month)

  const groups = useMemo(() => {
    const txs = txForMonth(data, month)
      .filter((t) => filter === 'all' || t.type === filter)
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    const byDay = new Map<string, Transaction[]>()
    for (const t of txs) {
      const list = byDay.get(t.date) ?? []
      list.push(t)
      byDay.set(t.date, list)
    }
    return [...byDay.entries()]
  }, [data, month, filter])

  return (
    <div className="view">
      <header className="topbar">
        <h1>Historik</h1>
      </header>
      <MonthSwitcher month={month} onChange={onMonth} />

      <p className="month-sums">
        <span className="neg">−{formatKr(totals.expenseOre)}</span>
        {' · '}
        <span className="pos">+{formatKr(totals.incomeOre)}</span>
      </p>

      <div className="segmented small" role="radiogroup" aria-label="Filtrera">
        {(
          [
            ['all', 'Alla'],
            ['expense', 'Utgifter'],
            ['income', 'Inkomster'],
          ] as [Filter, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={filter === id}
            className={filter === id ? 'on' : ''}
            onClick={() => setFilter(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {groups.length === 0 && (
        <section className="card empty">
          <p>Inga transaktioner den här månaden.</p>
          <button type="button" className="btn primary" onClick={onAddTx}>
            Lägg till transaktion
          </button>
        </section>
      )}

      {groups.map(([date, txs]) => (
        <section key={date} className="day-group">
          <h2 className="day-head">{dayLabel(date)}</h2>
          <div className="card list">
            {txs.map((t) => {
              const cat = categoryById(data, t.categoryId)
              // Undvik "Lön · Lön" när en fast post heter som sin kategori.
              const subText =
                t.note && t.note !== cat?.name ? t.note : t.fixedId ? 'Fast post' : t.note
              return (
                <button key={t.id} type="button" className="row" onClick={() => onEditTx(t)}>
                  <span
                    className="dot big"
                    style={{ background: `var(--slot-${cat?.slot ?? 0})` }}
                    aria-hidden
                  />
                  <span className="row-main">
                    <span className="row-title">{cat?.name ?? 'Okänd kategori'}</span>
                    {(t.note || t.fixedId) && (
                      <span className="row-sub">
                        {t.fixedId && (
                          <span className="fixed-mark" title="Från fast post">
                            <RepeatIcon size={12} />
                          </span>
                        )}
                        {subText}
                      </span>
                    )}
                  </span>
                  <span className={`row-amount ${t.type === 'income' ? 'pos' : ''}`}>
                    {formatSignedKr(t.amountOre, t.type)}
                  </span>
                </button>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
