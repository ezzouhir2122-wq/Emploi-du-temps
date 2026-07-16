import { type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PageHeaderProps {
  icon: LucideIcon
  title: string
  subtitle?: string
  badge?: string
  actions?: React.ReactNode
  className?: string
}

export function PageHeader({ icon: Icon, title, subtitle, badge, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between gap-4 mb-6', className)}>
      <div className="flex items-center gap-4">
        {/* Icon container with OFPPT blue */}
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#005FAD] shadow-md shadow-[#005FAD]/20">
          <Icon className="h-5 w-5 text-white" />
        </div>

        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight text-[#0A2558] leading-none">
              {title}
            </h1>
            {badge && (
              <span className="inline-flex items-center rounded-full border border-[#00968C]/30 bg-[#00968C]/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#00968C]">
                {badge}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>

      {actions && (
        <div className="flex items-center gap-2 shrink-0">{actions}</div>
      )}
    </div>
  )
}

/* Thin teal divider used below PageHeader */
export function PageDivider() {
  return (
    <div className="h-px w-full bg-gradient-to-r from-[#005FAD]/20 via-[#00968C]/40 to-transparent mb-6" />
  )
}
