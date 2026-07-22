'use client'

import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
  filiere: string          // nom filière (colonne "Filière")
  code_module: string      // colonne "Code Module"
  module: string           // colonne "Module" (intitulé)
  masse_horaire: number    // MHT total (ou S1+S2)
  semestre: string         // dérivé de MHT S1/S2 + Année de Formation
  mode: string             // toujours 'Présentiel' (non présent dans le fichier)
  ordre: number            // rang ligne
  // champs supplémentaires pour affichage dans l'aperçu
  secteur?: string
  niveau?: string
  annee_formation?: string
  mht_s1?: number
  mht_s2?: number
}

interface ImportResult {
  rows: ParsedRow[]
  errors: string[]
  warnings: string[]
}

// ── Normalisation entête ─────────────────────────────────────
// Mappe toutes les variantes possibles vers une clé interne normalisée
const COL_MAP: Record<string, string> = {
  // Filière
  'filière': 'filiere', 'filiere': 'filiere',
  // Code filière DRIF
  'code filière drif': 'code_filiere', 'code filiere drif': 'code_filiere',
  // Secteur
  'secteur': 'secteur',
  // Niveau
  'niveau de formation': 'niveau', 'niveau': 'niveau',
  // Année de formation
  'anneé de formation': 'annee_formation',
  'annee de formation': 'annee_formation',
  'année de formation': 'annee_formation',
  'annee formation': 'annee_formation',
  // Code module
  'code module': 'code_module', 'code_module': 'code_module',
  // Module (intitulé)
  'module': 'module', 'intitulé module': 'module', 'intitule module': 'module',
  // MHT S1
  'mht s1': 'mht_s1', 'mhts1': 'mht_s1', 'mht_s1': 'mht_s1',
  'masse horaire s1': 'mht_s1', 'mhs1': 'mht_s1',
  // MHT S2
  'mht s2': 'mht_s2', 'mhts2': 'mht_s2', 'mht_s2': 'mht_s2',
  'masse horaire s2': 'mht_s2', 'mhs2': 'mht_s2',
  // MHT total
  'mht': 'mht', 'masse horaire totale': 'mht', 'masse horaire': 'mht',
  'mht total': 'mht', 'masse horaire total': 'mht',
  // Mode (optionnel)
  'mode': 'mode',
}

function normalizeKey(h: string): string {
  const clean = h.toLowerCase().trim().replace(/[_]+/g, ' ')
  return COL_MAP[clean] ?? clean
}

function toNum(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0
  const n = Number(String(v).replace(/[^\d.]/g, ''))
  return isNaN(n) ? 0 : n
}

