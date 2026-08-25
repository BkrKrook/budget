import { useRef, useState } from 'react'
import { useApp } from '../data/AppState'
import { uid } from '../lib/id'
import { formatKr, formatNetKr } from '../lib/money'
import { mergeStatements, parseStatementFile } from '../lib/statement'
import type { StatementRow } from '../lib/statement'
import type { Category, Transaction, TxType } from '../types'
import { Sheet } from './Sheet'

/** Grov gissning av kategori utifrån transaktionstexten. Pekar på appens
 *  standardkategori-id:n; träffar vars kategori tagits bort faller vidare. */
const KEYWORD_RULES: readonly (readonly [RegExp, string])[] = [
  // Butiksnamn dyker ofta upp utan åäö i kortterminaltexter (HEMKOP, NARLIVS).
  [/\b(ica|coop|willys|hemk[öo]p|lidl|city ?gross|netto|mathem|matsmart|matöppet|n[äa]rlivs|livsmedel)/i, 'cat-mat'],
  [
    /\b(sl\b|sj\b|circle[ _]?k|okq8|preem|ingo|st1|shell|parkering|easypark|aimo|apcoa|västtrafik|skånetrafiken|östgötatrafiken|flixbus|taxi|uber(?! ?eats)|bolt\b)/i,
    'cat-transport',
  ],
  [
    /netflix|spotify|hbo|disney|viaplay|youtube|storytel|telia|tele2|telenor|comviq|hallon|halebop|vimla|bahnhof|bredband|apple\.com|itunes|google (one|play)|amazon prime|patreon/i,
    'cat-abonnemang',
  ],
  [
    /mc ?donald|\bmcd|burger king|max burgers|espresso house|starbucks|waynes|sushi|pizz|restaurang|café|cafe\b|konditori|kebab|foodora|uber ?eats|wolt/i,
    'cat-restaurang',
  ],
  [
    /apotek|tandläk|folktandvård|vårdcentral|läkar|optik|synsam|specsavers|gym|sats\b|nordic ?wellness|friskis|actic/i,
    'cat-halsa',
  ],
  [
    /\bh ?& ?m\b|zalando|lindex|kappahl|åhléns|stadium|intersport|xxl|gina tricot|monki|weekday|boozt|shein|cubus/i,
    'cat-klader',
  ],
  [
    /hyra|hyres|bostad|brf|hsb|riksbyggen|heimstaden|vattenfall|e\.?on\b|ellevio|fortum|tibber|göta energi|hemförsäkring|folksam|trygg.?hansa|länsförsäkringar|\blf\b/i,
    'cat-boende',
  ],
  [/systembolaget|filmstaden|ticketmaster|eventim|konsert|teater|\bbio\b/i, 'cat-noje'],
  [/\blön\b|salary|payroll/i, 'cat-lon'],
  [/försäkringskassan|csn|skatteverket|a-kassa|pensionsmyndigheten/i, 'cat-bidrag'],
]

function guessCategoryId(text: string, type: TxType, categories: Category[]): string {
  // Kortterminaltexter använder ofta understreck som avgränsare
  // ('30/6_22457_Circle_K') – normalisera så att ordgränserna stämmer.
  const t = text.replace(/_/g, ' ')
  const has = (id: string) => categories.some((c) => c.id === id && c.type === type)
  for (const [rx, id] of KEYWORD_RULES) if (rx.test(t) && has(id)) return id
  // Egna kategorinamn som nämns i texten (t.ex. en kategori "Husdjur" och
  // texten "Husdjur AB") träffar också.
  const lower = t.toLowerCase()
  const byName = categories.find(
    (c) => c.type === type && c.name.length >= 3 && lower.includes(c.name.toLowerCase()),
  )
  if (byName) return byName.id
  const fallback = type === 'income' ? 'cat-ovrig-inkomst' : 'cat-ovrigt'
  if (has(fallback)) return fallback
  return categories.find((c) => c.type === type)?.id ?? ''
}

interface Candidate {
  id: number
  row: StatementRow
  include: boolean
  categoryId: string
  /** En transaktion med samma datum och belopp finns redan i appen. */
  exists: boolean
}

const dateFmt = new Intl.DateTimeFormat('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' })

function dateLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return dateFmt.format(new Date(y, m - 1, d)).replace(/\./g, '')
}

