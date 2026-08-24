import { useMemo, useState } from 'react'
import { useApp } from '../data/AppState'
import { currentMonthKey } from '../lib/dates'
import { formatNetKr, formatSignedKr, oreToInput, parseKr } from '../lib/money'
import { categoryById } from '../lib/selectors'
import { uid } from '../lib/id'
import type { FixedItem, TxType } from '../types'
import { AmountField } from '../components/AmountField'
import { CategoryChips, resolveCategory } from '../components/CategoryChips'
import { Dot, PlusIcon } from '../components/Icons'
import { Segmented, TX_TYPE_OPTIONS } from '../components/Segmented'
import { Sheet } from '../components/Sheet'

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
            Lägg in hyra, lön, abonnemang och månadssparande här, så skapas de automatiskt i
            historiken varje månad på rätt dag.
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
                    <Dot slot={cat?.slot ?? 0} big />
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
            <strong className={monthlyNet >= 0 ? 'pos' : 'neg'}>{formatNetKr(monthlyNet)}</strong>
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
  const [amount, setAmount] = useState(item ? oreToInput(item.amountOre) : '')
  const [categoryId, setCategoryId] = useState(item?.categoryId ?? '')
  const [day, setDay] = useState(item?.dayOfMonth ?? 25)
  const [error, setError] = useState('')

  const categories = data.categories.filter((c) => c.type === type)
  const chosen = resolveCategory(categories, categoryId)

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
        <Segmented value={type} onChange={setType} options={TX_TYPE_OPTIONS} label="Typ" />

        <label className="field">
          <span>Namn</span>
          <input
            type="text"
            placeholder="T.ex. Hyra, Lön, Månadssparande"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus={!item}
            maxLength={60}
          />
        </label>

        <AmountField label="Belopp" value={amount} onChange={setAmount} />

        <CategoryChips categories={categories} value={chosen} onChange={setCategoryId} />

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
