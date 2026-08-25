import { memo, useCallback, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useApp } from '../data/AppState'
import { longDayLabel } from '../lib/dates'
import { guessCategoryId } from '../lib/guessCategory'
import { uid } from '../lib/id'
import { formatNetKr, formatSignedKr } from '../lib/money'
import { matchExisting, mergeStatements, parseStatementFile } from '../lib/statement'
import type { StatementRow } from '../lib/statement'
import type { Category, Transaction, TxType } from '../types'
import { Sheet } from './Sheet'

interface Candidate {
  row: StatementRow
  include: boolean
  categoryId: string
  /** En transaktion med samma datum och belopp finns redan i appen. */
  exists: boolean
}

/** Resultatet av en filinläsning – hålls ihop som ett värde så att "Andra
 *  filer" nollställer allt på en gång. */
interface ParseResult {
  errors: string[]
  skipped: number
  fileCount: number
  candidates: Candidate[]
}

interface RowProps {
  index: number
  candidate: Candidate
  incomeOptions: ReactNode
  expenseOptions: ReactNode
  onChange: (index: number, patch: Partial<Candidate>) => void
}

/** En kandidatrad. Memoiserad så att en kryssning eller ett kategori­byte bara
 *  renderar om den ändrade raden – listan kan rymma hundratals rader. */
const ImportRow = memo(function ImportRow({ index, candidate: c, incomeOptions, expenseOptions, onChange }: RowProps) {
  return (
    <div className={`row import-row${c.include ? '' : ' off'}`}>
      <input
        type="checkbox"
        checked={c.include}
        onChange={(e) => onChange(index, { include: e.target.checked })}
        aria-label={`Ta med ${c.row.text || 'transaktion'} ${c.row.date}`}
      />
      <div className="row-main">
        <div className="import-top">
          <span className="row-title">{c.row.text || '(utan text)'}</span>
          <span className={`row-amount ${c.row.amountOre > 0 ? 'pos' : ''}`}>
            {formatNetKr(c.row.amountOre)}
          </span>
        </div>
        <div className="import-bottom">
          <span className="import-date">{longDayLabel(c.row.date)}</span>
          {c.exists && <span className="import-tag">Finns redan?</span>}
          <select
            className="import-cat"
            value={c.categoryId}
            onChange={(e) => onChange(index, { categoryId: e.target.value })}
            aria-label="Kategori"
          >
            {c.row.amountOre > 0 ? incomeOptions : expenseOptions}
          </select>
        </div>
      </div>
    </div>
  )
})

const options = (cats: Category[]) =>
  cats.map((c) => (
    <option key={c.id} value={c.id}>
      {c.name}
    </option>
  ))

