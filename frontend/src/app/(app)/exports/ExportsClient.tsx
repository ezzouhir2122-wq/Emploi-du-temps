'use client'

import { useState } from 'react'
import { FileSpreadsheet, FileText, File, Download, Users, Building2, Layers, BookOpen } from 'lucide-react'
import type { Formateur, Salle, Groupe, Pole, PlanningFixe, RotationSamediConfig, CycleReference } from '@/types/planning'
import type { ExportType } from '@/lib/export'

interface Props {
  formateurs: Formateur[]
  salles: Salle[]
  groupes: Groupe[]
  poles: Pole[]
  planningFixe: PlanningFixe[]
  rotationConfig: RotationSamediConfig[]
  cycleReferences: CycleReference[]
}

const MOIS_LABELS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]

const EXPORT_TYPES: { key: ExportType; label: string; desc: string; icon: React.ElementType }[] = [
  { key: 'formateur', label: 'Par Formateur',         desc: 'Un onglet / section par formateur', icon: Users },
  { key: 'salle',     label: 'Par Salle',             desc: 'Formateurs de chaque salle',        icon: Building2 },
  { key: 'pole',      label: 'Par Pôle',              desc: 'Formateurs regroupés par pôle',      icon: Layers },
  { key: 'groupe',    label: 'Par Groupe de Formation', desc: 'Planning du groupe (Lun–Sam)',     icon: BookOpen },
]

export function ExportsClient({ formateurs, salles, groupes, poles, planningFixe, rotationConfig, cycleReferences }: Props) {
  const now = new Date()
  const [annee, setAnnee] = useState(now.getFullYear())
  const [mois, setMois] = useState(now.getMonth() + 1)
  const [type, setType] = useState<ExportType>('formateur')
  const [loading, setLoading] = useState<string | null>(null)

  const params = { annee, mois, formateurs, salles, groupes, poles, planningFixe, rotationConfig, cycleReferences }

  async function handleExport(format: 'excel' | 'csv' | 'pdf') {
    setLoading(format)
    try {
      const { exportExcel, exportCSV, exportPDF } = await import('@/lib/export')
      if (format === 'excel') exportExcel(params, type)
      else if (format === 'csv') exportCSV(params, type)
      else await exportPDF(params, type)
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Download className="h-6 w-6 text-[#00968C]" />
          Exports des emplois du temps
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Générez un fichier Excel, CSV ou PDF pour le mois sélectionné.
        </p>
      </div>

      {/* Sélection mois / année */}
      <section className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-white/80 uppercase tracking-wide">
          1 — Période
        </h2>
        <div className="flex gap-3">
          <select
            value={mois}
            onChange={e => setMois(Number(e.target.value))}
            className="flex-1 rounded-lg border border-gray-300 dark:border-white/20 bg-white dark:bg-white/10 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#00968C]"
          >
            {MOIS_LABELS.map((label, i) => (
              <option key={i + 1} value={i + 1}>{label}</option>
            ))}
          </select>
          <select
            value={annee}
            onChange={e => setAnnee(Number(e.target.value))}
            className="w-28 rounded-lg border border-gray-300 dark:border-white/20 bg-white dark:bg-white/10 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#00968C]"
          >
            {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </section>

      {/* Sélection type */}
      <section className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-white/80 uppercase tracking-wide">
          2 — Type d&apos;emploi du temps
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {EXPORT_TYPES.map(({ key, label, desc, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setType(key)}
              className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-all ${
                type === key
                  ? 'border-[#00968C] bg-[#00968C]/10 dark:bg-[#00968C]/15'
                  : 'border-gray-200 dark:border-white/10 hover:border-[#00968C]/40 hover:bg-gray-50 dark:hover:bg-white/5'
              }`}
            >
              <Icon className={`h-5 w-5 mt-0.5 shrink-0 ${type === key ? 'text-[#00968C]' : 'text-gray-400 dark:text-white/40'}`} />
              <div>
                <p className={`text-sm font-medium ${type === key ? 'text-[#00968C] dark:text-[#00D4C8]' : 'text-gray-700 dark:text-white/70'}`}>
                  {label}
                </p>
                <p className="text-xs text-gray-400 dark:text-white/35 mt-0.5">{desc}</p>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Boutons export */}
      <section className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-white/80 uppercase tracking-wide">
          3 — Format de sortie
        </h2>
        <p className="text-xs text-gray-400 dark:text-white/40">
          Emploi du temps {EXPORT_TYPES.find(t => t.key === type)?.label.toLowerCase()} · {MOIS_LABELS[mois - 1]} {annee}
        </p>
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={() => handleExport('excel')}
            disabled={!!loading}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 px-4 py-2.5 text-sm font-semibold text-white transition-colors"
          >
            <FileSpreadsheet className="h-4 w-4" />
            {loading === 'excel' ? 'Export…' : 'Excel (.xlsx)'}
          </button>
          <button
            onClick={() => handleExport('csv')}
            disabled={!!loading}
            className="flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 px-4 py-2.5 text-sm font-semibold text-white transition-colors"
          >
            <FileText className="h-4 w-4" />
            {loading === 'csv' ? 'Export…' : 'CSV (.csv)'}
          </button>
          <button
            onClick={() => handleExport('pdf')}
            disabled={!!loading}
            className="flex items-center gap-2 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-60 px-4 py-2.5 text-sm font-semibold text-white transition-colors"
          >
            <File className="h-4 w-4" />
            {loading === 'pdf' ? 'Génération…' : 'PDF (.pdf)'}
          </button>
        </div>
      </section>

      {/* Résumé données */}
      <section className="rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/3 p-4">
        <p className="text-xs font-medium text-gray-500 dark:text-white/40 uppercase tracking-wide mb-3">Données disponibles</p>
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Formateurs', count: formateurs.length, icon: Users },
            { label: 'Salles', count: salles.length, icon: Building2 },
            { label: 'Pôles', count: poles.length, icon: Layers },
            { label: 'Groupes', count: groupes.length, icon: BookOpen },
          ].map(({ label, count, icon: Icon }) => (
            <div key={label} className="flex flex-col items-center rounded-lg bg-white dark:bg-white/5 border border-gray-100 dark:border-white/8 p-3">
              <Icon className="h-5 w-5 text-[#00968C] mb-1" />
              <span className="text-lg font-bold text-gray-900 dark:text-white">{count}</span>
              <span className="text-[10px] text-gray-400 dark:text-white/35 mt-0.5">{label}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
