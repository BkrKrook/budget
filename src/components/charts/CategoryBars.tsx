import { slotColor } from '../../data/defaults'
import { formatKr } from '../../lib/money'
import type { CategorySum } from '../../lib/selectors'
import { Dot } from '../Icons'

/** Fler kategorier än så viks ihop till en grå "Övriga kategorier"-rad. */
const MAX_VISIBLE = 6

/** Horisontell stapellista: varje rad bär sin egen etikett och sitt värde,
 *  så färgen är aldrig den enda identitetsbäraren. */
export function CategoryBars({ rows }: { rows: CategorySum[] }) {
  if (rows.length === 0) return null
  const shown = rows.length > MAX_VISIBLE ? rows.slice(0, MAX_VISIBLE - 1) : rows
  const folded = rows.slice(shown.length)
  const foldedSum = folded.reduce((s, r) => s + r.amountOre, 0)
  const max = Math.max(...rows.map((r) => r.amountOre), foldedSum)

  const bar = (key: string, name: string, slot: number, amountOre: number) => (
    <div key={key}>
      <div className="catbar-top">
        <Dot slot={slot} />
        <span className="catbar-name">{name}</span>
        <span className="catbar-val">{formatKr(amountOre)}</span>
      </div>
      <div className="catbar-track">
        <div
          className="catbar-bar"
          style={{
            width: `${Math.max(1.5, (amountOre / max) * 100)}%`,
            background: slotColor(slot),
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
