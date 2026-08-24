import { useState } from 'react'
import { useApp } from '../data/AppState'
import { formatKr, parseKr } from '../lib/money'
import { budgetRows, totalBudget } from '../lib/selectors'
import type { Category } from '../types'
import { MonthSwitcher } from '../components/MonthSwitcher'
import { Sheet } from '../components/Sheet'
import { Meter } from '../components/charts/Meter'
import { WarnIcon } from '../components/Icons'

interface Props {
  month: string
  onMonth: (m: string) => void
}

export function Budget({ month, onMonth }: Props) {
  const { data, dispatch } = useApp()
  const [editing, setEditing] = useState<Category | null>(null)
  const [amount, setAmount] = useState('')

  const rows = budgetRows(data, month)
  const total = totalBudget(data, month)
  const leftOre = total.capOre - total.spentOre
  const unbudgeted = data.categories.filter(
    (c) => c.type === 'expense' && data.budgets[c.id] === undefined,
  )

  const openEditor = (cat: Category) => {
    const cap = data.budgets[cat.id]
    setAmount(cap ? String(cap / 100).replace('.', ',') : '')
    setEditing(cat)
  }

  const saveBudget = () => {
    if (!editing) return
    const ore = parseKr(amount)
    if (!ore || ore <= 0) return
    dispatch({ type: 'budget/set', categoryId: editing.id, amountOre: ore })
    setEditing(null)
  }

  const removeBudget = () => {
    if (!editing) return
    dispatch({ type: 'budget/set', categoryId: editing.id, amountOre: null })
    setEditing(null)
  }

  return (
    <div className="view">
      <header className="topbar">
        <h1>Budget</h1>
      </header>
      <MonthSwitcher month={month} onChange={onMonth} />

      {rows.length === 0 ? (
        <section className="card welcome">
          <h2>Sätt din första budget</h2>
          <p>
            Välj ett månadstak per kategori så ser du hela tiden hur mycket som är kvar att
            spendera.
          </p>
        </section>
      ) : (
        <section className="card budget-total">
          <span className="card-title">Kvar att spendera</span>
          <span className={`hero ${leftOre >= 0 ? 'pos' : 'neg'}`}>
            {leftOre < 0 ? '−' : ''}
            {formatKr(Math.abs(leftOre))}
          </span>
          <Meter ratio={total.capOre > 0 ? total.spentOre / total.capOre : 0} slot={1} />
          <span className="sub">
            {formatKr(total.spentOre)} använt av {formatKr(total.capOre)} budgeterat
          </span>
        </section>
      )}

      {rows.length > 0 && (
        <div className="card list">
          {rows.map(({ category, capOre, spentOre }) => {
            const over = spentOre > capOre
            return (
              <button
                key={category.id}
                type="button"
                className="row budget-row"
                onClick={() => openEditor(category)}
              >
                <span className="row-main">
                  <span className="budget-row-top">
                    <span
                      className="dot"
                      style={{ background: `var(--slot-${category.slot})` }}
                      aria-hidden
                    />
                    <span className="row-title">{category.name}</span>
                    <span className="budget-nums">
                      {formatKr(spentOre)} / {formatKr(capOre)}
                    </span>
                  </span>
                  <Meter ratio={capOre > 0 ? spentOre / capOre : 0} slot={category.slot} />
                  {over && (
                    <span className="over-note">
                      <WarnIcon size={14} /> {formatKr(spentOre - capOre)} över budgeten
                    </span>
                  )}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {unbudgeted.length > 0 && (
        <>
          <h2 className="section-head">Utan budget</h2>
          <div className="card list">
            {unbudgeted.map((c) => (
              <button key={c.id} type="button" className="row" onClick={() => openEditor(c)}>
                <span className="dot big" style={{ background: `var(--slot-${c.slot})` }} aria-hidden />
                <span className="row-main">
                  <span className="row-title">{c.name}</span>
                </span>
                <span className="row-action">Sätt budget</span>
              </button>
            ))}
          </div>
        </>
      )}

      {editing && (
        <Sheet title={`Budget för ${editing.name}`} onClose={() => setEditing(null)}>
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault()
              saveBudget()
            }}
          >
            <label className="field">
              <span>Månadstak</span>
              <div className="amount-wrap">
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  autoFocus
                  aria-label="Månadstak i kronor"
                />
                <span className="amount-unit">kr</span>
              </div>
            </label>
            <button type="submit" className="btn primary">
              Spara
            </button>
            {data.budgets[editing.id] !== undefined && (
              <button type="button" className="btn danger-ghost" onClick={removeBudget}>
                Ta bort budget
              </button>
            )}
          </form>
        </Sheet>
      )}
    </div>
  )
}
