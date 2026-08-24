import { formatKr, formatNetKr } from '../../lib/money'
import type { MonthTotals } from '../../lib/selectors'

/** KPI-rad: stat-brickor för vald månad. Sparat-brickan visas bara när något
 *  sparats – då byter raden till 2×2-layout (.four). */
export function StatTiles({ totals }: { totals: MonthTotals }) {
  const hasSaving = totals.savingOre > 0
  return (
    <div className={`stat-row${hasSaving ? ' four' : ''}`}>
      <div className="stat-tile">
        <span className="stat-label">Inkomster</span>
        <span className="stat-value">{formatKr(totals.incomeOre)}</span>
      </div>
      <div className="stat-tile">
        <span className="stat-label">Utgifter</span>
        <span className="stat-value">{formatKr(totals.expenseOre)}</span>
      </div>
      {hasSaving && (
        <div className="stat-tile">
          <span className="stat-label">Sparat</span>
          <span className="stat-value">{formatKr(totals.savingOre)}</span>
        </div>
      )}
      <div className="stat-tile">
        <span className="stat-label">Saldo</span>
        <span className={`stat-value ${totals.netOre >= 0 ? 'pos' : 'neg'}`}>
          {formatNetKr(totals.netOre)}
        </span>
      </div>
    </div>
  )
}
