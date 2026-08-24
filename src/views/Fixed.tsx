import { useMemo, useState } from 'react'
import { useApp } from '../data/AppState'
import { currentMonthKey } from '../lib/dates'
import { formatKr, formatSignedKr, parseKr } from '../lib/money'
import { categoryById } from '../lib/selectors'
import { uid } from '../lib/id'
import type { FixedItem, TxType } from '../types'
import { Sheet } from '../components/Sheet'
import { PlusIcon } from '../components/Icons'

export function Fixed() {
  const { data, dispatch } = useApp()
  const [sheet, setSheet] = useState<FixedItem | 'new' | null>(null)

  const items = useMemo(
    () => [...data.fixed].sort((a, b) => a.dayOfMonth - b.dayOfMonth || a.name.localeCompare(b.name, 'sv')),
    [data.fixed],
  )

  const toggle = (item: FixedItem) => {
    dispatch({ type: 'fixed/update', item: { ...item, active: !item.active } })
  }

  const monthlyNet = items
    .filter((i) => i.active)
    .reduce((s, i) => s + (i.type === 'income' ? i.amountOre : -i.amountOre), 0)

  return (
    <div className="view">
      <header className="topbar">
        <h1>Fasta poster</h1>
        <button type="button" className="icon-btn accent" onClick={() => setSheet('new')} aria-label="Ny fast post">
          <PlusIcon />
        </button>
      </header>

      {items.length === 0 ? (
        <section className="card welcome">
          <h2>Slipp registrera samma sak varje månad</h2>
          <p>
            Lägg in hyra, lön, el och abonnemang här, så skapas de automatiskt i historiken varje
            månad på rätt dag.
          </p>
          <button type="button" className="btn primary" onClick={() => setSheet('new')}>
            Lägg till fast post
          </button>
        </section>
      ) : (
        <>
          <div className="card list">
            {items.map((item) => {
              const cat = categoryById(data, item.categoryId)
              return (
                <div key={item.id} className={`row static${item.active ? '' : ' inactive'}`}>
                  <button type="button" className="row-tap" onClick={() => setSheet(item)}>
                    <span
                      className="dot big"
                      style={{ background: `var(--slot-${cat?.slot ?? 0})` }}
                      aria-hidden
                    />
                    <span className="row-main">
                      <span className="row-title">{item.name}</span>
                      <span className="row-sub">
                        Dag {item.dayOfMonth} · {cat?.name ?? 'Okänd kategori'}
                      </span>
                    </span>
                    <span className={`row-amount ${item.type === 'income' ? 'pos' : ''}`}>
                      {formatSignedKr(item.amountOre, item.type)}
                    </span>
                  </button>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={item.active}
                    aria-label={`${item.name} ${item.active ? 'aktiv' : 'pausad'}`}
                    className={`switch${item.active ? ' on' : ''}`}
                    onClick={() => toggle(item)}
                  >
                    <span className="knob" />
                  </button>
                </div>
              )
            })}
          </div>
          <p className="hint center">
            Netto per månad från aktiva poster:{' '}
            <strong className={monthlyNet >= 0 ? 'pos' : 'neg'}>
              {monthlyNet > 0 ? '+' : ''}
              {formatKr(monthlyNet)}
            </strong>
          </p>
          <p className="hint center">
            Posterna läggs in automatiskt i historiken varje månad. Tar du bort en enskild månads
            transaktion återskapas den inte. Pausade poster börjar om från innevarande månad när de
            aktiveras igen.
          </p>
        </>
      )}

      {sheet && (
        <FixedForm item={sheet === 'new' ? null : sheet} onClose={() => setSheet(null)} />
      )}
    </div>
  )
}

function FixedForm({ item, onClose }: { item: FixedItem | null; onClose: () => void }) {
  const { data, dispatch } = useApp()
  const [type, setType] = useState<TxType>(item?.type ?? 'expense')
  const [name, setName] = useState(item?.name ?? '')
  const [amount, setAmount] = useState(item ? String(item.amountOre / 100).replace('.', ',') : '')
  const [categoryId, setCategoryId] = useState(item?.categoryId ?? '')
  const [day, setDay] = useState(item?.dayOfMonth ?? 25)
  const [error, setError] = useState('')

  const categories = data.categories.filter((c) => c.type === type)
  const chosen = categories.some((c) => c.id === categoryId) ? categoryId : (categories[0]?.id ?? '')

  const save = () => {
    const amountOre = parseKr(amount)
    if (!name.trim()) return setError('Ange ett namn, t.ex. Hyra.')
    if (!amountOre || amountOre <= 0) return setError('Ange ett belopp större än noll.')
    if (!chosen) return setError('Välj en kategori.')
    const next: FixedItem = {
      id: item?.id ?? uid(),
      name: name.trim(),
      type,
      amountOre,
      categoryId: chosen,
      dayOfMonth: day,
      active: item?.active ?? true,
      startMonth: item?.startMonth ?? currentMonthKey(),
    }
    dispatch({ type: item ? 'fixed/update' : 'fixed/add', item: next })
    onClose()
  }

  const remove = () => {
    if (!item) return
    if (!window.confirm(`Ta bort ${item.name}? Redan skapade transaktioner behålls i historiken.`))
      return
    dispatch({ type: 'fixed/delete', id: item.id })
    onClose()
  }

  return (
    <Sheet title={item ? 'Ändra fast post' : 'Ny fast post'} onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        <div className="segmented" role="radiogroup" aria-label="Typ">
          <button
            type="button"
            role="radio"
            aria-checked={type === 'expense'}
            className={type === 'expense' ? 'on' : ''}
            onClick={() => setType('expense')}
          >
            Utgift
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={type === 'income'}
            className={type === 'income' ? 'on' : ''}
            onClick={() => setType('income')}
          >
            Inkomst
          </button>
        </div>

        <label className="field">
          <span>Namn</span>
          <input
            type="text"
            placeholder="T.ex. Hyra, Lön, El"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus={!item}
            maxLength={60}
          />
        </label>

        <label className="field">
          <span>Belopp</span>
          <div className="amount-wrap">
            <input
              type="text"
              inputMode="decimal"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              aria-label="Belopp i kronor"
            />
            <span className="amount-unit">kr</span>
          </div>
        </label>

        <div className="field">
          <span>Kategori</span>
          <div className="chips" role="radiogroup" aria-label="Kategori">
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={chosen === c.id}
                className={`chip${chosen === c.id ? ' on' : ''}`}
                onClick={() => setCategoryId(c.id)}
              >
                <span className="dot" style={{ background: `var(--slot-${c.slot})` }} aria-hidden />
                {c.name}
              </button>
            ))}
          </div>
        </div>

        <label className="field">
          <span>Dag i månaden</span>
          <select value={day} onChange={(e) => setDay(Number(e.target.value))}>
            {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <span className="hint">I kortare månader används sista dagen.</span>
        </label>

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="btn primary">
          Spara
        </button>
        {item && (
          <button type="button" className="btn danger-ghost" onClick={remove}>
            Ta bort
          </button>
        )}
      </form>
    </Sheet>
  )
}