// Déduit le semestre à partir de Année de formation + colonne MHT
// Année 1 : S1 / S2 — Année 2 : S3 / S4 — Année 3 : S5 / S6
function deriveSemestre(anneeFo: string, mhtS1: number, mhtS2: number): string {
  const yr = parseInt(anneeFo) || 1
  const base = (yr - 1) * 2  // 0→1 pour an1, 2→3 pour an2, 4→5 pour an3
  if (mhtS1 > 0 && mhtS2 === 0) return `S${base + 1}`
  if (mhtS2 > 0 && mhtS1 === 0) return `S${base + 2}`
  if (mhtS1 > 0 && mhtS2 > 0)   return `S${base + 1}+S${base + 2}`
  return `S${base + 1}` // fallback
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

        if (raw.length === 0) { resolve({ rows: [], errors: ['Fichier vide'], warnings: [] }); return }

        // Normaliser les entêtes
        const norm = (row: Record<string, unknown>): Record<string, unknown> => {
          const out: Record<string, unknown> = {}
          for (const [k, v] of Object.entries(row)) out[normalizeKey(k)] = v
          return out
        }

        const firstNorm = norm(raw[0])
        const keys = Object.keys(firstNorm)

        // Vérifier colonnes minimales
        const hasFiliere  = keys.includes('filiere')
        const hasModule   = keys.includes('module') || keys.includes('code_module')
        const hasMHT      = keys.includes('mht') || keys.includes('mht_s1') || keys.includes('mht_s2')

        const errors: string[] = []
        const warnings: string[] = []

        if (!hasFiliere) errors.push('Colonne "Filière" introuvable')
        if (!hasModule)  errors.push('Colonne "Module" ou "Code Module" introuvable')
        if (!hasMHT)     errors.push('Aucune colonne de masse horaire (MHT, MHT S1 ou MHT S2) trouvée')
        if (errors.length > 0) { resolve({ rows: [], errors, warnings }); return }

        if (!keys.includes('annee_formation')) {
          warnings.push('Colonne "Année de formation" absente — semestre déduit sera "S1" par défaut')
        }

        const rows: ParsedRow[] = []

        raw.forEach((rawRow, i) => {
          const r = norm(rawRow)
          const lineNum = i + 2

          const filiere = String(r.filiere ?? '').trim()
          if (!filiere) return // ligne vide sur la colonne filière → ignorer silencieusement

          const codeModule = String(r.code_module ?? '').trim()
          const moduleNom  = String(r.module ?? codeModule).trim()
          if (!codeModule && !moduleNom) {
            errors.push(`Ligne ${lineNum} : Module et Code Module vides`)
            return
          }

          const mhtS1 = toNum(r.mht_s1)
          const mhtS2 = toNum(r.mht_s2)
          const mhtTotal = toNum(r.mht) || (mhtS1 + mhtS2) || 0

          if (mhtTotal === 0 && mhtS1 === 0 && mhtS2 === 0) {
            warnings.push(`Ligne ${lineNum} (${codeModule || moduleNom}) : masse horaire = 0, ignorée`)
            return
          }

          const anneeForStr = String(r.annee_formation ?? '1').trim()
          const semestre = deriveSemestre(anneeForStr, mhtS1, mhtS2)
          const masse = mhtTotal > 0 ? mhtTotal : (mhtS1 + mhtS2)

          rows.push({
            filiere,
            code_module: codeModule,
            module: codeModule ? `${codeModule} – ${moduleNom}` : moduleNom,
            masse_horaire: masse,
            semestre,
            mode: String(r.mode ?? 'Présentiel').trim() || 'Présentiel',
            ordre: i + 1,
            secteur: String(r.secteur ?? '').trim() || undefined,
            niveau: String(r.niveau ?? '').trim() || undefined,
            annee_formation: anneeForStr,
            mht_s1: mhtS1,
            mht_s2: mhtS2,
          })
        })

        if (rows.length === 0 && errors.length === 0) {
          errors.push('Aucune ligne valide trouvée dans le fichier')
        }

        resolve({ rows, errors, warnings })
      } catch (err) {
        resolve({ rows: [], errors: [`Impossible de lire le fichier : ${err}`], warnings: [] })
      }
    }
    reader.readAsArrayBuffer(file)
  })
}

// ── Composant ────────────────────────────────────────────────

