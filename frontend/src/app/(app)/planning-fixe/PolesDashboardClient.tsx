'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { CalendarDays, ChevronRight, Layers, RotateCcw, Users, Building2 } from 'lucide-react'
import { PageHeader, PageDivider } from '@/components/layout/PageHeader'
import type { Pole, Salle, Formateur, PlanningFixe, TypeScenario } from '@/types/planning'

// ── Config scénarios ───────────────────────────────────────────

const SCENARIOS: {
  value: TypeScenario
  label: string
  short: string
  icon: typeof Layers
  color: string
  bg: string
  border: string
  barColor: string
  badgeCls: string
}[] = [
  {
    value: 'groups_fixed',
    label: 'A — Groupes fixes',
    short: 'A',
    icon: Layers,
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    barColor: 'bg-blue-500',
    badgeCls: 'bg-blue-100 text-blue-700 border border-blue-200',
  },
  {
    value: 'groups_rotating',
    label: 'B — Rotation salles',
    short: 'B',
    icon: RotateCcw,
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    barColor: 'bg-amber-500',
    badgeCls: 'bg-amber-100 text-amber-700 border border-amber-200',
  },
  {
    value: 'pool_mixed',
    label: 'C — Pool pôle',
    short: 'C',
    icon: Users,
    color: 'text-purple-700',
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    barColor: 'bg-purple-500',
    badgeCls: 'bg-purple-100 text-purple-700 border border-purple-200',
  },
]

function getScenario(type: TypeScenario) {
  return SCENARIOS.find(s => s.value === type) ?? SCENARIOS[0]
}

// ── Props ──────────────────────────────────────────────────────

interface Props {
  poles: Pole[]
  salles: Salle[]
  formateurs: Formateur[]
  planningFixe: PlanningFixe[]
}

// ── Composant carte pôle ───────────────────────────────────────

