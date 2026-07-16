'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { StatutBadge } from '@/components/planning/StatutBadge'
import { PageHeader, PageDivider } from '@/components/layout/PageHeader'
import { RotateCcw as RotateCcwIcon } from 'lucide-react'
import { getSemaineCycle, getSamedisDuMois, parseISODate, toISODateString } from '@/lib/rotation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import type {
  Groupe, Formateur, RotationSamediConfig, CycleReference,
  SemaineCycle, StatutSamedi,
} from '@/types/planning'

interface Props {
  groupes: Groupe[]
  formateurs: Formateur[]
  rotationConfig: RotationSamediConfig[]
  cycleReferences: CycleReference[]
}

const STATUTS_SAMEDI: StatutSamedi[] = ['Matin', 'Après-midi', 'Repos']
const SEMAINES_CYCLE: SemaineCycle[] = [1, 2, 3]

export function RotationSamediClient({ groupes, formateurs, rotationConfig, cycleReferences }: Props) {
  const [config, setConfig] = useState<RotationSamediConfig[]>(rotationConfig)
  const [cycleRefs, setCycleRefs] = useState<CycleReference[]>(cycleReferences)

  // Prévisualisation
  const currentDate = new Date()
  const [previewAnnee, setPreviewAnnee] = useState(currentDate.getFullYear())
  const [previewMois, setPreviewMois] = useState(currentDate.getMonth() + 1)

  const supabase = createClient()

  function getCycleRef(groupeId: string): CycleReference | undefined {
    return cycleRefs.find(c => c.groupe_id === groupeId)
  }

  function getConfig(groupeId: string, semaine: SemaineCycle, formateurId: string) {
    return config.find(
      c => c.groupe_id === groupeId && c.semaine_cycle === semaine && c.formateur_id === formateurId
    )
  }

  async function handleStatutChange(
    groupeId: string,
    semaine: SemaineCycle,
    formateurId: string,
    statut: StatutSamedi
  ) {
    const { error } = await supabase
      .from('rotation_samedi_config')
      .upsert(
        { groupe_id: groupeId, semaine_cycle: semaine, formateur_id: formateurId, statut },
        { onConflict: 'groupe_id,semaine_cycle,formateur_id' }
      )

    if (error) {
      toast.error('Erreur lors de la sauvegarde')
      return
    }

    setConfig(prev => {
      const filtered = prev.filter(
        c => !(c.groupe_id === groupeId && c.semaine_cycle === semaine && c.formateur_id === formateurId)
      )
      return [...filtered, {
        id: crypto.randomUUID(),
        groupe_id: groupeId,
        semaine_cycle: semaine,
        formateur_id: formateurId,
        statut,
      }]
    })
    toast.success('Configuration mise à jour')
  }

  async function handleAncrageSave(groupeId: string, dateAncrage: string, semaineAncrage: SemaineCycle) {
    const { error } = await supabase
      .from('cycle_reference')
      .upsert(
        { groupe_id: groupeId, date_ancrage: dateAncrage, semaine_cycle_ancrage: semaineAncrage },
        { onConflict: 'groupe_id' }
      )

    if (error) {
      toast.error('Erreur lors de la sauvegarde de l\'ancrage')
      return
    }

    setCycleRefs(prev => {
      const filtered = prev.filter(c => c.groupe_id !== groupeId)
      return [...filtered, {
        id: crypto.randomUUID(),
        groupe_id: groupeId,
        date_ancrage: dateAncrage,
        semaine_cycle_ancrage: semaineAncrage,
      }]
    })
    toast.success('Date d\'ancrage mise à jour')
  }

  // Calcul de la prévisualisation du mois
  function getPreviewSamedis(groupeId: string) {
    const ref = getCycleRef(groupeId)
    if (!ref) return []

    const samedis = getSamedisDuMois(previewAnnee, previewMois)
    const ancrage = parseISODate(ref.date_ancrage)

    return samedis.map(samedi => {
      const semaine = getSemaineCycle(samedi, ancrage, ref.semaine_cycle_ancrage)
      const formateursGroupe = formateurs.filter(f => f.groupe_id === groupeId)
      const statuts = formateursGroupe.map(f => ({
        formateur: f,
        statut: config.find(
          c => c.groupe_id === groupeId && c.semaine_cycle === semaine && c.formateur_id === f.id
        )?.statut ?? 'Repos' as StatutSamedi,
      }))

      return { date: toISODateString(samedi), semaine, statuts }
    })
  }

  const MOIS_LABELS = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
  ]

  return (
    <div className="space-y-8">
      <div>
        <PageHeader
          icon={RotateCcwIcon}
          title="Rotation Samedi"
          subtitle="Cycle de 3 semaines perpétuel — ne se réinitialise jamais."
          badge="Cycle 3 sem."
        />
        <PageDivider />
      </div>

      {groupes.map(groupe => {
        const formateursGroupe = formateurs.filter(f => f.groupe_id === groupe.id)
        const ref = getCycleRef(groupe.id)

        return (
          <div key={groupe.id} className="rounded-lg border bg-card space-y-0">
            <div className="border-b px-4 py-3">
              <h2 className="font-semibold">{groupe.nom}</h2>
            </div>

            {/* Date d'ancrage */}
            <AncragEditor
              ref_={ref}
              onSave={(date, semaine) => handleAncrageSave(groupe.id, date, semaine)}
            />

            {/* Configuration du cycle */}
            <div className="overflow-x-auto p-4">
              <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">
                Configuration du cycle
              </p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Formateur</th>
                    {SEMAINES_CYCLE.map(s => (
                      <th key={s} className="text-center py-2 px-3 font-medium text-muted-foreground">
                        Semaine {s}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {formateursGroupe.map(formateur => (
                    <tr key={formateur.id} className="hover:bg-muted/30">
                      <td className="py-2 px-3 font-medium">{formateur.nom}</td>
                      {SEMAINES_CYCLE.map(semaine => {
                        const current = getConfig(groupe.id, semaine, formateur.id)
                        return (
                          <td key={semaine} className="py-2 px-3 text-center">
                            <Select
                              value={current?.statut ?? 'Repos'}
                              onValueChange={val =>
                                handleStatutChange(groupe.id, semaine, formateur.id, val as StatutSamedi)
                              }
                            >
                              <SelectTrigger className="h-8 w-32 text-xs mx-auto">
                                <SelectValue>
                                  {current ? <StatutBadge statut={current.statut} /> : <StatutBadge statut="Repos" />}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {STATUTS_SAMEDI.map(s => (
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

            {/* Prévisualisation */}
            <div className="border-t p-4">
              <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">
                Prévisualisation — Samedis du mois
              </p>
              <div className="flex items-center gap-2 mb-4">
                <Select
                  value={String(previewMois)}
                  onValueChange={v => setPreviewMois(Number(v))}
                >
                  <SelectTrigger className="h-8 w-36 text-xs">
                    <SelectValue>{MOIS_LABELS[previewMois - 1]}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {MOIS_LABELS.map((m, i) => (
                      <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  value={previewAnnee}
                  onChange={e => setPreviewAnnee(Number(e.target.value))}
                  className="h-8 w-24 text-xs"
                  min={2020}
                  max={2040}
                />
              </div>

              {!ref ? (
                <p className="text-sm text-muted-foreground italic">
                  Configurez la date d&apos;ancrage ci-dessus pour activer la prévisualisation.
                </p>
              ) : (
                <div className="space-y-2">
                  {getPreviewSamedis(groupe.id).map(({ date, semaine, statuts }) => (
                    <div key={date} className="rounded border p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-medium text-sm">
                          Samedi {new Date(date + 'T12:00:00').toLocaleDateString('fr-FR', {
                            day: 'numeric', month: 'long', year: 'numeric'
                          })}
                        </span>
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                          Cycle S{semaine}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        {statuts.map(({ formateur, statut }) => (
                          <div key={formateur.id} className="flex items-center gap-1.5 text-sm">
                            <span className="font-medium text-xs">{formateur.nom}</span>
                            <StatutBadge statut={statut} />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function AncragEditor({
  ref_,
  onSave,
}: {
  ref_: CycleReference | undefined
  onSave: (date: string, semaine: SemaineCycle) => void
}) {
  const [date, setDate] = useState(ref_?.date_ancrage ?? '')
  const [semaine, setSemaine] = useState<SemaineCycle>(ref_?.semaine_cycle_ancrage ?? 1)

  return (
    <div className="border-b px-4 py-3 bg-muted/30">
      <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
        Date d'ancrage du cycle
      </p>
      <div className="flex items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Samedi de référence</Label>
          <Input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="h-8 w-44 text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Semaine du cycle</Label>
          <Select value={String(semaine)} onValueChange={v => setSemaine(Number(v) as SemaineCycle)}>
            <SelectTrigger className="h-8 w-32 text-xs">
              <SelectValue>Semaine {semaine}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {([1, 2, 3] as SemaineCycle[]).map(s => (
                <SelectItem key={s} value={String(s)}>Semaine {s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs"
          onClick={() => onSave(date, semaine)}
          disabled={!date}
        >
          Enregistrer
        </Button>
      </div>
      {ref_ && (
        <p className="text-xs text-muted-foreground mt-1">
          Ancrage actuel : {ref_.date_ancrage} → Semaine {ref_.semaine_cycle_ancrage} du cycle
        </p>
      )}
    </div>
  )
}
