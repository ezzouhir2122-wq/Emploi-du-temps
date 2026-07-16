import { cn } from '@/lib/utils'
import type { StatutFixe, StatutSamedi } from '@/types/planning'

const COLORS: Record<string, string> = {
  'Matin':      'bg-blue-100 text-blue-800 border-blue-200',
  'Après-midi': 'bg-amber-100 text-amber-800 border-amber-200',
  'Distance':   'bg-purple-100 text-purple-800 border-purple-200',
  'Repos':      'bg-gray-100 text-gray-500 border-gray-200',
}

interface StatutBadgeProps {
  statut: StatutFixe | StatutSamedi
  className?: string
}

export function StatutBadge({ statut, className }: StatutBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium',
        COLORS[statut] ?? 'bg-gray-100 text-gray-700',
        className
      )}
    >
      {statut}
    </span>
  )
}
