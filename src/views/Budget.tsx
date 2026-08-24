import { useState } from 'react'
import { useApp } from '../data/AppState'
import { formatKr, oreToInput, parseKr } from '../lib/money'
import { budgetRows, savingRows, totalBudget } from '../lib/selectors'
import type { SavingRow } from '../lib/selectors'
import type { Category } from '../types'
import { AmountField } from '../components/AmountField'
import { BudgetSummary } from '../components/BudgetSummary'
import { MonthSwitcher } from '../components/MonthSwitcher'
import { Sheet } from '../components/Sheet'
import { Meter } from '../components/charts/Meter'
import { CheckIcon, Dot, WarnIcon } from '../components/Icons'

interface Props {
  month: string
  onMonth: (m: string) => void
}

export function Budget({ month, onMonth }: Props) {
  const { data, dispatch } = useApp()
  const [editing, setEditing] = useState<Category | null>(null)
  const [amount, setAmount] = useState('')

  const rows = budgetRows(data, month)
  const total = totalBudget(rows)
  const savings = savingRows(data, month)
  const goals = savings.filter((s): s is SavingRow & { goalOre: number } => s.goalOre !== null)
  const noGoal = savings.filter((s) => s.goalOre === null)
  const unbudgeted = data.categories.filter(
    (c) => c.type === 'expense' && data.budgets[c.id] === undefined,
  )

  const openEditor = (cat: Category) => {
    const cap = data.budgets[cat.id]
    setAmount(cap ? oreToInput(cap) : '')
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

      {rows.length === 0 && goals.length === 0 && (
        <section className="card welcome">
          <h2>Sätt din första budget</h2>
          <p>
            Välj ett månadstak per utgiftskategori så ser du hela tiden hur mycket som är kvar
            att spendera – och sätt ett sparmål för att följa månadens sparande.
          </p>
        </section>
      )}
      {rows.length > 0 && (
        <section className="card budget-card">
          <BudgetSummary capOre={total.capOre} spentOre={total.spentOre} />
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
                    <Dot slot={category.slot} />
                    <span className="row-title">{category.name}</span>
                    <span className="budget-nums">
                      {formatKr(spentOre)} / {formatKr(capOre)}
                    </span>
                  </span>
                  <Meter ratio={spentOre / capOre} slot={category.slot} />
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

      {savings.length > 0 && (
        <>
          <h2 className="section-head">Sparmål</h2>
          <div className="card list">
            {goals.map(({ category, goalOre, savedOre }) => {
              const reached = savedOre >= goalOre
              return (
                <button
                  key={category.id}
                  type="button"
                  className="row budget-row"
                  onClick={() => openEditor(category)}
                >
                  <span className="row-main">
                    <span className="budget-row-top">
                      <Dot slot={category.slot} />
                      <span className="row-title">{category.name}</span>
                      <span className="budget-nums">
                        {formatKr(savedOre)} / {formatKr(goalOre)}
                      </span>
                    </span>
                    {/* Överskjutet sparande är bra – mätaren klampas i stället
                        för att slå om till kritisk färg som för utgiftstak. */}
                    <Meter ratio={Math.min(1, savedOre / goalOre)} slot={category.slot} />
                    {reached ? (
                      <span className="over-note good">
                        <CheckIcon size={14} />{' '}
                        {savedOre > goalOre
                          ? `Mål nått – ${formatKr(savedOre - goalOre)} över`
                          : 'Mål nått!'}
                      </span>
                    ) : (
                      <span className="hint">{formatKr(goalOre - savedOre)} kvar till målet</span>
                    )}
                  </span>
                </button>
              )
            })}
            {noGoal.map(({ category }) => (
              <button
                key={category.id}
                type="button"
                className="row"
                onClick={() => openEditor(category)}
              >
                <Dot slot={category.slot} big />
                <span className="row-main">
                  <span className="row-title">{category.name}</span>
                </span>
                <span className="row-action">Sätt mål</span>
              </button>
            ))}
          </div>
        </>
      )}

      {unbudgeted.length > 0 && (
        <>
          <h2 className="section-head">Utan budget</h2>
          <div className="card list">
            {unbudgeted.map((c) => (
              <button key={c.id} type="button" className="row" onClick={() => openEditor(c)}>
                <Dot slot={c.slot} big />
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
        <Sheet
          title={
            editing.type === 'saving' ? `Sparmål för ${editing.name}` : `Budget för ${editing.name}`
          }
          onClose={() => setEditing(null)}
        >
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault()
              saveBudget()
            }}
          >
            <AmountField
              label={editing.type === 'saving' ? 'Månadsmål' : 'Månadstak'}
              value={amount}
              onChange={setAmount}
              autoFocus
            />
            <button type="submit" className="btn primary">
              Spara
            </button>
            {data.budgets[editing.id] !== undefined && (
              <button type="button" className="btn danger-ghost" onClick={removeBudget}>
                {editing.type === 'saving' ? 'Ta bort mål' : 'Ta bort budget'}
              </button>
            )}
          </form>
        </Sheet>
      )}
    </div>
  )
}
