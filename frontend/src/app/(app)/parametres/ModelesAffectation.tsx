'use client'

import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Upload, FileSpreadsheet, Trash2, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Pole, AffectationTemplate } from '@/types/planning'

interface Props {
  poles: Pole[]
  templates: AffectationTemplate[]
}

interface ParsedRow {
  filiere: string
  module: string
  masse_horaire: number
  semestre: string
  mode: string
  ordre: number
}

interface ImportResult {
  rows: ParsedRow[]
  errors: string[]
}

const REQUIRED_COLS = ['filiere', 'module', 'masse_horaire', 'semestre', 'mode', 'ordre']
const COL_ALIASES: Record<string, string> = {
  'filière': 'filiere', 'filiere': 'filiere',
  'module': 'module',
  'masse horaire': 'masse_horaire', 'masse_horaire': 'masse_horaire', 'masshoraire': 'masse_horaire',
  'semestre': 'semestre',
  'mode': 'mode',
  'ordre': 'ordre',
}

function normalizeHeader(h: string): string {
  return COL_ALIASES[h.toLowerCase().trim().replace(/[_\s]+/g, ' ')] ?? h.toLowerCase().trim()
}

function parseExcel(file: File): Promise<ImportResult> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const raw: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws, { defval: '' })

        if (raw.length === 0) { resolve({ rows: [], errors: ['Fichier vide'] }); return }

        const firstRow = raw[0]
        const headers = Object.keys(firstRow).map(normalizeHeader)
        const missingCols = REQUIRED_COLS.filter(c => !headers.includes(c))
        if (missingCols.length > 0) {
          resolve({ rows: [], errors: [`Colonnes manquantes : ${missingCols.join(', ')}`] })
          return
        }

        const errors: string[] = []
        const rows: ParsedRow[] = []

        raw.forEach((row, i) => {
          const norm: Record<string, unknown> = {}
          for (const [k, v] of Object.entries(row)) {
            const nk = normalizeHeader(k)
            norm[nk] = v
          }
          const filiere = String(norm.filiere ?? '').trim()
          const module = String(norm.module ?? '').trim()
          const massH = Number(norm.masse_horaire)
          const semestre = String(norm.semestre ?? '').trim()
          const mode = String(norm.mode ?? 'Présentiel').trim()
          const ordre = Number(norm.ordre ?? i + 1)

          if (!filiere) { errors.push(`Ligne ${i + 2} : Filière vide`); return }
          if (!module) { errors.push(`Ligne ${i + 2} : Module vide`); return }
          if (isNaN(massH) || massH <= 0) { errors.push(`Ligne ${i + 2} : Masse horaire invalide`); return }
          if (!semestre) { errors.push(`Ligne ${i + 2} : Semestre vide`); return }

          rows.push({ filiere, module, masse_horaire: massH, semestre, mode: mode || 'Présentiel', ordre: isNaN(ordre) ? i + 1 : ordre })
        })

        resolve({ rows, errors })
      } catch {
        resolve({ rows: [], errors: ['Impossible de lire le fichier Excel'] })
      }
    }
    reader.readAsArrayBuffer(file)
  })
}

