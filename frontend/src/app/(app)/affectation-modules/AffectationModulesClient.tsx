'use client'

import { useState, useMemo, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { BookOpen, Zap, RefreshCw, AlertTriangle, Loader2, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import type { Pole, Groupe, Formateur, AffectationModule, AffectationTemplate } from '@/types/planning'

// ── Années scolaires disponibles ──────────────────────────────
function getAnnees(): string[] {
  const current = new Date().getFullYear()
  return [current - 1, current, current + 1].map(y => `${y}-${y + 1}`)
}

interface Props {
  poles: Pole[]
  groupes: Groupe[]
  formateurs: Formateur[]
  affectations: AffectationModule[]
  templates: AffectationTemplate[]
}

export function AffectationModulesClient({ poles, groupes, formateurs, affectations: initAffectations, templates }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const annees = getAnnees()
  const currentYear = annees[1]
  const [annee, setAnnee] = useState(currentYear)
  const [filiereId, setFiliereId] = useState<string>('all')
  const [affectations, setAffectations] = useState<AffectationModule[]>(initAffectations)
  const [loading, setLoading] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)

  // ── Groupes par filière ───────────────────────────────────
  const groupesParFiliere = useMemo(() => {
    const map: Record<string, Groupe[]> = {}
    for (const g of groupes) {
      if (!g.pole_id) continue
      if (!map[g.pole_id]) map[g.pole_id] = []
      map[g.pole_id].push(g)
    }
    return map
  }, [groupes])

  // ── Filières filtrées ─────────────────────────────────────
  const filteredPoles = filiereId === 'all' ? poles : poles.filter(p => p.id === filiereId)

  // ── Affectations filtrées ─────────────────────────────────
  const filtered = useMemo(() => {
    return affectations.filter(a =>
      a.annee === annee &&
      (filiereId === 'all' || a.filiere_id === filiereId)
    )
  }, [affectations, annee, filiereId])

  // ── Existe déjà ? ─────────────────────────────────────────
  function existsForFiliere(poleId: string): boolean {
    return affectations.some(a => a.filiere_id === poleId && a.annee === annee)
  }

  // ── Générer (avec vérif doublon) ─────────────────────────
  async function doGenerate(targetPoleId: string | null, force = false) {
    const targetPoles = targetPoleId ? poles.filter(p => p.id === targetPoleId) : poles
    if (!force) {
      const hasExisting = targetPoles.some(p => existsForFiliere(p.id))
      if (hasExisting) { setConfirmOpen(true); return }
    }
    setLoading(true)
    try {
      for (const pole of targetPoles) {
        const poleTemplates = templates.filter(t => t.filiere_id === pole.id).sort((a, b) => a.ordre - b.ordre)
        if (poleTemplates.length === 0) {
          toast.warning(`Aucun modèle pour ${pole.nom} — ignoré`)
          continue
        }
        const poleGroupes = groupesParFiliere[pole.id] ?? []
        if (poleGroupes.length === 0) {
          toast.warning(`Aucun groupe pour ${pole.nom} — ignoré`)
          continue
        }

        // Supprimer les affectations existantes pour cette filière + année
        await supabase.from('affectations_modules')
          .delete()
          .eq('filiere_id', pole.id)
          .eq('annee', annee)

        // Générer pour chaque groupe × chaque module
        const rows = poleGroupes.flatMap(groupe =>
          poleTemplates.map(t => ({
            filiere_id: pole.id,
            groupe_id: groupe.id,
            annee,
            module: t.module,
            masse_horaire: t.masse_horaire,
            semestre: t.semestre,
            mode: t.mode,
            ordre: t.ordre,
            formateur_id: null,
            etat: 'Non affecté',
          }))
        )

        const { data, error } = await supabase
          .from('affectations_modules')
          .insert(rows)
          .select()

        if (error) { toast.error(`Erreur pour ${pole.nom}: ${error.message}`); continue }
        setAffectations(prev => [
          ...prev.filter(a => !(a.filiere_id === pole.id && a.annee === annee)),
          ...(data as AffectationModule[]),
        ])
        toast.success(`${pole.nom} — ${data.length} affectations générées`)
      }
    } finally {
      setLoading(false)
      setConfirmOpen(false)
    }
  }

  // ── Affecter formateur ────────────────────────────────────
  async function handleFormateurChange(affId: string, formateurId: string | null) {
    setSavingId(affId)
    const etat: AffectationModule['etat'] = formateurId ? 'Affecté' : 'Non affecté'
    const { error } = await supabase
      .from('affectations_modules')
      .update({ formateur_id: formateurId, etat })
      .eq('id', affId)

    if (error) { toast.error('Erreur lors de la mise à jour'); setSavingId(null); return }
    setAffectations(prev => prev.map(a =>
      a.id === affId ? { ...a, formateur_id: formateurId, etat } : a
    ))
    toast.success(formateurId ? 'Formateur affecté' : 'Formateur retiré')
    setSavingId(null)
  }

  // ── Stats ─────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total: filtered.length,
    affecte: filtered.filter(a => a.etat === 'Affecté').length,
  }), [filtered])

  // ── Templates disponibles par filière ────────────────────
  const templatesByFiliere = useMemo(() => {
    const map: Record<string, number> = {}
    for (const t of templates) {
      map[t.filiere_id] = (map[t.filiere_id] ?? 0) + 1
    }
    return map
  }, [templates])

  return (
    <div className="flex flex-col h-full bg-background">

      {/* ── En-tête ── */}
      <div className="border-b bg-card px-6 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#003D70] text-white shadow">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">Affectation des Modules</h1>
              <p className="text-xs text-muted-foreground">Génération automatique par filière et groupe</p>
            </div>
          </div>

          {/* Stats */}
          <div className="flex gap-3 text-center">
            <div className="rounded-lg border bg-muted/30 px-4 py-2">
              <p className="text-[11px] text-muted-foreground">Total</p>
              <p className="text-xl font-bold">{stats.total}</p>
            </div>
            <div className="rounded-lg border bg-emerald-50 px-4 py-2">
              <p className="text-[11px] text-emerald-600">Affectés</p>
              <p className="text-xl font-bold text-emerald-700">{stats.affecte}</p>
            </div>
            <div className="rounded-lg border bg-slate-50 px-4 py-2">
              <p className="text-[11px] text-slate-500">En attente</p>
              <p className="text-xl font-bold text-slate-600">{stats.total - stats.affecte}</p>
            </div>
          </div>
        </div>

        {/* ── Filtres + bouton ── */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-muted-foreground whitespace-nowrap">Année :</label>
            <Select value={annee} onValueChange={v => v && setAnnee(v)}>
              <SelectTrigger className="h-8 w-32 text-xs">
                <span>{annee}</span>
              </SelectTrigger>
              <SelectContent>
                {annees.map(a => <SelectItem key={a} value={a} className="text-xs">{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-muted-foreground whitespace-nowrap">Filière :</label>
            <Select value={filiereId} onValueChange={v => v && setFiliereId(v)}>
              <SelectTrigger className="h-8 w-52 text-xs">
                <span className="truncate">
                  {filiereId === 'all'
                    ? 'Toutes les filières'
                    : poles.find(p => p.id === filiereId)?.nom ?? 'Filière'}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">Toutes les filières</SelectItem>
                {poles.map(p => (
                  <SelectItem key={p.id} value={p.id} className="text-xs">
                    {p.nom}
                    {templatesByFiliere[p.id] ? ` · ${templatesByFiliere[p.id]} modules` : ' — aucun modèle'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            size="sm"
            className="h-8 gap-1.5 bg-[#003D70] hover:bg-[#003D70]/90 text-white ml-auto"
            disabled={loading}
            onClick={() => doGenerate(filiereId === 'all' ? null : filiereId)}
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
            Générer les affectations
          </Button>
        </div>
      </div>

      {/* ── Tableau ── */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
            <BookOpen className="h-12 w-12 text-muted-foreground/30" />
            <div>
              <p className="text-sm font-medium text-muted-foreground">Aucune affectation pour {annee}</p>
              {templates.length === 0 ? (
                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-6 py-4 text-left max-w-sm mx-auto">
                  <p className="text-xs font-semibold text-amber-800 mb-2">Étapes à suivre :</p>
                  <ol className="text-xs text-amber-700 space-y-1.5 list-decimal list-inside">
                    <li>Préparez un fichier Excel avec les colonnes :<br/>
                      <span className="font-mono text-[10px]">Filière · Module · Masse horaire · Semestre · Mode · Ordre</span>
                    </li>
                    <li>Allez dans <strong>Paramètres → Modèles d'affectation</strong> et importez le fichier</li>
                    <li>Revenez ici et cliquez sur <strong>Générer les affectations</strong></li>
                  </ol>
                  <Link
                    href="/parametres?tab=modeles"
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 transition-colors"
                  >
                    <ArrowRight className="h-3.5 w-3.5" />
                    Aller dans Paramètres → Modèles
                  </Link>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground/60 mt-1">
                  Sélectionnez une filière et cliquez sur « Générer les affectations »
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {filteredPoles.map(pole => {
              const poleAffectations = filtered.filter(a => a.filiere_id === pole.id)
              if (poleAffectations.length === 0) return null
              const poleGroupes = groupesParFiliere[pole.id] ?? []

              return (
                <div key={pole.id} className="rounded-xl border bg-card overflow-hidden shadow-sm">
                  {/* En-tête filière */}
                  <div className="bg-[#003D70]/5 border-b px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-[#003D70]" />
                      <h2 className="text-sm font-semibold text-[#003D70]">{pole.nom}</h2>
                      <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                        {poleGroupes.length} groupe{poleGroupes.length > 1 ? 's' : ''}
                      </Badge>
                    </div>
                    <div className="flex gap-2 text-[10px] text-muted-foreground">
                      <span className="text-emerald-600 font-medium">
                        {poleAffectations.filter(a => a.etat === 'Affecté').length} affectés
                      </span>
                      <span>/ {poleAffectations.length}</span>
                    </div>
                  </div>

                  {/* Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/40">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium text-muted-foreground w-[130px]">Groupe</th>
                          <th className="text-left px-3 py-2 font-medium text-muted-foreground">Module</th>
                          <th className="text-center px-3 py-2 font-medium text-muted-foreground w-[90px]">Masse h.</th>
                          <th className="text-center px-3 py-2 font-medium text-muted-foreground w-[60px]">Sem.</th>
                          <th className="text-center px-3 py-2 font-medium text-muted-foreground w-[90px]">Mode</th>
                          <th className="text-left px-3 py-2 font-medium text-muted-foreground w-[180px]">Formateur</th>
                          <th className="text-center px-3 py-2 font-medium text-muted-foreground w-[90px]">État</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {poleGroupes.flatMap(groupe => {
                          const rows = poleAffectations
                            .filter(a => a.groupe_id === groupe.id)
                            .sort((a, b) => a.ordre - b.ordre)
                          if (rows.length === 0) return []
                          return rows.map((aff, i) => (
                            <tr key={aff.id} className="hover:bg-muted/20 transition-colors">
                              {i === 0 && (
                                <td
                                  className="px-3 py-2 font-semibold text-[#003D70] border-r bg-[#003D70]/3 align-top"
                                  rowSpan={rows.length}
                                >
                                  {groupe.nom}
                                </td>
                              )}
                              <td className="px-3 py-2 font-medium">{aff.module}</td>
                              <td className="px-3 py-2 text-center text-muted-foreground">{aff.masse_horaire}h</td>
                              <td className="px-3 py-2 text-center">
                                <Badge variant="outline" className="text-[10px] h-4 px-1">{aff.semestre}</Badge>
                              </td>
                              <td className="px-3 py-2 text-center">
                                <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${
                                  aff.mode === 'FAD' ? 'bg-violet-100 text-violet-700' :
                                  aff.mode === 'Mixte' ? 'bg-amber-100 text-amber-700' :
                                  'bg-blue-100 text-blue-700'
                                }`}>{aff.mode}</span>
                              </td>
                              <td className="px-3 py-2">
                                <div className="relative">
                                  <Select
                                    value={aff.formateur_id ?? 'none'}
                                    onValueChange={v => handleFormateurChange(aff.id, v === 'none' ? null : v)}
                                    disabled={savingId === aff.id}
                                  >
                                    <SelectTrigger className="h-7 text-[11px] w-full">
                                      {savingId === aff.id
                                        ? <span className="flex items-center gap-1 text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Enregistrement…</span>
                                        : <SelectValue placeholder="Choisir un formateur" />
                                      }
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="none" className="text-xs text-muted-foreground">— Aucun —</SelectItem>
                                      {formateurs.map(f => (
                                        <SelectItem key={f.id} value={f.id} className="text-xs">
                                          {f.nom}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </td>
                              <td className="px-3 py-2 text-center">
                                <Badge className={`text-[10px] h-5 px-2 ${
                                  aff.etat === 'Affecté'
                                    ? 'bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                    : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-100'
                                }`}>
                                  {aff.etat}
                                </Badge>
                              </td>
                            </tr>
                          ))
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Dialog confirmation régénération ── */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Affectations existantes
            </DialogTitle>
            <DialogDescription>
              Des affectations existent déjà pour {annee}.
              Voulez-vous les régénérer ? Les affectations existantes seront supprimées et recréées.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setConfirmOpen(false)}>Annuler</Button>
            <Button
              size="sm"
              className="bg-[#003D70] hover:bg-[#003D70]/90 text-white gap-1.5"
              disabled={loading}
              onClick={() => doGenerate(filiereId === 'all' ? null : filiereId, true)}
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Régénérer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
