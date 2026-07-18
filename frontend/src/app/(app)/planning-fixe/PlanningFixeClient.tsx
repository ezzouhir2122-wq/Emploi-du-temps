'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { createClient } from '@/lib/supabase/client'
import { StatutBadge } from '@/components/planning/StatutBadge'
import { PageHeader, PageDivider } from '@/components/layout/PageHeader'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { CalendarDays, Info, RotateCcw, Wand2, ChevronDown, ChevronUp, Settings2, Play, Eye, X, FileDown, Users } from 'lucide-react'
import { PDFDownloadButton } from '@/components/pdf/PDFDownloadButton'
import type {
  Formateur, Groupe, Salle, PlanningFixe, Scenario,
  JourSemaine, StatutFixe, RotationSamediConfig, CycleReference, StatutSamedi, SemaineCycle,
} from '@/types/planning'
import { JOURS_SEMAINE, STATUTS_FIXES, STATUT_TIMES, STATUTS_TRAVAIL as STATUTS_TRAVAIL_BASE, DUREE_HEURES } from '@/types/planning'
import { getMoisCycle, getSamedisDuMois, parseISODate, toISODateString } from '@/lib/rotation'

const MOIS_LABELS = [
  'Janvier','Février','Mars','Avril','Mai','Juin',
  'Juillet','Août','Septembre','Octobre','Novembre','Décembre',
]

const STATUTS_SAMEDI: StatutSamedi[] = ['Matin', 'Après-midi', 'Repos']
const POSITIONS_CYCLE: SemaineCycle[] = [1, 2, 3]
const ROTATION_SUIVANTE: Record<StatutSamedi, StatutSamedi> = {
  'Matin': 'Après-midi',
  'Après-midi': 'Repos',
  'Repos': 'Matin',
}

// Statuts qui comptent comme une séance travaillée (source canonique : types/planning.ts)
const STATUTS_TRAVAIL = STATUTS_TRAVAIL_BASE
// Statuts physiques (occupent la salle)
const STATUTS_PHYSIQUES_FP: StatutFixe[] = ['Matin FP S1', 'Matin FP S2', 'Après-midi FP S1', 'Après-midi FP S2']
const MAX_SEANCES = 10      // 5 jours × 2 sous-séances/jour
const JOURS_MON_VEN: JourSemaine[] = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi']
// 6 jours × 4 sous-créneaux (MS1, MS2, PMS1, PMS2) = 24 sous-créneaux max par salle
const MAX_CRENEAUX_SALLE = 24

// Créneaux horaires pour la fiche emploi du temps
const HORAIRES_SLOTS: { statut: StatutFixe; label: string; time: string; bg: string; fg: string; extraStatuts?: StatutFixe[] }[] = [
  { statut: 'Matin FP S1',         label: 'Matin S1',       time: '08h30–11h',    bg: '#DBEAFE', fg: '#1D4ED8' },
  { statut: 'Matin FP S2',         label: 'Matin S2',       time: '11h–13h30',    bg: '#BFDBFE', fg: '#1E40AF' },
  { statut: 'Après-midi FP S1',    label: 'Après-midi S1',  time: '13h30–16h',    bg: '#D1FAE5', fg: '#065F46' },
  { statut: 'Après-midi FP S2',    label: 'Après-midi S2',  time: '16h–18h30',    bg: '#A7F3D0', fg: '#064E3B' },
  // legacy 'FAD Matin' → fusionné dans S1
  { statut: 'FAD Matin S1',        label: 'FAD 08h30–11h',  time: '08h30–11h',    bg: '#EDE9FE', fg: '#6D28D9', extraStatuts: ['FAD Matin'] },
  { statut: 'FAD Matin S2',        label: 'FAD 11h–13h30',  time: '11h–13h30',    bg: '#DDD6FE', fg: '#5B21B6' },
  // legacy 'FAD Après-midi' → fusionné dans S1
  { statut: 'FAD Après-midi S1',   label: 'FAD 13h30–16h',  time: '13h30–16h',    bg: '#F5F3FF', fg: '#7C3AED', extraStatuts: ['FAD Après-midi'] },
  { statut: 'FAD Après-midi S2',   label: 'FAD 16h–18h30',  time: '16h–18h30',    bg: '#E9D5FF', fg: '#6D28D9' },
  { statut: 'FAD 1h',              label: 'FAD Complément', time: '1h dist.',      bg: '#EDE9FE', fg: '#6D28D9' },
]

// ── Bannière taux d'occupation salle ─────────────────────────

function OccupationBanner({ filled }: { filled: number }) {
  const pct = Math.round(filled / MAX_CRENEAUX_SALLE * 100)
  const color = pct === 100
    ? { bar: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' }
    : pct >= 75
    ? { bar: 'bg-amber-400', text: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' }
    : { bar: 'bg-red-400', text: 'text-red-700', bg: 'bg-red-50 border-red-200' }

  return (
    <div className={`px-4 py-2.5 border-b ${color.bg} border flex items-center gap-4`}>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs font-semibold text-muted-foreground">Occupation salle</span>
        <span className={`text-xs font-bold ${color.text}`}>{pct}%</span>
        <span className="text-xs text-muted-foreground">({filled}/{MAX_CRENEAUX_SALLE} créneaux)</span>
      </div>
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden min-w-[80px]">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color.bar}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {pct === 100 && (
        <span className="text-xs font-medium text-emerald-700 shrink-0">✓ Salle 100% occupée</span>
      )}
    </div>
  )
}

interface Props {
  salles: Salle[]
  groupes: Groupe[]
  formateurs: Formateur[]
  planningFixe: PlanningFixe[]
  activeScenario: Scenario | null
  rotationConfig: RotationSamediConfig[]
  cycleReferences: CycleReference[]
}

// Groupes de formation (non techniques : salle_id IS NULL)
function isGroupeFormation(g: Groupe) { return !g.salle_id }

// ── Composants Rotation Samedi (intégrés) ────────────────────

