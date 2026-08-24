import { addMonths, monthLabel } from '../lib/dates'
import { ChevronLeftIcon, ChevronRightIcon } from './Icons'

interface Props {
  month: string
  onChange: (month: string) => void
}

export function MonthSwitcher({ month, onChange }: Props) {
  return (
    <div className="month-switcher">
      <button
        type="button"
        className="icon-btn"
        onClick={() => onChange(addMonths(month, -1))}
        aria-label="Föregående månad"
      >
        <ChevronLeftIcon />
      </button>
      <span className="month-label" aria-live="polite">
        {monthLabel(month)}
      </span>
      <button
        type="button"
        className="icon-btn"
        onClick={() => onChange(addMonths(month, 1))}
        aria-label="Nästa månad"
      >
        <ChevronRightIcon />
      </button>
    </div>
  )
}
