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
import { JOURS_SEMAINE, STATUTS_FIXES, STATUT_TIMES } from '@/types/planning'
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
const STATUTS_TRAVAIL: StatutFixe[] = [
  'Matin FP S1', 'Matin FP S2', 'Après-midi FP S1', 'Après-midi FP S2',
  'FAD Matin', 'FAD Après-midi',
  'Matin', 'Après-midi', 'Distance', 'Distance Matin', 'Distance Après-midi', // legacy
]
// Statuts physiques (occupent la salle)
const STATUTS_PHYSIQUES_FP: StatutFixe[] = ['Matin FP S1', 'Matin FP S2', 'Après-midi FP S1', 'Après-midi FP S2']
const MAX_SEANCES = 10      // 5 jours × 2 sous-séances/jour
const JOURS_MON_VEN: JourSemaine[] = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi']
// 6 jours × 4 sous-créneaux (MS1, MS2, PMS1, PMS2) = 24 sous-créneaux max par salle
const MAX_CRENEAUX_SALLE = 24

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

// Groupes de formation (non techniques : salle_id IS NULL)
function isGroupeFormation(g: Groupe) { return !g.salle_id }

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
  if (statut === 'Distance' || statut === 'Distance Matin' || statut === 'Distance Après-midi' || statut === 'Repos') return statut
  return salleId ? `${salleId}|${statut}` : statut
}

