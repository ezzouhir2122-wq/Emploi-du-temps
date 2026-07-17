'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { ArrowLeft, ChevronDown, Building2 } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import type { Pole, TypeScenario } from '@/types/planning'

const SCENARIOS: { value: TypeScenario; label: string; short: string; badgeCls: string }[] = [
  { value: 'groups_fixed',    label: 'A — Groupes fixes',   short: 'A', badgeCls: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'groups_rotating', label: 'B — Rotation salles', short: 'B', badgeCls: 'bg-amber-100 text-amber-700 border-amber-200' },
  { value: 'pool_mixed',      label: 'C — Pool pôle',       short: 'C', badgeCls: 'bg-purple-100 text-purple-700 border-purple-200' },
]

const SCENARIO_COLORS: Record<TypeScenario, string> = {
  groups_fixed:    'text-blue-600',
  groups_rotating: 'text-amber-600',
  pool_mixed:      'text-purple-600',
}

interface Props {
  pole: Pole
  allPoles: Pole[]
}

export function PlanningPoleHeader({ pole, allPoles }: Props) {
  const router      = useRouter()
  const supabase    = createClient()
  const current     = SCENARIOS.find(s => s.value === pole.scenario_type) ?? SCENARIOS[0]
  const [open, setOpen] = useState(false)
  const dropRef     = useRef<HTMLDivElement>(null)

  // Fermer le dropdown si clic en dehors
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function handleScenarioChange(newType: TypeScenario) {
    const { error } = await supabase.from('poles').update({ scenario_type: newType }).eq('id', pole.id)
    if (error) { toast.error('Erreur lors du changement de scénario'); return }
    toast.success(`Scénario → ${SCENARIOS.find(s => s.value === newType)?.label}`)
    router.refresh()
  }

  function handlePoleSwitch(poleId: string) {
    setOpen(false)
    router.push(`/planning-fixe/${poleId}`)
  }

  const otherPoles = allPoles.filter(p => p.id !== pole.id)

  return (
    <div className="flex items-center gap-3 pb-4 border-b border-muted mb-2 flex-wrap">

      {/* ── Retour ── */}
      <button
        onClick={() => router.push('/planning-fixe')}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors group shrink-0"
      >
        <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
        <span>Tous les pôles</span>
      </button>

      <span className="text-muted-foreground/30 text-lg">/</span>

      {/* ── Sélecteur de pôle (dropdown) ── */}
      <div className="relative" ref={dropRef}>
        <button
          onClick={() => setOpen(v => !v)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#005FAD]/30 bg-[#005FAD]/5 hover:bg-[#005FAD]/10 transition-colors group"
        >
          <Building2 className="h-3.5 w-3.5 text-[#005FAD]" />
          <span className="text-sm font-bold text-[#0A2558]">{pole.nom}</span>
          {pole.code && (
            <span className="text-[9px] font-mono bg-white border border-muted text-muted-foreground px-1.5 py-0.5 rounded">
              {pole.code}
            </span>
          )}
          <ChevronDown className={`h-3.5 w-3.5 text-[#005FAD]/60 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {/* Dropdown liste des pôles */}
        {open && (
          <div className="absolute top-full left-0 mt-1.5 z-50 min-w-[220px] rounded-xl border border-muted bg-white shadow-lg overflow-hidden">
            {/* Pôle actif */}
            <div className="px-3 py-2 border-b bg-[#005FAD]/5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#005FAD]">{pole.nom}</span>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${current.badgeCls}`}>
                  {current.short}
                </span>
                <span className="ml-auto text-[9px] text-[#005FAD] bg-[#005FAD]/10 px-2 py-0.5 rounded-full font-medium">
                  Actuel
                </span>
              </div>
            </div>

            {/* Autres pôles */}
            {otherPoles.length > 0 ? (
              <div className="py-1">
                <div className="px-3 py-1 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">
                  Basculer vers
                </div>
                {otherPoles.map(p => {
                  const sc = SCENARIOS.find(s => s.value === p.scenario_type)
                  return (
                    <button
                      key={p.id}
                      onClick={() => handlePoleSwitch(p.id)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50 transition-colors text-left"
                    >
                      <Building2 className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                      <span className="font-medium flex-1 truncate">{p.nom}</span>
                      {p.code && (
                        <span className="text-[9px] font-mono text-muted-foreground/60">{p.code}</span>
                      )}
                      {sc && (
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border shrink-0 ${sc.badgeCls}`}>
                          {sc.short}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="px-3 py-3 text-xs text-muted-foreground italic">
                Aucun autre pôle actif
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Scénario badge + picker ── */}
      <div className="ml-auto flex items-center gap-2 shrink-0">
        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${current.badgeCls}`}>
          Scénario {current.short}
        </span>
        <select
          defaultValue={pole.scenario_type}
          onChange={e => handleScenarioChange(e.target.value as TypeScenario)}
          className="text-xs border rounded-lg px-2 h-8 bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-[#005FAD]/20"
        >
          {SCENARIOS.map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>
    </div>
  )
}
