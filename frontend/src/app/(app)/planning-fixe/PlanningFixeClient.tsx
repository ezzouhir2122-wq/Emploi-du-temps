'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { StatutBadge } from '@/components/planning/StatutBadge'
import { PageHeader, PageDivider } from '@/components/layout/PageHeader'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { CalendarDays } from 'lucide-react'
import type { Formateur, Groupe, Salle, PlanningFixe, JourSemaine, StatutFixe } from '@/types/planning'
import { JOURS_SEMAINE, STATUTS_FIXES } from '@/types/planning'

interface Props {
  salles: Salle[]
  groupes: Groupe[]
  formateurs: Formateur[]
  planningFixe: PlanningFixe[]
}

export function PlanningFixeClient({ salles, groupes, formateurs, planningFixe }: Props) {
  const [planning, setPlanning] = useState<PlanningFixe[]>(planningFixe)
  const [saving, setSaving] = useState<string | null>(null)
  const supabase = createClient()

  function getStatut(formateurId: string, jour: JourSemaine): StatutFixe | undefined {
    return planning.find(p => p.formateur_id === formateurId && p.jour_semaine === jour)?.statut
  }

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

    if (error) {
      toast.error('Erreur lors de la sauvegarde')
    } else {
      setPlanning(prev => {
        const filtered = prev.filter(
          p => !(p.formateur_id === formateurId && p.jour_semaine === jour)
        )
        return [...filtered, {
          id: existing?.id ?? crypto.randomUUID(),
          formateur_id: formateurId,
          jour_semaine: jour,
          statut,
        }]
      })
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
          subtitle="Planning permanent — les modifications s'appliquent immédiatement à toutes les semaines."
          badge="Fixe"
        />
        <PageDivider />
      </div>

      {salles.map(salle => {
        const groupe = groupes.find(g => g.salle_id === salle.id)
        const formateursSalle = formateurs.filter(f => f.groupe_id === groupe?.id)

        return (
          <div key={salle.id} className="rounded-lg border bg-card">
            <div className="border-b px-4 py-3">
              <h2 className="font-semibold">{salle.nom}</h2>
              {groupe && (
                <p className="text-xs text-muted-foreground">{groupe.nom}</p>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground w-36">
                      Formateur
                    </th>
                    {JOURS_SEMAINE.map(jour => (
                      <th key={jour} className="px-3 py-2 text-center font-medium text-muted-foreground">
                        {jour}
                      </th>
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
                        return (
                          <td key={jour} className="px-3 py-2 text-center">
                            <Select
                              value={statut ?? ''}
                              onValueChange={val =>
                                handleStatutChange(formateur.id, jour, val as StatutFixe)
                              }
                              disabled={saving === key}
                            >
                              <SelectTrigger className="h-8 w-32 text-xs">
                                <SelectValue placeholder="—">
                                  {statut ? <StatutBadge statut={statut} /> : '—'}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {STATUTS_FIXES.map(s => (
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

            {/* Résumé occupation salle */}
            <div className="border-t px-4 py-2 text-xs text-muted-foreground">
              <span className="font-medium">Occupation salle</span> — Vérifiez qu&apos;il y a exactement 1 Matin + 1 Après-midi physique par jour (Distance ne compte pas).
            </div>
          </div>
        )
      })}
    </div>
  )
}
