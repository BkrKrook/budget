import { useState } from 'react'
import { slotColor } from '../../data/defaults'
import { monthLabel, shortMonthLabel } from '../../lib/dates'
import { formatKr, formatNetKr } from '../../lib/money'
import type { TrendPoint } from '../../lib/selectors'
import { Dot } from '../Icons'

/** Seriernas fasta palettplatser i diagrammet. */
const INCOME_SLOT = 1
const EXPENSE_SLOT = 2
const SAVING_SLOT = 6

/** Avrundar uppåt till ett "snyggt" axelvärde, med halverbara steg så att
 *  även mittengridlinjen blir ett rent tal. */
function niceCeil(v: number): number {
  if (v <= 0) return 100
  const exp = Math.floor(Math.log10(v))
  const base = Math.pow(10, exp)
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) {
    if (m * base >= v) return m * base
  }
  return 10 * base
}

const axisFmt = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 0 })

/** Parade månadskolumner: inkomster (plats 1) och utgifter (plats 2).
 *  Tryck på en månad visar exakta värden; tabellvyn är tvillingen i text. */
export function TrendChart({ points }: { points: TrendPoint[] }) {
  const [selected, setSelected] = useState<string | null>(null)
  const [showTable, setShowTable] = useState(false)

  // Sparserien visas bara när något sparats i fönstret – annars skräpar en
  // evigt tom tredje stapel ner diagrammet för den som inte sparar.
  const hasSaving = points.some((p) => p.savingOre > 0)
  const maxOre = Math.max(
    ...points.map((p) => Math.max(p.incomeOre, p.expenseOre, p.savingOre)),
    1,
  )
  // Golva axeln på 100 kr så att månader helt utan data inte ger en 0/0/0-axel.
  const topKr = niceCeil(Math.max(maxOre / 100, 100))
  const sel = points.find((p) => p.monthKey === selected) ?? null

  return (
    <div className="trend">
      <div className="trend-head">
        <div className="legend">
          <span className="legend-item">
            <Dot slot={INCOME_SLOT} /> Inkomster
          </span>
          <span className="legend-item">
            <Dot slot={EXPENSE_SLOT} /> Utgifter
          </span>
          {hasSaving && (
            <span className="legend-item">
              <Dot slot={SAVING_SLOT} /> Sparat
            </span>
          )}
        </div>
        <button type="button" className="text-btn" onClick={() => setShowTable(!showTable)}>
          {showTable ? 'Diagram' : 'Tabell'}
        </button>
      </div>

      {showTable ? (
        <table className="trend-table">
          <thead>
            <tr>
              <th scope="col">Månad</th>
              <th scope="col">Inkomster</th>
              <th scope="col">Utgifter</th>
              {hasSaving && <th scope="col">Sparat</th>}
              <th scope="col">Netto</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.monthKey}>
                <th scope="row">{shortMonthLabel(p.monthKey)}</th>
                <td>{formatKr(p.incomeOre)}</td>
                <td>{formatKr(p.expenseOre)}</td>
                {hasSaving && <td>{formatKr(p.savingOre)}</td>}
                <td className={p.netOre >= 0 ? 'pos' : 'neg'}>{formatNetKr(p.netOre)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <>
          <p className="trend-readout" aria-live="polite">
            {sel
              ? `${monthLabel(sel.monthKey)}: +${formatKr(sel.incomeOre)} · −${formatKr(sel.expenseOre)}${
                  hasSaving ? ` · ${formatKr(sel.savingOre)} sparat` : ''
                }`
              : 'Tryck på en månad för exakta värden'}
          </p>
          <div className="trend-plot">
            <div className="gridline" style={{ bottom: '100%' }}>
              <span>{axisFmt.format(topKr)}</span>
            </div>
            <div className="gridline" style={{ bottom: '50%' }}>
              <span>{axisFmt.format(topKr / 2)}</span>
            </div>
            <div className="gridline" style={{ bottom: 0 }}>
              <span>0</span>
            </div>
            <div className="trend-cols">
              {points.map((p) => {
                const h = (ore: number) =>
                  ore > 0 ? `${Math.max(1.5, (ore / 100 / topKr) * 100)}%` : '0'
                return (
                  <button
                    key={p.monthKey}
                    type="button"
                    className={`trend-col${selected === p.monthKey ? ' sel' : ''}`}
                    onClick={() => setSelected(selected === p.monthKey ? null : p.monthKey)}
                    aria-label={`${monthLabel(p.monthKey)}: inkomster ${formatKr(p.incomeOre)}, utgifter ${formatKr(p.expenseOre)}${
                      hasSaving ? `, sparat ${formatKr(p.savingOre)}` : ''
                    }`}
                    aria-pressed={selected === p.monthKey}
                  >
                    <span className="trend-bars">
                      <span
                        className="trend-bar"
                        style={{ height: h(p.incomeOre), background: slotColor(INCOME_SLOT) }}
                      />
                      <span
                        className="trend-bar"
                        style={{ height: h(p.expenseOre), background: slotColor(EXPENSE_SLOT) }}
                      />
                      {hasSaving && (
                        <span
                          className="trend-bar"
                          style={{ height: h(p.savingOre), background: slotColor(SAVING_SLOT) }}
                        />
                      )}
                    </span>
                    <span className="trend-x">{shortMonthLabel(p.monthKey)}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
