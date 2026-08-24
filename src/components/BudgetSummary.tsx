import { formatKr } from '../lib/money'
import { Meter } from './charts/Meter'

interface Props {
  capOre: number
  spentOre: number
}

/** Innehållet i "Kvar att spendera"-kortet – används av Översikt, och av
 *  Budget som reserv när fasta inkomster saknas (annars BudgetPlanCard).
 *  Wrappern (.card.budget-card) står anroparen för. Renderas bara när
 *  capOre > 0 (budgetar lagrar enbart positiva tak). */
export function BudgetSummary({ capOre, spentOre }: Props) {
  const leftOre = capOre - spentOre
  return (
    <>
      <span className="card-title">Kvar att spendera</span>
      <span className={`hero ${leftOre >= 0 ? 'pos' : 'neg'}`}>{formatKr(leftOre)}</span>
      <Meter ratio={spentOre / capOre} slot={1} />
      <span className="sub">
        {formatKr(spentOre)} använt av {formatKr(capOre)} budgeterat
      </span>
    </>
  )
}
