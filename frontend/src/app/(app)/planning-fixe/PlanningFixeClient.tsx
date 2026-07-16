'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { StatutBadge } from '@/components/planning/StatutBadge'
import { PageHeader, PageDivider } from '@/components/layout/PageHeader'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { CalendarDays, Info, RotateCcw, Wand2, ChevronDown, ChevronUp, Settings2, Play } from 'lucide-react'
import type {
  Formateur, Groupe, Salle, PlanningFixe, Scenario,
  JourSemaine, StatutFixe, RotationSamediConfig, CycleReference, StatutSamedi, SemaineCycle,
} from '@/types/planning'
import { JOURS_SEMAINE, STATUTS_FIXES } from '@/types/planning'
import { getMoisCycle, getSamedisDuMois, parseISODate, toISODateString } from '@/lib/rotation'

const MOIS_LABELS = [
  'Janvier','Février','Mars','Avril','Mai','Juin',
  'Juillet','Août','Septembre','Octobre','Novembre','Décembre',
]

const STATUTS_SAMEDI: StatutSamedi[] = ['Matin', 'Après-midi', 'Repos']
const POSITIONS_CYCLE: SemaineCycle[] = [1, 2, 3]
const ROTATION_SUIVANTE: Record<StatutSamedi, StatutSamedi> = {
  'Matin': 'Après-midi',
  'Après-midi': 'Repos',
  'Repos': 'Matin',
}

// Statuts qui comptent comme une séance travaillée
const STATUTS_TRAVAIL: StatutFixe[] = ['Matin', 'Après-midi', 'Distance']
const MAX_SEANCES = 5
const JOURS_MON_VEN: JourSemaine[] = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi']
// 6 jours × (Matin + Après-midi) = 12 créneaux physiques max par salle par semaine
const MAX_CRENEAUX_SALLE = 12

// ── Bannière taux d'occupation salle ─────────────────────────

function OccupationBanner({ filled }: { filled: number }) {
  const pct = Math.round(filled / MAX_CRENEAUX_SALLE * 100)
  const color = pct === 100
    ? { bar: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' }
    : pct >= 75
    ? { bar: 'bg-amber-400', text: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' }
    : { bar: 'bg-red-400', text: 'text-red-700', bg: 'bg-red-50 border-red-200' }

  return (
    <div className={`px-4 py-2.5 border-b ${color.bg} border flex items-center gap-4`}>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs font-semibold text-muted-foreground">Occupation salle</span>
        <span className={`text-xs font-bold ${color.text}`}>{pct}%</span>
        <span className="text-xs text-muted-foreground">({filled}/{MAX_CRENEAUX_SALLE} créneaux)</span>
      </div>
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden min-w-[80px]">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color.bar}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {pct === 100 && (
        <span className="text-xs font-medium text-emerald-700 shrink-0">✓ Salle 100% occupée</span>
      )}
    </div>
  )
}

interface Props {
  salles: Salle[]
  groupes: Groupe[]
  formateurs: Formateur[]
  planningFixe: PlanningFixe[]
  activeScenario: Scenario | null
  rotationConfig: RotationSamediConfig[]
  cycleReferences: CycleReference[]
}

// ── Composants Rotation Samedi (intégrés) ────────────────────