export function ImportStatement({ onClose }: { onClose: () => void }) {
  const { data, dispatch } = useApp()
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [parse, setParse] = useState<ParseResult | null>(null)

  // Options-elementen delas av alla rader – React-element är oföränderliga.
  const incomeOptions = useMemo(
    () => options(data.categories.filter((c) => c.type === 'income')),
    [data.categories],
  )
  const expenseOptions = useMemo(() => {
    const savingCats = data.categories.filter((c) => c.type === 'saving')
    return (
      <>
        <optgroup label="Utgift">{options(data.categories.filter((c) => c.type === 'expense'))}</optgroup>
        {savingCats.length > 0 && <optgroup label="Sparande">{options(savingCats)}</optgroup>}
      </>
    )
  }, [data.categories])

  const handleFiles = async (files: FileList) => {
    setBusy(true)
    // Filerna är oberoende av varandra – läs dem parallellt.
    const results = await Promise.all(
      Array.from(files).map(async (file) => {
        try {
          const parsed = await parseStatementFile(file)
          if (parsed.rows.length === 0)
            return { rows: null, skipped: parsed.skipped, error: `${file.name}: inga transaktioner hittades i filen.` }
          return { rows: parsed.rows, skipped: parsed.skipped, error: null }
        } catch (e) {
          return { rows: null, skipped: 0, error: `${file.name}: ${e instanceof Error ? e.message : 'filen kunde inte läsas'}.` }
        }
      }),
    )
    const perFile = results.flatMap((r) => (r.rows ? [r.rows] : []))
    const merged = mergeStatements(perFile).reverse() // nyast först, som i Historik
    // Rader som verkar finnas i appen redan avmarkeras.
    const exists = matchExisting(merged, data.transactions)
    setParse({
      errors: results.flatMap((r) => (r.error ? [r.error] : [])),
      skipped: results.reduce((sum, r) => sum + r.skipped, 0),
      fileCount: perFile.length,
      candidates: merged.map((row, i): Candidate => {
        const type: TxType = row.amountOre > 0 ? 'income' : 'expense'
        return {
          row,
          include: !exists[i],
          exists: exists[i],
          categoryId: guessCategoryId(row.text, type, data.categories),
        }
      }),
    })
    setBusy(false)
  }

  const updateRow = useCallback(
    (index: number, patch: Partial<Candidate>) =>
      setParse(
        (prev) =>
          prev && { ...prev, candidates: prev.candidates.map((c, i) => (i === index ? { ...c, ...patch } : c)) },
      ),
    [],
  )

  const setAll = (include: boolean) =>
    setParse((prev) => prev && { ...prev, candidates: prev.candidates.map((c) => ({ ...c, include })) })

  const candidates = parse?.candidates ?? []
  const chosen = candidates.filter((c) => c.include)
  const existsCount = candidates.filter((c) => c.exists).length
  let outOre = 0
  let inOre = 0
  for (const c of chosen) {
    if (c.row.amountOre < 0) outOre -= c.row.amountOre
    else inOre += c.row.amountOre
  }

  const doImport = () => {
    if (chosen.length === 0) return
    const catById = new Map(data.categories.map((c) => [c.id, c]))
    const txs: Transaction[] = chosen.map((c) => {
      const type: TxType =
        c.row.amountOre > 0 ? 'income' : catById.get(c.categoryId)?.type === 'saving' ? 'saving' : 'expense'
      return {
        id: uid(),
        type,
        amountOre: Math.abs(c.row.amountOre),
        categoryId: c.categoryId,
        date: c.row.date,
        note: c.row.text.slice(0, 120) || undefined,
      }
    })
    dispatch({ type: 'tx/addMany', txs })
    window.alert(`${txs.length} transaktioner importerade.`)
    onClose()
  }

  const errorList = parse?.errors.map((e) => (
    <p key={e} className="error" role="alert">
      {e}
    </p>
  ))

  return (
    <Sheet title="Importera kontoutdrag" onClose={onClose}>
      {candidates.length === 0 ? (
        <div className="form">
          <p className="hint">
            Exportera kontoutdrag från internetbanken som Excel eller CSV och välj filerna här –
            gärna flera månader på en gång. Allt granskas innan något sparas, och rader som redan
            verkar finnas i appen hoppas över automatiskt.
          </p>
          {errorList}
          <button
            type="button"
            className="btn primary"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            {busy ? 'Läser filer …' : 'Välj filer'}
          </button>
          <input
            ref={fileRef}
            type="file"
            multiple
            hidden
            accept=".xlsx,.xls,.csv,.tsv,.txt,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(e) => {
              if (e.target.files?.length) void handleFiles(e.target.files)
              e.target.value = ''
            }}
          />
        </div>
      ) : (
        <div className="import-preview">
          <p className="hint">
            {candidates.length} transaktioner hittades i {parse!.fileCount}{' '}
            {parse!.fileCount === 1 ? 'fil' : 'filer'}
            {existsCount > 0 && <> – {existsCount} verkar redan finnas i appen och är avmarkerade</>}
            {parse!.skipped > 0 && <>. {parse!.skipped} rader gick inte att tolka och hoppades över</>}. Bocka
            ur det som inte ska med och justera kategorierna vid behov.
          </p>
          {errorList}
          <div className="btn-row import-actions">
            <button type="button" className="btn" onClick={() => setAll(true)}>
              Markera alla
            </button>
            <button type="button" className="btn" onClick={() => setAll(false)}>
              Avmarkera alla
            </button>
            <button type="button" className="btn" onClick={() => setParse(null)}>
              Andra filer
            </button>
          </div>
          <div className="card list">
            {candidates.map((c, i) => (
              <ImportRow
                key={i}
                index={i}
                candidate={c}
                incomeOptions={incomeOptions}
                expenseOptions={expenseOptions}
                onChange={updateRow}
              />
            ))}
          </div>
          <div className="import-foot">
            <p className="hint center">
              {outOre > 0 && <span className="neg">{formatSignedKr(outOre, 'expense')} utgifter</span>}
              {outOre > 0 && inOre > 0 && ' · '}
              {inOre > 0 && <span className="pos">{formatSignedKr(inOre, 'income')} inkomster</span>}
              {outOre === 0 && inOre === 0 && 'Inget markerat'}
            </p>
            <button
              type="button"
              className="btn primary"
              disabled={chosen.length === 0}
              onClick={doImport}
            >
              Importera {chosen.length} transaktioner
            </button>
          </div>
        </div>
      )}
    </Sheet>
  )
}
