import { useApp } from '../data/AppState'
import { formatKr } from '../lib/money'
import {
  expenseByCategory,
  hasAnyData,
  monthTotals,
  totalBudget,
  trend,
} from '../lib/selectors'
import type { Tab } from '../components/BottomNav'
import { MonthSwitcher } from '../components/MonthSwitcher'
import { CategoryBars } from '../components/charts/CategoryBars'
import { StatTiles } from '../components/charts/StatTiles'
import { TrendChart } from '../components/charts/TrendChart'
import { Meter } from '../components/charts/Meter'

interface Props {
  month: string
  onMonth: (m: string) => void
  onAddTx: () => void
  goTo: (tab: Tab) => void
}

export function Overview({ month, onMonth, onAddTx, goTo }: Props) {
  const { data } = useApp()
  const totals = monthTotals(data, month)
  const catRows = expenseByCategory(data, month)
  const budget = totalBudget(data, month)
  const trendPoints = trend(data, month, 6)
  const empty = !hasAnyData(data)
  const leftOre = budget.capOre - budget.spentOre

  return (
    <div className="view">
      <header className="topbar">
        <h1>Översikt</h1>
      </header>
      <MonthSwitcher month={month} onChange={onMonth} />

      {empty && (
        <section className="card welcome">
          <h2>Välkommen!</h2>
          <p>
            Här får du koll på din ekonomi. All data sparas lokalt på den här enheten – ingenting
            skickas till någon server.
          </p>
          <ol>
            <li>
              Lägg in dina <strong>fasta poster</strong> (hyra, lön, abonnemang) så fylls varje
              månad i automatiskt.
            </li>
            <li>
              Registrera övriga köp med <strong>+</strong>-knappen.
            </li>
            <li>
              Sätt en <strong>budget</strong> per kategori och följ hur mycket som är kvar.
            </li>
          </ol>
          <div className="btn-row">
            <button type="button" className="btn primary" onClick={() => goTo('fixed')}>
              Lägg in fasta poster
            </button>
            <button type="button" className="btn" onClick={onAddTx}>
              Ny transaktion
            </button>
          </div>
        </section>
      )}

      {!empty && <StatTiles totals={totals} />}

      {budget.capOre > 0 && (
        <button type="button" className="card tappable budget-summary" onClick={() => goTo('budget')}>
          <span className="card-title">Kvar att spendera</span>
          <span className={`hero ${leftOre >= 0 ? 'pos' : 'neg'}`}>
            {leftOre < 0 ? '−' : ''}
            {formatKr(Math.abs(leftOre))}
          </span>
          <Meter ratio={budget.capOre > 0 ? budget.spentOre / budget.capOre : 0} slot={1} />
          <span className="sub">
            {formatKr(budget.spentOre)} använt av {formatKr(budget.capOre)} budgeterat
          </span>
        </button>
      )}

      {catRows.length > 0 && (
        <section className="card">
          <h2 className="card-title">Utgifter per kategori</h2>
          <CategoryBars rows={catRows} />
        </section>
      )}

      {!empty && (
        <section className="card">
          <h2 className="card-title">Utveckling</h2>
          <TrendChart points={trendPoints} />
        </section>
      )}
    </div>
  )
}
