'use client'

import { useState, useMemo } from 'react'
import { StatutBadge } from '@/components/planning/StatutBadge'
import { PageHeader, PageDivider } from '@/components/layout/PageHeader'
import { CalendarRange } from 'lucide-react'
import {
  getSemaineCycle,
  getJoursDuMois,
  parseISODate,
  toISODateString,
  dayNumberToLabel,
} from '@/lib/rotation'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { exportExcel, exportPDF } from '@/lib/export'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type {
  Formateur, Groupe, Salle, PlanningFixe,
  RotationSamediConfig, CycleReference,
  JourSemaine, StatutFixe, StatutSamedi, SemaineCycle,
} from '@/types/planning'
import { JOURS_SEMAINE } from '@/types/planning'

interface Props {
  salles: Salle[]
  groupes: Groupe[]
  formateurs: Formateur[]
  planningFixe: PlanningFixe[]
  rotationConfig: RotationSamediConfig[]
  cycleReferences: CycleReference[]
}

const MOIS_LABELS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]

export function VueMensuelleClient({
  salles, groupes, formateurs, planningFixe, rotationConfig, cycleReferences,
}: Props) {
  const today = new Date()
  const [annee, setAnnee] = useState(today.getFullYear())
  const [mois, setMois] = useState(today.getMonth() + 1)

  function navMois(delta: number) {
    let m = mois + delta
    let a = annee
    if (m > 12) { m = 1; a++ }
    if (m < 1) { m = 12; a-- }
    setMois(m)
    setAnnee(a)
  }

  function getStatutFormateur(
    formateurId: string,
    groupeId: string | null,
    date: Date
  ): StatutFixe | StatutSamedi | null {
    const dayNum = date.getDay() // 0=Dim,1=Lun...6=Sam

    if (dayNum === 6) {
      // Samedi
      if (!groupeId) return 'Repos'
      const ref = cycleReferences.find(c => c.groupe_id === groupeId)
      if (!ref) return null

      const ancrage = parseISODate(ref.date_ancrage)
      const samediUTC = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
      const semaine = getSemaineCycle(samediUTC, ancrage, ref.semaine_cycle_ancrage)
      const cfg = rotationConfig.find(
        c => c.groupe_id === groupeId && c.semaine_cycle === semaine && c.formateur_id === formateurId
      )
      return cfg?.statut ?? 'Repos'
    }

    // Lundi–Vendredi
    const jourLabel = dayNumberToLabel(dayNum) as JourSemaine
    if (!JOURS_SEMAINE.includes(jourLabel)) return null

    const pf = planningFixe.find(
      p => p.formateur_id === formateurId && p.jour_semaine === jourLabel
    )
    return pf?.statut ?? null
  }

  const jours = useMemo(() => getJoursDuMois(annee, mois), [annee, mois])

  return (
    <div className="space-y-6">
      {/* En-tête navigation */}
      <PageHeader
        icon={CalendarRange}
        title="Vue mensuelle"
        subtitle="Planning complet Lundi–Samedi avec statuts calculés automatiquement."
        badge="Calendrier"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navMois(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="w-40 text-center font-medium text-sm">
              {MOIS_LABELS[mois - 1]} {annee}
            </span>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navMois(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1"
              onClick={() => {
                exportExcel({ annee, mois, salles, groupes, formateurs, planningFixe, rotationConfig, cycleReferences })
                toast.success('Export Excel téléchargé')
              }}
            >
              <Download className="h-3.5 w-3.5" /> Excel
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1"
              onClick={async () => {
                await exportPDF({ annee, mois, salles, groupes, formateurs, planningFixe, rotationConfig, cycleReferences })
                toast.success('Export PDF téléchargé')
              }}
            >
              <Download className="h-3.5 w-3.5" /> PDF
            </Button>
          </div>
        }
      />
      <PageDivider />

      {/* Une table par salle */}
      {salles.map(salle => {
        const groupe = groupes.find(g => g.salle_id === salle.id)
        const formateursSalle = formateurs.filter(f => f.groupe_id === groupe?.id)

        return (
          <div key={salle.id} className="rounded-lg border bg-card">
            <div className="border-b px-4 py-3 flex items-center gap-2">
              <h2 className="font-semibold">{salle.nom}</h2>
              {groupe && <span className="text-xs text-muted-foreground">— {groupe.nom}</span>}
            </div>

            <div className="overflow-x-auto">
              <table className="text-xs w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground sticky left-0 bg-muted/50 w-28">
                      Formateur
                    </th>
                    {jours.map(jour => {
                      const isSam = jour.getDay() === 6
                      const dayLabel = dayNumberToLabel(jour.getDay()).slice(0, 3)
                      const dateNum = jour.getDate()
                      return (
                        <th
                          key={toISODateString(jour)}
                          className={cn(
                            'px-1 py-1 text-center font-medium text-muted-foreground min-w-[52px]',
                            isSam && 'bg-amber-50 text-amber-700'
                          )}
                        >
                          <div>{dayLabel}</div>
                          <div className="font-semibold">{dateNum}</div>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {formateursSalle.map(formateur => (
                    <tr key={formateur.id} className="hover:bg-muted/20">
                      <td className="px-3 py-1.5 font-medium sticky left-0 bg-background border-r">
                        {formateur.nom}
                      </td>
                      {jours.map(jour => {
                        const statut = getStatutFormateur(formateur.id, formateur.groupe_id, jour)
                        const isSam = jour.getDay() === 6
                        return (
                          <td
                            key={toISODateString(jour)}
                            className={cn('px-1 py-1.5 text-center', isSam && 'bg-amber-50/50')}
                          >
                            {statut ? (
                              <StatutBadge statut={statut} className="text-[10px] px-1 py-0" />
                            ) : (
                              <span className="text-muted-foreground/40">—</span>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}
    </div>
  )
}
