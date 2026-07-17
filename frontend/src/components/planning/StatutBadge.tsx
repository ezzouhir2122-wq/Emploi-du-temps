import { cn } from '@/lib/utils'
import type { StatutFixe, StatutSamedi } from '@/types/planning'
import { STATUT_TIMES } from '@/types/planning'

const COLORS: Record<string, string> = {
  'Matin FP S1':        'bg-blue-100 text-blue-900 border-blue-300',
  'Matin FP S2':        'bg-blue-50 text-blue-700 border-blue-200',
  'Après-midi FP S1':   'bg-amber-100 text-amber-900 border-amber-300',
  'Après-midi FP S2':   'bg-amber-50 text-amber-700 border-amber-200',
  'FAD Matin':          'bg-violet-100 text-violet-800 border-violet-200',
  'FAD Après-midi':     'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200',
  'Repos':              'bg-gray-100 text-gray-500 border-gray-200',
  // Legacy
  'Matin':              'bg-blue-100 text-blue-800 border-blue-200',
  'Après-midi':         'bg-amber-100 text-amber-800 border-amber-200',
  'Distance':           'bg-purple-100 text-purple-800 border-purple-200',
  'Distance Matin':     'bg-violet-100 text-violet-800 border-violet-200',
  'Distance Après-midi':'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200',
}

const SHORT_LABELS: Partial<Record<string, string>> = {
  'Matin FP S1':        'Mat. S1',
  'Matin FP S2':        'Mat. S2',
  'Après-midi FP S1':   'PM S1',
  'Après-midi FP S2':   'PM S2',
  'FAD Matin':          'FAD Mat.',
  'FAD Après-midi':     'FAD PM',
  'Distance Matin':     'Dist. Mat.',
  'Distance Après-midi':'Dist. PM',
}

interface StatutBadgeProps {
  statut: StatutFixe | StatutSamedi
  showTime?: boolean
  className?: string
}

export function StatutBadge({ statut, showTime, className }: StatutBadgeProps) {
  const label = SHORT_LABELS[statut] ?? statut
  const time = showTime ? STATUT_TIMES[statut as StatutFixe] : undefined
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs font-medium',
        COLORS[statut] ?? 'bg-gray-100 text-gray-700',
        className
      )}
    >
      {label}
      {time && <span className="text-[9px] opacity-70 font-normal">{time}</span>}
    </span>
  )
}