export function ImportStatement({ onClose }: { onClose: () => void }) {
  const { data, dispatch } = useApp()
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [skipped, setSkipped] = useState(0)
  const [fileCount, setFileCount] = useState(0)
  const [candidates, setCandidates] = useState<Candidate[] | null>(null)

  const incomeCats = data.categories.filter((c) => c.type === 'income')
  const expenseCats = data.categories.filter((c) => c.type === 'expense')
  const savingCats = data.categories.filter((c) => c.type === 'saving')

  const handleFiles = async (files: FileList) => {
    setBusy(true)
    const errs: string[] = []
    const perFile: StatementRow[][] = []
    let skippedTotal = 0
    for (const file of Array.from(files)) {
      try {
        const parsed = await parseStatementFile(file)
        if (parsed.rows.length === 0) errs.push(`${file.name}: inga transaktioner hittades i filen.`)
        else perFile.push(parsed.rows)
        skippedTotal += parsed.skipped
      } catch (e) {
        errs.push(`${file.name}: ${e instanceof Error ? e.message : 'filen kunde inte läsas'}.`)
      }
    }
    // Rader som verkar finnas i appen redan (samma dag och belopp – t.ex. en
    // materialiserad fast post eller något som lagts in för hand) avmarkeras.
    // Matchningen räknar antal, så två äkta likadana köp inte båda flaggas
    // mot en och samma befintliga post.
    const existing = new Map<string, number>()
    for (const t of data.transactions) {
      const signed = t.type === 'income' ? t.amountOre : -t.amountOre
      const key = `${t.date}|${signed}`
      existing.set(key, (existing.get(key) ?? 0) + 1)
    }
    const merged = mergeStatements(perFile).reverse() // nyast först, som i Historik
    const next = merged.map((row, i): Candidate => {
      const key = `${row.date}|${row.amountOre}`
      const left = existing.get(key) ?? 0
      if (left > 0) existing.set(key, left - 1)
      const type: TxType = row.amountOre > 0 ? 'income' : 'expense'
      return {
        id: i,
        row,
        include: left === 0,
        exists: left > 0,
        categoryId: guessCategoryId(row.text, type, data.categories),
      }
    })
    setErrors(errs)
    setSkipped(skippedTotal)
    setFileCount(perFile.length)
    setCandidates(next.length > 0 ? next : null)
    setBusy(false)
  }

  const update = (id: number, patch: Partial<Candidate>) =>
    setCandidates((prev) => prev?.map((c) => (c.id === id ? { ...c, ...patch } : c)) ?? null)

  const setAll = (include: boolean) =>
    setCandidates((prev) => prev?.map((c) => ({ ...c, include })) ?? null)

  const chosen = candidates?.filter((c) => c.include) ?? []
  const existsCount = candidates?.filter((c) => c.exists).length ?? 0
  let outOre = 0
  let inOre = 0
  for (const c of chosen) {
    if (c.row.amountOre < 0) outOre -= c.row.amountOre
    else inOre += c.row.amountOre
  }

  const catById = new Map(data.categories.map((c) => [c.id, c]))
  const doImport = () => {
    if (chosen.length === 0) return
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

  const options = (cats: Category[]) =>
    cats.map((c) => (
      <option key={c.id} value={c.id}>
        {c.name}
      </option>
    ))

  return (
    <Sheet title="Importera kontoutdrag" onClose={onClose}>
      {!candidates ? (
        <div className="form">
          <p className="hint">
            Exportera kontoutdrag från internetbanken som Excel (.xlsx) eller CSV och välj filerna
            här – gärna flera månader på en gång. Allt granskas innan något sparas, och rader som
            redan verkar finnas i appen hoppas över automatiskt.
          </p>
          {errors.map((e) => (
            <p key={e} className="error" role="alert">
              {e}
            </p>
          ))}
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
            {candidates.length} transaktioner hittades i {fileCount} {fileCount === 1 ? 'fil' : 'filer'}
            {existsCount > 0 && (
              <> – {existsCount} verkar redan finnas i appen och är avmarkerade</>
            )}
            {skipped > 0 && <>. {skipped} rader gick inte att tolka och hoppades över</>}. Bocka ur
            det som inte ska med och justera kategorierna vid behov.
          </p>
          {errors.map((e) => (
            <p key={e} className="error" role="alert">
              {e}
            </p>
          ))}
          <div className="btn-row import-actions">
            <button type="button" className="btn" onClick={() => setAll(true)}>
              Markera alla
            </button>
            <button type="button" className="btn" onClick={() => setAll(false)}>
              Avmarkera alla
            </button>
            <button type="button" className="btn" onClick={() => setCandidates(null)}>
              Andra filer
            </button>
          </div>
          <div className="card list import-list">
            {candidates.map((c) => (
              <div key={c.id} className={`import-row${c.include ? '' : ' off'}`}>
                <input
                  type="checkbox"
                  checked={c.include}
                  onChange={(e) => update(c.id, { include: e.target.checked })}
                  aria-label={`Ta med ${c.row.text || 'transaktion'} ${c.row.date}`}
                />
                <div className="import-main">
                  <div className="import-top">
                    <span className="import-text">{c.row.text || '(utan text)'}</span>
                    <span className={`row-amount ${c.row.amountOre > 0 ? 'pos' : ''}`}>
                      {formatNetKr(c.row.amountOre)}
                    </span>
                  </div>
                  <div className="import-bottom">
                    <span className="import-date">{dateLabel(c.row.date)}</span>
                    {c.exists && <span className="import-tag">Finns redan?</span>}
                    <select
                      className="import-cat"
                      value={c.categoryId}
                      onChange={(e) => update(c.id, { categoryId: e.target.value })}
                      aria-label="Kategori"
                    >
                      {c.row.amountOre > 0 ? (
                        options(incomeCats)
                      ) : (
                        <>
                          <optgroup label="Utgift">{options(expenseCats)}</optgroup>
                          {savingCats.length > 0 && (
                            <optgroup label="Sparande">{options(savingCats)}</optgroup>
                          )}
                        </>
                      )}
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="import-foot">
            <p className="hint center">
              {outOre > 0 && <span className="neg">−{formatKr(outOre)} utgifter</span>}
              {outOre > 0 && inOre > 0 && ' · '}
              {inOre > 0 && <span className="pos">+{formatKr(inOre)} inkomster</span>}
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
