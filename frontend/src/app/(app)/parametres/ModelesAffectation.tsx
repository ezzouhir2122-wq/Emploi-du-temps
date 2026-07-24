'use client'

import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Upload, FileSpreadsheet, Trash2, AlertCircle, CheckCircle2, Loader2, ArrowRight, Link2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Pole, AffectationTemplate } from '@/types/planning'

interface Props {
  poles: Pole[]
  templates: AffectationTemplate[]
}

interface ParsedRow {
  filiere: string
  code_module: string
  module: string
  masse_horaire: number
  semestre: string
  mode: string
  ordre: number
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
  filiereNames: string[] // noms uniques de filières dans le fichier
}

// ── Normalisation entête ─────────────────────────────────────
const COL_MAP: Record<string, string> = {
  'filière': 'filiere', 'filiere': 'filiere',
  'code filière drif': 'code_filiere', 'code filiere drif': 'code_filiere',
  'secteur': 'secteur',
  'niveau de formation': 'niveau', 'niveau': 'niveau',
  'anneé de formation': 'annee_formation',
  'annee de formation': 'annee_formation',
  'année de formation': 'annee_formation',
  'annee formation': 'annee_formation',
  'code module': 'code_module', 'code_module': 'code_module',
  'module': 'module', 'intitulé module': 'module', 'intitule module': 'module',
  'mht s1': 'mht_s1', 'mhts1': 'mht_s1', 'mht_s1': 'mht_s1', 'masse horaire s1': 'mht_s1',
  'mht s2': 'mht_s2', 'mhts2': 'mht_s2', 'mht_s2': 'mht_s2', 'masse horaire s2': 'mht_s2',
  'mht': 'mht', 'masse horaire totale': 'mht', 'masse horaire': 'mht', 'mht total': 'mht',
  'mode': 'mode',
}

function normalizeKey(h: string): string {
  return COL_MAP[h.toLowerCase().trim().replace(/[_]+/g, ' ')] ?? h.toLowerCase().trim()
}

function toNum(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0
  const n = Number(String(v).replace(/[^\d.]/g, ''))
  return isNaN(n) ? 0 : n
}

function deriveSemestre(anneeFo: string, mhtS1: number, mhtS2: number): string {
  const yr = parseInt(anneeFo) || 1
  const base = (yr - 1) * 2
  if (mhtS1 > 0 && mhtS2 === 0) return `S${base + 1}`
  if (mhtS2 > 0 && mhtS1 === 0) return `S${base + 2}`
  if (mhtS1 > 0 && mhtS2 > 0)   return `S${base + 1}+S${base + 2}`
  return `S${base + 1}`
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

        if (raw.length === 0) { resolve({ rows: [], errors: ['Fichier vide'], warnings: [], filiereNames: [] }); return }

        const norm = (row: Record<string, unknown>) => {
          const out: Record<string, unknown> = {}
          for (const [k, v] of Object.entries(row)) out[normalizeKey(k)] = v
          return out
        }

        const firstNorm = norm(raw[0])
        const keys = Object.keys(firstNorm)
        const errors: string[] = []
        const warnings: string[] = []

        if (!keys.includes('filiere'))                                     errors.push('Colonne "Filière" introuvable')
        if (!keys.includes('module') && !keys.includes('code_module'))     errors.push('Colonne "Module" ou "Code Module" introuvable')
        if (!keys.includes('mht') && !keys.includes('mht_s1') && !keys.includes('mht_s2'))
          errors.push('Aucune colonne de masse horaire (MHT, MHT S1 ou MHT S2) trouvée')
        if (errors.length > 0) { resolve({ rows: [], errors, warnings, filiereNames: [] }); return }

        if (!keys.includes('annee_formation')) warnings.push('Colonne "Année de formation" absente — semestre déduit sera S1 par défaut')

        const rows: ParsedRow[] = []
        const filiereSet = new Set<string>()

        raw.forEach((rawRow, i) => {
          const r = norm(rawRow)
          const filiere = String(r.filiere ?? '').trim()
          if (!filiere) return
          filiereSet.add(filiere)

          const codeModule = String(r.code_module ?? '').trim()
          const moduleNom  = String(r.module ?? codeModule).trim()
          if (!codeModule && !moduleNom) { errors.push(`Ligne ${i + 2} : Module vide`); return }

          const mhtS1 = toNum(r.mht_s1)
          const mhtS2 = toNum(r.mht_s2)
          const mhtTotal = toNum(r.mht) || (mhtS1 + mhtS2)
          if (mhtTotal === 0) { warnings.push(`Ligne ${i + 2} (${codeModule || moduleNom}) : MHT = 0, ignorée`); return }

          const anneeForStr = String(r.annee_formation ?? '1').trim()
          rows.push({
            filiere,
            code_module: codeModule,
            module: codeModule ? `${codeModule} – ${moduleNom}` : moduleNom,
            masse_horaire: mhtTotal,
            semestre: deriveSemestre(anneeForStr, mhtS1, mhtS2),
            mode: String(r.mode ?? 'Présentiel').trim() || 'Présentiel',
            ordre: i + 1,
            secteur: String(r.secteur ?? '').trim() || undefined,
            niveau: String(r.niveau ?? '').trim() || undefined,
            annee_formation: anneeForStr,
            mht_s1: mhtS1,
            mht_s2: mhtS2,
          })
        })

        resolve({ rows, errors, warnings, filiereNames: [...filiereSet] })
      } catch (err) {
        resolve({ rows: [], errors: [`Impossible de lire le fichier : ${err}`], warnings: [], filiereNames: [] })
      }
    }
    reader.readAsArrayBuffer(file)
  })
}

