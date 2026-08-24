import { formatKr } from '../../lib/money'
import type { MonthTotals } from '../../lib/selectors'

/** KPI-rad: tre stat-brickor för vald månad. */
export function StatTiles({ totals }: { totals: MonthTotals }) {
  return (
    <div className="stat-row">
      <div className="stat-tile">
        <span className="stat-label">Inkomster</span>
        <span className="stat-value">{formatKr(totals.incomeOre)}</span>
      </div>
      <div className="stat-tile">
        <span className="stat-label">Utgifter</span>
        <span className="stat-value">{formatKr(totals.expenseOre)}</span>
      </div>
      <div className="stat-tile">
        <span className="stat-label">Saldo</span>
        <span className={`stat-value ${totals.netOre >= 0 ? 'pos' : 'neg'}`}>
          {totals.netOre > 0 ? '+' : ''}
          {formatKr(totals.netOre)}
        </span>
      </div>
    </div>
  )
}
