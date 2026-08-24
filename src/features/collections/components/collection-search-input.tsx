import { Search } from 'lucide-react'
import { Input } from '@app/shared/components/ui/input'

interface CollectionSearchInputProps {
  readonly value: string
  readonly onChange: (value: string) => void
}

const SEARCH_LABEL = 'Search collections and websites'

/**
 * Filters the dashboard by collection name, website name, or domain.
 */
export function CollectionSearchInput({
  value,
  onChange,
}: CollectionSearchInputProps) {
  return (
    <div className="relative w-full shrink-0 sm:w-72">
      <Search
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />

      <Input
        type="search"
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder={SEARCH_LABEL}
        aria-label={SEARCH_LABEL}
        className="pl-9"
      />
    </div>
  )
}
