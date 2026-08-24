import { slotColor } from '../data/defaults'
import { formatKr } from '../lib/money'
import type { BudgetPlan } from '../lib/selectors'
import { Meter } from './charts/Meter'

interface Props {
  plan: BudgetPlan
  /** Månadens faktiska utgifter respektive sparande, i öre. */
  spentOre: number
  savedOre: number
}

/** Innehållet i "Månadens ram"-kortet i budgetvyn: de fasta inkomsterna som
 *  ram, en fördelningsstapel som visar hur planen (fasta utgifter, budgetar,
 *  sparande) bokar upp ramen, och månadens utfall mätt mot samma ram.
 *  Renderas bara när det finns fasta inkomster för månaden. */
export function BudgetPlanCard({ plan, spentOre, savedOre }: Props) {
  const over = plan.unallocatedOre < 0
  // Vid överfördelning skalas stapeln efter planen så att alla segment ryms.
  const barTotal = Math.max(plan.incomeOre, plan.plannedOre)
  const segments = [
    { name: 'Fasta utgifter', color: slotColor(2), ore: plan.fixedExpenseOre },
    { name: 'Budgetar', color: slotColor(1), ore: plan.budgetOre },
    { name: 'Sparande', color: slotColor(6), ore: plan.savingOre },
  ].filter((s) => s.ore > 0)

  const usedOre = spentOre + savedOre
  const leftOre = plan.incomeOre - usedOre
  const outcomeParts = [
    `${formatKr(spentOre)} utgifter`,
    ...(savedOre > 0 ? [`${formatKr(savedOre)} sparat`] : []),
    leftOre >= 0 ? `${formatKr(leftOre)} kvar` : `${formatKr(-leftOre)} över inkomsten`,
  ]

  return (
    <>
      <span className="card-title">Månadens ram</span>
      <span className={`hero ${over ? 'neg' : 'pos'}`}>{formatKr(plan.unallocatedOre)}</span>
      <span className="plan-caption">
        {over
          ? `fördelat utöver ${formatKr(plan.incomeOre)} i fasta inkomster`
          : `ofördelat av ${formatKr(plan.incomeOre)} i fasta inkomster`}
      </span>
      <div className="alloc-bar">
        {segments.map((s) => (
          <div
            key={s.name}
            className="alloc-seg"
            style={{ width: `${(s.ore / barTotal) * 100}%`, background: s.color }}
          />
        ))}
      </div>
      <div className="alloc-legend">
        {segments.map((s) => (
          <div key={s.name} className="alloc-legend-row">
            <span className="dot" style={{ background: s.color }} />
            <span className="alloc-name">{s.name}</span>
            <span className="alloc-val">{formatKr(s.ore)}</span>
          </div>
        ))}
        <div className="alloc-legend-row">
          <span
            className="dot"
            style={{ background: over ? 'var(--critical)' : 'var(--slot-0)' }}
          />
          <span className="alloc-name">{over ? 'Över ramen' : 'Ofördelat'}</span>
          <span className={`alloc-val${over ? ' neg' : ''}`}>
            {formatKr(Math.abs(plan.unallocatedOre))}
          </span>
        </div>
      </div>
      {plan.fixedInBudgetsOre > 0 && (
        <span className="hint">
          Fasta utgifter i budgeterade kategorier ({formatKr(plan.fixedInBudgetsOre)}) räknas inom
          sina månadstak.
        </span>
      )}
      <div className="plan-outcome">
        <span className="card-title">Använt av inkomsten</span>
        <Meter ratio={usedOre / plan.incomeOre} slot={1} />
        <span className="sub">{outcomeParts.join(' · ')}</span>
      </div>
    </>
  )
}