function AncragEditor({
  ref_, onSave,
}: {
  ref_: CycleReference | undefined
  onSave: (date: string, pos: SemaineCycle) => void
}) {
  const [date, setDate] = useState(ref_?.date_ancrage ?? '')
  const [pos, setPos] = useState<SemaineCycle>(ref_?.semaine_cycle_ancrage ?? 1)
  return (
    <div className="px-4 py-3 bg-muted/20 border-b">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Ancrage du cycle</p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Mois de référence (1er du mois)</Label>
          <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-7 w-40 text-xs" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Position dans le cycle</Label>
          <Select value={String(pos)} onValueChange={v => setPos(Number(v) as SemaineCycle)}>
            <SelectTrigger className="h-7 w-28 text-xs"><SelectValue>Mois {pos}</SelectValue></SelectTrigger>
            <SelectContent>
              {([1, 2, 3] as SemaineCycle[]).map(s => (
                <SelectItem key={s} value={String(s)} className="text-xs">Mois {s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onSave(date, pos)} disabled={!date}>
          Enregistrer
        </Button>
        {ref_ && (
          <span className="text-xs text-muted-foreground">
            Actuel : {ref_.date_ancrage.slice(0, 7)} → Mois {ref_.semaine_cycle_ancrage}
          </span>
        )}
      </div>
    </div>
  )
}

function RotationSallePanel({
  salle, formateursSalle, rotationConfig, cycleRef, previewAnnee, previewMois,
  onStatutChange, onAutoRotation, onAncrageSave, onApplyRotation,
}: {
  salle: Salle
  formateursSalle: Formateur[]
  rotationConfig: RotationSamediConfig[]
  cycleRef: CycleReference | undefined
  previewAnnee: number
  previewMois: number
  onStatutChange: (salleId: string, pos: SemaineCycle, formateurId: string, statut: StatutSamedi) => void
  onAutoRotation: (salleId: string, formateursSalle: Formateur[]) => void
  onAncrageSave: (salleId: string, date: string, pos: SemaineCycle) => void
  onApplyRotation: (entries: { formateurId: string; statut: StatutSamedi }[]) => void
}) {
  function getCfg(pos: SemaineCycle, formateurId: string) {
    return rotationConfig.find(
      c => c.salle_id === salle.id && c.semaine_cycle === pos && c.formateur_id === formateurId
    )
  }

  function handleApply() {
    if (!cycleRef) return
    const ancrage = parseISODate(cycleRef.date_ancrage)
    const pos = getMoisCycle(previewAnnee, previewMois, ancrage, cycleRef.semaine_cycle_ancrage)
    const entries = formateursSalle.map(f => ({
      formateurId: f.id,
      statut: (getCfg(pos, f.id)?.statut ?? 'Repos') as StatutSamedi,
    }))
    onApplyRotation(entries)
  }

  const preview = (() => {
    if (!cycleRef) return []
    const ancrage = parseISODate(cycleRef.date_ancrage)
    const position = getMoisCycle(previewAnnee, previewMois, ancrage, cycleRef.semaine_cycle_ancrage)
    return getSamedisDuMois(previewAnnee, previewMois).map(samedi => ({
      date: toISODateString(samedi),
      position,
      statuts: formateursSalle.map(f => ({
        formateur: f,
        statut: (getCfg(position, f.id)?.statut ?? 'Repos') as StatutSamedi,
      })),
    }))
  })()

  return (
    <div className="border-t bg-muted/10">
      <AncragEditor ref_={cycleRef} onSave={(d, p) => onAncrageSave(salle.id, d, p)} />

      <div className="px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Cycle mensuel — 3 mois</p>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-6 text-xs gap-1"
              onClick={() => onAutoRotation(salle.id, formateursSalle)}>
              <Wand2 className="h-3 w-3" /> Auto Mois 2 &amp; 3
            </Button>
            <Button size="sm" className="h-6 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handleApply} disabled={!cycleRef}>
              <Play className="h-3 w-3" />
              Appliquer au Samedi — {MOIS_LABELS[previewMois - 1]}
            </Button>
          </div>
        </div>
        <div className="text-xs text-muted-foreground bg-blue-50 border border-blue-100 rounded px-2 py-1 mb-2">
          Règle : <strong>Matin</strong> → Après-midi → Repos → Matin…
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-1.5 px-2 font-medium text-muted-foreground text-xs">Formateur</th>
              {POSITIONS_CYCLE.map(p => (
                <th key={p} className="text-center py-1.5 px-2 font-medium text-muted-foreground text-xs">Mois {p}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {formateursSalle.map(f => (
              <tr key={f.id} className="hover:bg-muted/20">
                <td className="py-1.5 px-2 text-xs font-medium">{f.nom}</td>
                {POSITIONS_CYCLE.map(pos => {
                  const cfg = getCfg(pos, f.id)
                  return (
                    <td key={pos} className="py-1.5 px-2 text-center">
                      <Select
                        value={cfg?.statut ?? 'Repos'}
                        onValueChange={val => onStatutChange(salle.id, pos, f.id, val as StatutSamedi)}
                      >
                        <SelectTrigger className="h-7 w-28 text-xs mx-auto">
                          <SelectValue><StatutBadge statut={cfg?.statut ?? 'Repos'} /></SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {STATUTS_SAMEDI.map(s => (
                            <SelectItem key={s} value={s} className="text-xs"><StatutBadge statut={s} /></SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {cycleRef && preview.length > 0 && (
        <div className="border-t px-4 py-3">
          <div className="text-xs text-muted-foreground mb-2">
            Prévisualisation — <span className="font-medium">{MOIS_LABELS[previewMois - 1]} {previewAnnee}</span>
            {' → '}Position <strong>{preview[0].position}</strong> du cycle
          </div>
          <div className="flex flex-wrap gap-2">
            {preview.map(({ date, statuts }) => (
              <div key={date} className="rounded border bg-background px-3 py-2 text-xs">
                <div className="font-medium mb-1">
                  Samedi {new Date(date + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                </div>
                <div className="flex flex-wrap gap-2">
                  {statuts.map(({ formateur, statut }) => (
                    <span key={formateur.id} className="flex items-center gap-1">
                      <span className="text-muted-foreground">{formateur.nom.split(' ')[0]}</span>
                      <StatutBadge statut={statut} />
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Helpers partagés ─────────────────────────────────────────

function encodeValue(statut: StatutFixe, salleId: string | null): string {
  if (statut === 'Distance' || statut === 'Repos') return statut
  return salleId ? `${salleId}|${statut}` : statut
}

function decodeValue(value: string): { statut: StatutFixe; salleId: string | null } {
  if (value === 'Distance' || value === 'Repos') return { statut: value as StatutFixe, salleId: null }
  const [salleId, statut] = value.split('|')
  return { statut: statut as StatutFixe, salleId }
}

// Badge séances/semaine
function SeancesBadge({ count }: { count: number }) {
  const color = count === MAX_SEANCES
    ? 'bg-emerald-100 text-emerald-700'
    : count > MAX_SEANCES
    ? 'bg-red-100 text-red-600'
    : 'bg-amber-100 text-amber-700'
  return (
    <span className={`ml-1.5 text-[9px] font-mono px-1 rounded ${color}`}>
      {count}/{MAX_SEANCES}
    </span>
  )
}

// ── Vue standard (Scénario A / B) ────────────────────────────

function StandardView({
  salles, groupes, formateurs, planning, saving,
  onStatutChange,
  rotationConfig, cycleReferences, previewAnnee, previewMois,
  onRotationStatut, onAutoRotation, onAncrageSave, onApplyRotation,
}: {
  salles: Salle[]
  groupes: Groupe[]
  formateurs: Formateur[]
  planning: PlanningFixe[]
  saving: string | null
  onStatutChange: (formateurId: string, jour: JourSemaine, statut: StatutFixe) => void
  rotationConfig: RotationSamediConfig[]
  cycleReferences: CycleReference[]
  previewAnnee: number
  previewMois: number
  onRotationStatut: (salleId: string, pos: SemaineCycle, formateurId: string, statut: StatutSamedi) => void
  onAutoRotation: (salleId: string, formateursSalle: Formateur[]) => void
  onAncrageSave: (salleId: string, date: string, pos: SemaineCycle) => void
  onApplyRotation: (salleId: string, entries: { formateurId: string; statut: StatutSamedi }[]) => void
}) {
  const [expandedSalles, setExpandedSalles] = useState<Set<string>>(new Set())
  function toggleRotation(salleId: string) {
    setExpandedSalles(prev => {
      const next = new Set(prev)
      next.has(salleId) ? next.delete(salleId) : next.add(salleId)
      return next
    })
  }

  function getStatut(formateurId: string, jour: JourSemaine): StatutFixe | undefined {
    return planning.find(p => p.formateur_id === formateurId && p.jour_semaine === jour)?.statut
  }

  // Séances Lundi-Vendredi uniquement (hors Samedi)
  function countSeancesMonVen(formateurId: string): number {
    return JOURS_MON_VEN.filter(j => STATUTS_TRAVAIL.includes(getStatut(formateurId, j) as StatutFixe)).length
  }

  // Séances totales Lundi-Samedi
  function countSeances(formateurId: string): number {
    return JOURS_SEMAINE.filter(j => STATUTS_TRAVAIL.includes(getStatut(formateurId, j) as StatutFixe)).length
  }

  // Taux d'occupation : créneaux physiques (Matin + PM) saisis / 12
  function getOccupationSalle(formateursSalle: Formateur[]): number {
    let filled = 0
    for (const jour of JOURS_SEMAINE) {
      if (formateursSalle.some(f => getStatut(f.id, jour) === 'Matin')) filled++
      if (formateursSalle.some(f => getStatut(f.id, jour) === 'Après-midi')) filled++
    }
    return filled
  }

  function getStatutsDisponibles(formateurId: string, jour: JourSemaine, formateursSalle: Formateur[]): StatutFixe[] {
    const indisponibles = new Set<StatutFixe>()

    for (const f of formateursSalle) {
      if (f.id === formateurId) continue
      const s = getStatut(f.id, jour)
      if (s === 'Matin' || s === 'Après-midi') indisponibles.add(s)
    }

    const dejaDistance = JOURS_SEMAINE
      .filter(j => j !== jour)
      .some(j => getStatut(formateurId, j) === 'Distance')
    if (dejaDistance) indisponibles.add('Distance')

    // Samedi : pas de Distance
    if (jour === 'Samedi') indisponibles.add('Distance')

    return STATUTS_FIXES.filter(s => !indisponibles.has(s as StatutFixe)) as StatutFixe[]
  }

  return (
    <>
      {salles.map(salle => {
        const groupe = groupes.find(g => g.salle_id === salle.id)
        const formateursSalle = groupe
          ? formateurs.filter(f => f.groupe_id === groupe.id)
          : formateurs.filter(f => salle.pole_id && f.pole_id === salle.pole_id)
        const salleLabel = salle.nom.replace('Salle ', 'S')
        const expanded = expandedSalles.has(salle.id)
        const occupationFilled = getOccupationSalle(formateursSalle)

        return (
          <div key={salle.id} className="rounded-lg border bg-card">
            <div className="border-b px-4 py-3 flex items-center justify-between">
              <div>
                <h2 className="font-semibold">{salle.nom}</h2>
                {groupe && <p className="text-xs text-muted-foreground">{groupe.nom}</p>}
              </div>
              <Button
                size="sm" variant="outline"
                className={`h-7 text-xs gap-1.5 ${expanded ? 'bg-muted' : ''}`}
                onClick={() => toggleRotation(salle.id)}
              >
                <Settings2 className="h-3.5 w-3.5" />
                Rotation Samedi
                {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </Button>
            </div>

            {/* Bannière taux d'occupation */}
            <OccupationBanner filled={occupationFilled} />

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground w-32">Formateur</th>
                    {JOURS_SEMAINE.map(jour => {
                      const matinPris = formateursSalle.some(f => getStatut(f.id, jour) === 'Matin')
                      const pmPris    = formateursSalle.some(f => getStatut(f.id, jour) === 'Après-midi')
                      const complete  = matinPris && pmPris
                      const isSamedi  = jour === 'Samedi'
                      return (
                        <th key={jour} className={`px-1 py-1.5 text-center font-medium text-muted-foreground min-w-[100px] ${isSamedi ? 'border-l-2 border-dashed border-muted-foreground/40' : ''}`}>
                          <div className={`text-xs font-medium ${isSamedi ? 'text-emerald-700 font-semibold' : ''}`}>{jour}</div>
                          <div className="flex justify-center mt-0.5">
                            <span
                              title={`${salle.nom} : ${matinPris ? 'Matin✓' : 'Matin○'} ${pmPris ? 'PM✓' : 'PM○'}`}
                              className={`text-[8px] font-mono px-1 rounded ${
                                complete ? 'bg-red-100 text-red-600'
                                : (matinPris || pmPris) ? 'bg-amber-100 text-amber-600'
                                : 'bg-green-100 text-green-600'
                              }`}
                            >
                              {salleLabel}{complete ? '✓' : matinPris ? ' M' : pmPris ? ' PM' : ' ○'}
                            </span>
                          </div>
                          {complete && (
                            <div className="flex items-center justify-center gap-0.5 mt-0.5 text-[8px] text-red-500">
                              <Info className="h-2 w-2" />complet
                            </div>
                          )}
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {formateursSalle.map(formateur => {
                    const monVenCount = countSeancesMonVen(formateur.id)
                    const seances     = countSeances(formateur.id)
                    const samediAuto  = monVenCount >= MAX_SEANCES

                    return (
                      <tr key={formateur.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-3 py-1.5 font-medium text-sm leading-tight">
                          <div className="flex items-center gap-1 flex-wrap">
                            <span className="truncate max-w-[100px]">{formateur.nom}</span>
                            <SeancesBadge count={seances} />
                          </div>
                        </td>
                        {JOURS_SEMAINE.map(jour => {
                          const statut      = getStatut(formateur.id, jour)
                          const key         = `${formateur.id}-${jour}`
                          const isSamedi    = jour === 'Samedi'

                          // Samedi auto-Repos si Mon-Ven = 5
                          if (isSamedi && samediAuto) {
                            return (
                              <td key={jour} className="px-1 py-1.5 text-center border-l-2 border-dashed border-muted-foreground/40 bg-slate-50/60">
                                <div className="flex flex-col items-center gap-0.5">
                                  <StatutBadge statut="Repos" />
                                  <span className="text-[9px] text-muted-foreground/60 italic">auto</span>
                                </div>
                              </td>
                            )
                          }

                          const disponibles = getStatutsDisponibles(formateur.id, jour, formateursSalle)
                          const physiques   = disponibles.filter(s => s === 'Matin' || s === 'Après-midi')
                          const autres      = disponibles.filter(s => s !== 'Matin' && s !== 'Après-midi')
                          const salleComplete = formateursSalle.some(f => f.id !== formateur.id && getStatut(f.id, jour) === 'Matin')
                                            && formateursSalle.some(f => f.id !== formateur.id && getStatut(f.id, jour) === 'Après-midi')
                          const trop = !statut && seances >= MAX_SEANCES

                          return (
                            <td key={jour} className={`px-1 py-1.5 text-center ${isSamedi ? 'border-l-2 border-dashed border-muted-foreground/40 bg-emerald-50/30' : ''}`}>
                              <Select
                                value={statut ?? ''}
                                onValueChange={val => onStatutChange(formateur.id, jour, val as StatutFixe)}
                                disabled={saving === key}
                              >
                                {/* Trigger compact : affiche uniquement le badge (la salle est déjà connue) */}
                                <SelectTrigger className={`h-7 w-[96px] text-xs mx-auto px-2 ${trop ? 'border-orange-300' : ''}`}>
                                  <SelectValue placeholder="—">
                                    {statut
                                      ? <StatutBadge statut={statut} />
                                      : <span className="text-muted-foreground/40 text-[10px]">—</span>
                                    }
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  {trop && (
                                    <div className="flex items-center gap-1.5 px-3 py-2 text-xs text-orange-600 bg-orange-50 border-b">
                                      <Info className="h-3 w-3 shrink-0" />
                                      {seances}/{MAX_SEANCES} séances atteint
                                    </div>
                                  )}
                                  {salleComplete && physiques.length === 0 && (
                                    <div className="flex items-center gap-1.5 px-3 py-2 text-xs text-amber-600 bg-amber-50 border-b">
                                      <Info className="h-3 w-3 shrink-0" />
                                      {salleLabel} non disponible
                                    </div>
                                  )}
                                  {physiques.map(s => (
                                    <SelectItem key={s} value={s}>
                                      <span className="flex items-center gap-1.5 text-xs">
                                        <span className="text-muted-foreground font-mono text-[10px]">{salleLabel}</span>
                                        <StatutBadge statut={s} />
                                      </span>
                                    </SelectItem>
                                  ))}
                                  {physiques.length > 0 && autres.length > 0 && <div className="h-px bg-border my-1" />}
                                  {autres.map(s => (
                                    <SelectItem key={s} value={s}>
                                      <StatutBadge statut={s} />
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="border-t px-4 py-2 text-xs text-muted-foreground flex items-center gap-4">
              <span className="flex items-center gap-1"><span className="bg-green-100 text-green-600 px-1 rounded font-mono text-[9px]">S○</span> Salle libre</span>
              <span className="flex items-center gap-1"><span className="bg-amber-100 text-amber-600 px-1 rounded font-mono text-[9px]">S M</span> 1 créneau pris</span>
              <span className="flex items-center gap-1"><span className="bg-red-100 text-red-600 px-1 rounded font-mono text-[9px]">S✓</span> Salle complète</span>
              <span className="flex items-center gap-1 ml-auto"><span className="bg-emerald-100 text-emerald-700 px-1 rounded font-mono text-[9px]">5/5</span> = séances/semaine complètes</span>
            </div>

            {expanded && (
              <RotationSallePanel
                salle={salle}
                formateursSalle={formateursSalle}
                rotationConfig={rotationConfig}
                cycleRef={cycleReferences.find(c => c.salle_id === salle.id)}
                previewAnnee={previewAnnee}
                previewMois={previewMois}
                onStatutChange={onRotationStatut}
                onAutoRotation={onAutoRotation}
                onAncrageSave={onAncrageSave}
                onApplyRotation={entries => onApplyRotation(salle.id, entries)}
              />
            )}
          </div>
        )
      })}
    </>
  )
}

// ── Vue Pool Mixte (Scénario C) ───────────────────────────────

function PoolMixedView({
  salles, formateurs, planning, saving,
  onAssign,
}: {
  salles: Salle[]
  formateurs: Formateur[]
  planning: PlanningFixe[]
  saving: string | null
  onAssign: (formateurId: string, jour: JourSemaine, value: string) => void
}) {
  function getSlotsPris(jour: JourSemaine, salleId: string, excludeFormateurId: string): Set<StatutFixe> {
    const pris = new Set<StatutFixe>()
    for (const p of planning) {
      if (p.formateur_id === excludeFormateurId) continue
      if (p.jour_semaine !== jour) continue
      if (p.salle_id !== salleId) continue
      if (p.statut === 'Matin' || p.statut === 'Après-midi') pris.add(p.statut)
    }
    return pris
  }

  function toutesCompletes(jour: JourSemaine, excludeId: string): boolean {
    return salles.every(s => {
      const pris = getSlotsPris(jour, s.id, excludeId)
      return pris.has('Matin') && pris.has('Après-midi')
    })
  }

  function getCurrentValue(formateurId: string, jour: JourSemaine): string {
    const p = planning.find(p => p.formateur_id === formateurId && p.jour_semaine === jour)
    if (!p) return ''
    return encodeValue(p.statut, p.salle_id)
  }

  function renderCurrentValue(value: string): React.ReactNode {
    if (!value) return <span className="text-muted-foreground/50">—</span>
    if (value === 'Distance' || value === 'Repos') return <StatutBadge statut={value as StatutFixe} />
    const { statut, salleId } = decodeValue(value)
    const salle = salles.find(s => s.id === salleId)
    return (
      <span className="flex items-center gap-1 text-xs">
        <span className="text-muted-foreground font-mono">{salle?.nom ?? '?'}</span>
        <span className="text-muted-foreground">·</span>
        <StatutBadge statut={statut} />
      </span>
    )
  }

  function getOccupationJour(jour: JourSemaine): { salle: Salle; matin: boolean; apresmidi: boolean }[] {
    return salles.map(salle => {
      const assignations = planning.filter(
        p => p.jour_semaine === jour && p.salle_id === salle.id && (p.statut === 'Matin' || p.statut === 'Après-midi')
      )
      return {
        salle,
        matin: assignations.some(p => p.statut === 'Matin'),
        apresmidi: assignations.some(p => p.statut === 'Après-midi'),
      }
    })
  }

  function countSeances(formateurId: string): number {
    return JOURS_SEMAINE.filter(j => {
      const val = getCurrentValue(formateurId, j)
      if (!val) return false
      const { statut } = val === 'Distance' || val === 'Repos' ? { statut: val as StatutFixe } : decodeValue(val)
      return STATUTS_TRAVAIL.includes(statut as StatutFixe)
    }).length
  }

  return (
    <div className="rounded-lg border bg-card">
      <div className="border-b px-4 py-3">
        <h2 className="font-semibold">Pool Mixte — Toutes salles disponibles</h2>
        <p className="text-xs text-muted-foreground">Choisissez la salle et la séance pour chaque formateur.</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-2 text-left font-medium text-muted-foreground w-44">Formateur</th>
              {JOURS_SEMAINE.map(jour => {
                const occ = getOccupationJour(jour)
                const toutesPleines = occ.every(o => o.matin && o.apresmidi)
                const isSamedi = jour === 'Samedi'
                return (
                  <th key={jour} className={`px-2 py-2 text-center font-medium text-muted-foreground min-w-[140px] ${isSamedi ? 'border-l-2 border-dashed border-muted-foreground/40' : ''}`}>
                    <div className={isSamedi ? 'text-emerald-700 font-semibold' : ''}>{jour}</div>
                    <div className="flex justify-center gap-1 mt-1">
                      {occ.map(o => (
                        <span
                          key={o.salle.id}
                          title={`${o.salle.nom} : ${o.matin ? 'Matin✓' : 'Matin○'} ${o.apresmidi ? 'PM✓' : 'PM○'}`}
                          className={`text-[9px] font-mono px-1 rounded ${
                            o.matin && o.apresmidi ? 'bg-red-100 text-red-600'
                            : (o.matin || o.apresmidi) ? 'bg-amber-100 text-amber-600'
                            : 'bg-green-100 text-green-600'
                          }`}
                        >
                          {o.salle.nom.replace('Salle ', 'S')}
                          {o.matin && o.apresmidi ? ' ✓' : o.matin ? ' M' : o.apresmidi ? ' PM' : ' ○'}
                        </span>
                      ))}
                    </div>
                    {toutesPleines && (
                      <div className="flex items-center justify-center gap-0.5 mt-0.5 text-[9px] text-red-500">
                        <Info className="h-2.5 w-2.5" /> Salles complètes
                      </div>
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody className="divide-y">
            {formateurs.map(formateur => {
              const seances = countSeances(formateur.id)
              return (
                <tr key={formateur.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-2 font-medium text-sm">
                    {formateur.nom}
                    <SeancesBadge count={seances} />
                  </td>
                  {JOURS_SEMAINE.map(jour => {
                    const key = `${formateur.id}-${jour}`
                    const currentVal = getCurrentValue(formateur.id, jour)
                    const complete = toutesCompletes(jour, formateur.id)
                    const isSamedi = jour === 'Samedi'
                    const trop = !currentVal && seances >= MAX_SEANCES

                    const optionsPhysiques: { value: string; label: string }[] = []
                    for (const salle of salles) {
                      const pris = getSlotsPris(jour, salle.id, formateur.id)
                      if (!pris.has('Matin')) optionsPhysiques.push({ value: `${salle.id}|Matin`, label: `${salle.nom} · Matin` })
                      if (!pris.has('Après-midi')) optionsPhysiques.push({ value: `${salle.id}|Après-midi`, label: `${salle.nom} · Après-midi` })
                    }

                    const dejaDistance = JOURS_SEMAINE
                      .filter(j => j !== jour)
                      .some(j => planning.find(p => p.formateur_id === formateur.id && p.jour_semaine === j)?.statut === 'Distance')

                    return (
                      <td key={jour} className={`px-2 py-2 text-center ${isSamedi ? 'border-l-2 border-dashed border-muted-foreground/40 bg-emerald-50/30' : ''}`}>
                        <Select
                          value={currentVal}
                          onValueChange={val => onAssign(formateur.id, jour, val ?? '')}
                          disabled={saving === key}
                        >
                          <SelectTrigger className="h-8 w-[150px] text-xs mx-auto">
                            <SelectValue>{renderCurrentValue(currentVal)}</SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {trop && (
                              <div className="flex items-center gap-1.5 px-3 py-2 text-xs text-orange-600 bg-orange-50 border-b">
                                <Info className="h-3 w-3 shrink-0" />
                                {seances}/{MAX_SEANCES} séances déjà atteint
                              </div>
                            )}
                            {complete && optionsPhysiques.length === 0 && (
                              <div className="flex items-center gap-1.5 px-3 py-2 text-xs text-amber-600 bg-amber-50 border-b">
                                <Info className="h-3 w-3 shrink-0" />
                                Toutes les salles physiques sont occupées
                              </div>
                            )}
                            {optionsPhysiques.map(opt => {
                              const [, statut] = opt.value.split('|')
                              return (
                                <SelectItem key={opt.value} value={opt.value}>
                                  <span className="flex items-center gap-1.5 text-xs">
                                    <span className="text-muted-foreground font-mono">{opt.label.split(' · ')[0]}</span>
                                    <span className="text-muted-foreground">·</span>
                                    <StatutBadge statut={statut as StatutFixe} />
                                  </span>
                                </SelectItem>
                              )
                            })}
                            {optionsPhysiques.length > 0 && <div className="h-px bg-border my-1" />}
                            {!dejaDistance && !isSamedi && (
                              <SelectItem value="Distance"><StatutBadge statut="Distance" /></SelectItem>
                            )}
                            <SelectItem value="Repos"><StatutBadge statut="Repos" /></SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="border-t px-4 py-2 text-xs text-muted-foreground flex items-center gap-4">
        <span className="flex items-center gap-1"><span className="bg-green-100 text-green-600 px-1 rounded font-mono text-[9px]">S○</span> Salle libre</span>
        <span className="flex items-center gap-1"><span className="bg-amber-100 text-amber-600 px-1 rounded font-mono text-[9px]">S M</span> 1 créneau pris</span>
        <span className="flex items-center gap-1"><span className="bg-red-100 text-red-600 px-1 rounded font-mono text-[9px]">S✓</span> Salle complète</span>
      </div>
    </div>
  )
}

// ── Composant principal ───────────────────────────────────────

export function PlanningFixeClient({ salles, groupes, formateurs, planningFixe, activeScenario, rotationConfig: initRotation, cycleReferences: initCycleRefs }: Props) {
  const [planning, setPlanning] = useState<PlanningFixe[]>(planningFixe)
  const [saving, setSaving] = useState<string | null>(null)
  const [rotationCfg, setRotationCfg] = useState<RotationSamediConfig[]>(initRotation)
  const [cycleRefs, setCycleRefs] = useState<CycleReference[]>(initCycleRefs)
  const now = new Date()
  const [selectedMois, setSelectedMois] = useState(now.getMonth() + 1)
  const [selectedAnnee, setSelectedAnnee] = useState(now.getFullYear())
  const supabase = createClient()

  const isPoolMixed = activeScenario?.config && 'type' in activeScenario.config && activeScenario.config.type === 'pool_mixed'

  // ── Handlers Planning Fixe ────────────────────────────────
  async function handleStatutChange(formateurId: string, jour: JourSemaine, statut: StatutFixe) {
    const key = `${formateurId}-${jour}`
    setSaving(key)
    const existing = planning.find(p => p.formateur_id === formateurId && p.jour_semaine === jour)

    const { error } = await supabase
      .from('planning_fixe')
      .upsert(
        { formateur_id: formateurId, jour_semaine: jour, statut },
        { onConflict: 'formateur_id,jour_semaine' }
      )

    if (error) { toast.error('Erreur lors de la sauvegarde'); setSaving(null); return }

    const newEntry: PlanningFixe = { id: existing?.id ?? crypto.randomUUID(), formateur_id: formateurId, jour_semaine: jour, statut, salle_id: null }
    const updatedPlanning = [
      ...planning.filter(p => !(p.formateur_id === formateurId && p.jour_semaine === jour)),
      newEntry,
    ]
    setPlanning(updatedPlanning)
    toast.success('Statut mis à jour')
    setSaving(null)

    // Auto-Repos Samedi si Mon-Ven atteint 5 séances
    if (jour !== 'Samedi') {
      const monVenCount = JOURS_MON_VEN.filter(j =>
        STATUTS_TRAVAIL.includes(
          updatedPlanning.find(p => p.formateur_id === formateurId && p.jour_semaine === j)?.statut as StatutFixe
        )
      ).length

      if (monVenCount >= MAX_SEANCES) {
        const samediEntry = updatedPlanning.find(p => p.formateur_id === formateurId && p.jour_semaine === 'Samedi')
        if (!samediEntry || samediEntry.statut !== 'Repos') {
          const { error: errSam } = await supabase
            .from('planning_fixe')
            .upsert(
              { formateur_id: formateurId, jour_semaine: 'Samedi', statut: 'Repos' },
              { onConflict: 'formateur_id,jour_semaine' }
            )
          if (!errSam) {
            setPlanning(prev => [
              ...prev.filter(p => !(p.formateur_id === formateurId && p.jour_semaine === 'Samedi')),
              { id: samediEntry?.id ?? crypto.randomUUID(), formateur_id: formateurId, jour_semaine: 'Samedi', statut: 'Repos', salle_id: null },
            ])
          }
        }
      }
    }
  }

  async function handlePoolAssign(formateurId: string, jour: JourSemaine, value: string) {
    const key = `${formateurId}-${jour}`
    setSaving(key)
    const { statut, salleId } = decodeValue(value)
    const existing = planning.find(p => p.formateur_id === formateurId && p.jour_semaine === jour)

    const { error } = await supabase
      .from('planning_fixe')
      .upsert(
        { formateur_id: formateurId, jour_semaine: jour, statut, salle_id: salleId },
        { onConflict: 'formateur_id,jour_semaine' }
      )

    if (error) { toast.error('Erreur lors de la sauvegarde') } else {
      setPlanning(prev => [
        ...prev.filter(p => !(p.formateur_id === formateurId && p.jour_semaine === jour)),
        { id: existing?.id ?? crypto.randomUUID(), formateur_id: formateurId, jour_semaine: jour, statut, salle_id: salleId },
      ])
      toast.success('Statut mis à jour')
    }
    setSaving(null)
  }

  // ── Handlers Rotation Samedi ──────────────────────────────
  async function handleRotationStatut(salleId: string, pos: SemaineCycle, formateurId: string, statut: StatutSamedi) {
    const existing = rotationCfg.find(
      c => c.salle_id === salleId && c.semaine_cycle === pos && c.formateur_id === formateurId
    )
    let error
    if (existing?.id && !existing.id.startsWith('tmp-')) {
      ;({ error } = await supabase.from('rotation_samedi_config').update({ statut }).eq('id', existing.id))
    } else {
      ;({ error } = await supabase.from('rotation_samedi_config')
        .insert({ salle_id: salleId, semaine_cycle: pos, formateur_id: formateurId, statut, groupe_id: null }))
    }
    if (error) { toast.error('Erreur lors de la sauvegarde'); return }
    setRotationCfg(prev => [
      ...prev.filter(c => !(c.salle_id === salleId && c.semaine_cycle === pos && c.formateur_id === formateurId)),
      { id: existing?.id ?? `tmp-${crypto.randomUUID()}`, salle_id: salleId, groupe_id: null, semaine_cycle: pos, formateur_id: formateurId, statut },
    ])
    toast.success('Mis à jour')
  }

  async function handleAutoRotation(salleId: string, formateursSalle: Formateur[]) {
    const mois1 = formateursSalle.map(f => ({
      formateur_id: f.id,
      statut: (rotationCfg.find(c => c.salle_id === salleId && c.semaine_cycle === 1 && c.formateur_id === f.id)?.statut ?? 'Repos') as StatutSamedi,
    }))
    const mois2 = mois1.map(e => ({ formateur_id: e.formateur_id, statut: ROTATION_SUIVANTE[e.statut] }))
    const mois3 = mois2.map(e => ({ formateur_id: e.formateur_id, statut: ROTATION_SUIVANTE[e.statut] }))
    await supabase.from('rotation_samedi_config').delete().eq('salle_id', salleId).in('semaine_cycle', [2, 3])
    const rows = [
      ...mois2.map(e => ({ salle_id: salleId, groupe_id: null, semaine_cycle: 2 as SemaineCycle, formateur_id: e.formateur_id, statut: e.statut })),
      ...mois3.map(e => ({ salle_id: salleId, groupe_id: null, semaine_cycle: 3 as SemaineCycle, formateur_id: e.formateur_id, statut: e.statut })),
    ]
    const { error } = await supabase.from('rotation_samedi_config').insert(rows)
    if (error) { toast.error('Erreur lors de la génération'); return }
    setRotationCfg(prev => [
      ...prev.filter(c => !(c.salle_id === salleId && (c.semaine_cycle === 2 || c.semaine_cycle === 3))),
      ...rows.map(r => ({ ...r, id: `tmp-${crypto.randomUUID()}` })),
    ])
    toast.success('Mois 2 et 3 générés automatiquement')
  }

  async function handleAncrageSave(salleId: string, dateAncrage: string, moisCycleAncrage: SemaineCycle) {
    const existing = cycleRefs.find(c => c.salle_id === salleId)
    let error
    if (existing?.id && !existing.id.startsWith('tmp-')) {
      ;({ error } = await supabase.from('cycle_reference')
        .update({ date_ancrage: dateAncrage, semaine_cycle_ancrage: moisCycleAncrage })
        .eq('id', existing.id))
    } else {
      ;({ error } = await supabase.from('cycle_reference')
        .insert({ salle_id: salleId, date_ancrage: dateAncrage, semaine_cycle_ancrage: moisCycleAncrage, groupe_id: null }))
    }
    if (error) { toast.error("Erreur lors de la sauvegarde de l'ancrage"); return }
    setCycleRefs(prev => [
      ...prev.filter(c => c.salle_id !== salleId),
      { id: existing?.id ?? `tmp-${crypto.randomUUID()}`, salle_id: salleId, groupe_id: null, date_ancrage: dateAncrage, semaine_cycle_ancrage: moisCycleAncrage },
    ])
    toast.success('Ancrage mis à jour')
  }

  // Applique la rotation du mois sélectionné sur la colonne Samedi du planning fixe
  async function handleApplyRotation(_salleId: string, entries: { formateurId: string; statut: StatutSamedi }[]) {
    await Promise.all(entries.map(({ formateurId, statut }) =>
      handleStatutChange(formateurId, 'Samedi', statut as StatutFixe)
    ))
    toast.success(`Rotation Samedi (${MOIS_LABELS[selectedMois - 1]}) appliquée au planning`)
  }

  const annees = [selectedAnnee - 1, selectedAnnee, selectedAnnee + 1]

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <PageHeader
              icon={CalendarDays}
              title="Planning fixe Lundi–Samedi"
              subtitle={
                isPoolMixed
                  ? 'Scénario C actif — Pool mixte : tous les formateurs peuvent être affectés à n\'importe quelle salle.'
                  : 'Planning permanent — 5 séances/semaine par formateur. Samedi en rotation mensuelle.'
              }
              badge={isPoolMixed ? 'Pool mixte' : 'Fixe'}
            />
          </div>
          {/* Sélecteur mois/année pour le panneau Rotation Samedi */}
          <div className="flex items-center gap-2 shrink-0 mt-1">
            <RotateCcw className="h-4 w-4 text-muted-foreground/60" />
            <span className="text-xs text-muted-foreground">Mois rotation :</span>
            <Select value={String(selectedMois)} onValueChange={v => setSelectedMois(Number(v))}>
              <SelectTrigger className="h-7 w-[110px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MOIS_LABELS.map((label, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)} className="text-xs">{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={String(selectedAnnee)} onValueChange={v => setSelectedAnnee(Number(v))}>
              <SelectTrigger className="h-7 w-[80px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {annees.map(a => (
                  <SelectItem key={a} value={String(a)} className="text-xs">{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {activeScenario && (
          <div className={`mt-2 text-xs px-3 py-1.5 rounded inline-flex items-center gap-2 ${
            isPoolMixed ? 'bg-purple-50 text-purple-700 border border-purple-200' : 'bg-blue-50 text-blue-700 border border-blue-200'
          }`}>
            Scénario actif : <strong>{activeScenario.nom}</strong>
          </div>
        )}
        <PageDivider />
      </div>

      {isPoolMixed ? (
        <PoolMixedView
          salles={salles}
          formateurs={formateurs}
          planning={planning}
          saving={saving}
          onAssign={handlePoolAssign}
        />
      ) : (
        <StandardView
          salles={salles}
          groupes={groupes}
          formateurs={formateurs}
          planning={planning}
          saving={saving}
          onStatutChange={handleStatutChange}
          rotationConfig={rotationCfg}
          cycleReferences={cycleRefs}
          previewAnnee={selectedAnnee}
          previewMois={selectedMois}
          onRotationStatut={handleRotationStatut}
          onAutoRotation={handleAutoRotation}
          onAncrageSave={handleAncrageSave}
          onApplyRotation={handleApplyRotation}
        />
      )}
    </div>
  )
}
