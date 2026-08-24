interface MeterProps {
  /** 0–1 fyller mätaren; > 1 markerar överdrag och byter till kritisk färg. */
  ratio: number
  slot: number
}

/** Budgetmätare: spåret är en ljus ton av samma nyans som fyllnaden,
 *  så att hela stapeln läses som en helhet. Vid överdrag blir fyllnaden kritisk. */
export function Meter({ ratio, slot }: MeterProps) {
  const over = ratio > 1
  const width = `${Math.min(1, Math.max(0, ratio)) * 100}%`
  const color = over ? 'var(--critical)' : `var(--slot-${slot})`
  return (
    <div
      className="meter"
      style={{ background: `color-mix(in srgb, ${color} 16%, transparent)` }}
    >
      <div className="meter-fill" style={{ width, background: color }} />
    </div>
  )
}
