import type { ReactNode } from 'react'
import { BudgetIcon, ListIcon, MoreIcon, OverviewIcon, RepeatIcon } from './Icons'

export type Tab = 'overview' | 'history' | 'budget' | 'fixed' | 'more'

const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
  { id: 'overview', label: 'Översikt', icon: <OverviewIcon /> },
  { id: 'history', label: 'Historik', icon: <ListIcon /> },
  { id: 'budget', label: 'Budget', icon: <BudgetIcon /> },
  { id: 'fixed', label: 'Fasta', icon: <RepeatIcon /> },
  { id: 'more', label: 'Mer', icon: <MoreIcon /> },
]

interface Props {
  tab: Tab
  onChange: (tab: Tab) => void
}

export function BottomNav({ tab, onChange }: Props) {
  return (
    <nav className="bottom-nav" aria-label="Huvudnavigering">
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          className={`nav-item${tab === t.id ? ' active' : ''}`}
          aria-current={tab === t.id ? 'page' : undefined}
          onClick={() => onChange(t.id)}
        >
          {t.icon}
          <span>{t.label}</span>
        </button>
      ))}
    </nav>
  )
}
