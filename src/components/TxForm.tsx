import { useMemo, useState } from 'react'
import { useApp } from '../data/AppState'
import { formatKr, parseKr } from '../lib/money'
import { uid } from '../lib/id'
import type { Transaction, TxType } from '../types'
import { Sheet } from './Sheet'

interface Props {
  /** Befintlig transaktion vid redigering, annars ny. */
  initial?: Transaction
  defaultDate: string
  onClose: () => void
}

export function TxForm({ initial, defaultDate, onClose }: Props) {
  const { data, dispatch } = useApp()
  const [type, setType] = useState<TxType>(initial?.type ?? 'expense')
  const [amount, setAmount] = useState(initial ? String(initial.amountOre / 100).replace('.', ',') : '')
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? '')
  const [date, setDate] = useState(initial?.date ?? defaultDate)
  const [note, setNote] = useState(initial?.note ?? '')
  const [error, setError] = useState('')

  const categories = useMemo(() => data.categories.filter((c) => c.type === type), [data, type])
  const chosen = categories.some((c) => c.id === categoryId) ? categoryId : (categories[0]?.id ?? '')

  const switchType = (t: TxType) => {
    setType(t)
    setError('')
  }

  const save = () => {
    const amountOre = parseKr(amount)
    if (!amountOre || amountOre <= 0) {
      setError('Ange ett belopp större än noll.')
      return
    }
    if (!chosen) {
      setError('Välj en kategori.')
      return
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError('Ange ett giltigt datum.')
      return
    }
    const tx: Transaction = {
      id: initial?.id ?? uid(),
      type,
      amountOre,
      categoryId: chosen,
      date,
      note: note.trim() || undefined,
      fixedId: initial?.fixedId,
    }
    dispatch({ type: initial ? 'tx/update' : 'tx/add', tx })
    onClose()
  }

  const remove = () => {
    if (!initial) return
    if (!window.confirm(`Ta bort ${formatKr(initial.amountOre)}?`)) return
    dispatch({ type: 'tx/delete', id: initial.id })
    onClose()
  }

  return (
    <Sheet title={initial ? 'Ändra transaktion' : 'Ny transaktion'} onClose={onClose}>
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
            onClick={() => switchType('expense')}
          >
            Utgift
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={type === 'income'}
            className={type === 'income' ? 'on' : ''}
            onClick={() => switchType('income')}
          >
            Inkomst
          </button>
        </div>

        <label className="field">
          <span>Belopp</span>
          <div className="amount-wrap">
            <input
              type="text"
              inputMode="decimal"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus={!initial}
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
          <span>Datum</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>

        <label className="field">
          <span>Anteckning</span>
          <input
            type="text"
            placeholder="Valfritt"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={120}
          />
        </label>

        {initial?.fixedId && (
          <p className="hint">
            Skapad från en fast post. Ändringar här gäller bara den här månaden.
          </p>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="btn primary">
          Spara
        </button>
        {initial && (
          <button type="button" className="btn danger-ghost" onClick={remove}>
            Ta bort
          </button>
        )}
      </form>
    </Sheet>
  )
}
