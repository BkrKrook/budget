interface Props {
  label: string
  value: string
  onChange: (value: string) => void
  autoFocus?: boolean
}

/** Beloppsfält i kronor med kr-suffix; tolkas med parseKr vid spara. */
export function AmountField({ label, value, onChange, autoFocus }: Props) {
  return (
    <label className="field">
      <span>{label}</span>
      <div className="amount-wrap">
        <input
          type="text"
          inputMode="decimal"
          placeholder="0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoFocus={autoFocus}
          aria-label={`${label} i kronor`}
        />
        <span className="amount-unit">kr</span>
      </div>
    </label>
  )
}