function decodeValue(value: string): { statut: StatutFixe; salleId: string | null } {
  if (value === 'Distance' || value === 'Distance Matin' || value === 'Distance Après-midi' || value === 'Repos')
    return { statut: value as StatutFixe, salleId: null }
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
  onAddSubSession, onRemoveSubSession, onGroupeChange, groupesFormation,
  rotationConfig, cycleReferences, previewAnnee, previewMois,
  onRotationStatut, onAutoRotation, onAncrageSave, onApplyRotation,
}: {
  salles: Salle[]
  groupes: Groupe[]
  formateurs: Formateur[]
  planning: PlanningFixe[]
  saving: Set<string>
  onAddSubSession: (formateurId: string, jour: JourSemaine, statut: StatutFixe) => void
  onRemoveSubSession: (rowId: string) => void
  onGroupeChange: (rowId: string, groupeId: string | null) => void
  groupesFormation: Groupe[]
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

  // Toutes les sous-séances actives d'un formateur pour un jour
  function getActiveRows(formateurId: string, jour: JourSemaine): PlanningFixe[] {
    return planning.filter(p => p.formateur_id === formateurId && p.jour_semaine === jour)
  }

  // Nombre total de sous-séances travaillées Lun-Ven
  function countSeancesMonVen(formateurId: string): number {
    return planning.filter(p =>
      p.formateur_id === formateurId &&
      JOURS_MON_VEN.includes(p.jour_semaine as JourSemaine) &&
      STATUTS_TRAVAIL.includes(p.statut)
    ).length
  }

  // Nombre total de sous-séances travaillées toute la semaine
  function countSeances(formateurId: string): number {
    return planning.filter(p =>
      p.formateur_id === formateurId &&
      STATUTS_TRAVAIL.includes(p.statut)
    ).length
  }

  // Taux d'occupation : sous-créneaux physiques FP saisis / 24
  function getOccupationSalle(formateursSalle: Formateur[]): number {
    const slots = new Set<string>()
    for (const p of planning) {
      if (
        formateursSalle.some(f => f.id === p.formateur_id) &&
        STATUTS_PHYSIQUES_FP.includes(p.statut)
      ) {
        slots.add(`${p.jour_semaine}-${p.statut}`)
      }
    }
    return slots.size
  }

  // Groupes disponibles / indisponibles pour une sous-séance spécifique
  function getGroupesParDisponibilite(
    formateurId: string, jour: JourSemaine, statut: StatutFixe, sallePoleId: string | null
  ): { disponibles: Groupe[]; indisponibles: Groupe[] } {
    // Exclusivité par statut exact (chaque sous-créneau est indépendant)
    const prisIds = new Set(
      planning
        .filter(p =>
          p.formateur_id !== formateurId &&
          p.jour_semaine === jour &&
          p.statut === statut &&
          p.groupe_formation_id
        )
        .map(p => p.groupe_formation_id!)
    )
    const allGroupes = groupesFormation.filter(g =>
      !sallePoleId || !g.pole_id || g.pole_id === sallePoleId
    )
    return {
      disponibles: allGroupes.filter(g => !prisIds.has(g.id)),
      indisponibles: allGroupes.filter(g => prisIds.has(g.id)),
    }
  }

  // Demi-journée d'un statut (pour exclusivité matin / après-midi)
  function getHalfDay(s: StatutFixe): 'matin' | 'apresmidi' | null {
    if (['Matin FP S1','Matin FP S2','FAD Matin','Matin','Distance Matin'].includes(s)) return 'matin'
    if (['Après-midi FP S1','Après-midi FP S2','FAD Après-midi','Après-midi','Distance Après-midi'].includes(s)) return 'apresmidi'
    return null
  }

  // Statuts disponibles à ajouter pour ce formateur ce jour
  function getStatutsDisponibles(formateurId: string, jour: JourSemaine, formateursSalle: Formateur[]): StatutFixe[] {
    const dejaActifs = new Set(
      planning
        .filter(p => p.formateur_id === formateurId && p.jour_semaine === jour)
        .map(p => p.statut)
    )
    const prisParSalle = new Set(
      planning
        .filter(p =>
          p.formateur_id !== formateurId &&
          formateursSalle.some(f => f.id === p.formateur_id) &&
          p.jour_semaine === jour
        )
        .map(p => p.statut)
    )

    if (countSeances(formateurId) >= MAX_SEANCES) return []

    // Demi-journée déjà commencée → filtrer par cohérence
    const demiJourneeActive = [...dejaActifs]
      .map(getHalfDay)
      .find(h => h !== null) ?? null

    const isSamedi = jour === 'Samedi'

    return STATUTS_FIXES.filter(s => {
      if (dejaActifs.has(s)) return false
      if (prisParSalle.has(s)) return false
      if (isSamedi && (s === 'FAD Matin' || s === 'FAD Après-midi')) return false
      // Si une demi-journée est déjà active, n'offrir que ses sous-séances
      if (demiJourneeActive) {
        const sHalf = getHalfDay(s)
        if (sHalf && sHalf !== demiJourneeActive) return false
      }
      return true
    })
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
                      const isSamedi  = jour === 'Samedi'
                      return (
                        <th key={jour} className={`px-1 py-1.5 text-center font-medium text-muted-foreground min-w-[110px] ${isSamedi ? 'border-l-2 border-dashed border-muted-foreground/40' : ''}`}>
                          <div className={`text-xs font-medium ${isSamedi ? 'text-emerald-700 font-semibold' : ''}`}>{jour}</div>
                          {/* Indicateurs 4 sous-créneaux */}
                          <div className="flex justify-center gap-0.5 mt-0.5 flex-wrap">
                            {(['Matin FP S1','Matin FP S2','Après-midi FP S1','Après-midi FP S2'] as StatutFixe[]).map(s => {
                              const pris = formateursSalle.some(f => planning.some(p => p.formateur_id === f.id && p.jour_semaine === jour && p.statut === s))
                              const short = s === 'Matin FP S1' ? 'MS1' : s === 'Matin FP S2' ? 'MS2' : s === 'Après-midi FP S1' ? 'PS1' : 'PS2'
                              return (
                                <span key={s} title={`${s}${pris ? ' — pris' : ' — libre'}`}
                                  className={`text-[7px] font-mono px-0.5 rounded ${pris ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                                  {short}
                                </span>
                              )
                            })}
                          </div>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {formateursSalle.map(formateur => {
                    const monVenCount = countSeancesMonVen(formateur.id)
                    const seances     = countSeances(formateur.id)
                    const samediAuto  = monVenCount >= MAX_SEANCES // 10 sous-séances Lun-Ven = quota plein

                    return (
                      <tr key={formateur.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-3 py-1.5 font-medium text-sm leading-tight">
                          <div className="flex items-center gap-1 flex-wrap">
                            <span className="truncate max-w-[100px]">{formateur.nom}</span>
                            <SeancesBadge count={seances} />
                          </div>
                        </td>
                        {JOURS_SEMAINE.map(jour => {
                          const isSamedi   = jour === 'Samedi'
                          const activeRows = getActiveRows(formateur.id, jour)
                          const canAdd     = seances < MAX_SEANCES

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

                          // Bloc Matin FP pris par un AUTRE formateur de la même salle
                          const matinFPPris = formateursSalle.some(f =>
                            f.id !== formateur.id && planning.some(p =>
                              p.formateur_id === f.id && p.jour_semaine === jour &&
                              (p.statut === 'Matin FP S1' || p.statut === 'Matin FP S2')
                            ))
                          // Bloc PM FP pris par un AUTRE formateur
                          const pmFPPris = formateursSalle.some(f =>
                            f.id !== formateur.id && planning.some(p =>
                              p.formateur_id === f.id && p.jour_semaine === jour &&
                              (p.statut === 'Après-midi FP S1' || p.statut === 'Après-midi FP S2')
                            ))

                          // Rows de ce formateur par sous-créneau
                          const ms1 = activeRows.find(r => r.statut === 'Matin FP S1')
                          const ms2 = activeRows.find(r => r.statut === 'Matin FP S2')
                          const ps1 = activeRows.find(r => r.statut === 'Après-midi FP S1')
                          const ps2 = activeRows.find(r => r.statut === 'Après-midi FP S2')
                          const fadM = activeRows.find(r => r.statut === 'FAD Matin')
                          const fadP = activeRows.find(r => r.statut === 'FAD Après-midi')

                          const hasMatinBlock = !!(ms1 || ms2)
                          const hasPmBlock    = !!(ps1 || ps2)
                          const hasFadMatin   = !!fadM
                          const hasFadPm      = !!fadP

                          // Helper: rendu d'un slot avec groupe
                          const renderSlot = (row: PlanningFixe | undefined, statut: StatutFixe, showAdd: boolean, borderClass: string) => {
                            const { disponibles: gDispo, indisponibles: gIndispo } = row
                              ? getGroupesParDisponibilite(formateur.id, jour, statut, salle.pole_id)
                              : { disponibles: [] as Groupe[], indisponibles: [] as Groupe[] }
                            const groupeNom = row ? groupesFormation.find(g => g.id === row.groupe_formation_id)?.nom : undefined
                            const time = STATUT_TIMES[statut]

                            if (!row && !showAdd) return null
                            return (
                              <div key={statut} className={`px-1.5 py-1 ${borderClass}`}>
                                {row ? (
                                  <>
                                    <div className="flex items-center gap-1 mb-0.5">
                                      {time && <span className="text-[8px] text-muted-foreground/70 font-mono">{time}</span>}
                                      <button
                                        onClick={() => onRemoveSubSession(row.id)}
                                        className="ml-auto text-muted-foreground/30 hover:text-red-500 text-[11px] leading-none transition-colors"
                                        title="Supprimer"
                                      >×</button>
                                    </div>
                                    <Select
                                      value={row.groupe_formation_id ?? '__none__'}
                                      onValueChange={val => onGroupeChange(row.id, val === '__none__' ? null : val)}
                                    >
                                      <SelectTrigger className={`h-5 w-full text-[9px] px-1 border-dashed ${row.groupe_formation_id ? 'border-solid border-primary/30 bg-primary/5' : 'text-muted-foreground/40'}`}>
                                        <SelectValue>
                                          {groupeNom
                                            ? <span className="font-semibold text-primary/80">{groupeNom}</span>
                                            : <span className="italic">Groupe…</span>
                                          }
                                        </SelectValue>
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="__none__" className="text-xs italic text-muted-foreground">— Aucun —</SelectItem>
                                        {gDispo.length === 0 && gIndispo.length === 0 && (
                                          <div className="px-3 py-2 text-xs text-muted-foreground italic">
                                            {salle.pole_id ? 'Aucun groupe pour ce pôle' : 'Aucun groupe disponible'}
                                          </div>
                                        )}
                                        {gDispo.length > 0 && <div className="h-px bg-border my-1" />}
                                        {gDispo.map(g => <SelectItem key={g.id} value={g.id} className="text-xs font-medium">{g.nom}</SelectItem>)}
                                        {gIndispo.length > 0 && (
                                          <>
                                            <div className="h-px bg-border mt-1" />
                                            <div className="px-2 py-1 flex items-center gap-1 text-[9px] font-semibold text-rose-500/80 uppercase">
                                              <Info className="h-2.5 w-2.5" /> Non disponibles
                                            </div>
                                            {gIndispo.map(g => <SelectItem key={g.id} value={g.id} disabled className="text-xs line-through text-muted-foreground/40">{g.nom}</SelectItem>)}
                                          </>
                                        )}
                                      </SelectContent>
                                    </Select>
                                  </>
                                ) : (
                                  <button
                                    onClick={() => onAddSubSession(formateur.id, jour, statut)}
                                    className="w-full text-[9px] text-muted-foreground/50 hover:text-primary/70 py-0.5 text-left transition-colors flex items-center gap-1"
                                  >
                                    <span className="text-[10px]">＋</span>
                                    <span>{time}</span>
                                  </button>
                                )}
                              </div>
                            )
                          }

                          return (
                            <td key={jour} className={`px-0.5 py-1 align-top min-w-[120px] ${isSamedi ? 'border-l-2 border-dashed border-muted-foreground/40 bg-emerald-50/30' : ''}`}>
                              <div className="flex flex-col gap-1">

                                {/* ── BLOC MATIN FP ── */}
                                {(hasMatinBlock || (!matinFPPris && !hasFadMatin && !hasFadPm && canAdd)) && (
                                  <div className="rounded border border-blue-200 bg-blue-50/30 overflow-hidden">
                                    <div className="px-1.5 py-0.5 bg-blue-100/60 text-[9px] font-semibold text-blue-700 uppercase tracking-wide">
                                      {salleLabel} · Matin FP
                                    </div>
                                    {renderSlot(ms1, 'Matin FP S1', !matinFPPris && canAdd, 'border-b border-blue-100')}
                                    {(ms1 || ms2) && renderSlot(ms2, 'Matin FP S2', !matinFPPris && canAdd && !!ms1, '')}
                                  </div>
                                )}

                                {/* ── BLOC APRÈS-MIDI FP ── */}
                                {(hasPmBlock || (!pmFPPris && !hasFadMatin && !hasFadPm && canAdd)) && (
                                  <div className="rounded border border-amber-200 bg-amber-50/30 overflow-hidden">
                                    <div className="px-1.5 py-0.5 bg-amber-100/60 text-[9px] font-semibold text-amber-700 uppercase tracking-wide">
                                      {salleLabel} · Après-midi FP
                                    </div>
                                    {renderSlot(ps1, 'Après-midi FP S1', !pmFPPris && canAdd, 'border-b border-amber-100')}
                                    {(ps1 || ps2) && renderSlot(ps2, 'Après-midi FP S2', !pmFPPris && canAdd && !!ps1, '')}
                                  </div>
                                )}

                                {/* ── BLOC FAD ── */}
                                {!isSamedi && (hasFadMatin || hasFadPm || (!hasMatinBlock && !hasPmBlock && canAdd)) && (
                                  <div className="rounded border border-violet-200 bg-violet-50/20 overflow-hidden">
                                    <div className="px-1.5 py-0.5 bg-violet-100/50 text-[9px] font-semibold text-violet-700 uppercase tracking-wide">FAD</div>
                                    {renderSlot(fadM, 'FAD Matin', canAdd && !hasFadPm, 'border-b border-violet-100')}
                                    {renderSlot(fadP, 'FAD Après-midi', canAdd && !hasFadMatin, '')}
                                  </div>
                                )}

                                {/* Repos implicite */}
                                {activeRows.length === 0 && (
                                  <div className="flex justify-center pt-0.5">
                                    <StatutBadge statut="Repos" className="text-[10px]" />
                                  </div>
                                )}

                                {!canAdd && activeRows.length === 0 && (
                                  <div className="text-[8px] text-orange-400 text-center">{seances}/{MAX_SEANCES}</div>
                                )}
                              </div>
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
  saving: Set<string>
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
    if (value === 'Distance' || value === 'Distance Matin' || value === 'Distance Après-midi' || value === 'Repos') return <StatutBadge statut={value as StatutFixe} />
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
                      .some(j => {
                        const st = planning.find(p => p.formateur_id === formateur.id && p.jour_semaine === j)?.statut
                        return st === 'Distance' || st === 'Distance Matin' || st === 'Distance Après-midi'
                      })

                    return (
                      <td key={jour} className={`px-2 py-2 text-center ${isSamedi ? 'border-l-2 border-dashed border-muted-foreground/40 bg-emerald-50/30' : ''}`}>
                        <Select
                          value={currentVal}
                          onValueChange={val => onAssign(formateur.id, jour, val ?? '')}
                          disabled={saving.has(key)}
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
                              <>
                                <SelectItem value="Distance Matin"><StatutBadge statut="Distance Matin" /></SelectItem>
                                <SelectItem value="Distance Après-midi"><StatutBadge statut="Distance Après-midi" /></SelectItem>
                              </>
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
  const groupesFormation = groupes.filter(isGroupeFormation)
  const [planning, setPlanning] = useState<PlanningFixe[]>(planningFixe)
  const [saving, setSaving] = useState<Set<string>>(new Set())
  const [rotationCfg, setRotationCfg] = useState<RotationSamediConfig[]>(initRotation)
  const [cycleRefs, setCycleRefs] = useState<CycleReference[]>(initCycleRefs)
  const now = new Date()
  const [selectedMois, setSelectedMois] = useState(now.getMonth() + 1)
  const [selectedAnnee, setSelectedAnnee] = useState(now.getFullYear())
  const supabase = createClient()

  const isPoolMixed = activeScenario?.config && 'type' in activeScenario.config && activeScenario.config.type === 'pool_mixed'

  function addSaving(key: string) { setSaving(prev => new Set(prev).add(key)) }
  function delSaving(key: string) { setSaving(prev => { const n = new Set(prev); n.delete(key); return n }) }

  // ── Handlers Planning Fixe ────────────────────────────────
  async function handleAddSubSession(formateurId: string, jour: JourSemaine, statut: StatutFixe) {
    const key = `${formateurId}-${jour}-${statut}`
    addSaving(key)

    const { data, error } = await supabase
      .from('planning_fixe')
      .insert({ formateur_id: formateurId, jour_semaine: jour, statut, groupe_formation_id: null, salle_id: null })
      .select()
      .single()

    if (error) { toast.error('Erreur lors de la sauvegarde'); delSaving(key); return }

    const updated = [...planning, data as PlanningFixe]
    setPlanning(updated)
    toast.success('Sous-séance ajoutée')
    delSaving(key)

    // Auto-Repos Samedi si Mon-Ven atteint le quota
    if (jour !== 'Samedi') {
      const monVenCount = updated.filter(p =>
        p.formateur_id === formateurId &&
        JOURS_MON_VEN.includes(p.jour_semaine as JourSemaine) &&
        STATUTS_TRAVAIL.includes(p.statut)
      ).length
      if (monVenCount >= MAX_SEANCES) {
        // Supprimer toutes les sous-séances du Samedi pour ce formateur
        const samediRows = updated.filter(p => p.formateur_id === formateurId && p.jour_semaine === 'Samedi')
        for (const row of samediRows) {
          await supabase.from('planning_fixe').delete().eq('id', row.id)
        }
        if (samediRows.length > 0) {
          setPlanning(prev => prev.filter(p => !(p.formateur_id === formateurId && p.jour_semaine === 'Samedi')))
        }
      }
    }
  }

  async function handleRemoveSubSession(rowId: string) {
    const row = planning.find(p => p.id === rowId)
    if (!row) return
    const key = `${row.formateur_id}-${row.jour_semaine}-${row.statut}`
    addSaving(key)

    const { error } = await supabase.from('planning_fixe').delete().eq('id', rowId)
    if (error) { toast.error('Erreur lors de la suppression'); delSaving(key); return }

    setPlanning(prev => prev.filter(p => p.id !== rowId))
    delSaving(key)
  }

  async function handlePoolAssign(formateurId: string, jour: JourSemaine, value: string) {
    const key = `${formateurId}-${jour}`
    addSaving(key)
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
        { id: existing?.id ?? crypto.randomUUID(), formateur_id: formateurId, jour_semaine: jour, statut, salle_id: salleId, groupe_formation_id: null },
      ])
      toast.success('Statut mis à jour')
    }
    delSaving(key)
  }

  async function handleGroupeChange(rowId: string, groupeId: string | null) {
    const { error } = await supabase
      .from('planning_fixe')
      .update({ groupe_formation_id: groupeId })
      .eq('id', rowId)

    if (error) { toast.error('Erreur lors de la sauvegarde du groupe'); return }

    setPlanning(prev => prev.map(p => p.id === rowId ? { ...p, groupe_formation_id: groupeId } : p))
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
    // Map legacy rotation statuts vers nouveaux sous-créneaux (S1 par défaut)
    const statutMap: Record<StatutSamedi, StatutFixe> = {
      'Matin': 'Matin FP S1',
      'Après-midi': 'Après-midi FP S1',
      'Repos': 'Repos',
    }
    for (const { formateurId, statut } of entries) {
      if (statut === 'Repos') continue
      // Supprimer les séances Samedi existantes
      const existing = planning.filter(p => p.formateur_id === formateurId && p.jour_semaine === 'Samedi')
      for (const row of existing) {
        await supabase.from('planning_fixe').delete().eq('id', row.id)
      }
      setPlanning(prev => prev.filter(p => !(p.formateur_id === formateurId && p.jour_semaine === 'Samedi')))
      // Ajouter la nouvelle sous-séance
      await handleAddSubSession(formateurId, 'Samedi', statutMap[statut])
    }
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
              title="Planning Hebdomadaire"
              subtitle={
                isPoolMixed
                  ? 'Scénario C actif — Pool mixte : tous les formateurs peuvent être affectés à n\'importe quelle salle.'
                  : '5 séances/semaine par formateur · Lun–Ven fixe · Samedi par rotation mensuelle (panneau ⚙ par salle)'
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
          onAddSubSession={handleAddSubSession}
          onRemoveSubSession={handleRemoveSubSession}
          onGroupeChange={handleGroupeChange}
          groupesFormation={groupesFormation}
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
