import type { TxType } from '../types'

interface Props<T extends string> {
  value: T
  onChange: (value: T) => void
  options: readonly (readonly [T, string])[]
  label: string
  small?: boolean
}

/** Segmenterad radiogrupp – bär a11y-kontraktet (role/aria-checked) på ett ställe. */
export function Segmented<T extends string>({ value, onChange, options, label, small }: Props<T>) {
  return (
    <div className={`segmented${small ? ' small' : ''}`} role="radiogroup" aria-label={label}>
      {options.map(([id, text]) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={value === id}
          className={value === id ? 'on' : ''}
          onClick={() => onChange(id)}
        >
          {text}
        </button>
      ))}
    </div>
  )
}

export const TX_TYPE_OPTIONS: readonly (readonly [TxType, string])[] = [
  ['expense', 'Utgift'],
  ['income', 'Inkomst'],
  ['saving', 'Sparande'],
]
