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
import { CalendarDays, Info, RotateCcw, Wand2, ChevronDown, ChevronUp, Settings2 } from 'lucide-react'
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

interface Props {
  salles: Salle[]
  groupes: Groupe[]
  formateurs: Formateur[]
  planningFixe: PlanningFixe[]
  activeScenario: Scenario | null
  rotationConfig: RotationSamediConfig[]
  cycleReferences: CycleReference[]
}

// Calcule le statut Samedi d'un formateur pour un mois donné
function getSamediStatut(
  formateurId: string,
  salleId: string,
  annee: number,
  mois: number,
  rotationConfig: RotationSamediConfig[],
  cycleReferences: CycleReference[]
): StatutSamedi | undefined {
  const ref = cycleReferences.find(c => c.salle_id === salleId)
  if (!ref) return undefined
  const ancrage = parseISODate(ref.date_ancrage)
  const pos = getMoisCycle(annee, mois, ancrage, ref.semaine_cycle_ancrage as SemaineCycle)
  return rotationConfig.find(
    c => c.salle_id === salleId && c.semaine_cycle === pos && c.formateur_id === formateurId
  )?.statut
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
  onStatutChange, onAutoRotation, onAncrageSave,
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
}) {
  function getCfg(pos: SemaineCycle, formateurId: string) {
    return rotationConfig.find(
      c => c.salle_id === salle.id && c.semaine_cycle === pos && c.formateur_id === formateurId
    )
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
      {/* Ancrage */}
      <AncragEditor ref_={cycleRef} onSave={(d, p) => onAncrageSave(salle.id, d, p)} />

      {/* Tableau cycle */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Cycle mensuel — 3 mois</p>
          <Button size="sm" variant="outline" className="h-6 text-xs gap-1"
            onClick={() => onAutoRotation(salle.id, formateursSalle)}>
            <Wand2 className="h-3 w-3" /> Auto-générer Mois 2 &amp; 3
          </Button>
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

      {/* Prévisualisation */}
      {cycleRef && preview.length > 0 && (
        <div className="border-t px-4 py-3">
          <div className="text-xs text-muted-foreground mb-2">
            <span className="font-medium">{MOIS_LABELS[previewMois - 1]} {previewAnnee}</span>
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

// Encode une affectation pool_mixed comme "{salleId}|{statut}" ou juste "Distance"/"Repos"
function encodeValue(statut: StatutFixe, salleId: string | null): string {
  if (statut === 'Distance' || statut === 'Repos') return statut
  return salleId ? `${salleId}|${statut}` : statut
}

function decodeValue(value: string): { statut: StatutFixe; salleId: string | null } {
  if (value === 'Distance' || value === 'Repos') return { statut: value as StatutFixe, salleId: null }
  const [salleId, statut] = value.split('|')
  return { statut: statut as StatutFixe, salleId }
}

// ── Vue standard (Scénario A / B) ────────────────────────────

function StandardView({
  salles, groupes, formateurs, planning, saving,
  onStatutChange, getSamedi,
  rotationConfig, cycleReferences, previewAnnee, previewMois,
  onRotationStatut, onAutoRotation, onAncrageSave,
}: {
  salles: Salle[]
  groupes: Groupe[]
  formateurs: Formateur[]
  planning: PlanningFixe[]
  saving: string | null
  onStatutChange: (formateurId: string, jour: JourSemaine, statut: StatutFixe) => void
  getSamedi: (formateurId: string, salleId: string) => StatutSamedi | undefined
  rotationConfig: RotationSamediConfig[]
  cycleReferences: CycleReference[]
  previewAnnee: number
  previewMois: number
  onRotationStatut: (salleId: string, pos: SemaineCycle, formateurId: string, statut: StatutSamedi) => void
  onAutoRotation: (salleId: string, formateursSalle: Formateur[]) => void
  onAncrageSave: (salleId: string, date: string, pos: SemaineCycle) => void
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

  function getStatutsDisponibles(formateurId: string, jour: JourSemaine, formateursSalle: Formateur[]): StatutFixe[] {
    const indisponibles = new Set<StatutFixe>()

    // Matin/Après-midi : déjà pris par un autre formateur de la même salle ce jour
    for (const f of formateursSalle) {
      if (f.id === formateurId) continue
      const s = getStatut(f.id, jour)
      if (s === 'Matin' || s === 'Après-midi') indisponibles.add(s)
    }

    // Distance : max 1 fois par semaine pour ce formateur
    const dejaDistance = JOURS_SEMAINE
      .filter(j => j !== jour)
      .some(j => getStatut(formateurId, j) === 'Distance')
    if (dejaDistance) indisponibles.add('Distance')

    return STATUTS_FIXES.filter(s => !indisponibles.has(s as StatutFixe)) as StatutFixe[]
  }

  return (
    <>
      {salles.map(salle => {
        const groupe = groupes.find(g => g.salle_id === salle.id)
        // Fallback : si aucun groupe lié à la salle, afficher par pole_id
        const formateursSalle = groupe
          ? formateurs.filter(f => f.groupe_id === groupe.id)
          : formateurs.filter(f => salle.pole_id && f.pole_id === salle.pole_id)
        const salleLabel = salle.nom.replace('Salle ', 'S')

        return (
          <div key={salle.id} className="rounded-lg border bg-card">
            <div className="border-b px-4 py-3 flex items-center justify-between">
              <div>
                <h2 className="font-semibold">{salle.nom}</h2>
                {groupe && <p className="text-xs text-muted-foreground">{groupe.nom}</p>}
              </div>
              <Button
                size="sm" variant="outline"
                className={`h-7 text-xs gap-1.5 ${expandedSalles.has(salle.id) ? 'bg-muted' : ''}`}
                onClick={() => toggleRotation(salle.id)}
              >
                <Settings2 className="h-3.5 w-3.5" />
                Rotation Samedi
                {expandedSalles.has(salle.id) ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground w-36">Formateur</th>
                    {JOURS_SEMAINE.map(jour => {
                      const matinPris = formateursSalle.some(f => getStatut(f.id, jour) === 'Matin')
                      const pmPris    = formateursSalle.some(f => getStatut(f.id, jour) === 'Après-midi')
                      const complete  = matinPris && pmPris
                      return (
                        <th key={jour} className="px-2 py-2 text-center font-medium text-muted-foreground min-w-[140px]">
                          <div>{jour}</div>
                          <div className="flex justify-center mt-1">
                            <span
                              title={`${salle.nom} : ${matinPris ? 'Matin✓' : 'Matin○'} ${pmPris ? 'PM✓' : 'PM○'}`}
                              className={`text-[9px] font-mono px-1 rounded ${
                                complete ? 'bg-red-100 text-red-600'
                                : (matinPris || pmPris) ? 'bg-amber-100 text-amber-600'
                                : 'bg-green-100 text-green-600'
                              }`}
                            >
                              {salleLabel}{complete ? ' ✓' : matinPris ? ' M' : pmPris ? ' PM' : ' ○'}
                            </span>
                          </div>
                          {complete && (
                            <div className="flex items-center justify-center gap-0.5 mt-0.5 text-[9px] text-red-500">
                              <Info className="h-2.5 w-2.5" /> Salle complète
                            </div>
                          )}
                        </th>
                      )
                    })}
                    {/* Colonne Samedi — rotation */}
                    <th className="px-2 py-2 text-center font-medium text-muted-foreground min-w-[130px] border-l border-dashed border-muted-foreground/30">
                      <div className="flex items-center justify-center gap-1">
                        <RotateCcw className="h-3 w-3 text-muted-foreground/60" />
                        Samedi
                      </div>
                      <div className="text-[9px] text-muted-foreground/60 mt-0.5">Rotation mensuelle</div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {formateursSalle.map(formateur => {
                    const samediStatut = getSamedi(formateur.id, salle.id)
                    return (
                      <tr key={formateur.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-2 font-medium">{formateur.nom}</td>
                        {JOURS_SEMAINE.map(jour => {
                          const statut     = getStatut(formateur.id, jour)
                          const key        = `${formateur.id}-${jour}`
                          const disponibles = getStatutsDisponibles(formateur.id, jour, formateursSalle)
                          const physiques  = disponibles.filter(s => s === 'Matin' || s === 'Après-midi')
                          const autres     = disponibles.filter(s => s !== 'Matin' && s !== 'Après-midi')
                          const salleComplete = formateursSalle.some(f => f.id !== formateur.id && getStatut(f.id, jour) === 'Matin')
                                            && formateursSalle.some(f => f.id !== formateur.id && getStatut(f.id, jour) === 'Après-midi')
                          return (
                            <td key={jour} className="px-2 py-2 text-center">
                              <Select
                                value={statut ?? ''}
                                onValueChange={val => onStatutChange(formateur.id, jour, val as StatutFixe)}
                                disabled={saving === key}
                              >
                                <SelectTrigger className="h-8 w-[150px] text-xs mx-auto">
                                  <SelectValue placeholder="—">
                                    {statut
                                      ? (statut === 'Distance' || statut === 'Repos')
                                        ? <StatutBadge statut={statut} />
                                        : <span className="flex items-center gap-1 text-xs">
                                            <span className="text-muted-foreground font-mono">{salle.nom}</span>
                                            <span className="text-muted-foreground">·</span>
                                            <StatutBadge statut={statut} />
                                          </span>
                                      : <span className="text-muted-foreground/50">—</span>
                                    }
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  {salleComplete && physiques.length === 0 && (
                                    <div className="flex items-center gap-1.5 px-3 py-2 text-xs text-amber-600 bg-amber-50 border-b">
                                      <Info className="h-3 w-3 shrink-0" />
                                      {salle.nom} non disponible
                                    </div>
                                  )}
                                  {physiques.map(s => (
                                    <SelectItem key={s} value={s}>
                                      <span className="flex items-center gap-1.5 text-xs">
                                        <span className="text-muted-foreground font-mono">{salle.nom}</span>
                                        <span className="text-muted-foreground">·</span>
                                        <StatutBadge statut={s} />
                                      </span>
                                    </SelectItem>
                                  ))}
                                  {physiques.length > 0 && autres.length > 0 && (
                                    <div className="h-px bg-border my-1" />
                                  )}
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
                        {/* Cellule Samedi (lecture seule) */}
                        <td className="px-2 py-2 text-center border-l border-dashed border-muted-foreground/30">
                          {samediStatut
                            ? <StatutBadge statut={samediStatut} />
                            : <span className="text-xs text-muted-foreground/40 italic">Non config.</span>
                          }
                        </td>
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

            {/* Panneau Rotation Samedi dépliable */}
            {expandedSalles.has(salle.id) && (
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
  onAssign, getSamedi,
}: {
  salles: Salle[]
  formateurs: Formateur[]
  planning: PlanningFixe[]
  saving: string | null
  onAssign: (formateurId: string, jour: JourSemaine, value: string) => void
  getSamedi: (formateurId: string, salleId: string) => StatutSamedi | undefined
}) {
  // Séances physiques prises dans une (salle, jour) par d'autres formateurs
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

  // Toutes les salles physiquement complètes pour ce jour (hors formateur courant)
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

  // Occupation globale par jour pour les indicateurs d'en-tête
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

  return (
    <div className="rounded-lg border bg-card">
      <div className="border-b px-4 py-3 flex items-center gap-3">
        <div>
          <h2 className="font-semibold">Pool Mixte — Toutes salles disponibles</h2>
          <p className="text-xs text-muted-foreground">Choisissez la salle et la séance pour chaque formateur. Les créneaux physiques déjà pris disparaissent des choix.</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-2 text-left font-medium text-muted-foreground w-36">Formateur</th>
              {JOURS_SEMAINE.map(jour => {
                const occ = getOccupationJour(jour)
                const toutesPleines = occ.every(o => o.matin && o.apresmidi)
                return (
                  <th key={jour} className="px-2 py-2 text-center font-medium text-muted-foreground min-w-[140px]">
                    <div>{jour}</div>
                    <div className="flex justify-center gap-1 mt-1">
                      {occ.map(o => (
                        <span
                          key={o.salle.id}
                          title={`${o.salle.nom} : ${o.matin ? 'Matin✓' : 'Matin○'} ${o.apresmidi ? 'PM✓' : 'PM○'}`}
                          className={`text-[9px] font-mono px-1 rounded ${
                            o.matin && o.apresmidi
                              ? 'bg-red-100 text-red-600'
                              : (o.matin || o.apresmidi)
                              ? 'bg-amber-100 text-amber-600'
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
              {/* En-tête Samedi rotation */}
              <th className="px-2 py-2 text-center font-medium text-muted-foreground min-w-[130px] border-l border-dashed border-muted-foreground/30">
                <div className="flex items-center justify-center gap-1">
                  <RotateCcw className="h-3 w-3 text-muted-foreground/60" />
                  Samedi
                </div>
                <div className="text-[9px] text-muted-foreground/60 mt-0.5">Rotation mensuelle</div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {formateurs.map(formateur => {
              // Pour PoolMixed : chercher la salle du formateur via son groupe ou son pole_id
              const salleDuFormateur = salles.find(s => {
                const hasPole = s.pole_id && formateur.pole_id === s.pole_id
                return hasPole
              })
              const samediStatut = salleDuFormateur
                ? getSamedi(formateur.id, salleDuFormateur.id)
                : undefined
              return (
              <tr key={formateur.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-2 font-medium text-sm">{formateur.nom}</td>
                {JOURS_SEMAINE.map(jour => {
                  const key = `${formateur.id}-${jour}`
                  const currentVal = getCurrentValue(formateur.id, jour)
                  const complete = toutesCompletes(jour, formateur.id)

                  // Options disponibles : filtrer les créneaux déjà pris par d'autres
                  const optionsPhysiques: { value: string; label: string }[] = []
                  for (const salle of salles) {
                    const pris = getSlotsPris(jour, salle.id, formateur.id)
                    if (!pris.has('Matin')) {
                      optionsPhysiques.push({ value: `${salle.id}|Matin`, label: `${salle.nom} · Matin` })
                    }
                    if (!pris.has('Après-midi')) {
                      optionsPhysiques.push({ value: `${salle.id}|Après-midi`, label: `${salle.nom} · Après-midi` })
                    }
                  }

                  // Distance : max 1 fois par semaine pour ce formateur
                  const dejaDistance = JOURS_SEMAINE
                    .filter(j => j !== jour)
                    .some(j => planning.find(p => p.formateur_id === formateur.id && p.jour_semaine === j)?.statut === 'Distance')

                  return (
                    <td key={jour} className="px-2 py-2 text-center">
                      <Select
                        value={currentVal}
                        onValueChange={val => onAssign(formateur.id, jour, val ?? '')}
                        disabled={saving === key}
                      >
                        <SelectTrigger className="h-8 w-[150px] text-xs mx-auto">
                          <SelectValue>
                            {renderCurrentValue(currentVal)}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
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
                          {/* Séparateur si des options physiques existent */}
                          {optionsPhysiques.length > 0 && (
                            <div className="h-px bg-border my-1" />
                          )}
                          {!dejaDistance && (
                            <SelectItem value="Distance"><StatutBadge statut="Distance" /></SelectItem>
                          )}
                          <SelectItem value="Repos"><StatutBadge statut="Repos" /></SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                  )
                })}
                {/* Cellule Samedi (lecture seule) */}
                <td className="px-2 py-2 text-center border-l border-dashed border-muted-foreground/30">
                  {samediStatut
                    ? <StatutBadge statut={samediStatut} />
                    : <span className="text-xs text-muted-foreground/40 italic">Non config.</span>
                  }
                </td>
              </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Légende occupation */}
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

  function getSamedi(formateurId: string, salleId: string): StatutSamedi | undefined {
    return getSamediStatut(formateurId, salleId, selectedAnnee, selectedMois, rotationCfg, cycleRefs)
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

  // Sauvegarde standard (Scénario A/B) — salle implicite via groupe
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

    if (error) { toast.error('Erreur lors de la sauvegarde') } else {
      setPlanning(prev => [
        ...prev.filter(p => !(p.formateur_id === formateurId && p.jour_semaine === jour)),
        { id: existing?.id ?? crypto.randomUUID(), formateur_id: formateurId, jour_semaine: jour, statut, salle_id: null },
      ])
      toast.success('Statut mis à jour')
    }
    setSaving(null)
  }

  // Sauvegarde pool mixte (Scénario C) — salle explicite
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

  const annees = [selectedAnnee - 1, selectedAnnee, selectedAnnee + 1]

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <PageHeader
              icon={CalendarDays}
              title="Planning fixe Lundi–Vendredi"
              subtitle={
                isPoolMixed
                  ? 'Scénario C actif — Pool mixte : tous les formateurs peuvent être affectés à n\'importe quelle salle.'
                  : 'Planning permanent — les modifications s\'appliquent immédiatement à toutes les semaines.'
              }
              badge={isPoolMixed ? 'Pool mixte' : 'Fixe'}
            />
          </div>
          {/* Sélecteur mois/année pour la colonne Samedi */}
          <div className="flex items-center gap-2 shrink-0 mt-1">
            <RotateCcw className="h-4 w-4 text-muted-foreground/60" />
            <span className="text-xs text-muted-foreground">Samedi :</span>
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
          getSamedi={getSamedi}
        />
      ) : (
        <StandardView
          salles={salles}
          groupes={groupes}
          formateurs={formateurs}
          planning={planning}
          saving={saving}
          onStatutChange={handleStatutChange}
          getSamedi={getSamedi}
          rotationConfig={rotationCfg}
          cycleReferences={cycleRefs}
          previewAnnee={selectedAnnee}
          previewMois={selectedMois}
          onRotationStatut={handleRotationStatut}
          onAutoRotation={handleAutoRotation}
          onAncrageSave={handleAncrageSave}
        />
      )}
    </div>
  )
}