export function ModelesAffectation({ poles, templates: initTemplates }: Props) {
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [templates, setTemplates] = useState<AffectationTemplate[]>(initTemplates)
  const [importing, setImporting] = useState(false)
  const [preview, setPreview] = useState<ImportResult | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null) // filiere_id

  // ── Grouper templates par filière ────────────────────────
  const byFiliere = poles.map(p => ({
    pole: p,
    rows: templates.filter(t => t.filiere_id === p.id).sort((a, b) => a.ordre - b.ordre),
  })).filter(g => g.rows.length > 0)

  // ── Gestion fichier ───────────────────────────────────────
  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      toast.error('Format non supporté — utilisez .xlsx, .xls ou .csv')
      return
    }
    setImporting(true)
    const result = await parseExcel(file)
    setPreview(result)
    setImporting(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function confirmImport() {
    if (!preview || preview.rows.length === 0) return
    setImporting(true)

    // Résoudre les noms de filières vers des IDs
    const rows = preview.rows
    const filiereMap: Record<string, string> = {}
    for (const pole of poles) {
      filiereMap[pole.nom.toLowerCase().trim()] = pole.id
    }

    const toInsert: Omit<AffectationTemplate, 'id' | 'created_at'>[] = []
    const unknown: string[] = []

    for (const row of rows) {
      const filiereId = filiereMap[row.filiere.toLowerCase().trim()]
      if (!filiereId) { unknown.push(row.filiere); continue }
      toInsert.push({ filiere_id: filiereId, module: row.module, masse_horaire: row.masse_horaire, semestre: row.semestre, mode: row.mode, ordre: row.ordre })
    }

    if (unknown.length > 0) {
      toast.warning(`Filières inconnues ignorées : ${[...new Set(unknown)].join(', ')}`)
    }

    if (toInsert.length === 0) { toast.error('Aucune ligne valide à importer'); setImporting(false); return }

    // Supprimer les anciens modèles des filières concernées
    const filiereIds = [...new Set(toInsert.map(r => r.filiere_id))]
    await supabase.from('affectation_templates').delete().in('filiere_id', filiereIds)

    const { data, error } = await supabase.from('affectation_templates').insert(toInsert).select()
    if (error) { toast.error(`Erreur import : ${error.message}`); setImporting(false); return }

    setTemplates(prev => [
      ...prev.filter(t => !filiereIds.includes(t.filiere_id)),
      ...(data as AffectationTemplate[]),
    ])
    toast.success(`${data.length} modules importés avec succès`)
    setPreview(null)
    setImporting(false)
  }

  async function deleteFiliere(filiereId: string) {
    const { error } = await supabase.from('affectation_templates').delete().eq('filiere_id', filiereId)
    if (error) { toast.error('Erreur suppression'); return }
    setTemplates(prev => prev.filter(t => t.filiere_id !== filiereId))
    toast.success('Modèle supprimé')
    setConfirmDelete(null)
  }

  return (
    <div className="space-y-6">
      {/* ── Zone import ── */}
      <div className="rounded-xl border-2 border-dashed border-border bg-muted/20 p-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#003D70]/10">
            <FileSpreadsheet className="h-6 w-6 text-[#003D70]" />
          </div>
          <div>
            <p className="text-sm font-semibold">Importer un modèle Excel</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Colonnes requises : <span className="font-mono text-[11px]">Filière · Module · Masse horaire · Semestre · Mode · Ordre</span>
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="gap-2"
            disabled={importing}
            onClick={() => fileRef.current?.click()}
          >
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Choisir un fichier (.xlsx / .csv)
          </Button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
        </div>
      </div>

      {/* ── Prévisualisation avant import ── */}
      {preview && (
        <div className="rounded-xl border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Aperçu — {preview.rows.length} ligne(s) valide(s)</p>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setPreview(null)}>Annuler</Button>
          </div>

          {preview.errors.length > 0 && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 space-y-1">
              <p className="text-xs font-semibold text-red-700 flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5" /> {preview.errors.length} erreur(s)
              </p>
              {preview.errors.slice(0, 5).map((e, i) => (
                <p key={i} className="text-[11px] text-red-600">{e}</p>
              ))}
              {preview.errors.length > 5 && (
                <p className="text-[11px] text-red-500 italic">… et {preview.errors.length - 5} autres</p>
              )}
            </div>
          )}

          {preview.rows.length > 0 && (
            <>
              <div className="overflow-x-auto rounded-lg border max-h-48">
                <table className="w-full text-xs">
                  <thead className="bg-muted/40 sticky top-0">
                    <tr>
                      {['Filière','Module','Masse h.','Semestre','Mode','Ordre'].map(h => (
                        <th key={h} className="text-left px-3 py-2 font-medium text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {preview.rows.map((r, i) => (
                      <tr key={i} className="hover:bg-muted/20">
                        <td className="px-3 py-1.5 font-medium">{r.filiere}</td>
                        <td className="px-3 py-1.5">{r.module}</td>
                        <td className="px-3 py-1.5 text-center">{r.masse_horaire}h</td>
                        <td className="px-3 py-1.5 text-center">{r.semestre}</td>
                        <td className="px-3 py-1.5 text-center">{r.mode}</td>
                        <td className="px-3 py-1.5 text-center text-muted-foreground">{r.ordre}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Button
                size="sm"
                className="gap-2 bg-[#003D70] hover:bg-[#003D70]/90 text-white"
                disabled={importing}
                onClick={confirmImport}
              >
                {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                Confirmer l'import ({preview.rows.length} modules)
              </Button>
            </>
          )}
        </div>
      )}

      {/* ── Modèles existants ── */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Modèles actuels ({byFiliere.length} filière{byFiliere.length > 1 ? 's' : ''})
        </h3>

        {byFiliere.length === 0 && (
          <div className="rounded-xl border border-dashed bg-muted/10 p-8 text-center">
            <p className="text-sm text-muted-foreground">Aucun modèle importé</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Importez un fichier Excel pour commencer</p>
          </div>
        )}

        {byFiliere.map(({ pole, rows }) => (
          <div key={pole.id} className="rounded-xl border bg-card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-[#003D70]" />
                <span className="text-sm font-semibold">{pole.nom}</span>
                <Badge variant="outline" className="text-[10px] h-4 px-1.5">{rows.length} module{rows.length > 1 ? 's' : ''}</Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 gap-1"
                onClick={() => setConfirmDelete(pole.id)}
              >
                <Trash2 className="h-3 w-3" /> Supprimer
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/20">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Module</th>
                    <th className="text-center px-3 py-2 font-medium text-muted-foreground w-[90px]">Masse h.</th>
                    <th className="text-center px-3 py-2 font-medium text-muted-foreground w-[70px]">Semestre</th>
                    <th className="text-center px-3 py-2 font-medium text-muted-foreground w-[100px]">Mode</th>
                    <th className="text-center px-3 py-2 font-medium text-muted-foreground w-[60px]">Ordre</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map(r => (
                    <tr key={r.id} className="hover:bg-muted/10">
                      <td className="px-3 py-2 font-medium">{r.module}</td>
                      <td className="px-3 py-2 text-center">{r.masse_horaire}h</td>
                      <td className="px-3 py-2 text-center">
                        <Badge variant="outline" className="text-[10px] h-4 px-1">{r.semestre}</Badge>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium ${
                          r.mode === 'FAD' ? 'bg-violet-100 text-violet-700' :
                          r.mode === 'Mixte' ? 'bg-amber-100 text-amber-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>{r.mode}</span>
                      </td>
                      <td className="px-3 py-2 text-center text-muted-foreground">{r.ordre}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {/* ── Dialog supprimer filière ── */}
      <AlertDialog open={!!confirmDelete} onOpenChange={o => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              Supprimer le modèle ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Cela supprimera tous les modules du modèle pour cette filière. Les affectations déjà générées ne seront pas affectées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => confirmDelete && deleteFiliere(confirmDelete)}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
