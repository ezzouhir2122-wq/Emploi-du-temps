'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { StatutBadge } from '@/components/planning/StatutBadge'
import { PageHeader, PageDivider } from '@/components/layout/PageHeader'
import { RotateCcw as RotateCcwIcon, Wand2 } from 'lucide-react'
import { getMoisCycle, getSamedisDuMois, parseISODate, toISODateString } from '@/lib/rotation'
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
  Salle, Formateur, RotationSamediConfig, CycleReference,
  SemaineCycle, StatutSamedi,
} from '@/types/planning'

interface Props {
  salles: Salle[]
  formateurs: Formateur[]
  rotationConfig: RotationSamediConfig[]
  cycleReferences: CycleReference[]
}

const STATUTS_SAMEDI: StatutSamedi[] = ['Matin', 'Après-midi', 'Repos']
const POSITIONS_CYCLE: SemaineCycle[] = [1, 2, 3]

const ROTATION_SUIVANTE: Record<StatutSamedi, StatutSamedi> = {
  'Matin':       'Après-midi',
  'Après-midi':  'Repos',
  'Repos':       'Matin',
}

const MOIS_LABELS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]

export function RotationSamediClient({ salles, formateurs, rotationConfig, cycleReferences }: Props) {
  const [config, setConfig] = useState<RotationSamediConfig[]>(rotationConfig)
  const [cycleRefs, setCycleRefs] = useState<CycleReference[]>(cycleReferences)

  const currentDate = new Date()
  const [previewAnnee, setPreviewAnnee] = useState(currentDate.getFullYear())
  const [previewMois, setPreviewMois] = useState(currentDate.getMonth() + 1)

  const supabase = createClient()

  // ── Formateurs par salle : pole_id fallback si pas de groupe lié ──
  function getFormateursSalle(salle: Salle): Formateur[] {
    return formateurs.filter(f => salle.pole_id && f.pole_id === salle.pole_id)
  }

  function getCycleRef(salleId: string): CycleReference | undefined {
    return cycleRefs.find(c => c.salle_id === salleId)
  }

  function getConfig(salleId: string, position: SemaineCycle, formateurId: string) {
    return config.find(
      c => c.salle_id === salleId && c.semaine_cycle === position && c.formateur_id === formateurId
    )
  }

  async function handleStatutChange(
    salleId: string,
    position: SemaineCycle,
    formateurId: string,
    statut: StatutSamedi
  ) {
    const { error } = await supabase
      .from('rotation_samedi_config')
      .upsert(
        { salle_id: salleId, semaine_cycle: position, formateur_id: formateurId, statut, groupe_id: null },
        { onConflict: 'salle_id,semaine_cycle,formateur_id' }
      )
    if (error) { toast.error('Erreur lors de la sauvegarde'); return }

    setConfig(prev => {
      const filtered = prev.filter(
        c => !(c.salle_id === salleId && c.semaine_cycle === position && c.formateur_id === formateurId)
      )
      return [...filtered, { id: crypto.randomUUID(), salle_id: salleId, groupe_id: null, semaine_cycle: position, formateur_id: formateurId, statut }]
    })
    toast.success('Mis à jour')
  }

  async function handleAutoRotation(salleId: string, formateursSalle: Formateur[]) {
    const mois1 = formateursSalle.map(f => ({
      formateur_id: f.id,
      statut: (getConfig(salleId, 1, f.id)?.statut ?? 'Repos') as StatutSamedi,
    }))
    const mois2 = mois1.map(e => ({ formateur_id: e.formateur_id, statut: ROTATION_SUIVANTE[e.statut] }))
    const mois3 = mois2.map(e => ({ formateur_id: e.formateur_id, statut: ROTATION_SUIVANTE[e.statut] }))

    const rows = [
      ...mois2.map(e => ({ salle_id: salleId, groupe_id: null, semaine_cycle: 2 as SemaineCycle, formateur_id: e.formateur_id, statut: e.statut })),
      ...mois3.map(e => ({ salle_id: salleId, groupe_id: null, semaine_cycle: 3 as SemaineCycle, formateur_id: e.formateur_id, statut: e.statut })),
    ]

    const { error } = await supabase
      .from('rotation_samedi_config')
      .upsert(rows, { onConflict: 'salle_id,semaine_cycle,formateur_id' })
    if (error) { toast.error('Erreur lors de la génération'); return }

    setConfig(prev => {
      const filtered = prev.filter(c => !(c.salle_id === salleId && (c.semaine_cycle === 2 || c.semaine_cycle === 3)))
      return [...filtered, ...rows.map(r => ({ ...r, id: crypto.randomUUID() }))]
    })
    toast.success('Mois 2 et 3 générés automatiquement')
  }

  async function handleAncrageSave(salleId: string, dateAncrage: string, moisCycleAncrage: SemaineCycle) {
    const { error } = await supabase
      .from('cycle_reference')
      .upsert(
        { salle_id: salleId, date_ancrage: dateAncrage, semaine_cycle_ancrage: moisCycleAncrage, groupe_id: null },
        { onConflict: 'salle_id' }
      )
    if (error) { toast.error('Erreur lors de la sauvegarde de l\'ancrage'); return }

    setCycleRefs(prev => {
      const filtered = prev.filter(c => c.salle_id !== salleId)
      return [...filtered, { id: crypto.randomUUID(), salle_id: salleId, groupe_id: null, date_ancrage: dateAncrage, semaine_cycle_ancrage: moisCycleAncrage }]
    })
    toast.success('Ancrage mis à jour')
  }

  function getPreviewSamedis(salleId: string) {
    const ref = getCycleRef(salleId)
    if (!ref) return []
    const ancrage = parseISODate(ref.date_ancrage)
    const position = getMoisCycle(previewAnnee, previewMois, ancrage, ref.semaine_cycle_ancrage)
    const samedis = getSamedisDuMois(previewAnnee, previewMois)
    const salle = salles.find(s => s.id === salleId)!
    const formateursSalle = getFormateursSalle(salle)
    const statuts = formateursSalle.map(f => ({
      formateur: f,
      statut: (getConfig(salleId, position, f.id)?.statut ?? 'Repos') as StatutSamedi,
    }))
    return samedis.map(samedi => ({ date: toISODateString(samedi), position, statuts }))
  }

  // N'afficher que les salles qui ont des formateurs (via pole_id)
  const sallesActives = salles.filter(s => getFormateursSalle(s).length > 0)

  return (
    <div className="space-y-8">
      <div>
        <PageHeader
          icon={RotateCcwIcon}
          title="Rotation Samedis"
          subtitle="Cycle mensuel perpétuel — tous les Samedis d'un même mois ont la même affectation."
          badge="Cycle 3 mois"
        />
        <PageDivider />
      </div>

      {sallesActives.length === 0 && (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Aucune salle avec des formateurs affectés.<br />
          Configurez les pôles dans <strong>Paramètres → Pôles</strong>.
        </div>
      )}

      {sallesActives.map(salle => {
        const formateursSalle = getFormateursSalle(salle)
        const ref = getCycleRef(salle.id)

        return (
          <div key={salle.id} className="rounded-lg border bg-card space-y-0">
            {/* Entête salle */}
            <div className="border-b px-4 py-3">
              <h2 className="font-semibold">{salle.nom}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{formateursSalle.length} formateur(s)</p>
            </div>

            {/* Ancrage */}
            <AncragEditor
              ref_={ref}
              onSave={(date, pos) => handleAncrageSave(salle.id, date, pos)}
            />

            {/* Configuration du cycle mensuel */}
            <div className="overflow-x-auto p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Configuration du cycle mensuel
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1.5"
                  onClick={() => handleAutoRotation(salle.id, formateursSalle)}
                  title="Génère Mois 2 et 3 automatiquement depuis Mois 1"
                >
                  <Wand2 className="h-3.5 w-3.5" />
                  Auto-générer Mois 2 &amp; 3
                </Button>
              </div>

              <div className="text-xs text-muted-foreground bg-muted/40 rounded p-2 mb-3">
                Règle de rotation : <strong>Matin</strong> → Après-midi le mois suivant → Repos → Matin…
              </div>

              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Formateur</th>
                    {POSITIONS_CYCLE.map(pos => (
                      <th key={pos} className="text-center py-2 px-3 font-medium text-muted-foreground">
                        Mois {pos}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {formateursSalle.map(formateur => (
                    <tr key={formateur.id} className="hover:bg-muted/30">
                      <td className="py-2 px-3 font-medium">{formateur.nom}</td>
                      {POSITIONS_CYCLE.map(pos => {
                        const current = getConfig(salle.id, pos, formateur.id)
                        return (
                          <td key={pos} className="py-2 px-3 text-center">
                            <Select
                              value={current?.statut ?? 'Repos'}
                              onValueChange={val =>
                                handleStatutChange(salle.id, pos, formateur.id, val as StatutSamedi)
                              }
                            >
                              <SelectTrigger className="h-8 w-32 text-xs mx-auto">
                                <SelectValue>
                                  <StatutBadge statut={current?.statut ?? 'Repos'} />
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

            {/* Prévisualisation mensuelle */}
            <div className="border-t p-4">
              <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">
                Prévisualisation — Samedis du mois
              </p>
              <div className="flex items-center gap-2 mb-4">
                <Select value={String(previewMois)} onValueChange={v => setPreviewMois(Number(v))}>
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
                  min={2020} max={2040}
                />
              </div>

              {!ref ? (
                <p className="text-sm text-muted-foreground italic">
                  Configurez le mois d&apos;ancrage ci-dessus pour activer la prévisualisation.
                </p>
              ) : (() => {
                const preview = getPreviewSamedis(salle.id)
                if (preview.length === 0) return <p className="text-sm text-muted-foreground italic">Aucun Samedi ce mois.</p>
                const { position } = preview[0]
                return (
                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground bg-muted/40 rounded px-3 py-1.5 inline-flex items-center gap-2">
                      {MOIS_LABELS[previewMois - 1]} {previewAnnee} →
                      <span className="font-semibold text-foreground">Position {position} du cycle</span>
                      — tous les Samedis ont la même affectation
                    </div>
                    {preview.map(({ date, statuts }) => (
                      <div key={date} className="rounded border p-3">
                        <span className="font-medium text-sm">
                          Samedi {new Date(date + 'T12:00:00').toLocaleDateString('fr-FR', {
                            day: 'numeric', month: 'long', year: 'numeric'
                          })}
                        </span>
                        <div className="flex flex-wrap gap-3 mt-2">
                          {statuts.map(({ formateur, statut }) => (
                            <div key={formateur.id} className="flex items-center gap-1.5">
                              <span className="text-xs font-medium">{formateur.nom}</span>
                              <StatutBadge statut={statut} />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })()}
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
  onSave: (date: string, pos: SemaineCycle) => void
}) {
  const [date, setDate] = useState(ref_?.date_ancrage ?? '')
  const [pos, setPos] = useState<SemaineCycle>(ref_?.semaine_cycle_ancrage ?? 1)

  return (
    <div className="border-b px-4 py-3 bg-muted/30">
      <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
        Mois d'ancrage du cycle
      </p>
      <div className="flex items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Mois de référence (choisir le 1er du mois)</Label>
          <Input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="h-8 w-44 text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Position dans le cycle</Label>
          <Select value={String(pos)} onValueChange={v => setPos(Number(v) as SemaineCycle)}>
            <SelectTrigger className="h-8 w-32 text-xs">
              <SelectValue>Mois {pos}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {([1, 2, 3] as SemaineCycle[]).map(s => (
                <SelectItem key={s} value={String(s)}>Mois {s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          size="sm" variant="outline" className="h-8 text-xs"
          onClick={() => onSave(date, pos)}
          disabled={!date}
        >
          Enregistrer
        </Button>
      </div>
      {ref_ && (
        <p className="text-xs text-muted-foreground mt-1">
          Ancrage actuel : {ref_.date_ancrage.slice(0, 7)} → Mois {ref_.semaine_cycle_ancrage} du cycle
        </p>
      )}
    </div>
  )
}
