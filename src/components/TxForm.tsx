import { useState } from 'react'
import { useApp } from '../data/AppState'
import { isISODate } from '../lib/dates'
import { formatKr, oreToInput, parseKr } from '../lib/money'
import { uid } from '../lib/id'
import type { Transaction, TxType } from '../types'
import { AmountField } from './AmountField'
import { CategoryChips, resolveCategory } from './CategoryChips'
import { Segmented, TX_TYPE_OPTIONS } from './Segmented'
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
  const [amount, setAmount] = useState(initial ? oreToInput(initial.amountOre) : '')
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? '')
  const [date, setDate] = useState(initial?.date ?? defaultDate)
  const [note, setNote] = useState(initial?.note ?? '')
  const [error, setError] = useState('')

  const categories = data.categories.filter((c) => c.type === type)
  const chosen = resolveCategory(categories, categoryId)

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
    if (!isISODate(date)) {
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
        <Segmented value={type} onChange={switchType} options={TX_TYPE_OPTIONS} label="Typ" />

        <AmountField label="Belopp" value={amount} onChange={setAmount} autoFocus={!initial} />

        <CategoryChips categories={categories} value={chosen} onChange={setCategoryId} />

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
