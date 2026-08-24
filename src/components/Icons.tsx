import { slotColor } from '../data/defaults'

interface IconProps {
  size?: number
}

/** Färgprick för en kategoris palettplats. */
export const Dot = ({ slot, big = false }: { slot: number; big?: boolean }) => (
  <span className={`dot${big ? ' big' : ''}`} style={{ background: slotColor(slot) }} aria-hidden />
)

function svgProps({ size = 22 }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }
}

export const OverviewIcon = (p: IconProps = {}) => (
  <svg {...svgProps(p)}>
    <path d="M4 19V11" />
    <path d="M9.5 19V5" />
    <path d="M15 19v-6" />
    <path d="M20.5 19V8" />
  </svg>
)

export const ListIcon = (p: IconProps = {}) => (
  <svg {...svgProps(p)}>
    <path d="M8 6h12" />
    <path d="M8 12h12" />
    <path d="M8 18h12" />
    <circle cx="4" cy="6" r="1" fill="currentColor" stroke="none" />
    <circle cx="4" cy="12" r="1" fill="currentColor" stroke="none" />
    <circle cx="4" cy="18" r="1" fill="currentColor" stroke="none" />
  </svg>
)

export const BudgetIcon = (p: IconProps = {}) => (
  <svg {...svgProps(p)}>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="4.5" />
    <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
  </svg>
)

export const RepeatIcon = (p: IconProps = {}) => (
  <svg {...svgProps(p)}>
    <path d="M17 2.5 20 5.5l-3 3" />
    <path d="M4 11V9.5a4 4 0 0 1 4-4h12" />
    <path d="m7 21.5-3-3 3-3" />
    <path d="M20 13v1.5a4 4 0 0 1-4 4H4" />
  </svg>
)

export const MoreIcon = (p: IconProps = {}) => (
  <svg {...svgProps(p)}>
    <circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
    <circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none" />
  </svg>
)

export const PlusIcon = (p: IconProps = {}) => (
  <svg {...svgProps(p)}>
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </svg>
)

export const ChevronLeftIcon = (p: IconProps = {}) => (
  <svg {...svgProps(p)}>
    <path d="m14.5 6-6 6 6 6" />
  </svg>
)

export const ChevronRightIcon = (p: IconProps = {}) => (
  <svg {...svgProps(p)}>
    <path d="m9.5 6 6 6-6 6" />
  </svg>
)

export const CloseIcon = (p: IconProps = {}) => (
  <svg {...svgProps(p)}>
    <path d="M6 6l12 12" />
    <path d="M18 6 6 18" />
  </svg>
)

export const CheckIcon = (p: IconProps = {}) => (
  <svg {...svgProps(p)}>
    <path d="m4.5 12.5 5 5L19.5 7" />
  </svg>
)

export const WarnIcon = (p: IconProps = {}) => (
  <svg {...svgProps(p)}>
    <path d="M12 3.5 22 20H2Z" />
    <path d="M12 10v4.5" />
    <circle cx="12" cy="17.2" r="0.9" fill="currentColor" stroke="none" />
  </svg>
)