export function ModelesAffectation({ poles, templates: initTemplates }: Props) {
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [templates, setTemplates] = useState<AffectationTemplate[]>(initTemplates)
  const [importing, setImporting] = useState(false)
  const [preview, setPreview] = useState<ImportResult | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const byFiliere = poles.map(p => ({
    pole: p,
    rows: templates.filter(t => t.filiere_id === p.id).sort((a, b) => a.ordre - b.ordre),
  })).filter(g => g.rows.length > 0)

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

    const filiereMap: Record<string, string> = {}
    for (const pole of poles) {
      filiereMap[pole.nom.toLowerCase().trim()] = pole.id
    }

    const toInsert: Omit<AffectationTemplate, 'id' | 'created_at'>[] = []
    const unknown = new Set<string>()

    for (const row of preview.rows) {
      const filiereId = filiereMap[row.filiere.toLowerCase().trim()]
      if (!filiereId) { unknown.add(row.filiere); continue }
      toInsert.push({
        filiere_id: filiereId,
        module: row.module,
        masse_horaire: row.masse_horaire,
        semestre: row.semestre,
        mode: row.mode,
        ordre: row.ordre,
      })
    }

    if (unknown.size > 0) {
      toast.warning(`Filières inconnues ignorées : ${[...unknown].join(', ')}`)
    }
    if (toInsert.length === 0) {
      toast.error('Aucune ligne à importer (filières non reconnues ?)')
      setImporting(false)
      return
    }

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
            <p className="text-sm font-semibold">Importer la carte de formation (Excel DRIF)</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-lg">
              Colonnes détectées automatiquement :{' '}
              <span className="font-mono text-[11px] bg-muted px-1 rounded">
                Secteur · Niveau de formation · Code Filière DRIF · Filière · Année de Formation · Code Module · Module · MHT S1 · MHT S2 · MHT
              </span>
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

      {/* ── Prévisualisation ── */}
      {preview && (
        <div className="rounded-xl border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">
              Aperçu — {preview.rows.length} module(s) valide(s)
            </p>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setPreview(null)}>
              Annuler
            </Button>
          </div>

          {/* Erreurs bloquantes */}
          {preview.errors.length > 0 && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 space-y-1">
              <p className="text-xs font-semibold text-red-700 flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5" /> {preview.errors.length} erreur(s) bloquante(s)
              </p>
              {preview.errors.map((e, i) => <p key={i} className="text-[11px] text-red-600">{e}</p>)}
            </div>
          )}

          {/* Avertissements non bloquants */}
          {preview.warnings.length > 0 && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 space-y-1">
              <p className="text-xs font-semibold text-amber-700 flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5" /> {preview.warnings.length} avertissement(s)
              </p>
              {preview.warnings.slice(0, 5).map((w, i) => <p key={i} className="text-[11px] text-amber-600">{w}</p>)}
              {preview.warnings.length > 5 && (
                <p className="text-[11px] text-amber-500 italic">… et {preview.warnings.length - 5} autres</p>
              )}
            </div>
          )}

          {/* Tableau aperçu */}
          {preview.rows.length > 0 && (
            <>
              <div className="overflow-x-auto rounded-lg border max-h-64">
                <table className="w-full text-xs">
                  <thead className="bg-muted/40 sticky top-0">
                    <tr>
                      {['Filière','Code Module','Module','Masse h.','S1','S2','Semestre','Mode'].map(h => (
                        <th key={h} className="text-left px-2.5 py-2 font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {preview.rows.map((r, i) => (
                      <tr key={i} className="hover:bg-muted/20">
                        <td className="px-2.5 py-1.5 font-medium text-[#003D70]">{r.filiere}</td>
                        <td className="px-2.5 py-1.5 font-mono text-[10px]">{r.code_module}</td>
                        <td className="px-2.5 py-1.5 max-w-[200px] truncate" title={r.module}>{r.module}</td>
                        <td className="px-2.5 py-1.5 text-center font-semibold">{r.masse_horaire}h</td>
                        <td className="px-2.5 py-1.5 text-center text-muted-foreground">{r.mht_s1 || '–'}</td>
                        <td className="px-2.5 py-1.5 text-center text-muted-foreground">{r.mht_s2 || '–'}</td>
                        <td className="px-2.5 py-1.5 text-center">
                          <Badge variant="outline" className="text-[10px] h-4 px-1">{r.semestre}</Badge>
                        </td>
                        <td className="px-2.5 py-1.5">
                          <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">{r.mode}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {preview.errors.length === 0 && (
                <Button
                  size="sm"
                  className="gap-2 bg-[#003D70] hover:bg-[#003D70]/90 text-white"
                  disabled={importing}
                  onClick={confirmImport}
                >
                  {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                  Confirmer l'import ({preview.rows.length} modules)
                </Button>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Modèles existants ── */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Modèles actuels ({byFiliere.length} filière{byFiliere.length !== 1 ? 's' : ''})
        </h3>

        {byFiliere.length === 0 && (
          <div className="rounded-xl border border-dashed bg-muted/10 p-8 text-center">
            <p className="text-sm text-muted-foreground">Aucun modèle importé</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Importez le fichier Excel DRIF ci-dessus</p>
          </div>
        )}

        {byFiliere.map(({ pole, rows }) => (
          <div key={pole.id} className="rounded-xl border bg-card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-[#003D70]" />
                <span className="text-sm font-semibold">{pole.nom}</span>
                <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                  {rows.length} module{rows.length !== 1 ? 's' : ''}
                </Badge>
              </div>
              <Button
                variant="ghost" size="sm"
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
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Code</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Module</th>
                    <th className="text-center px-3 py-2 font-medium text-muted-foreground w-[80px]">Masse h.</th>
                    <th className="text-center px-3 py-2 font-medium text-muted-foreground w-[70px]">Semestre</th>
                    <th className="text-center px-3 py-2 font-medium text-muted-foreground w-[100px]">Mode</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map(r => {
                    const [code, ...rest] = r.module.includes(' – ') ? r.module.split(' – ') : ['', r.module]
                    const nom = rest.join(' – ') || r.module
                    return (
                      <tr key={r.id} className="hover:bg-muted/10">
                        <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground">{code || '–'}</td>
                        <td className="px-3 py-2 font-medium">{nom}</td>
                        <td className="px-3 py-2 text-center font-semibold">{r.masse_horaire}h</td>
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
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {/* ── Dialog supprimer ── */}
      <AlertDialog open={!!confirmDelete} onOpenChange={o => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              Supprimer le modèle ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tous les modules du modèle pour cette filière seront supprimés. Les affectations déjà générées ne seront pas affectées.
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
