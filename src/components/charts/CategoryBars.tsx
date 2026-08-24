import { formatKr } from '../../lib/money'
import type { CategorySum } from '../../lib/selectors'

interface Props {
  rows: CategorySum[]
  /** Fler kategorier än så viks ihop till en grå "Övriga kategorier"-rad. */
  maxVisible?: number
}

/** Horisontell stapellista: varje rad bär sin egen etikett och sitt värde,
 *  så färgen är aldrig den enda identitetsbäraren. */
export function CategoryBars({ rows, maxVisible = 6 }: Props) {
  if (rows.length === 0) return null
  const shown = rows.length > maxVisible ? rows.slice(0, maxVisible - 1) : rows
  const folded = rows.slice(shown.length)
  const foldedSum = folded.reduce((s, r) => s + r.amountOre, 0)
  const max = Math.max(...rows.map((r) => r.amountOre), foldedSum)

  const bar = (key: string, name: string, slot: number, amountOre: number) => (
    <div className="catbar-row" key={key}>
      <div className="catbar-top">
        <span className="dot" style={{ background: `var(--slot-${slot})` }} aria-hidden />
        <span className="catbar-name">{name}</span>
        <span className="catbar-val">{formatKr(amountOre)}</span>
      </div>
      <div className="catbar-track">
        <div
          className="catbar-bar"
          style={{
            width: `${Math.max(1.5, (amountOre / max) * 100)}%`,
            background: `var(--slot-${slot})`,
          }}
        />
      </div>
    </div>
  )

  return (
    <div className="catbars">
      {shown.map((r) => bar(r.category.id, r.category.name, r.category.slot, r.amountOre))}
      {folded.length > 0 && bar('__folded', `Övriga kategorier (${folded.length})`, 0, foldedSum)}
    </div>
  )
}
