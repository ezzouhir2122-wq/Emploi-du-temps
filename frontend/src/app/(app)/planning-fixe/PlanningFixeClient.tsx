'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { StatutBadge } from '@/components/planning/StatutBadge'
import { PageHeader, PageDivider } from '@/components/layout/PageHeader'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { CalendarDays, Info } from 'lucide-react'
import type { Formateur, Groupe, Salle, PlanningFixe, Scenario, JourSemaine, StatutFixe } from '@/types/planning'
import { JOURS_SEMAINE, STATUTS_FIXES } from '@/types/planning'

interface Props {
  salles: Salle[]
  groupes: Groupe[]
  formateurs: Formateur[]
  planningFixe: PlanningFixe[]
  activeScenario: Scenario | null
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
  onStatutChange,
}: {
  salles: Salle[]
  groupes: Groupe[]
  formateurs: Formateur[]
  planning: PlanningFixe[]
  saving: string | null
  onStatutChange: (formateurId: string, jour: JourSemaine, statut: StatutFixe) => void
}) {
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
        const formateursSalle = formateurs.filter(f => f.groupe_id === groupe?.id)

        return (
          <div key={salle.id} className="rounded-lg border bg-card">
            <div className="border-b px-4 py-3">
              <h2 className="font-semibold">{salle.nom}</h2>
              {groupe && <p className="text-xs text-muted-foreground">{groupe.nom}</p>}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground w-36">Formateur</th>
                    {JOURS_SEMAINE.map(jour => (
                      <th key={jour} className="px-3 py-2 text-center font-medium text-muted-foreground">{jour}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {formateursSalle.map(formateur => (
                    <tr key={formateur.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-2 font-medium">{formateur.nom}</td>
                      {JOURS_SEMAINE.map(jour => {
                        const statut = getStatut(formateur.id, jour)
                        const key = `${formateur.id}-${jour}`
                        const disponibles = getStatutsDisponibles(formateur.id, jour, formateursSalle)
                        return (
                          <td key={jour} className="px-3 py-2 text-center">
                            <Select
                              value={statut ?? ''}
                              onValueChange={val => onStatutChange(formateur.id, jour, val as StatutFixe)}
                              disabled={saving === key}
                            >
                              <SelectTrigger className="h-8 w-32 text-xs">
                                <SelectValue placeholder="—">
                                  {statut ? <StatutBadge statut={statut} /> : '—'}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {disponibles.map(s => (
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
                  ))}
                </tbody>
              </table>
            </div>

            <div className="border-t px-4 py-2 text-xs text-muted-foreground">
              <span className="font-medium">Occupation salle</span> — Vérifiez qu&apos;il y a exactement 1 Matin + 1 Après-midi physique par jour (Distance ne compte pas).
            </div>
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
            </tr>
          </thead>
          <tbody className="divide-y">
            {formateurs.map(formateur => (
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
              </tr>
            ))}
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

export function PlanningFixeClient({ salles, groupes, formateurs, planningFixe, activeScenario }: Props) {
  const [planning, setPlanning] = useState<PlanningFixe[]>(planningFixe)
  const [saving, setSaving] = useState<string | null>(null)
  const supabase = createClient()

  const isPoolMixed = activeScenario?.config && 'type' in activeScenario.config && activeScenario.config.type === 'pool_mixed'

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

  return (
    <div className="space-y-6">
      <div>
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
        />
      )}
    </div>
  )
}
