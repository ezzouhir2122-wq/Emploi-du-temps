'use client'

import { useState, useMemo } from 'react'
import { calculerEquite } from '@/lib/equite'
import { Button } from '@/components/ui/button'
import { PageHeader, PageDivider } from '@/components/layout/PageHeader'
import { BarChart3 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type {
  Formateur, Groupe, PlanningFixe, RotationSamediConfig, CycleReference,
} from '@/types/planning'

interface Props {
  groupes: Groupe[]
  formateurs: Formateur[]
  planningFixe: PlanningFixe[]
  rotationConfig: RotationSamediConfig[]
  cycleReferences: CycleReference[]
}

type Periode = 'mois' | 'trimestre' | 'annee'

const MOIS_LABELS = [
  'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin',
  'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc',
]

export function SuiviEquiteClient({ groupes, formateurs, planningFixe, rotationConfig, cycleReferences }: Props) {
  const today = new Date()
  const [annee, setAnnee] = useState(today.getFullYear())
  const [mois, setMois] = useState(today.getMonth() + 1)
  const [periode, setPeriode] = useState<Periode>('mois')

  function getPlage(): { anneeDebut: number; moisDebut: number; anneeFin: number; moisFin: number } {
    if (periode === 'mois') {
      return { anneeDebut: annee, moisDebut: mois, anneeFin: annee, moisFin: mois }
    }
    if (periode === 'trimestre') {
      const debut = Math.floor((mois - 1) / 3) * 3 + 1
      return { anneeDebut: annee, moisDebut: debut, anneeFin: annee, moisFin: debut + 2 }
    }
    // annee
    return { anneeDebut: annee, moisDebut: 9, anneeFin: annee + 1, moisFin: 7 }
  }

  const compteurs = useMemo(() => calculerEquite({
    formateurs,
    planningFixe,
    rotationConfig,
    cycleReferences,
    ...getPlage(),
  }), [formateurs, planningFixe, rotationConfig, cycleReferences, annee, mois, periode])

  function libellePeriode() {
    if (periode === 'mois') return `${MOIS_LABELS[mois - 1]} ${annee}`
    if (periode === 'trimestre') {
      const q = Math.ceil(mois / 3)
      return `T${q} ${annee}`
    }
    return `Année formation ${annee}–${annee + 1}`
  }

  const cols = [
    { key: 'matin',              label: 'Matin',       className: 'text-blue-700' },
    { key: 'apresmidi',          label: 'Après-midi',  className: 'text-amber-700' },
    { key: 'distance',           label: 'Distance',    className: 'text-purple-700' },
    { key: 'repos',              label: 'Repos',       className: 'text-gray-500' },
    { key: 'samedis_travailles', label: 'Sam. trav.',  className: 'text-orange-600' },
    { key: 'total_heures',       label: 'Total (h)',   className: 'font-semibold' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <PageHeader
          icon={BarChart3}
          title="Suivi équité"
          subtitle="Compteurs par formateur sur la période sélectionnée."
          badge="Compteurs"
        />
        <PageDivider />
      </div>

      {/* Contrôles */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-md border">
          {(['mois', 'trimestre', 'annee'] as Periode[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriode(p)}
              className={cn(
                'px-3 py-1.5 text-sm transition-colors first:rounded-l-md last:rounded-r-md',
                periode === p
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted'
              )}
            >
              {p === 'mois' ? 'Mois' : p === 'trimestre' ? 'Trimestre' : 'Année'}
            </button>
          ))}
        </div>

        {periode !== 'annee' && (
          <select
            value={mois}
            onChange={e => setMois(Number(e.target.value))}
            className="h-8 rounded-md border text-sm px-2"
          >
            {MOIS_LABELS.map((m, i) => (
              <option key={i + 1} value={i + 1}>{m}</option>
            ))}
          </select>
        )}

        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" className="h-8 px-2" onClick={() => setAnnee(a => a - 1)}>−</Button>
          <span className="text-sm font-medium w-12 text-center">{annee}</span>
          <Button variant="outline" size="sm" className="h-8 px-2" onClick={() => setAnnee(a => a + 1)}>+</Button>
        </div>

        <span className="text-sm text-muted-foreground">→ {libellePeriode()}</span>
      </div>

      {/* Tables par groupe */}
      {groupes.map(groupe => {
        const formateursGroupe = compteurs.filter(c => c.formateur.groupe_id === groupe.id)
        if (formateursGroupe.length === 0) return null

        return (
          <div key={groupe.id} className="rounded-lg border bg-card">
            <div className="border-b px-4 py-3">
              <h2 className="font-semibold">{groupe.nom}</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground w-32">Formateur</th>
                    {cols.map(c => (
                      <th key={c.key} className={cn('px-4 py-2 text-center font-medium text-muted-foreground', c.className)}>
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {formateursGroupe.map(({ formateur, matin, apresmidi, distance, repos, samedis_travailles, total_heures }) => (
                    <tr key={formateur.id} className="hover:bg-muted/30">
                      <td className="px-4 py-2 font-medium">{formateur.nom}</td>
                      <td className="px-4 py-2 text-center text-blue-700 font-mono">{matin}</td>
                      <td className="px-4 py-2 text-center text-amber-700 font-mono">{apresmidi}</td>
                      <td className="px-4 py-2 text-center text-purple-700 font-mono">{distance}</td>
                      <td className="px-4 py-2 text-center text-gray-500 font-mono">{repos}</td>
                      <td className="px-4 py-2 text-center text-orange-600 font-mono">{samedis_travailles}</td>
                      <td className="px-4 py-2 text-center font-semibold font-mono">{total_heures}h</td>
                    </tr>
                  ))}
                </tbody>
                {/* Ligne totaux */}
                <tfoot>
                  <tr className="border-t bg-muted/30 font-medium">
                    <td className="px-4 py-2 text-muted-foreground">Total groupe</td>
                    {['matin', 'apresmidi', 'distance', 'repos', 'samedis_travailles', 'total_heures'].map(k => (
                      <td key={k} className="px-4 py-2 text-center font-mono">
                        {formateursGroupe.reduce((s, c) => s + (c as unknown as Record<string, number>)[k], 0)}
                        {k === 'total_heures' ? 'h' : ''}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )
      })}
    </div>
  )
}
