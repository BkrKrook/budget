import { useRef, useState } from 'react'
import { useApp } from '../data/AppState'
import { SLOT_NAMES } from '../data/defaults'
import { exportJson, sanitize } from '../data/storage'
import { todayISO } from '../lib/dates'
import { uid } from '../lib/id'
import type { Category, Theme, TxType } from '../types'
import { Sheet } from '../components/Sheet'

export function More() {
  const { data, dispatch } = useApp()
  const [catSheet, setCatSheet] = useState<Category | TxType | null>(null) // Category = redigera, TxType = ny
  const fileRef = useRef<HTMLInputElement>(null)

  const doExport = () => {
    const blob = new Blob([exportJson(data)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `min-budget-${todayISO()}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const doImport = async (file: File) => {
    try {
      const parsed = sanitize(JSON.parse(await file.text()))
      if (!parsed) {
        window.alert('Filen kunde inte läsas – är det en export från Min budget?')
        return
      }
      if (
        window.confirm(
          `Importen innehåller ${parsed.transactions.length} transaktioner och ersätter ALL nuvarande data på den här enheten. Fortsätt?`,
        )
      ) {
        dispatch({ type: 'data/import', data: parsed })
        window.alert('Importen är klar.')
      }
    } catch {
      window.alert('Filen kunde inte läsas – är det en export från Min budget?')
    }
  }

  const doReset = () => {
    if (!window.confirm('Rensa ALL data i appen på den här enheten?')) return
    if (!window.confirm('Säker? Det går inte att ångra. Exportera gärna först.')) return
    dispatch({ type: 'data/reset' })
  }

  const themes: [Theme, string][] = [
    ['auto', 'Auto'],
    ['light', 'Ljust'],
    ['dark', 'Mörkt'],
  ]

  return (
    <div className="view">
      <header className="topbar">
        <h1>Mer</h1>
      </header>

      <h2 className="section-head">Utseende</h2>
      <div className="card pad">
        <div className="segmented" role="radiogroup" aria-label="Tema">
          {themes.map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={data.settings.theme === id}
              className={data.settings.theme === id ? 'on' : ''}
              onClick={() => dispatch({ type: 'theme/set', theme: id })}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <h2 className="section-head">Kategorier</h2>
      {(['expense', 'income'] as TxType[]).map((type) => (
        <div key={type}>
          <h3 className="sub-head">{type === 'expense' ? 'Utgifter' : 'Inkomster'}</h3>
          <div className="card list">
            {data.categories
              .filter((c) => c.type === type)
              .map((c) => (
                <button key={c.id} type="button" className="row" onClick={() => setCatSheet(c)}>
                  <span className="dot big" style={{ background: `var(--slot-${c.slot})` }} aria-hidden />
                  <span className="row-main">
                    <span className="row-title">{c.name}</span>
                  </span>
                  <span className="row-action">Ändra</span>
                </button>
              ))}
            <button type="button" className="row add-row" onClick={() => setCatSheet(type)}>
              + Ny kategori
            </button>
          </div>
        </div>
      ))}

      <h2 className="section-head">Data</h2>
      <div className="card pad btn-col">
        <button type="button" className="btn" onClick={doExport}>
          Exportera säkerhetskopia (JSON)
        </button>
        <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
          Importera säkerhetskopia
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void doImport(f)
            e.target.value = ''
          }}
        />
        <button type="button" className="btn danger-ghost" onClick={doReset}>
          Rensa all data
        </button>
      </div>

      <h2 className="section-head">Om appen</h2>
      <div className="card pad about">
        <p>
          <strong>Min budget</strong> sparar all data lokalt i den här webbläsaren – ingenting
          skickas till någon server och inget konto behövs.
        </p>
        <p>
          Det betyder också att datan bara finns på den här enheten. Exportera regelbundet som
          säkerhetskopia, och importera filen på en annan enhet för att flytta datan dit.
        </p>
        <p>
          Tips: öppna appen i mobilens webbläsare och välj <em>Lägg till på hemskärmen</em> så
          beter den sig som en vanlig app.
        </p>
      </div>

      {catSheet && (
        <CategoryForm
          category={typeof catSheet === 'object' ? catSheet : null}
          newType={typeof catSheet === 'string' ? catSheet : 'expense'}
          onClose={() => setCatSheet(null)}
        />
      )}
    </div>
  )
}

function CategoryForm({
  category,
  newType,
  onClose,
}: {
  category: Category | null
  newType: TxType
  onClose: () => void
}) {
  const { data, dispatch } = useApp()
  const [name, setName] = useState(category?.name ?? '')
  const [slot, setSlot] = useState(category?.slot ?? 1)
  const [error, setError] = useState('')
  const type = category?.type ?? newType

  const used = category
    ? data.transactions.some((t) => t.categoryId === category.id) ||
      data.fixed.some((f) => f.categoryId === category.id)
    : false

  const save = () => {
    const trimmed = name.trim()
    if (!trimmed) return setError('Ange ett namn.')
    const dupe = data.categories.some(
      (c) => c.id !== category?.id && c.type === type && c.name.toLowerCase() === trimmed.toLowerCase(),
    )
    if (dupe) return setError('Det finns redan en kategori med det namnet.')
    const next: Category = { id: category?.id ?? uid(), name: trimmed, type, slot }
    dispatch({ type: category ? 'cat/update' : 'cat/add', category: next })
    onClose()
  }

  const remove = () => {
    if (!category) return
    if (!window.confirm(`Ta bort kategorin ${category.name}?`)) return
    dispatch({ type: 'cat/delete', id: category.id })
    onClose()
  }

  return (
    <Sheet title={category ? 'Ändra kategori' : 'Ny kategori'} onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        <label className="field">
          <span>Namn</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus={!category}
            maxLength={40}
          />
        </label>

        <div className="field">
          <span>Färg</span>
          <div className="swatches" role="radiogroup" aria-label="Färg">
            {SLOT_NAMES.map((label, i) => (
              <button
                key={i}
                type="button"
                role="radio"
                aria-checked={slot === i}
                aria-label={label}
                className={`swatch${slot === i ? ' on' : ''}`}
                style={{ background: `var(--slot-${i})` }}
                onClick={() => setSlot(i)}
              />
            ))}
          </div>
        </div>

        <p className="hint">Typ: {type === 'expense' ? 'utgiftskategori' : 'inkomstkategori'}</p>

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="btn primary">
          Spara
        </button>
        {category &&
          (used ? (
            <p className="hint center">
              Kategorin används av transaktioner eller fasta poster och kan inte tas bort.
            </p>
          ) : (
            <button type="button" className="btn danger-ghost" onClick={remove}>
              Ta bort
            </button>
          ))}
      </form>
    </Sheet>
  )
}