function AncragEditor({
  ref_, onSave,
}: {
  ref_: CycleReference | undefined
  onSave: (date: string, pos: SemaineCycle) => void
}) {
  const [date, setDate] = useState(ref_?.date_ancrage ?? '')
  const [pos, setPos] = useState<SemaineCycle>(ref_?.semaine_cycle_ancrage ?? 1)
  return (
    <div className="px-4 py-3 bg-muted/20 border-b">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Ancrage du cycle</p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Mois de référence (1er du mois)</Label>
          <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-7 w-40 text-xs" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Position dans le cycle</Label>
          <Select value={String(pos)} onValueChange={v => setPos(Number(v) as SemaineCycle)}>
            <SelectTrigger className="h-7 w-28 text-xs"><SelectValue>Mois {pos}</SelectValue></SelectTrigger>
            <SelectContent>
              {([1, 2, 3] as SemaineCycle[]).map(s => (
                <SelectItem key={s} value={String(s)} className="text-xs">Mois {s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onSave(date, pos)} disabled={!date}>
          Enregistrer
        </Button>
        {ref_ && (
          <span className="text-xs text-muted-foreground">
            Actuel : {ref_.date_ancrage.slice(0, 7)} → Mois {ref_.semaine_cycle_ancrage}
          </span>
        )}
      </div>
    </div>
  )
}

function RotationSallePanel({
  salle, formateursSalle, rotationConfig, cycleRef, previewAnnee, previewMois,
  onStatutChange, onAutoRotation, onAncrageSave, onApplyRotation,
}: {
  salle: Salle
  formateursSalle: Formateur[]
  rotationConfig: RotationSamediConfig[]
  cycleRef: CycleReference | undefined
  previewAnnee: number
  previewMois: number
  onStatutChange: (salleId: string, pos: SemaineCycle, formateurId: string, statut: StatutSamedi) => void
  onAutoRotation: (salleId: string, formateursSalle: Formateur[]) => void
  onAncrageSave: (salleId: string, date: string, pos: SemaineCycle) => void
  onApplyRotation: (entries: { formateurId: string; statut: StatutSamedi }[]) => void
}) {
  function getCfg(pos: SemaineCycle, formateurId: string) {
    return rotationConfig.find(
      c => c.salle_id === salle.id && c.semaine_cycle === pos && c.formateur_id === formateurId
    )
  }

  function handleApply() {
    if (!cycleRef) return
    const ancrage = parseISODate(cycleRef.date_ancrage)
    const pos = getMoisCycle(previewAnnee, previewMois, ancrage, cycleRef.semaine_cycle_ancrage)
    const entries = formateursSalle.map(f => ({
      formateurId: f.id,
      statut: (getCfg(pos, f.id)?.statut ?? 'Repos') as StatutSamedi,
    }))
    onApplyRotation(entries)
  }

  const preview = (() => {
    if (!cycleRef) return []
    const ancrage = parseISODate(cycleRef.date_ancrage)
    const position = getMoisCycle(previewAnnee, previewMois, ancrage, cycleRef.semaine_cycle_ancrage)
    return getSamedisDuMois(previewAnnee, previewMois).map(samedi => ({
      date: toISODateString(samedi),
      position,
      statuts: formateursSalle.map(f => ({
        formateur: f,
        statut: (getCfg(position, f.id)?.statut ?? 'Repos') as StatutSamedi,
      })),
    }))
  })()

  return (
    <div className="border-t bg-muted/10">
      <AncragEditor ref_={cycleRef} onSave={(d, p) => onAncrageSave(salle.id, d, p)} />

      <div className="px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Cycle mensuel — 3 mois</p>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-6 text-xs gap-1"
              onClick={() => onAutoRotation(salle.id, formateursSalle)}>
              <Wand2 className="h-3 w-3" /> Auto Mois 2 &amp; 3
            </Button>
            <Button size="sm" className="h-6 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handleApply} disabled={!cycleRef}>
              <Play className="h-3 w-3" />
              Appliquer au Samedi — {MOIS_LABELS[previewMois - 1]}
            </Button>
          </div>
        </div>
        <div className="text-xs text-muted-foreground bg-blue-50 border border-blue-100 rounded px-2 py-1 mb-2">
          Règle : <strong>Matin</strong> → Après-midi → Repos → Matin…
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-1.5 px-2 font-medium text-muted-foreground text-xs">Formateur</th>
              {POSITIONS_CYCLE.map(p => (
                <th key={p} className="text-center py-1.5 px-2 font-medium text-muted-foreground text-xs">Mois {p}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {formateursSalle.map(f => (
              <tr key={f.id} className="hover:bg-muted/20">
                <td className="py-1.5 px-2 text-xs font-medium">{f.nom}</td>
                {POSITIONS_CYCLE.map(pos => {
                  const cfg = getCfg(pos, f.id)
                  return (
                    <td key={pos} className="py-1.5 px-2 text-center">
                      <Select
                        value={cfg?.statut ?? 'Repos'}
                        onValueChange={val => onStatutChange(salle.id, pos, f.id, val as StatutSamedi)}
                      >
                        <SelectTrigger className="h-7 w-28 text-xs mx-auto">
                          <SelectValue><StatutBadge statut={cfg?.statut ?? 'Repos'} /></SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {STATUTS_SAMEDI.map(s => (
                            <SelectItem key={s} value={s} className="text-xs"><StatutBadge statut={s} /></SelectItem>
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

      {cycleRef && preview.length > 0 && (
        <div className="border-t px-4 py-3">
          <div className="text-xs text-muted-foreground mb-2">
            Prévisualisation — <span className="font-medium">{MOIS_LABELS[previewMois - 1]} {previewAnnee}</span>
            {' → '}Position <strong>{preview[0].position}</strong> du cycle
          </div>
          <div className="flex flex-wrap gap-2">
            {preview.map(({ date, statuts }) => (
              <div key={date} className="rounded border bg-background px-3 py-2 text-xs">
                <div className="font-medium mb-1">
                  Samedi {new Date(date + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                </div>
                <div className="flex flex-wrap gap-2">
                  {statuts.map(({ formateur, statut }) => (
                    <span key={formateur.id} className="flex items-center gap-1">
                      <span className="text-muted-foreground">{formateur.nom.split(' ')[0]}</span>
                      <StatutBadge statut={statut} />
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Helpers partagés ─────────────────────────────────────────

function encodeValue(statut: StatutFixe, salleId: string | null): string {
  if (statut === 'Distance' || statut === 'Distance Matin' || statut === 'Distance Après-midi' || statut === 'Repos') return statut
  return salleId ? `${salleId}|${statut}` : statut
}

function decodeValue(value: string): { statut: StatutFixe; salleId: string | null } {
  if (value === 'Distance' || value === 'Distance Matin' || value === 'Distance Après-midi' || value === 'Repos')
    return { statut: value as StatutFixe, salleId: null }
  const [salleId, statut] = value.split('|')
  return { statut: statut as StatutFixe, salleId }
}

// Badge séances/semaine
function SeancesBadge({ count }: { count: number }) {
  const color = count === MAX_SEANCES
    ? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300'
    : count > MAX_SEANCES
    ? 'bg-red-100 text-red-600 ring-1 ring-red-300'
    : 'bg-amber-50 text-amber-600'
  return (
    <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${color}`}>
      {count}/{MAX_SEANCES} séances
    </span>
  )
}

// ── Fiche emploi du temps formateur ─────────────────────────

function FormateurScheduleModal({
  formateur, salle, planning, groupesFormation, onClose,
}: {
  formateur: Formateur
  salle: Salle
  planning: PlanningFixe[]
  groupesFormation: Groupe[]
  onClose: () => void
}) {
  const rows = planning.filter(p => p.formateur_id === formateur.id)
  const slotsActifs = HORAIRES_SLOTS.filter(s => {
    const statuts = [s.statut, ...(s.extraStatuts ?? [])]
    return rows.some(r => statuts.includes(r.statut))
  })

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="px-6 py-4 bg-[#003D70] rounded-t-xl flex items-center justify-between shrink-0">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-blue-300 mb-0.5">
              Emploi du temps
            </p>
            <h2 className="text-white text-base font-bold leading-tight">{formateur.nom}</h2>
            {formateur.matricule && (
              <p className="text-blue-200 text-[11px] mt-0.5">Matricule : {formateur.matricule}</p>
            )}
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-[10px] text-blue-300 uppercase tracking-wide">Salle</p>
              <p className="text-white text-sm font-bold">{salle.nom}</p>
            </div>
            <button
              onClick={onClose}
              className="flex items-center justify-center w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ── Table ── */}
        <div className="overflow-auto flex-1 p-5">
          {slotsActifs.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground text-sm italic">
              Aucune séance planifiée pour ce formateur.
            </div>
          ) : (
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b-2 border-[#003D70]">
                  <th className="text-left px-3 py-2.5 font-semibold text-[#003D70] text-[10px] uppercase tracking-wide w-36">
                    Créneau horaire
                  </th>
                  {JOURS_SEMAINE.map(jour => (
                    <th
                      key={jour}
                      className={`px-2 py-2.5 text-center font-bold text-[11px] ${
                        jour === 'Samedi'
                          ? 'text-emerald-700 bg-emerald-50/60'
                          : 'text-[#003D70]'
                      }`}
                    >
                      {jour}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {slotsActifs.map((slot, idx) => (
                  <tr key={slot.statut} className={`border-b ${idx % 2 === 0 ? 'bg-slate-50/40' : ''}`}>
                    {/* Créneau label */}
                    <td className="px-3 py-3 w-36">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <div
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: slot.fg }}
                        />
                        <span className="font-bold text-[11px]" style={{ color: slot.fg }}>
                          {slot.label}
                        </span>
                      </div>
                      <div className="text-[10px] font-mono text-muted-foreground pl-4">
                        {slot.time}
                      </div>
                    </td>

                    {/* Cellule par jour */}
                    {JOURS_SEMAINE.map(jour => {
                      const slotStatuts = [slot.statut, ...(slot.extraStatuts ?? [])]
                      const fusionRows = rows.filter(r => r.jour_semaine === jour && slotStatuts.includes(r.statut))
                      const groupesNoms = fusionRows
                        .map(r => groupesFormation.find(g => g.id === r.groupe_formation_id)?.nom)
                        .filter(Boolean) as string[]
                      const groupeDisplay = groupesNoms.length > 0 ? groupesNoms.join('_') : null

                      return (
                        <td
                          key={jour}
                          className={`px-2 py-3 text-center align-middle ${
                            jour === 'Samedi' ? 'bg-emerald-50/30' : ''
                          }`}
                        >
                          {fusionRows.length > 0 ? (
                            <div
                              className="rounded-lg px-2 py-2 inline-flex flex-col items-center gap-1 min-w-[76px] border"
                              style={{ backgroundColor: slot.bg, borderColor: slot.fg + '40' }}
                            >
                              <span className="text-[9px] font-bold font-mono tracking-tight" style={{ color: slot.fg }}>
                                {slot.time}
                              </span>
                              {groupeDisplay ? (
                                <span className="text-[11px] font-extrabold leading-tight text-center" style={{ color: slot.fg }}>
                                  {groupeDisplay}
                                </span>
                              ) : (
                                <span className="text-[10px] text-muted-foreground/40 italic">—</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground/20 text-base">·</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="border-t px-6 py-3 flex items-center justify-between shrink-0 bg-slate-50 rounded-b-xl">
          <p className="text-[11px] text-muted-foreground">
            Planning hebdomadaire fixe · Lun–Sam
          </p>
          <button
            onClick={onClose}
            className="text-xs text-muted-foreground hover:text-foreground underline"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── Vue standard (Scénario A / B) ────────────────────────────

function StandardView({
  salles, groupes, formateurs, planning, saving,
  onAddSubSession, onRemoveSubSession, onGroupeChange, groupesFormation,
  rotationConfig, cycleReferences, previewAnnee, previewMois,
  onRotationStatut, onAutoRotation, onAncrageSave, onApplyRotation,
}: {
  salles: Salle[]
  groupes: Groupe[]
  formateurs: Formateur[]
  planning: PlanningFixe[]
  saving: Set<string>
  onAddSubSession: (formateurId: string, jour: JourSemaine, statut: StatutFixe) => void
  onRemoveSubSession: (rowId: string) => void
  onGroupeChange: (rowId: string, groupeId: string | null) => void
  groupesFormation: Groupe[]
  rotationConfig: RotationSamediConfig[]
  cycleReferences: CycleReference[]
  previewAnnee: number
  previewMois: number
  onRotationStatut: (salleId: string, pos: SemaineCycle, formateurId: string, statut: StatutSamedi) => void
  onAutoRotation: (salleId: string, formateursSalle: Formateur[]) => void
  onAncrageSave: (salleId: string, date: string, pos: SemaineCycle) => void
  onApplyRotation: (salleId: string, entries: { formateurId: string; statut: StatutSamedi }[]) => void
}) {
  const [expandedSalles, setExpandedSalles] = useState<Set<string>>(new Set())
  const [viewFormateur, setViewFormateur] = useState<{ formateur: Formateur; salle: Salle } | null>(null)
  const [pdfLoadingKey, setPdfLoadingKey] = useState<string | null>(null)

  function toggleRotation(salleId: string) {
    setExpandedSalles(prev => {
      const next = new Set(prev)
      next.has(salleId) ? next.delete(salleId) : next.add(salleId)
      return next
    })
  }

  // Toutes les sous-séances actives d'un formateur pour un jour
  function getActiveRows(formateurId: string, jour: JourSemaine): PlanningFixe[] {
    return planning.filter(p => p.formateur_id === formateurId && p.jour_semaine === jour)
  }

  // Nombre total de sous-séances travaillées Lun-Ven
  // Les FAD fusionnés génèrent plusieurs lignes DB (1 par groupe) pour le même créneau.
  // On déduplique par (jour, statut) pour compter 1 séance par créneau, pas par groupe.
  const FAD_STATUTS_ALL = ['FAD Matin S1','FAD Matin S2','FAD Après-midi S1','FAD Après-midi S2','FAD Matin','FAD Après-midi','FAD 1h']

  function deduplicatedCount(rows: PlanningFixe[]): number {
    const fpRows = rows.filter(p => !FAD_STATUTS_ALL.includes(p.statut))
    const fadKeys = new Set(
      rows
        .filter(p => FAD_STATUTS_ALL.includes(p.statut))
        .map(p => `${p.jour_semaine}:${p.statut}`)
    )
    return fpRows.length + fadKeys.size
  }

  function countSeancesMonVen(formateurId: string): number {
    return deduplicatedCount(planning.filter(p =>
      p.formateur_id === formateurId &&
      JOURS_MON_VEN.includes(p.jour_semaine as JourSemaine) &&
      STATUTS_TRAVAIL.includes(p.statut)
    ))
  }

  // Nombre total de sous-séances travaillées toute la semaine
  function countSeances(formateurId: string): number {
    return deduplicatedCount(planning.filter(p =>
      p.formateur_id === formateurId &&
      STATUTS_TRAVAIL.includes(p.statut)
    ))
  }

  // Taux d'occupation : sous-créneaux physiques FP saisis / 24
  function getOccupationSalle(formateursSalle: Formateur[]): number {
    const slots = new Set<string>()
    for (const p of planning) {
      if (
        formateursSalle.some(f => f.id === p.formateur_id) &&
        STATUTS_PHYSIQUES_FP.includes(p.statut)
      ) {
        slots.add(`${p.jour_semaine}-${p.statut}`)
      }
    }
    return slots.size
  }

  // Groupes disponibles / indisponibles pour une sous-séance spécifique
  // Règle : un groupe ne peut être que dans UN seul créneau horaire à la fois,
  // que ce soit FP ou FAD, chez n'importe quel formateur du pôle ou hors pôle.
  function getGroupesParDisponibilite(
    formateurId: string, jour: JourSemaine, statut: StatutFixe, sallePoleId: string | null,
    currentRowId?: string
  ): { disponibles: Groupe[]; indisponibles: Groupe[] } {
    // Tous les statuts qui occupent le même créneau horaire (FP + FAD confondus)
    const sameSlot: Record<string, StatutFixe[]> = {
      'Matin FP S1':         ['Matin FP S1', 'FAD Matin S1', 'FAD Matin'],
      'FAD Matin S1':        ['Matin FP S1', 'FAD Matin S1', 'FAD Matin'],
      'FAD Matin':           ['Matin FP S1', 'FAD Matin S1', 'FAD Matin'],
      'Matin FP S2':         ['Matin FP S2', 'FAD Matin S2'],
      'FAD Matin S2':        ['Matin FP S2', 'FAD Matin S2'],
      'Après-midi FP S1':    ['Après-midi FP S1', 'FAD Après-midi S1', 'FAD Après-midi'],
      'FAD Après-midi S1':   ['Après-midi FP S1', 'FAD Après-midi S1', 'FAD Après-midi'],
      'FAD Après-midi':      ['Après-midi FP S1', 'FAD Après-midi S1', 'FAD Après-midi'],
      'Après-midi FP S2':    ['Après-midi FP S2', 'FAD Après-midi S2'],
      'FAD Après-midi S2':   ['Après-midi FP S2', 'FAD Après-midi S2'],
    }
    const slotStatuts: StatutFixe[] = sameSlot[statut] ?? [statut]

    // Groupes déjà pris sur ce créneau — tous formateurs confondus (FP et FAD)
    const prisIds = new Set(
      planning
        .filter(p =>
          p.id !== currentRowId &&
          p.jour_semaine === jour &&
          slotStatuts.includes(p.statut) &&
          p.groupe_formation_id
        )
        .map(p => p.groupe_formation_id!)
    )
    const allGroupes = sallePoleId
      ? groupesFormation.filter(g => g.pole_id === sallePoleId)
      : groupesFormation
    return {
      disponibles: allGroupes.filter(g => !prisIds.has(g.id)),
      indisponibles: allGroupes.filter(g => prisIds.has(g.id)),
    }
  }

  // Demi-journée d'un statut (pour exclusivité matin / après-midi)
  function getHalfDay(s: StatutFixe): 'matin' | 'apresmidi' | null {
    if (['Matin FP S1','Matin FP S2','FAD Matin','Matin','Distance Matin'].includes(s)) return 'matin'
    if (['Après-midi FP S1','Après-midi FP S2','FAD Après-midi','Après-midi','Distance Après-midi'].includes(s)) return 'apresmidi'
    return null
  }

  // Statuts disponibles à ajouter pour ce formateur ce jour
  function getStatutsDisponibles(formateurId: string, jour: JourSemaine, formateursSalle: Formateur[]): StatutFixe[] {
    const dejaActifs = new Set(
      planning
        .filter(p => p.formateur_id === formateurId && p.jour_semaine === jour)
        .map(p => p.statut)
    )
    const prisParSalle = new Set(
      planning
        .filter(p =>
          p.formateur_id !== formateurId &&
          formateursSalle.some(f => f.id === p.formateur_id) &&
          p.jour_semaine === jour
        )
        .map(p => p.statut)
    )

    if (countSeances(formateurId) >= MAX_SEANCES) return []

    // Demi-journée déjà commencée → filtrer par cohérence
    const demiJourneeActive = [...dejaActifs]
      .map(getHalfDay)
      .find(h => h !== null) ?? null

    const isSamedi = jour === 'Samedi'

    return STATUTS_FIXES.filter(s => {
      if (dejaActifs.has(s)) return false
      if (prisParSalle.has(s)) return false
      if (isSamedi && (s === 'FAD Matin' || s === 'FAD Après-midi')) return false
      // Si une demi-journée est déjà active, n'offrir que ses sous-séances
      if (demiJourneeActive) {
        const sHalf = getHalfDay(s)
        if (sHalf && sHalf !== demiJourneeActive) return false
      }
      return true
    })
  }

  const DUREE_PDF: Partial<Record<StatutFixe, number>> = {
    'Matin FP S1': 2.5, 'Matin FP S2': 2.5,
    'Après-midi FP S1': 2.5, 'Après-midi FP S2': 2.5,
    'FAD Matin': 2.5, 'FAD Après-midi': 2.5, 'FAD 1h': 1,
  }

  async function openGroupePDF(groupe: Groupe) {
    const key = `groupe-${groupe.id}`
    if (pdfLoadingKey) return
    setPdfLoadingKey(key)
    try {
      const rows = planning.filter(p => p.groupe_formation_id === groupe.id)
      const poleNom = salles.find(s => s.pole_id === groupe.pole_id)?.pole?.nom ?? null
      const planningRows = rows.map(p => ({
        jour_semaine: p.jour_semaine,
        statut: p.statut,
        formateur_nom: formateurs.find(f => f.id === p.formateur_id)?.nom ?? null,
      }))
      const totalSeances = rows.length
      const totalHeures = rows.reduce((acc, p) => acc + (DUREE_PDF[p.statut] ?? 0), 0)

      const [{ pdf }, { createElement }, { GroupePlanningPDF }] = await Promise.all([
        import('@react-pdf/renderer'),
        import('react'),
        import('@/components/pdf/GroupePlanningPDF'),
      ])
      const blob = await pdf(createElement(GroupePlanningPDF as any, {
        groupeNom: groupe.nom, poleNom,
        planning: planningRows, totalSeances, totalHeures,
        dateGeneration: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }),
        logoUrl: `${window.location.origin}/OFPPT_Logo.png`,
      }) as any).toBlob()
      const url = URL.createObjectURL(blob)
      const win = window.open(url, '_blank')
      if (!win) {
        const a = document.createElement('a')
        a.href = url; a.download = `EDT-${groupe.nom}.pdf`
        document.body.appendChild(a); a.click(); document.body.removeChild(a)
      }
      setTimeout(() => URL.revokeObjectURL(url), 120_000)
    } catch (err) {
      console.error('Erreur génération PDF groupe', err)
    } finally {
      setPdfLoadingKey(null)
    }
  }

  async function openSallePDF(salle: Salle, formateursSalle: Formateur[]) {
    const key = `salle-${salle.id}`
    if (pdfLoadingKey) return
    setPdfLoadingKey(key)
    try {
      const FP_STATUTS: StatutFixe[] = ['Matin FP S1', 'Matin FP S2', 'Après-midi FP S1', 'Après-midi FP S2']
      const rows = planning.filter(p =>
        formateursSalle.some(f => f.id === p.formateur_id) &&
        FP_STATUTS.includes(p.statut)
      )
      const planningRows = rows.map(p => ({
        jour_semaine: p.jour_semaine,
        statut: p.statut,
        formateur_nom: formateursSalle.find(f => f.id === p.formateur_id)?.nom ?? null,
        groupe_nom: groupesFormation.find(g => g.id === p.groupe_formation_id)?.nom ?? null,
      }))

      const [{ pdf }, { createElement }, { SallePlanningPDF }] = await Promise.all([
        import('@react-pdf/renderer'),
        import('react'),
        import('@/components/pdf/SallePlanningPDF'),
      ])
      const blob = await pdf(createElement(SallePlanningPDF as any, {
        salleNom: salle.nom, poleNom: salle.pole?.nom ?? null,
        planning: planningRows, totalCreneaux: rows.length,
        dateGeneration: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }),
        logoUrl: `${window.location.origin}/OFPPT_Logo.png`,
      }) as any).toBlob()
      const url = URL.createObjectURL(blob)
      const win = window.open(url, '_blank')
      if (!win) {
        const a = document.createElement('a')
        a.href = url; a.download = `EDT-${salle.nom}.pdf`
        document.body.appendChild(a); a.click(); document.body.removeChild(a)
      }
      setTimeout(() => URL.revokeObjectURL(url), 120_000)
    } catch (err) {
      console.error('Erreur génération PDF salle', err)
    } finally {
      setPdfLoadingKey(null)
    }
  }

  return (
    <>
      {viewFormateur && (
        <FormateurScheduleModal
          formateur={viewFormateur.formateur}
          salle={viewFormateur.salle}
          planning={planning}
          groupesFormation={groupesFormation}
          onClose={() => setViewFormateur(null)}
        />
      )}

      {salles.map(salle => {
        const groupe = groupes.find(g => g.salle_id === salle.id)
        // N'afficher QUE les formateurs explicitement affectés à cette salle via le groupe technique
        // (jamais le fallback pôle qui mélangeait tous les formateurs)
        const formateursSalle = groupe
          ? formateurs.filter(f => f.groupe_id === groupe.id)
          : []
        const salleLabel = salle.nom.replace('Salle ', 'S')
        const expanded = expandedSalles.has(salle.id)
        const occupationFilled = getOccupationSalle(formateursSalle)

        return (
          <div key={salle.id} className="rounded-lg border bg-card">
            <div className="border-b px-4 py-3 flex items-center justify-between">
              <div>
                <h2 className="font-semibold">{salle.nom}</h2>
                {groupe && <p className="text-xs text-muted-foreground">{groupe.nom}</p>}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openSallePDF(salle, formateursSalle)}
                  disabled={!!pdfLoadingKey}
                  className="flex items-center gap-1 h-7 px-2.5 text-xs font-medium rounded-md border border-[#003D70]/30 bg-[#003D70]/5 text-[#003D70] hover:bg-[#003D70]/15 transition-all disabled:opacity-50"
                  title="Télécharger le PDF emploi du temps de cette salle"
                >
                  <FileDown className="h-3.5 w-3.5" />
                  {pdfLoadingKey === `salle-${salle.id}` ? 'Génération…' : 'PDF Salle'}
                </button>
                <Button
                  size="sm" variant="outline"
                  className={`h-7 text-xs gap-1.5 ${expanded ? 'bg-muted' : ''}`}
                  onClick={() => toggleRotation(salle.id)}
                >
                  <Settings2 className="h-3.5 w-3.5" />
                  Rotation Samedi
                  {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </Button>
              </div>
            </div>

            {/* Bannière taux d'occupation */}
            <OccupationBanner filled={occupationFilled} />

            {/* Aucun formateur affecté → guide */}
            {formateursSalle.length === 0 && (
              <div className="flex items-center gap-3 px-4 py-4 bg-amber-50 border-b border-amber-200">
                <span className="text-2xl">⚙️</span>
                <div>
                  <p className="text-sm font-semibold text-amber-800">Aucun formateur affecté à cette salle</p>
                  <p className="text-xs text-amber-600 mt-0.5">
                    Allez dans <strong>Paramètres → Salles</strong> pour affecter les formateurs (max 3 par salle).
                  </p>
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground w-32">Formateur</th>
                    {JOURS_SEMAINE.map(jour => {
                      const isSamedi  = jour === 'Samedi'
                      return (
                        <th key={jour} className={`px-1 py-1.5 text-center font-medium text-muted-foreground min-w-[110px] ${isSamedi ? 'border-l-2 border-dashed border-muted-foreground/40' : ''}`}>
                          <div className={`text-xs font-medium ${isSamedi ? 'text-emerald-700 font-semibold' : ''}`}>{jour}</div>
                          {/* Indicateurs 4 sous-créneaux */}
                          <div className="flex justify-center gap-0.5 mt-0.5 flex-wrap">
                            {(['Matin FP S1','Matin FP S2','Après-midi FP S1','Après-midi FP S2'] as StatutFixe[]).map(s => {
                              const pris = formateursSalle.some(f => planning.some(p => p.formateur_id === f.id && p.jour_semaine === jour && p.statut === s))
                              const short = s === 'Matin FP S1' ? 'MS1' : s === 'Matin FP S2' ? 'MS2' : s === 'Après-midi FP S1' ? 'PS1' : 'PS2'
                              return (
                                <span key={s} title={`${s}${pris ? ' — pris' : ' — libre'}`}
                                  className={`text-[7px] font-mono px-0.5 rounded ${pris ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                                  {short}
                                </span>
                              )
                            })}
                          </div>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {formateursSalle.map(formateur => {
                    const monVenCount = countSeancesMonVen(formateur.id)
                    const seances     = countSeances(formateur.id)
                    const samediAuto  = monVenCount >= MAX_SEANCES

                    // Comptage hebdomadaire FAD — créneaux distincts (fusion = 1 créneau)
                    const FAD_2H30_STATUTS = ['FAD Matin S1','FAD Matin S2','FAD Après-midi S1','FAD Après-midi S2','FAD Matin','FAD Après-midi']
                    const weeklyFad2h30 = new Set(
                      planning
                        .filter(p => p.formateur_id === formateur.id && FAD_2H30_STATUTS.includes(p.statut))
                        .map(p => {
                          // Normalise les statuts legacy pour éviter double-comptage avec les nouveaux
                          const norm = p.statut === 'FAD Matin' ? 'FAD Matin S1'
                            : p.statut === 'FAD Après-midi' ? 'FAD Après-midi S1'
                            : p.statut
                          return `${p.jour_semaine}:${norm}`
                        })
                    ).size
                    const weeklyFad1hRow = planning.find(p =>
                      p.formateur_id === formateur.id && p.statut === 'FAD 1h'
                    )
                    // Demi-jours présentiel (FP) — cible 4 (max 2 jours × 2 demi-jours)
                    // Matin FP S1 + Matin FP S2 sur le même jour = 1 demi-jour "matin"
                    const fpSlotType = (s: StatutFixe): 'mat' | 'apm' | null =>
                      ['Matin FP S1', 'Matin FP S2', 'Matin'].includes(s) ? 'mat'
                      : ['Après-midi FP S1', 'Après-midi FP S2', 'Après-midi'].includes(s) ? 'apm'
                      : null
                    const weeklyPresentielDays = new Set(
                      planning
                        .filter(p => p.formateur_id === formateur.id)
                        .flatMap(p => { const t = fpSlotType(p.statut); return t ? [`${p.jour_semaine}:${t}`] : [] })
                    ).size
                    const satHasSession = planning.some(p =>
                      p.formateur_id === formateur.id && p.jour_semaine === 'Samedi'
                    )
                    // Jours vides (Repos) sur toute la semaine Lun–Sam
                    // Quand le samedi est travaillé, 2 jours vides en semaine sont tolérés
                    const weeklyReposCount =
                      JOURS_MON_VEN.filter(j =>
                        !planning.some(p => p.formateur_id === formateur.id && p.jour_semaine === j)
                      ).length +
                      (!satHasSession ? 1 : 0)

                    return (
                      <tr key={formateur.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-2 py-1.5 font-medium text-sm leading-tight w-[120px] min-w-[120px]">
                          <div className="flex flex-col gap-1">
                            <span className="truncate text-[11px] font-semibold">{formateur.nom}</span>
                            <SeancesBadge count={seances} />
                            <div className="flex gap-1 mt-0.5 flex-wrap">
                              <span className={`text-[8px] px-1 py-0.5 rounded font-medium ${weeklyPresentielDays >= 4 ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'}`}>
                                Prés. {weeklyPresentielDays}/4
                              </span>
                              <span className={`text-[8px] px-1 py-0.5 rounded font-medium ${weeklyFad2h30 >= 1 ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-400'}`}>
                                FAD {weeklyFad2h30}/2
                              </span>
                            </div>
                            <button
                              onClick={() => setViewFormateur({ formateur, salle })}
                              className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-all bg-[#003D70]/10 text-[#003D70] hover:bg-[#003D70]/20 border border-[#003D70]/20"
                              title="Voir emploi du temps"
                            >
                              <Eye className="h-3 w-3" />
                              <span>Voir EDT</span>
                            </button>
                            <PDFDownloadButton
                              formateurNom={formateur.nom}
                              matricule={formateur.matricule}
                              salleNom={salle.nom}
                              poleNom={salle.pole?.nom ?? null}
                              planning={planning
                                .filter(p => p.formateur_id === formateur.id)
                                .map(p => ({
                                  jour_semaine: p.jour_semaine,
                                  statut: p.statut,
                                  groupe_nom: groupesFormation.find(g => g.id === p.groupe_formation_id)?.nom ?? null,
                                }))
                              }
                              totalSeances={seances}
                              totalHeures={
                                planning
                                  .filter(p => p.formateur_id === formateur.id)
                                  .reduce((acc, p) => acc + (DUREE_HEURES[p.statut] ?? 0), 0)
                              }
                              dateGeneration={new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                            />
                          </div>
                        </td>
                        {JOURS_SEMAINE.map(jour => {
                          const isSamedi   = jour === 'Samedi'
                          const activeRows = getActiveRows(formateur.id, jour)
                          const canAdd     = seances < MAX_SEANCES

                          if (isSamedi && samediAuto) {
                            return (
                              <td key={jour} className="px-1 py-1.5 text-center border-l-2 border-dashed border-muted-foreground/40 bg-slate-50/60">
                                <div className="flex flex-col items-center gap-0.5">
                                  <StatutBadge statut="Repos" />
                                  <span className="text-[9px] text-muted-foreground/60 italic">auto</span>
                                </div>
                              </td>
                            )
                          }

                          // Bloc Matin FP pris par un AUTRE formateur de la même salle
                          const matinFPPris = formateursSalle.some(f =>
                            f.id !== formateur.id && planning.some(p =>
                              p.formateur_id === f.id && p.jour_semaine === jour &&
                              (p.statut === 'Matin FP S1' || p.statut === 'Matin FP S2')
                            ))
                          // Bloc PM FP pris par un AUTRE formateur
                          const pmFPPris = formateursSalle.some(f =>
                            f.id !== formateur.id && planning.some(p =>
                              p.formateur_id === f.id && p.jour_semaine === jour &&
                              (p.statut === 'Après-midi FP S1' || p.statut === 'Après-midi FP S2')
                            ))

                          // Rows de ce formateur par sous-créneau
                          const ms1 = activeRows.find(r => r.statut === 'Matin FP S1')
                          const ms2 = activeRows.find(r => r.statut === 'Matin FP S2')
                          const ps1 = activeRows.find(r => r.statut === 'Après-midi FP S1')
                          const ps2 = activeRows.find(r => r.statut === 'Après-midi FP S2')
                          // FAD rows par sous-créneau (legacy inclus dans S1)
                          const fadMatS1Rows = activeRows.filter(r => r.statut === 'FAD Matin S1' || r.statut === 'FAD Matin')
                          const fadMatS2Rows = activeRows.filter(r => r.statut === 'FAD Matin S2')
                          const fadPmS1Rows  = activeRows.filter(r => r.statut === 'FAD Après-midi S1' || r.statut === 'FAD Après-midi')
                          const fadPmS2Rows  = activeRows.filter(r => r.statut === 'FAD Après-midi S2')
                          const fadHRow      = activeRows.find(r => r.statut === 'FAD 1h')

                          // FAD existant bloque le FP du même sous-créneau
                          const blockFpMatS1 = fadMatS1Rows.length > 0
                          const blockFpMatS2 = fadMatS2Rows.length > 0
                          const blockFpPmS1  = fadPmS1Rows.length > 0
                          const blockFpPmS2  = fadPmS2Rows.length > 0

                          const hasMatinBlock = !!(ms1 || ms2)
                          const hasPmBlock    = !!(ps1 || ps2)
                          const hasFadAny     = fadMatS1Rows.length > 0 || fadMatS2Rows.length > 0 || fadPmS1Rows.length > 0 || fadPmS2Rows.length > 0 || !!fadHRow
                          const canAddFad2h30 = weeklyFad2h30 < 2 && !weeklyFad1hRow && canAdd
                          const canAddFad1h   = weeklyFad2h30 >= 2 && !weeklyFad1hRow && canAdd
                          const isEmptyDay    = activeRows.length === 0
                          const showFad1hSlot = !!fadHRow || (canAddFad1h && hasFadAny)
                          const showFadBlock  = !isSamedi && (
                            hasFadAny || showFad1hSlot ||
                            (canAddFad2h30 && (!ms1 || !ms2 || !ps1 || !ps2))
                          )

                          // Helper: groupe picker inline
                          const renderGroupePicker = (row: PlanningFixe, accentColor: string) => {
                            const { disponibles: gDispo, indisponibles: gIndispo } =
                              getGroupesParDisponibilite(formateur.id, jour, row.statut, salle.pole_id, row.id)
                            const groupeNom = groupesFormation.find(g => g.id === row.groupe_formation_id)?.nom
                            return (
                              <Select
                                value={row.groupe_formation_id ?? '__none__'}
                                onValueChange={val => onGroupeChange(row.id, val === '__none__' ? null : val)}
                              >
                                <SelectTrigger className={`h-7 w-full text-xs px-2 mt-1 font-medium ${row.groupe_formation_id ? `${accentColor} border-solid` : 'border-dashed text-muted-foreground/60'}`}>
                                  <SelectValue>
                                    {groupeNom ?? <span className="italic font-normal text-[10px]">Groupe…</span>}
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__" className="text-xs italic text-muted-foreground">— Aucun —</SelectItem>
                                  {gDispo.length === 0 && gIndispo.length === 0 && (
                                    <div className="px-3 py-2 text-xs text-muted-foreground italic">
                                      {salle.pole_id ? 'Aucun groupe pour ce pôle' : 'Aucun groupe'}
                                    </div>
                                  )}
                                  {gDispo.length > 0 && <div className="h-px bg-border my-1" />}
                                  {gDispo.map(g => <SelectItem key={g.id} value={g.id} className="text-xs">{g.nom}</SelectItem>)}
                                  {gIndispo.length > 0 && (
                                    <>
                                      <div className="h-px bg-border mt-1" />
                                      <div className="px-2 py-0.5 text-[9px] font-semibold text-rose-500/70 uppercase flex items-center gap-1">
                                        <Info className="h-2.5 w-2.5" /> Non dispo
                                      </div>
                                      {gIndispo.map(g => <SelectItem key={g.id} value={g.id} disabled className="text-xs line-through text-muted-foreground/40">{g.nom}</SelectItem>)}
                                    </>
                                  )}
                                </SelectContent>
                              </Select>
                            )
                          }

                          // Helper: slot FP rempli
                          const renderFPSlotFilled = (row: PlanningFixe, time: string, accentBg: string, accentText: string, accentBorder: string) => (
                            <div className={`px-2 py-1.5 ${accentBg} rounded-sm`}>
                              <div className="flex items-center justify-between">
                                <span className={`text-[9px] font-mono font-semibold ${accentText}`}>{time}</span>
                                <button onClick={() => onRemoveSubSession(row.id)}
                                  className="w-5 h-5 flex items-center justify-center rounded hover:bg-red-100 text-muted-foreground/40 hover:text-red-500 transition-colors text-sm leading-none" title="Supprimer">×</button>
                              </div>
                              {renderGroupePicker(row, `border-${accentBorder} bg-white/80 text-${accentText.replace('text-', '')}`)}
                            </div>
                          )

                          // Helper: bouton + pour ajouter un slot FP
                          const renderFPSlotAdd = (statut: StatutFixe, time: string, colorCls: string) => (
                            <button onClick={() => onAddSubSession(formateur.id, jour, statut)}
                              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-sm text-xs font-medium transition-all hover:opacity-100 opacity-60 ${colorCls}`}>
                              <span className="text-base leading-none">+</span>
                              <span className="font-mono text-[10px]">{time}</span>
                            </button>
                          )

                          // Cellule vide = Repos (alias de isEmptyDay, déclaré plus haut)
                          const isEmpty = isEmptyDay
                          // Repos excédentaire : si >1 jour vide (ou >2 si samedi travaillé)
                          const reposExcedentaire = !isSamedi && isEmpty && weeklyReposCount > (satHasSession ? 2 : 1)
                          // Salle complète ce jour (FP pris par 2 autres formateurs, présentiel impossible)
                          // → Ne s'applique pas le samedi (rotation : chaque formateur a son propre samedi)
                          const salleCompleteCeJour = !isSamedi && isEmpty && !hasFadAny && matinFPPris && pmFPPris && weeklyPresentielDays < 4

                          return (
                            <td key={jour} className={`px-1 py-1.5 align-top min-w-[150px] max-w-[180px] ${isSamedi ? 'border-l-2 border-dashed border-muted-foreground/30 bg-emerald-50/30' : ''}`}>
                              <div className="flex flex-col gap-1.5">

                                {/* ── BLOC MATIN FP ── */}
                                {/* Samedi : exclusivité salle désactivée (chaque formateur a son propre samedi en rotation) */}
                                {(hasMatinBlock || ((!matinFPPris || isSamedi) && (!blockFpMatS1 || !blockFpMatS2) && canAdd && weeklyPresentielDays < 4)) && (
                                  <div className="rounded-lg border-2 border-blue-200 overflow-hidden bg-white shadow-sm">
                                    <div className="px-2 py-1 bg-blue-600 flex items-center gap-1.5">
                                      <span className="text-[10px] font-bold text-white uppercase tracking-wider">☀ Matin FP</span>
                                    </div>
                                    <div className="p-1.5 flex flex-col gap-1">
                                      {!blockFpMatS1 && (ms1
                                        ? renderFPSlotFilled(ms1, '08h30–11h00', 'bg-blue-50', 'text-blue-700', 'blue-300')
                                        : ((!matinFPPris || isSamedi) && canAdd && renderFPSlotAdd('Matin FP S1', '08h30–11h00', 'bg-blue-50 text-blue-600 hover:bg-blue-100 border border-dashed border-blue-300'))
                                      )}
                                      {!blockFpMatS2 && (ms1 || ms2) && (
                                        ms2
                                          ? renderFPSlotFilled(ms2, '11h00–13h30', 'bg-blue-50/60', 'text-blue-600', 'blue-200')
                                          : ((!matinFPPris || isSamedi) && canAdd && ms1 && renderFPSlotAdd('Matin FP S2', '11h00–13h30', 'bg-blue-50/60 text-blue-500 hover:bg-blue-100 border border-dashed border-blue-200'))
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* ── BLOC APRÈS-MIDI FP ── */}
                                {(hasPmBlock || ((!pmFPPris || isSamedi) && (!blockFpPmS1 || !blockFpPmS2) && canAdd && weeklyPresentielDays < 4)) && (
                                  <div className="rounded-lg border-2 border-green-200 overflow-hidden bg-white shadow-sm">
                                    <div className="px-2 py-1 bg-green-600 flex items-center gap-1.5">
                                      <span className="text-[10px] font-bold text-white uppercase tracking-wider">🌿 Après-midi FP</span>
                                    </div>
                                    <div className="p-1.5 flex flex-col gap-1">
                                      {!blockFpPmS1 && (ps1
                                        ? renderFPSlotFilled(ps1, '13h30–16h00', 'bg-green-50', 'text-green-700', 'green-300')
                                        : ((!pmFPPris || isSamedi) && canAdd && renderFPSlotAdd('Après-midi FP S1', '13h30–16h00', 'bg-green-50 text-green-600 hover:bg-green-100 border border-dashed border-green-300'))
                                      )}
                                      {!blockFpPmS2 && (ps1 || ps2 || blockFpPmS1) && (
                                        ps2
                                          ? renderFPSlotFilled(ps2, '16h00–18h30', 'bg-green-50/60', 'text-green-600', 'green-200')
                                          : ((!pmFPPris || isSamedi) && canAdd && (ps1 || blockFpPmS1) && renderFPSlotAdd('Après-midi FP S2', '16h00–18h30', 'bg-green-50/60 text-green-500 hover:bg-green-100 border border-dashed border-green-200'))
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* ── BLOC FAD ── */}
                                {showFadBlock && (
                                  <div className="rounded-lg border-2 border-violet-200 overflow-hidden bg-white shadow-sm">
                                    <div className="px-2 py-1 bg-violet-600 flex items-center justify-between">
                                      <span className="text-[10px] font-bold text-white uppercase tracking-wider">📡 FAD</span>
                                      <span className="text-[9px] text-violet-200 font-mono">{weeklyFad2h30}/2 × 2h30</span>
                                    </div>
                                    <div className="p-1.5 flex flex-col gap-1">
                                      {/* Helper inline pour chaque sous-créneau FAD */}
                                      {([
                                        { rows: fadMatS1Rows, statut: 'FAD Matin S1' as StatutFixe,      time: '08h30–11h00', bg: 'bg-violet-50',    txt: 'text-violet-700', brd: 'border-violet-300', blocked: !!ms1 },
                                        { rows: fadMatS2Rows, statut: 'FAD Matin S2' as StatutFixe,      time: '11h00–13h30', bg: 'bg-violet-50/80', txt: 'text-violet-600', brd: 'border-violet-300', blocked: !!ms2 },
                                        { rows: fadPmS1Rows,  statut: 'FAD Après-midi S1' as StatutFixe, time: '13h30–16h00', bg: 'bg-violet-50/60', txt: 'text-violet-600', brd: 'border-violet-200', blocked: !!ps1 },
                                        { rows: fadPmS2Rows,  statut: 'FAD Après-midi S2' as StatutFixe, time: '16h00–18h30', bg: 'bg-violet-50/40', txt: 'text-violet-500', brd: 'border-violet-200', blocked: !!ps2 },
                                      ] as const).map(({ rows, statut, time, bg, txt, brd, blocked }) => {
                                        if (blocked) return null
                                        if (rows.length > 0) return (
                                          <div key={statut} className={`px-2 py-1.5 ${bg} rounded-sm`}>
                                            <div className="flex items-center gap-1 mb-0.5">
                                              <span className={`text-[9px] font-mono font-semibold ${txt}`}>{time}</span>
                                              <span className="text-[8px] text-violet-500">· {rows.length} grp</span>
                                            </div>
                                            {rows.map(row => (
                                              <div key={row.id} className="flex items-center gap-1 mt-0.5">
                                                <div className="flex-1">{renderGroupePicker(row, `border-violet-300 bg-white/80 ${txt}`)}</div>
                                                <button onClick={() => onRemoveSubSession(row.id)} className="w-5 h-5 flex-shrink-0 flex items-center justify-center rounded hover:bg-red-100 text-muted-foreground/40 hover:text-red-500 text-sm">×</button>
                                              </div>
                                            ))}
                                            {rows.length < 3 && (
                                              <button onClick={() => onAddSubSession(formateur.id, jour, statut)}
                                                className={`w-full flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-[9px] font-medium ${txt} hover:bg-violet-100 border border-dashed ${brd} mt-1 transition-all`}>
                                                <span>+</span><span>Fusionner un groupe</span>
                                              </button>
                                            )}
                                          </div>
                                        )
                                        if (canAddFad2h30) return (
                                          <button key={statut} onClick={() => onAddSubSession(formateur.id, jour, statut)}
                                            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-sm text-xs font-medium ${bg} ${txt} hover:bg-violet-100 border border-dashed ${brd} opacity-70 hover:opacity-100 transition-all`}>
                                            <span className="text-base leading-none">+</span>
                                            <span className="font-mono text-[10px]">{time}</span>
                                          </button>
                                        )
                                        return null
                                      })}

                                      {/* Complément 1h */}
                                      {showFad1hSlot && (
                                        fadHRow ? (
                                          <div className="px-2 py-1.5 bg-violet-100 rounded-sm border border-violet-200">
                                            <div className="flex items-center justify-between">
                                              <span className="text-[9px] font-bold text-violet-700">Complément · 1h</span>
                                              <button onClick={() => onRemoveSubSession(fadHRow.id)} className="w-5 h-5 flex items-center justify-center rounded hover:bg-red-100 text-muted-foreground/40 hover:text-red-500 text-sm">×</button>
                                            </div>
                                            {renderGroupePicker(fadHRow, 'border-violet-300 bg-white/80 text-violet-700')}
                                          </div>
                                        ) : (
                                          <button onClick={() => onAddSubSession(formateur.id, jour, 'FAD 1h')}
                                            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-sm text-xs font-bold bg-violet-50 text-violet-600 hover:bg-violet-100 border border-violet-300 transition-all shadow-sm">
                                            <span className="text-base leading-none">+</span><span>Complément · 1h</span>
                                          </button>
                                        )
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* Repos : normal / forcé (salle complète) / excédentaire */}
                                {isEmpty && !isSamedi && (
                                  reposExcedentaire ? (
                                    <div className="rounded-lg border-2 border-orange-200 bg-orange-50 px-2 py-2 text-center">
                                      <div className="text-[9px] font-bold text-orange-600">⚠ Repos excédentaire</div>
                                      <div className="text-[8px] text-orange-400 mt-0.5">Samedi compte déjà comme repos</div>
                                    </div>
                                  ) : salleCompleteCeJour ? (
                                    <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-2 py-2 text-center">
                                      <div className="text-[8px] font-semibold text-slate-400">🔒 Salle complète</div>
                                      <div className="flex justify-center mt-1">
                                        <StatutBadge statut="Repos" />
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex justify-center py-2">
                                      <StatutBadge statut="Repos" className="text-xs" />
                                    </div>
                                  )
                                )}
                                {isEmpty && isSamedi && (
                                  <div className="flex justify-center py-2">
                                    <StatutBadge statut="Repos" className="text-xs" />
                                  </div>
                                )}
                                {!canAdd && isEmpty && (
                                  <div className="text-[9px] text-orange-400 text-center font-mono">{seances}/{MAX_SEANCES}</div>
                                )}
                              </div>
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="border-t px-4 py-2 text-xs text-muted-foreground flex items-center gap-4">
              <span className="flex items-center gap-1"><span className="bg-green-100 text-green-600 px-1 rounded font-mono text-[9px]">S○</span> Salle libre</span>
              <span className="flex items-center gap-1"><span className="bg-amber-100 text-amber-600 px-1 rounded font-mono text-[9px]">S M</span> 1 créneau pris</span>
              <span className="flex items-center gap-1"><span className="bg-red-100 text-red-600 px-1 rounded font-mono text-[9px]">S✓</span> Salle complète</span>
              <span className="flex items-center gap-1 ml-auto"><span className="bg-emerald-100 text-emerald-700 px-1 rounded font-mono text-[9px]">5/5</span> = séances/semaine complètes</span>
            </div>

            {expanded && (
              <RotationSallePanel
                salle={salle}
                formateursSalle={formateursSalle}
                rotationConfig={rotationConfig}
                cycleRef={cycleReferences.find(c => c.salle_id === salle.id)}
                previewAnnee={previewAnnee}
                previewMois={previewMois}
                onStatutChange={onRotationStatut}
                onAutoRotation={onAutoRotation}
                onAncrageSave={onAncrageSave}
                onApplyRotation={entries => onApplyRotation(salle.id, entries)}
              />
            )}
          </div>
        )
      })}

      {groupesFormation.length > 0 && (
        <div className="rounded-lg border bg-card p-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
            <Users className="h-3.5 w-3.5" />
            Emplois du temps — Groupes de formation
          </h3>
          <div className="flex flex-wrap gap-2">
            {groupesFormation.map(groupe => {
              const seances = planning.filter(p => p.groupe_formation_id === groupe.id).length
              const isLoading = pdfLoadingKey === `groupe-${groupe.id}`
              return (
                <button
                  key={groupe.id}
                  onClick={() => openGroupePDF(groupe)}
                  disabled={!!pdfLoadingKey}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[#003D70]/30 bg-[#003D70]/5 text-[#003D70] hover:bg-[#003D70]/15 transition-all disabled:opacity-50"
                  title={`EDT ${groupe.nom} — ${seances} séance(s)`}
                >
                  <FileDown className="h-3.5 w-3.5" />
                  {isLoading ? 'Génération…' : groupe.nom}
                  {seances > 0 && !isLoading && (
                    <span className="ml-1 text-[10px] bg-[#003D70]/10 px-1.5 py-0.5 rounded font-mono">{seances}</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </>
  )
}

// ── Vue Pool Mixte (Scénario C) ───────────────────────────────

function PoolMixedView({
  salles, formateurs, planning, saving,
  onAssign,
}: {
  salles: Salle[]
  formateurs: Formateur[]
  planning: PlanningFixe[]
  saving: Set<string>
  onAssign: (formateurId: string, jour: JourSemaine, value: string) => void
}) {
  function getSlotsPris(jour: JourSemaine, salleId: string, excludeFormateurId: string): Set<StatutFixe> {
    const pris = new Set<StatutFixe>()
    for (const p of planning) {
      if (p.formateur_id === excludeFormateurId) continue
      if (p.jour_semaine !== jour) continue
      if (p.salle_id !== salleId) continue
      if (p.statut === 'Matin' || p.statut === 'Après-midi') pris.add(p.statut)
    }
    return pris
  }

  function toutesCompletes(jour: JourSemaine, excludeId: string): boolean {
    return salles.every(s => {
      const pris = getSlotsPris(jour, s.id, excludeId)
      return pris.has('Matin') && pris.has('Après-midi')
    })
  }

  function getCurrentValue(formateurId: string, jour: JourSemaine): string {
    const p = planning.find(p => p.formateur_id === formateurId && p.jour_semaine === jour)
    if (!p) return ''
    return encodeValue(p.statut, p.salle_id)
  }

  function renderCurrentValue(value: string): React.ReactNode {
    if (!value) return <span className="text-muted-foreground/50">—</span>
    if (value === 'Distance' || value === 'Distance Matin' || value === 'Distance Après-midi' || value === 'Repos') return <StatutBadge statut={value as StatutFixe} />
    const { statut, salleId } = decodeValue(value)
    const salle = salles.find(s => s.id === salleId)
    return (
      <span className="flex items-center gap-1 text-xs">
        <span className="text-muted-foreground font-mono">{salle?.nom ?? '?'}</span>
        <span className="text-muted-foreground">·</span>
        <StatutBadge statut={statut} />
      </span>
    )
  }

  function getOccupationJour(jour: JourSemaine): { salle: Salle; matin: boolean; apresmidi: boolean }[] {
    return salles.map(salle => {
      const assignations = planning.filter(
        p => p.jour_semaine === jour && p.salle_id === salle.id && (p.statut === 'Matin' || p.statut === 'Après-midi')
      )
      return {
        salle,
        matin: assignations.some(p => p.statut === 'Matin'),
        apresmidi: assignations.some(p => p.statut === 'Après-midi'),
      }
    })
  }

  function countSeances(formateurId: string): number {
    return JOURS_SEMAINE.filter(j => {
      const val = getCurrentValue(formateurId, j)
      if (!val) return false
      const { statut } = val === 'Distance' || val === 'Repos' ? { statut: val as StatutFixe } : decodeValue(val)
      return STATUTS_TRAVAIL.includes(statut as StatutFixe)
    }).length
  }

  return (
    <div className="rounded-lg border bg-card">
      <div className="border-b px-4 py-3">
        <h2 className="font-semibold">Pool Mixte — Toutes salles disponibles</h2>
        <p className="text-xs text-muted-foreground">Choisissez la salle et la séance pour chaque formateur.</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-2 text-left font-medium text-muted-foreground w-44">Formateur</th>
              {JOURS_SEMAINE.map(jour => {
                const occ = getOccupationJour(jour)
                const toutesPleines = occ.every(o => o.matin && o.apresmidi)
                const isSamedi = jour === 'Samedi'
                return (
                  <th key={jour} className={`px-2 py-2 text-center font-medium text-muted-foreground min-w-[140px] ${isSamedi ? 'border-l-2 border-dashed border-muted-foreground/40' : ''}`}>
                    <div className={isSamedi ? 'text-emerald-700 font-semibold' : ''}>{jour}</div>
                    <div className="flex justify-center gap-1 mt-1">
                      {occ.map(o => (
                        <span
                          key={o.salle.id}
                          title={`${o.salle.nom} : ${o.matin ? 'Matin✓' : 'Matin○'} ${o.apresmidi ? 'PM✓' : 'PM○'}`}
                          className={`text-[9px] font-mono px-1 rounded ${
                            o.matin && o.apresmidi ? 'bg-red-100 text-red-600'
                            : (o.matin || o.apresmidi) ? 'bg-amber-100 text-amber-600'
                            : 'bg-green-100 text-green-600'
                          }`}
                        >
                          {o.salle.nom.replace('Salle ', 'S')}
                          {o.matin && o.apresmidi ? ' ✓' : o.matin ? ' M' : o.apresmidi ? ' PM' : ' ○'}
                        </span>
                      ))}
                    </div>
                    {toutesPleines && (
                      <div className="flex items-center justify-center gap-0.5 mt-0.5 text-[9px] text-red-500">
                        <Info className="h-2.5 w-2.5" /> Salles complètes
                      </div>
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody className="divide-y">
            {formateurs.map(formateur => {
              const seances = countSeances(formateur.id)
              return (
                <tr key={formateur.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-2 font-medium text-sm">
                    {formateur.nom}
                    <SeancesBadge count={seances} />
                  </td>
                  {JOURS_SEMAINE.map(jour => {
                    const key = `${formateur.id}-${jour}`
                    const currentVal = getCurrentValue(formateur.id, jour)
                    const complete = toutesCompletes(jour, formateur.id)
                    const isSamedi = jour === 'Samedi'
                    const trop = !currentVal && seances >= MAX_SEANCES

                    const optionsPhysiques: { value: string; label: string }[] = []
                    for (const salle of salles) {
                      const pris = getSlotsPris(jour, salle.id, formateur.id)
                      if (!pris.has('Matin')) optionsPhysiques.push({ value: `${salle.id}|Matin`, label: `${salle.nom} · Matin` })
                      if (!pris.has('Après-midi')) optionsPhysiques.push({ value: `${salle.id}|Après-midi`, label: `${salle.nom} · Après-midi` })
                    }

                    const dejaDistance = JOURS_SEMAINE
                      .filter(j => j !== jour)
                      .some(j => {
                        const st = planning.find(p => p.formateur_id === formateur.id && p.jour_semaine === j)?.statut
                        return st === 'Distance' || st === 'Distance Matin' || st === 'Distance Après-midi'
                      })

                    return (
                      <td key={jour} className={`px-2 py-2 text-center ${isSamedi ? 'border-l-2 border-dashed border-muted-foreground/40 bg-emerald-50/30' : ''}`}>
                        <Select
                          value={currentVal}
                          onValueChange={val => onAssign(formateur.id, jour, val ?? '')}
                          disabled={saving.has(key)}
                        >
                          <SelectTrigger className="h-8 w-[150px] text-xs mx-auto">
                            <SelectValue>{renderCurrentValue(currentVal)}</SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {trop && (
                              <div className="flex items-center gap-1.5 px-3 py-2 text-xs text-orange-600 bg-orange-50 border-b">
                                <Info className="h-3 w-3 shrink-0" />
                                {seances}/{MAX_SEANCES} séances déjà atteint
                              </div>
                            )}
                            {complete && optionsPhysiques.length === 0 && (
                              <div className="flex items-center gap-1.5 px-3 py-2 text-xs text-amber-600 bg-amber-50 border-b">
                                <Info className="h-3 w-3 shrink-0" />
                                Toutes les salles physiques sont occupées
                              </div>
                            )}
                            {optionsPhysiques.map(opt => {
                              const [, statut] = opt.value.split('|')
                              return (
                                <SelectItem key={opt.value} value={opt.value}>
                                  <span className="flex items-center gap-1.5 text-xs">
                                    <span className="text-muted-foreground font-mono">{opt.label.split(' · ')[0]}</span>
                                    <span className="text-muted-foreground">·</span>
                                    <StatutBadge statut={statut as StatutFixe} />
                                  </span>
                                </SelectItem>
                              )
                            })}
                            {optionsPhysiques.length > 0 && <div className="h-px bg-border my-1" />}
                            {!dejaDistance && !isSamedi && (
                              <>
                                <SelectItem value="Distance Matin"><StatutBadge statut="Distance Matin" /></SelectItem>
                                <SelectItem value="Distance Après-midi"><StatutBadge statut="Distance Après-midi" /></SelectItem>
                              </>
                            )}
                            <SelectItem value="Repos"><StatutBadge statut="Repos" /></SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="border-t px-4 py-2 text-xs text-muted-foreground flex items-center gap-4">
        <span className="flex items-center gap-1"><span className="bg-green-100 text-green-600 px-1 rounded font-mono text-[9px]">S○</span> Salle libre</span>
        <span className="flex items-center gap-1"><span className="bg-amber-100 text-amber-600 px-1 rounded font-mono text-[9px]">S M</span> 1 créneau pris</span>
        <span className="flex items-center gap-1"><span className="bg-red-100 text-red-600 px-1 rounded font-mono text-[9px]">S✓</span> Salle complète</span>
      </div>
    </div>
  )
}

// ── Composant principal ───────────────────────────────────────

export function PlanningFixeClient({ salles, groupes, formateurs, planningFixe, activeScenario, rotationConfig: initRotation, cycleReferences: initCycleRefs }: Props) {
  const groupesFormation = groupes.filter(isGroupeFormation)
  const [planning, setPlanning] = useState<PlanningFixe[]>(planningFixe)
  const [saving, setSaving] = useState<Set<string>>(new Set())
  const [rotationCfg, setRotationCfg] = useState<RotationSamediConfig[]>(initRotation)
  const [cycleRefs, setCycleRefs] = useState<CycleReference[]>(initCycleRefs)
  const now = new Date()
  const [selectedMois, setSelectedMois] = useState(now.getMonth() + 1)
  const [selectedAnnee, setSelectedAnnee] = useState(now.getFullYear())
  const supabase = createClient()

  const isPoolMixed = activeScenario?.config && 'type' in activeScenario.config && activeScenario.config.type === 'pool_mixed'

  function addSaving(key: string) { setSaving(prev => new Set(prev).add(key)) }
  function delSaving(key: string) { setSaving(prev => { const n = new Set(prev); n.delete(key); return n }) }

  // ── Handlers Planning Fixe ────────────────────────────────
  async function handleAddSubSession(formateurId: string, jour: JourSemaine, statut: StatutFixe) {
    const key = `${formateurId}-${jour}-${statut}`
    addSaving(key)

    const { data, error } = await supabase
      .from('planning_fixe')
      .insert({ formateur_id: formateurId, jour_semaine: jour, statut, groupe_formation_id: null, salle_id: null })
      .select()
      .single()

    if (error) { toast.error('Erreur lors de la sauvegarde'); delSaving(key); return }

    const updated = [...planning, data as PlanningFixe]
    setPlanning(updated)
    toast.success('Sous-séance ajoutée')
    delSaving(key)

    // Auto-Repos Samedi si Mon-Ven atteint le quota
    if (jour !== 'Samedi') {
      const monVenCount = updated.filter(p =>
        p.formateur_id === formateurId &&
        JOURS_MON_VEN.includes(p.jour_semaine as JourSemaine) &&
        STATUTS_TRAVAIL.includes(p.statut)
      ).length
      if (monVenCount >= MAX_SEANCES) {
        // Supprimer toutes les sous-séances du Samedi pour ce formateur
        const samediRows = updated.filter(p => p.formateur_id === formateurId && p.jour_semaine === 'Samedi')
        for (const row of samediRows) {
          await supabase.from('planning_fixe').delete().eq('id', row.id)
        }
        if (samediRows.length > 0) {
          setPlanning(prev => prev.filter(p => !(p.formateur_id === formateurId && p.jour_semaine === 'Samedi')))
        }
      }
    }
  }

  async function handleRemoveSubSession(rowId: string) {
    const row = planning.find(p => p.id === rowId)
    if (!row) return
    const key = `${row.formateur_id}-${row.jour_semaine}-${row.statut}`
    addSaving(key)

    const { error } = await supabase.from('planning_fixe').delete().eq('id', rowId)
    if (error) { toast.error('Erreur lors de la suppression'); delSaving(key); return }

    setPlanning(prev => prev.filter(p => p.id !== rowId))
    delSaving(key)
  }

  async function handlePoolAssign(formateurId: string, jour: JourSemaine, value: string) {
    const key = `${formateurId}-${jour}`
    addSaving(key)
    const { statut, salleId } = decodeValue(value)
    const existing = planning.find(p => p.formateur_id === formateurId && p.jour_semaine === jour)

    const { error } = await supabase
      .from('planning_fixe')
      .upsert(
        { formateur_id: formateurId, jour_semaine: jour, statut, salle_id: salleId },
        { onConflict: 'formateur_id,jour_semaine' }
      )

    if (error) { toast.error('Erreur lors de la sauvegarde') } else {
      setPlanning(prev => [
        ...prev.filter(p => !(p.formateur_id === formateurId && p.jour_semaine === jour)),
        { id: existing?.id ?? crypto.randomUUID(), formateur_id: formateurId, jour_semaine: jour, statut, salle_id: salleId, groupe_formation_id: null },
      ])
      toast.success('Statut mis à jour')
    }
    delSaving(key)
  }

  async function handleGroupeChange(rowId: string, groupeId: string | null) {
    const { error } = await supabase
      .from('planning_fixe')
      .update({ groupe_formation_id: groupeId })
      .eq('id', rowId)

    if (error) { toast.error('Erreur lors de la sauvegarde du groupe'); return }

    setPlanning(prev => prev.map(p => p.id === rowId ? { ...p, groupe_formation_id: groupeId } : p))
  }

  // ── Handlers Rotation Samedi ──────────────────────────────
  async function handleRotationStatut(salleId: string, pos: SemaineCycle, formateurId: string, statut: StatutSamedi) {
    const existing = rotationCfg.find(
      c => c.salle_id === salleId && c.semaine_cycle === pos && c.formateur_id === formateurId
    )
    let error
    if (existing?.id && !existing.id.startsWith('tmp-')) {
      ;({ error } = await supabase.from('rotation_samedi_config').update({ statut }).eq('id', existing.id))
    } else {
      ;({ error } = await supabase.from('rotation_samedi_config')
        .insert({ salle_id: salleId, semaine_cycle: pos, formateur_id: formateurId, statut, groupe_id: null }))
    }
    if (error) { toast.error('Erreur lors de la sauvegarde'); return }
    setRotationCfg(prev => [
      ...prev.filter(c => !(c.salle_id === salleId && c.semaine_cycle === pos && c.formateur_id === formateurId)),
      { id: existing?.id ?? `tmp-${crypto.randomUUID()}`, salle_id: salleId, groupe_id: null, semaine_cycle: pos, formateur_id: formateurId, statut },
    ])
    toast.success('Mis à jour')
  }

  async function handleAutoRotation(salleId: string, formateursSalle: Formateur[]) {
    const mois1 = formateursSalle.map(f => ({
      formateur_id: f.id,
      statut: (rotationCfg.find(c => c.salle_id === salleId && c.semaine_cycle === 1 && c.formateur_id === f.id)?.statut ?? 'Repos') as StatutSamedi,
    }))
    const mois2 = mois1.map(e => ({ formateur_id: e.formateur_id, statut: ROTATION_SUIVANTE[e.statut] }))
    const mois3 = mois2.map(e => ({ formateur_id: e.formateur_id, statut: ROTATION_SUIVANTE[e.statut] }))
    await supabase.from('rotation_samedi_config').delete().eq('salle_id', salleId).in('semaine_cycle', [2, 3])
    const rows = [
      ...mois2.map(e => ({ salle_id: salleId, groupe_id: null, semaine_cycle: 2 as SemaineCycle, formateur_id: e.formateur_id, statut: e.statut })),
      ...mois3.map(e => ({ salle_id: salleId, groupe_id: null, semaine_cycle: 3 as SemaineCycle, formateur_id: e.formateur_id, statut: e.statut })),
    ]
    const { error } = await supabase.from('rotation_samedi_config').insert(rows)
    if (error) { toast.error('Erreur lors de la génération'); return }
    setRotationCfg(prev => [
      ...prev.filter(c => !(c.salle_id === salleId && (c.semaine_cycle === 2 || c.semaine_cycle === 3))),
      ...rows.map(r => ({ ...r, id: `tmp-${crypto.randomUUID()}` })),
    ])
    toast.success('Mois 2 et 3 générés automatiquement')
  }

  async function handleAncrageSave(salleId: string, dateAncrage: string, moisCycleAncrage: SemaineCycle) {
    const existing = cycleRefs.find(c => c.salle_id === salleId)
    let error
    if (existing?.id && !existing.id.startsWith('tmp-')) {
      ;({ error } = await supabase.from('cycle_reference')
        .update({ date_ancrage: dateAncrage, semaine_cycle_ancrage: moisCycleAncrage })
        .eq('id', existing.id))
    } else {
      ;({ error } = await supabase.from('cycle_reference')
        .insert({ salle_id: salleId, date_ancrage: dateAncrage, semaine_cycle_ancrage: moisCycleAncrage, groupe_id: null }))
    }
    if (error) { toast.error("Erreur lors de la sauvegarde de l'ancrage"); return }
    setCycleRefs(prev => [
      ...prev.filter(c => c.salle_id !== salleId),
      { id: existing?.id ?? `tmp-${crypto.randomUUID()}`, salle_id: salleId, groupe_id: null, date_ancrage: dateAncrage, semaine_cycle_ancrage: moisCycleAncrage },
    ])
    toast.success('Ancrage mis à jour')
  }

  // Applique la rotation du mois sélectionné sur la colonne Samedi du planning fixe
  async function handleApplyRotation(_salleId: string, entries: { formateurId: string; statut: StatutSamedi }[]) {
    // Map legacy rotation statuts vers nouveaux sous-créneaux (S1 par défaut)
    const statutMap: Record<StatutSamedi, StatutFixe> = {
      'Matin': 'Matin FP S1',
      'Après-midi': 'Après-midi FP S1',
      'Repos': 'Repos',
    }
    for (const { formateurId, statut } of entries) {
      if (statut === 'Repos') continue
      // Supprimer les séances Samedi existantes
      const existing = planning.filter(p => p.formateur_id === formateurId && p.jour_semaine === 'Samedi')
      for (const row of existing) {
        await supabase.from('planning_fixe').delete().eq('id', row.id)
      }
      setPlanning(prev => prev.filter(p => !(p.formateur_id === formateurId && p.jour_semaine === 'Samedi')))
      // Ajouter la nouvelle sous-séance
      await handleAddSubSession(formateurId, 'Samedi', statutMap[statut])
    }
    toast.success(`Rotation Samedi (${MOIS_LABELS[selectedMois - 1]}) appliquée au planning`)
  }

  const annees = [selectedAnnee - 1, selectedAnnee, selectedAnnee + 1]

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <PageHeader
              icon={CalendarDays}
              title="Planning Hebdomadaire"
              subtitle={
                isPoolMixed
                  ? 'Scénario C actif — Pool mixte : tous les formateurs peuvent être affectés à n\'importe quelle salle.'
                  : '5 séances/semaine par formateur · Lun–Ven fixe · Samedi par rotation mensuelle (panneau ⚙ par salle)'
              }
              badge={isPoolMixed ? 'Pool mixte' : 'Fixe'}
            />
          </div>
          {/* Sélecteur mois/année pour le panneau Rotation Samedi */}
          <div className="flex items-center gap-2 shrink-0 mt-1">
            <RotateCcw className="h-4 w-4 text-muted-foreground/60" />
            <span className="text-xs text-muted-foreground">Mois rotation :</span>
            <Select value={String(selectedMois)} onValueChange={v => setSelectedMois(Number(v))}>
              <SelectTrigger className="h-7 w-[110px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MOIS_LABELS.map((label, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)} className="text-xs">{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={String(selectedAnnee)} onValueChange={v => setSelectedAnnee(Number(v))}>
              <SelectTrigger className="h-7 w-[80px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {annees.map(a => (
                  <SelectItem key={a} value={String(a)} className="text-xs">{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {activeScenario && (
          <div className={`mt-2 text-xs px-3 py-1.5 rounded inline-flex items-center gap-2 ${
            isPoolMixed ? 'bg-purple-50 text-purple-700 border border-purple-200' : 'bg-blue-50 text-blue-700 border border-blue-200'
          }`}>
            Scénario actif : <strong>{activeScenario.nom}</strong>
          </div>
        )}
        <PageDivider />
      </div>

      {isPoolMixed ? (
        <PoolMixedView
          salles={salles}
          formateurs={formateurs}
          planning={planning}
          saving={saving}
          onAssign={handlePoolAssign}
        />
      ) : (
        <StandardView
          salles={salles}
          groupes={groupes}
          formateurs={formateurs}
          planning={planning}
          saving={saving}
          onAddSubSession={handleAddSubSession}
          onRemoveSubSession={handleRemoveSubSession}
          onGroupeChange={handleGroupeChange}
          groupesFormation={groupesFormation}
          rotationConfig={rotationCfg}
          cycleReferences={cycleRefs}
          previewAnnee={selectedAnnee}
          previewMois={selectedMois}
          onRotationStatut={handleRotationStatut}
          onAutoRotation={handleAutoRotation}
          onAncrageSave={handleAncrageSave}
          onApplyRotation={handleApplyRotation}
        />
      )}
    </div>
  )
}
