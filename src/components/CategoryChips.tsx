import type { Category } from '../types'
import { Dot } from './Icons'

/** Regeln för förvald kategori: behåll valet om det finns i listan, annars första.
 *  Delas av alla formulär som väljer kategori. */
export function resolveCategory(categories: Category[], categoryId: string): string {
  return categories.some((c) => c.id === categoryId) ? categoryId : (categories[0]?.id ?? '')
}

interface Props {
  categories: Category[]
  value: string
  onChange: (id: string) => void
}

export function CategoryChips({ categories, value, onChange }: Props) {
  return (
    <div className="field">
      <span>Kategori</span>
      <div className="chips" role="radiogroup" aria-label="Kategori">
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={value === c.id}
            className={`chip${value === c.id ? ' on' : ''}`}
            onClick={() => onChange(c.id)}
          >
            <Dot slot={c.slot} />
            {c.name}
          </button>
        ))}
      </div>
    </div>
  )
}