// ── Composant principal ──────────────────────────────────────

export function ModelesAffectation({ poles, templates: initTemplates }: Props) {
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [templates, setTemplates] = useState<AffectationTemplate[]>(initTemplates)
  const [importing, setImporting] = useState(false)
  const [preview, setPreview] = useState<ImportResult | null>(null)
  // Mappage filière Excel → pole_id
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const byFiliere = poles.map(p => ({
    pole: p,
    rows: templates.filter(t => t.filiere_id === p.id).sort((a, b) => a.ordre - b.ordre),
  })).filter(g => g.rows.length > 0)

  // ── Chargement fichier ────────────────────────────────────
  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) { toast.error('Format non supporté'); return }
    setImporting(true)
    const result = await parseExcel(file)
    // Pré-remplir mapping par correspondance automatique (lowercase trim)
    const autoMap: Record<string, string> = {}
    for (const fn of result.filiereNames) {
      const match = poles.find(p => p.nom.toLowerCase().trim() === fn.toLowerCase().trim())
      if (match) autoMap[fn] = match.id
    }
    setMapping(autoMap)
    setPreview(result)
    setImporting(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  // ── Import effectif ───────────────────────────────────────
  async function confirmImport() {
    if (!preview || preview.rows.length === 0) return

    // Vérifier que toutes les filières sont mappées
    const unmapped = preview.filiereNames.filter(fn => !mapping[fn])
    if (unmapped.length > 0) {
      toast.error(`Mappez d'abord toutes les filières : ${unmapped.join(', ')}`)
      return
    }

    setImporting(true)
    const toInsert: Omit<AffectationTemplate, 'id' | 'created_at'>[] = []

    for (const row of preview.rows) {
      const filiereId = mapping[row.filiere]
      if (!filiereId) continue
      toInsert.push({
        filiere_id: filiereId,
        module: row.module,
        masse_horaire: row.masse_horaire,
        semestre: row.semestre,
        mode: row.mode,
        ordre: row.ordre,
      })
    }

    if (toInsert.length === 0) { toast.error('Aucune ligne à importer'); setImporting(false); return }

    const filiereIds = [...new Set(toInsert.map(r => r.filiere_id))]
    await supabase.from('affectation_templates').delete().in('filiere_id', filiereIds)

    const { data, error } = await supabase.from('affectation_templates').insert(toInsert).select()
    if (error) { toast.error(`Erreur : ${error.message}`); setImporting(false); return }

    setTemplates(prev => [
      ...prev.filter(t => !filiereIds.includes(t.filiere_id)),
      ...(data as AffectationTemplate[]),
    ])
    toast.success(`${data.length} modules importés avec succès`)
    setPreview(null)
    setMapping({})
    setImporting(false)
  }

  async function deleteFiliere(filiereId: string) {
    const { error } = await supabase.from('affectation_templates').delete().eq('filiere_id', filiereId)
    if (error) { toast.error('Erreur suppression'); return }
    setTemplates(prev => prev.filter(t => t.filiere_id !== filiereId))
    toast.success('Modèle supprimé')
    setConfirmDelete(null)
  }

  const allMapped = preview ? preview.filiereNames.every(fn => !!mapping[fn]) : false

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
            <p className="text-xs text-muted-foreground mt-1">
              Format reconnu :{' '}
              <span className="font-mono text-[10px] bg-muted px-1 rounded">
                Secteur · Niveau de formation · Code Filière DRIF · Filière · Année de Formation · Code Module · Module · MHT S1 · MHT S2 · MHT
              </span>
            </p>
          </div>
          <Button size="sm" variant="outline" className="gap-2" disabled={importing}
            onClick={() => fileRef.current?.click()}>
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Choisir un fichier (.xlsx / .csv)
          </Button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
        </div>
      </div>

      {/* ── Prévisualisation + Mappage ── */}
      {preview && (
        <div className="rounded-xl border bg-card p-5 space-y-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">{preview.rows.length} module(s) détecté(s)</p>
            <Button variant="ghost" size="sm" className="h-7 text-xs"
              onClick={() => { setPreview(null); setMapping({}) }}>Annuler</Button>
          </div>

          {/* Erreurs */}
          {preview.errors.length > 0 && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 space-y-1">
              <p className="text-xs font-semibold text-red-700 flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5" /> {preview.errors.length} erreur(s)
              </p>
              {preview.errors.map((e, i) => <p key={i} className="text-[11px] text-red-600">{e}</p>)}
            </div>
          )}

          {/* Avertissements */}
          {preview.warnings.length > 0 && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 space-y-1">
              <p className="text-xs font-semibold text-amber-700 flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5" /> {preview.warnings.length} avertissement(s)
              </p>
              {preview.warnings.slice(0, 4).map((w, i) => <p key={i} className="text-[11px] text-amber-600">{w}</p>)}
              {preview.warnings.length > 4 && <p className="text-[11px] text-amber-500 italic">… et {preview.warnings.length - 4} autres</p>}
            </div>
          )}

          {/* ── Mappage filières ── */}
          {preview.errors.length === 0 && preview.filiereNames.length > 0 && (
            <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Link2 className="h-4 w-4 text-[#003D70]" />
                <p className="text-sm font-semibold">Correspondance Filières Excel → Pôles de l'application</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Associez chaque filière du fichier à un pôle existant dans l'application.
              </p>
              <div className="space-y-2">
                {preview.filiereNames.map(fn => {
                  const count = preview.rows.filter(r => r.filiere === fn).length
                  const isMatched = !!mapping[fn]
                  return (
                    <div key={fn} className={`flex items-center gap-3 rounded-lg border p-2.5 ${isMatched ? 'border-emerald-200 bg-emerald-50/50' : 'border-amber-200 bg-amber-50/50'}`}>
                      {/* Filière Excel */}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate">{fn}</p>
                        <p className="text-[10px] text-muted-foreground">{count} module{count > 1 ? 's' : ''}</p>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      {/* Sélection pôle */}
                      <div className="w-56 shrink-0">
                        <Select
                          value={mapping[fn] ?? 'none'}
                          onValueChange={v => setMapping(prev => ({ ...prev, [fn]: v === 'none' ? '' : v }))}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <span className="truncate">
                              {mapping[fn] ? poles.find(p => p.id === mapping[fn])?.nom : '— Sélectionner un pôle —'}
                            </span>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none" className="text-xs text-muted-foreground">— Sélectionner un pôle —</SelectItem>
                            {poles.map(p => (
                              <SelectItem key={p.id} value={p.id} className="text-xs">{p.nom}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {/* Indicateur */}
                      {isMatched
                        ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                        : <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
                      }
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Tableau aperçu */}
          {preview.rows.length > 0 && preview.errors.length === 0 && (
            <div className="overflow-x-auto rounded-lg border max-h-56">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 sticky top-0">
                  <tr>
                    {['Filière','Code','Module','Masse h.','S1','S2','Semestre'].map(h => (
                      <th key={h} className="text-left px-2.5 py-2 font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {preview.rows.slice(0, 50).map((r, i) => (
                    <tr key={i} className="hover:bg-muted/20">
                      <td className="px-2.5 py-1.5 text-[#003D70] font-medium max-w-[140px] truncate">{r.filiere}</td>
                      <td className="px-2.5 py-1.5 font-mono text-[10px]">{r.code_module}</td>
                      <td className="px-2.5 py-1.5 max-w-[180px] truncate" title={r.module}>{r.module}</td>
                      <td className="px-2.5 py-1.5 text-center font-semibold">{r.masse_horaire}h</td>
                      <td className="px-2.5 py-1.5 text-center text-muted-foreground">{r.mht_s1 || '–'}</td>
                      <td className="px-2.5 py-1.5 text-center text-muted-foreground">{r.mht_s2 || '–'}</td>
                      <td className="px-2.5 py-1.5 text-center">
                        <Badge variant="outline" className="text-[10px] h-4 px-1">{r.semestre}</Badge>
                      </td>
                    </tr>
                  ))}
                  {preview.rows.length > 50 && (
                    <tr><td colSpan={7} className="px-3 py-2 text-center text-[11px] text-muted-foreground italic">… {preview.rows.length - 50} lignes supplémentaires</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Bouton confirmer */}
          {preview.errors.length === 0 && preview.rows.length > 0 && (
            <Button
              size="sm"
              className={`gap-2 text-white ${allMapped ? 'bg-[#003D70] hover:bg-[#003D70]/90' : 'bg-slate-400 cursor-not-allowed'}`}
              disabled={importing || !allMapped}
              onClick={confirmImport}
              title={!allMapped ? 'Associez toutes les filières avant de confirmer' : ''}
            >
              {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              {allMapped
                ? `Confirmer l'import (${preview.rows.length} modules)`
                : `En attente de mappage (${preview.filiereNames.filter(fn => !mapping[fn]).length} filière(s) non associée(s))`
              }
            </Button>
          )}
        </div>
      )}

      {/* ── Modèles existants ── */}
      <div className="space-y-4">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
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
              <Button variant="ghost" size="sm"
                className="h-7 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 gap-1"
                onClick={() => setConfirmDelete(pole.id)}>
                <Trash2 className="h-3 w-3" /> Supprimer
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/20">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground w-24">Code</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Module</th>
                    <th className="text-center px-3 py-2 font-medium text-muted-foreground w-20">Masse h.</th>
                    <th className="text-center px-3 py-2 font-medium text-muted-foreground w-20">Semestre</th>
                    <th className="text-center px-3 py-2 font-medium text-muted-foreground w-24">Mode</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map(r => {
                    const [code, ...rest] = r.module.includes(' – ') ? r.module.split(' – ') : ['', r.module]
                    const nom = rest.join(' – ') || r.module
                    return (
                      <tr key={r.id} className="hover:bg-muted/10">
                        <td className="px-3 py-1.5 font-mono text-[10px] text-muted-foreground">{code || '–'}</td>
                        <td className="px-3 py-1.5 font-medium">{nom}</td>
                        <td className="px-3 py-1.5 text-center font-semibold">{r.masse_horaire}h</td>
                        <td className="px-3 py-1.5 text-center">
                          <Badge variant="outline" className="text-[10px] h-4 px-1">{r.semestre}</Badge>
                        </td>
                        <td className="px-3 py-1.5 text-center">
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
              <AlertCircle className="h-5 w-5 text-red-500" /> Supprimer le modèle ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tous les modules du modèle pour cette filière seront supprimés. Les affectations déjà générées ne seront pas affectées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700"
              onClick={() => confirmDelete && deleteFiliere(confirmDelete)}>
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