function PoleCard({
  pole,
  sallesDuPole,
  formateursDuPole,
  sessionsDuPole,
  onScenarioChange,
  loading,
}: {
  pole: Pole
  sallesDuPole: Salle[]
  formateursDuPole: Formateur[]
  sessionsDuPole: number
  onScenarioChange: (poleId: string, type: TypeScenario) => void
  loading: string | null
}) {
  const scenario = getScenario(pole.scenario_type)
  const Icon = scenario.icon

  const maxSessions = formateursDuPole.length * 10
  const pct = maxSessions > 0 ? Math.min(100, Math.round((sessionsDuPole / maxSessions) * 100)) : 0
  const isReady = formateursDuPole.length > 0 && sallesDuPole.length > 0
  const isLoading = loading === pole.id

  return (
    <div className={`rounded-xl border-2 ${scenario.border} bg-white shadow-sm overflow-hidden flex flex-col transition-all hover:shadow-md`}>

      {/* Barre colorée en haut selon scénario */}
      <div className={`h-1.5 w-full ${scenario.barColor}`} />

      <div className="p-5 flex flex-col gap-4 flex-1">
        {/* ── En-tête ── */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-foreground leading-tight">{pole.nom}</h2>
              {pole.code && (
                <span className="text-[9px] font-mono bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                  {pole.code}
                </span>
              )}
            </div>
            {pole.description && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{pole.description}</p>
            )}
          </div>
          {/* Badge scénario actuel */}
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${scenario.badgeCls}`}>
            {scenario.short}
          </span>
        </div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-2 gap-2">
          <div className={`rounded-lg px-3 py-2 ${scenario.bg} ${scenario.border} border`}>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Formateurs</div>
            <div className={`text-xl font-bold ${scenario.color} leading-tight`}>{formateursDuPole.length}</div>
          </div>
          <div className="rounded-lg px-3 py-2 bg-slate-50 border border-slate-200">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Salles</div>
            <div className="text-xl font-bold text-slate-700 leading-tight">{sallesDuPole.length}</div>
          </div>
        </div>

        {/* ── Avancement planning ── */}
        {maxSessions > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Séances saisies</span>
              <span className={`font-semibold ${pct === 100 ? 'text-emerald-600' : 'text-foreground'}`}>
                {sessionsDuPole} / {maxSessions}
                {pct === 100 && ' ✓'}
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-emerald-500' : scenario.barColor}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="text-[10px] text-muted-foreground text-right">{pct}% complété</div>
          </div>
        )}

        {/* Avertissement configuration manquante */}
        {!isReady && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
            {formateursDuPole.length === 0 && '⚠ Aucun formateur affecté à ce pôle. '}
            {sallesDuPole.length === 0 && '⚠ Aucune salle affectée à ce pôle.'}
            <span className="block mt-0.5 text-amber-600">
              Configurez dans <strong>Paramètres</strong>.
            </span>
          </div>
        )}

        {/* ── Sélecteur scénario ── */}
        <div className="space-y-1">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Scénario d&apos;organisation
          </label>
          <select
            value={pole.scenario_type}
            onChange={e => onScenarioChange(pole.id, e.target.value as TypeScenario)}
            disabled={isLoading}
            className={`w-full text-xs rounded-lg border px-3 h-9 bg-white focus:outline-none focus:ring-2 focus:ring-[#005FAD]/30 transition-all ${scenario.border} ${scenario.color} font-medium`}
          >
            {SCENARIOS.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        {/* ── CTA ── */}
        {isReady ? (
          <Link
            href={`/planning-fixe/${pole.id}`}
            className={`mt-auto flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all ${scenario.bg} ${scenario.color} ${scenario.border} border hover:brightness-95`}
          >
            <Icon className="h-4 w-4" />
            Saisir le planning
            <ChevronRight className="h-4 w-4 ml-auto opacity-60" />
          </Link>
        ) : (
          <div className="mt-auto flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium bg-muted text-muted-foreground border border-dashed border-muted-foreground/30 cursor-not-allowed">
            <Building2 className="h-4 w-4" />
            Configuration requise
          </div>
        )}
      </div>
    </div>
  )
}

// ── Composant principal ────────────────────────────────────────

export function PolesDashboardClient({ poles, salles, formateurs, planningFixe }: Props) {
  const [polesState, setPolesState] = useState<Pole[]>(poles)
  const [loading, setLoading] = useState<string | null>(null)
  const supabase = createClient()

  async function handleScenarioChange(poleId: string, type: TypeScenario) {
    setLoading(poleId)
    const { error } = await supabase.from('poles').update({ scenario_type: type }).eq('id', poleId)
    if (error) {
      toast.error('Erreur lors de la mise à jour du scénario')
    } else {
      setPolesState(prev => prev.map(p => p.id === poleId ? { ...p, scenario_type: type } : p))
      toast.success('Scénario mis à jour')
    }
    setLoading(null)
  }

  // Stats par pôle
  const statsParPole = (poleId: string) => {
    const formateursDuPole = formateurs.filter(f => f.pole_id === poleId)
    const sallesDuPole     = salles.filter(s => s.pole_id === poleId)
    const formateurIds     = new Set(formateursDuPole.map(f => f.id))
    const sessionsDuPole   = planningFixe.filter(p => formateurIds.has(p.formateur_id)).length
    return { formateursDuPole, sallesDuPole, sessionsDuPole }
  }

  // Résumé global
  const totalFormateurs = formateurs.length
  const totalSessions   = planningFixe.length
  const totalMax        = totalFormateurs * 10
  const globalPct       = totalMax > 0 ? Math.round((totalSessions / totalMax) * 100) : 0

  return (
    <div className="space-y-6">
      {/* ── En-tête ── */}
      <div>
        <PageHeader
          icon={CalendarDays}
          title="Planning Hebdomadaire"
          subtitle="Sélectionnez un pôle pour saisir ou modifier son planning. Chaque pôle peut avoir son propre scénario d'organisation."
        />
        <PageDivider />
      </div>

      {/* ── Résumé global ── */}
      <div className="rounded-xl border bg-gradient-to-r from-[#005FAD]/5 to-[#00968C]/5 border-[#005FAD]/20 px-5 py-4 flex flex-wrap items-center gap-6">
        <div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium">Avancement global</div>
          <div className="text-2xl font-bold text-[#005FAD] mt-0.5">{globalPct}%</div>
        </div>
        <div className="flex-1 min-w-[200px]">
          <div className="h-3 bg-white rounded-full overflow-hidden border border-[#005FAD]/20">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#005FAD] to-[#00968C] transition-all duration-700"
              style={{ width: `${globalPct}%` }}
            />
          </div>
          <div className="text-xs text-muted-foreground mt-1">{totalSessions} / {totalMax} séances saisies</div>
        </div>
        <div className="flex gap-4 text-center shrink-0">
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Pôles</div>
            <div className="text-xl font-bold">{polesState.length}</div>
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Formateurs</div>
            <div className="text-xl font-bold">{totalFormateurs}</div>
          </div>
        </div>
      </div>

      {/* ── Légende scénarios ── */}
      <div className="flex flex-wrap gap-2">
        {SCENARIOS.map(s => {
          const Icon = s.icon
          return (
            <span key={s.value} className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full ${s.badgeCls}`}>
              <Icon className="h-3 w-3" />
              <strong>{s.short}</strong> · {s.label.split(' — ')[1]}
            </span>
          )
        })}
      </div>

      {/* ── Grille de pôles ── */}
      {polesState.length === 0 ? (
        <div className="rounded-xl border border-dashed border-muted-foreground/30 bg-muted/20 px-6 py-10 text-center">
          <Building2 className="h-8 w-8 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-sm font-semibold text-muted-foreground">Aucun pôle actif</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Créez des pôles dans <strong>Paramètres → Pôles</strong>.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {polesState.map(pole => {
            const { formateursDuPole, sallesDuPole, sessionsDuPole } = statsParPole(pole.id)
            return (
              <PoleCard
                key={pole.id}
                pole={pole}
                sallesDuPole={sallesDuPole}
                formateursDuPole={formateursDuPole}
                sessionsDuPole={sessionsDuPole}
                onScenarioChange={handleScenarioChange}
                loading={loading}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
