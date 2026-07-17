'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Users, Eye, X, FileDown } from 'lucide-react'
import { StatutBadge } from '@/components/planning/StatutBadge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { PageHeader, PageDivider } from '@/components/layout/PageHeader'
import { PDFDownloadButton } from '@/components/pdf/PDFDownloadButton'
import type {
  Pole, Salle, Formateur, PlanningFixe, Groupe,
  JourSemaine, StatutFixe,
} from '@/types/planning'
import { JOURS_SEMAINE } from '@/types/planning'

// ── Constantes ────────────────────────────────────────────────

const JOURS_MON_VEN: JourSemaine[] = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi']

const HORAIRES_SLOTS: { statut: StatutFixe; label: string; time: string; bg: string; fg: string }[] = [
  { statut: 'Matin FP S1',      label: 'Matin S1',       time: '08h30 – 11h00', bg: '#EFF6FF', fg: '#1D4ED8' },
  { statut: 'Matin FP S2',      label: 'Matin S2',       time: '11h00 – 13h30', bg: '#DBEAFE', fg: '#1E40AF' },
  { statut: 'Après-midi FP S1', label: 'Après-midi S1',  time: '13h30 – 16h00', bg: '#FFF7ED', fg: '#C2410C' },
  { statut: 'Après-midi FP S2', label: 'Après-midi S2',  time: '16h00 – 18h30', bg: '#FFFBEB', fg: '#92400E' },
  { statut: 'FAD Matin',        label: 'FAD Matin',      time: '2h30 dist.',    bg: '#F5F3FF', fg: '#5B21B6' },
  { statut: 'FAD Après-midi',   label: 'FAD Après-midi', time: '2h30 dist.',    bg: '#EDE9FE', fg: '#4C1D95' },
  { statut: 'FAD 1h',           label: 'FAD Complément', time: '1h dist.',      bg: '#FAF5FF', fg: '#6B21A8' },
]

// ── Fiche emploi du temps ─────────────────────────────────────

function FormateurScheduleModal({
  formateur, salleNom, planning, groupesFormation, onClose,
}: {
  formateur: Formateur
  salleNom: string
  planning: PlanningFixe[]
  groupesFormation: Groupe[]
  onClose: () => void
}) {
  const rows = planning.filter(p => p.formateur_id === formateur.id)
  const slotsActifs = HORAIRES_SLOTS.filter(s => rows.some(r => r.statut === s.statut))

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col" onClick={e => e.stopPropagation()}>

        <div className="px-6 py-4 bg-[#003D70] rounded-t-xl flex items-center justify-between shrink-0">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-blue-300 mb-0.5">Emploi du temps</p>
            <h2 className="text-white text-base font-bold">{formateur.nom}</h2>
            {formateur.matricule && <p className="text-blue-200 text-[11px] mt-0.5">Matricule : {formateur.matricule}</p>}
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-[10px] text-blue-300 uppercase tracking-wide">Salles</p>
              <p className="text-white text-sm font-bold">{salleNom}</p>
            </div>
            <button onClick={onClose} className="flex items-center justify-center w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="overflow-auto flex-1 p-5">
          {slotsActifs.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground text-sm italic">
              Aucune séance planifiée pour ce formateur.
            </div>
          ) : (
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b-2 border-[#003D70]">
                  <th className="text-left px-3 py-2.5 font-semibold text-[#003D70] text-[10px] uppercase tracking-wide w-36">Créneau horaire</th>
                  {JOURS_SEMAINE.map(jour => (
                    <th key={jour} className={`px-2 py-2.5 text-center font-bold text-[11px] ${jour === 'Samedi' ? 'text-emerald-700 bg-emerald-50/60' : 'text-[#003D70]'}`}>
                      {jour}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {slotsActifs.map((slot, idx) => (
                  <tr key={slot.statut} className={`border-b ${idx % 2 === 0 ? 'bg-slate-50/40' : ''}`}>
                    <td className="px-3 py-3 w-36">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: slot.fg }} />
                        <span className="font-bold text-[11px]" style={{ color: slot.fg }}>{slot.label}</span>
                      </div>
                      <div className="text-[10px] font-mono text-muted-foreground pl-4">{slot.time}</div>
                    </td>
                    {JOURS_SEMAINE.map(jour => {
                      const row = rows.find(r => r.jour_semaine === jour && r.statut === slot.statut)
                      const groupeNom = row ? (groupesFormation.find(g => g.id === row.groupe_formation_id)?.nom ?? null) : null
                      return (
                        <td key={jour} className={`px-2 py-3 text-center align-middle ${jour === 'Samedi' ? 'bg-emerald-50/30' : ''}`}>
                          {row ? (
                            <div className="rounded-lg px-2 py-2 inline-flex flex-col items-center gap-1 min-w-[76px] border"
                              style={{ backgroundColor: slot.bg, borderColor: slot.fg + '40' }}>
                              <span className="text-[9px] font-bold font-mono tracking-tight" style={{ color: slot.fg }}>{slot.time}</span>
                              {groupeNom
                                ? <span className="text-[12px] font-extrabold leading-tight text-center" style={{ color: slot.fg }}>{groupeNom}</span>
                                : <span className="text-[10px] text-muted-foreground/40 italic">—</span>
                              }
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

        <div className="border-t px-6 py-3 flex items-center justify-between shrink-0 bg-slate-50 rounded-b-xl">
          <p className="text-[11px] text-muted-foreground">Planning hebdomadaire fixe · Lun–Sam</p>
          <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground underline">Fermer</button>
        </div>
      </div>
    </div>,
    document.body
  )
}
const MAX_SEANCES = 10

const FP_MATIN:  StatutFixe[] = ['Matin FP S1', 'Matin FP S2']
const FP_PM:     StatutFixe[] = ['Après-midi FP S1', 'Après-midi FP S2']
const FAD_2H30:  StatutFixe[] = ['FAD Matin S1', 'FAD Matin S2', 'FAD Après-midi S1', 'FAD Après-midi S2', 'FAD Matin', 'FAD Après-midi']
const FAD_MAT:   StatutFixe[] = ['FAD Matin S1', 'FAD Matin S2', 'FAD Matin']
const FAD_PM:    StatutFixe[] = ['FAD Après-midi S1', 'FAD Après-midi S2', 'FAD Après-midi']

// ── Badge salle ───────────────────────────────────────────────

function SalleBadge({ nom, color }: { nom: string; color: 'blue' | 'emerald' }) {
  const cls = color === 'blue'
    ? 'bg-blue-100 text-blue-700 border border-blue-200'
    : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
  return (
    <span className={`text-[8px] font-bold px-1 py-0.5 rounded ${cls}`}>
      {nom.replace('Salle ', 'S')}
    </span>
  )
}

// ── Indicateur d'occupation par salle ─────────────────────────

function OccupationPole({
  salles, planning, jour, formateurIds,
}: {
  salles: Salle[]
  planning: PlanningFixe[]
  jour: JourSemaine
  formateurIds: string[]
}) {
  return (
    <div className="flex gap-2">
      {salles.map((s, i) => {
        const matinPris = planning.some(p =>
          p.salle_id === s.id && p.jour_semaine === jour &&
          formateurIds.includes(p.formateur_id) &&
          FP_MATIN.includes(p.statut)
        )
        const pmPris = planning.some(p =>
          p.salle_id === s.id && p.jour_semaine === jour &&
          formateurIds.includes(p.formateur_id) &&
          FP_PM.includes(p.statut)
        )
        const color = i === 0 ? 'text-blue-600' : 'text-emerald-600'
        const bgColor = i === 0 ? 'bg-blue-50' : 'bg-emerald-50'
        return (
          <div key={s.id} className={`text-[7px] font-mono px-1 py-0.5 rounded ${bgColor} ${color}`}>
            {s.nom.replace('Salle ', 'S')}:
            <span className={matinPris ? 'text-red-500' : 'text-green-600'}> M{matinPris ? '✓' : '○'}</span>
            <span className={pmPris ? 'text-red-500' : 'text-green-600'}> PM{pmPris ? '✓' : '○'}</span>
          </div>
        )
      })}
    </div>
  )
}

// ── Taux d'occupation par salle (bannière haut de section) ────

const FP_ALL: StatutFixe[] = [...FP_MATIN, ...FP_PM]
// 5 jours × 4 sous-créneaux (MS1 MS2 PMS1 PMS2) = 20 max par salle
const MAX_CRENEAUX_SALLE = 20

function OccupationSalleBanner({
  salles,
  planning,
}: {
  salles: Salle[]
  planning: PlanningFixe[]
}) {
  if (salles.length === 0) return null

  const COLORS = [
    { bar: 'bg-blue-500',    bg: 'bg-blue-50',    border: 'border-blue-200',    text: 'text-blue-700',    label: 'text-blue-600' },
    { bar: 'bg-emerald-500', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', label: 'text-emerald-600' },
  ]

  return (
    <div className="px-4 py-3 border-b bg-white grid gap-3" style={{ gridTemplateColumns: `repeat(${salles.length}, 1fr)` }}>
      {salles.map((salle, i) => {
        const c = COLORS[i] ?? COLORS[0]

        // Compter les sous-créneaux FP distincts occupés dans cette salle (Lun–Ven)
        const slots = new Set<string>()
        for (const p of planning) {
          if (
            p.salle_id === salle.id &&
            FP_ALL.includes(p.statut) &&
            JOURS_MON_VEN.includes(p.jour_semaine as JourSemaine)
          ) {
            slots.add(`${p.jour_semaine}-${p.statut}`)
          }
        }

        const filled  = slots.size
        const pct     = Math.min(100, Math.round((filled / MAX_CRENEAUX_SALLE) * 100))
        const isPlein = pct === 100

        return (
          <div key={salle.id} className={`rounded-xl border-2 ${c.border} ${c.bg} px-4 py-3`}>
            {/* En-tête */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold ${c.text}`}>{salle.nom}</span>
                {isPlein && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                    ✓ Salle pleine
                  </span>
                )}
              </div>
              <span className={`text-lg font-bold ${isPlein ? 'text-emerald-600' : c.text}`}>
                {pct}%
              </span>
            </div>

            {/* Barre de progression */}
            <div className="h-3 bg-white/70 rounded-full overflow-hidden border border-white/50 mb-2">
              <div
                className={`h-full rounded-full transition-all duration-500 ${isPlein ? 'bg-emerald-500' : c.bar}`}
                style={{ width: `${pct}%` }}
              />
            </div>

            {/* Détail */}
            <div className="flex items-center justify-between text-[10px]">
              <span className={c.label}>
                {filled} / {MAX_CRENEAUX_SALLE} créneaux saisis
              </span>
              <span className="text-muted-foreground/60">
                {MAX_CRENEAUX_SALLE - filled} restants
              </span>
            </div>

            {/* Grille Lun–Ven : M○ / PM○ par jour */}
            <div className="mt-2 flex gap-1 flex-wrap">
              {JOURS_MON_VEN.map(jour => {
                const matinS1 = planning.some(p => p.salle_id === salle.id && p.jour_semaine === jour && p.statut === 'Matin FP S1')
                const matinS2 = planning.some(p => p.salle_id === salle.id && p.jour_semaine === jour && p.statut === 'Matin FP S2')
                const pmS1    = planning.some(p => p.salle_id === salle.id && p.jour_semaine === jour && p.statut === 'Après-midi FP S1')
                const pmS2    = planning.some(p => p.salle_id === salle.id && p.jour_semaine === jour && p.statut === 'Après-midi FP S2')
                const matinFull = matinS1 && matinS2
                const pmFull    = pmS1 && pmS2
                const jourShort = jour.slice(0, 3).toUpperCase()
                return (
                  <div key={jour} className="flex flex-col items-center gap-0.5 min-w-[30px]">
                    <span className="text-[8px] text-muted-foreground font-mono">{jourShort}</span>
                    <span className={`text-[8px] font-bold px-1 rounded ${matinFull ? 'bg-blue-200 text-blue-800' : matinS1 ? 'bg-blue-100 text-blue-500' : 'bg-slate-100 text-slate-400'}`}>
                      M{matinS1 && matinS2 ? '✓' : matinS1 ? '½' : '○'}
                    </span>
                    <span className={`text-[8px] font-bold px-1 rounded ${pmFull ? 'bg-amber-200 text-amber-800' : pmS1 ? 'bg-amber-100 text-amber-500' : 'bg-slate-100 text-slate-400'}`}>
                      PM{pmS1 && pmS2 ? '✓' : pmS1 ? '½' : '○'}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Props ─────────────────────────────────────────────────────

interface Props {
  poles: Pole[]
  salles: Salle[]
  formateurs: Formateur[]
  planningFixe: PlanningFixe[]
  groupesFormation: Groupe[]
}

// ── Composant principal ───────────────────────────────────────

export function PlanningScenarioCClient({
  poles, salles, formateurs, planningFixe, groupesFormation,
}: Props) {
  const [planning, setPlanning] = useState<PlanningFixe[]>(planningFixe)
  const [viewFormateur, setViewFormateur] = useState<{ formateur: Formateur; salleNom: string } | null>(null)
  const [pdfLoadingKey, setPdfLoadingKey] = useState<string | null>(null)
  const supabase = createClient()

  // ── Helpers DB ────────────────────────────────────────────

  async function addSession(formateurId: string, jour: JourSemaine, statut: StatutFixe, salleId: string | null) {
    const { data, error } = await supabase
      .from('planning_fixe')
      .insert({ formateur_id: formateurId, jour_semaine: jour, statut, salle_id: salleId, groupe_formation_id: null })
      .select()
      .single()
    if (error) { toast.error('Erreur ajout séance'); return }
    setPlanning(prev => [...prev, data as PlanningFixe])
    toast.success('Séance ajoutée')
  }

  async function removeSession(id: string) {
    const { error } = await supabase.from('planning_fixe').delete().eq('id', id)
    if (error) { toast.error('Erreur suppression'); return }
    setPlanning(prev => prev.filter(p => p.id !== id))
    toast.success('Séance supprimée')
  }

  async function changeSalle(ids: string[], newSalleId: string) {
    for (const id of ids) {
      await supabase.from('planning_fixe').update({ salle_id: newSalleId }).eq('id', id)
    }
    setPlanning(prev => prev.map(p => ids.includes(p.id) ? { ...p, salle_id: newSalleId } : p))
  }

  async function changeGroupe(id: string, groupeFormationId: string | null) {
    await supabase.from('planning_fixe').update({ groupe_formation_id: groupeFormationId }).eq('id', id)
    setPlanning(prev => prev.map(p => p.id === id ? { ...p, groupe_formation_id: groupeFormationId } : p))
  }

  // ── Helpers calcul ────────────────────────────────────────

  function salleColor(idx: number): 'blue' | 'emerald' {
    return idx === 0 ? 'blue' : 'emerald'
  }

  function salleBorderCls(salle: Salle, sallesPool: Salle[]) {
    const idx = sallesPool.findIndex(s => s.id === salle.id)
    return idx === 0
      ? 'border-blue-300 bg-blue-50 text-blue-700'
      : 'border-emerald-300 bg-emerald-50 text-emerald-700'
  }

  // Salle libre pour un type FP (matin/pm) ce jour dans le pool
  function findFreeSalle(
    sallesPool: Salle[],
    jour: JourSemaine,
    statuts: StatutFixe[],
    excludeFormateurId: string,
  ): Salle | null {
    return sallesPool.find(s =>
      !planning.some(p =>
        p.salle_id === s.id &&
        p.jour_semaine === jour &&
        p.formateur_id !== excludeFormateurId &&
        statuts.includes(p.statut)
      )
    ) ?? null
  }

  // La salle actuelle d'un formateur pour un bloc FP (tirée du S1)
  function getCurrentSalle(formateurId: string, jour: JourSemaine, statuts: StatutFixe[]): Salle | null {
    const row = planning.find(p =>
      p.formateur_id === formateurId && p.jour_semaine === jour && statuts.includes(p.statut)
    )
    if (!row?.salle_id) return null
    return salles.find(s => s.id === row.salle_id) ?? null
  }

  // ── Render slot FP ────────────────────────────────────────

  function renderFPBlock(
    formateur: Formateur,
    jour: JourSemaine,
    sallesPool: Salle[],
    isMatin: boolean,
    canAdd: boolean,
    weeklyPresentielDays: number,
    blockS1 = false,
    blockS2 = false,
  ) {
    if (blockS1 && blockS2) return null

    const statuts = isMatin ? FP_MATIN : FP_PM
    const s1Statut: StatutFixe = isMatin ? 'Matin FP S1' : 'Après-midi FP S1'
    const s2Statut: StatutFixe = isMatin ? 'Matin FP S2' : 'Après-midi FP S2'
    const s1Time = isMatin ? '08h30–11h00' : '13h30–16h00'
    const s2Time = isMatin ? '11h00–13h30' : '16h00–18h30'

    const s1Row = !blockS1 ? planning.find(p => p.formateur_id === formateur.id && p.jour_semaine === jour && p.statut === s1Statut) : undefined
    const s2Row = !blockS2 ? planning.find(p => p.formateur_id === formateur.id && p.jour_semaine === jour && p.statut === s2Statut) : undefined

    const hasBlock = !!(s1Row || s2Row)
    const currentSalle = getCurrentSalle(formateur.id, jour, statuts)

    // Salle libre pour ajouter S1 (aucune autre)
    const freeSalle = findFreeSalle(sallesPool, jour, statuts, formateur.id)

    if (!hasBlock && (!canAdd || weeklyPresentielDays >= 4 || !freeSalle)) return null

    const headerBg = isMatin ? 'bg-blue-600' : 'bg-green-600'
    const blockBorder = isMatin ? 'border-blue-200' : 'border-green-200'
    const slotBg1 = isMatin ? 'bg-blue-50' : 'bg-green-50'
    const slotBg2 = isMatin ? 'bg-blue-50/60' : 'bg-green-50/60'
    const textColor = isMatin ? 'text-blue-700' : 'text-green-700'
    const textColor2 = isMatin ? 'text-blue-600' : 'text-green-600'
    const addCls1 = isMatin
      ? 'bg-blue-50 text-blue-600 hover:bg-blue-100 border border-dashed border-blue-300'
      : 'bg-green-50 text-green-600 hover:bg-green-100 border border-dashed border-green-300'
    const addCls2 = isMatin
      ? 'bg-blue-50/60 text-blue-500 hover:bg-blue-100 border border-dashed border-blue-200'
      : 'bg-green-50/60 text-green-500 hover:bg-green-100 border border-dashed border-green-200'

    // Salles alternatives pour switch
    const otherSalles = currentSalle
      ? sallesPool.filter(s => s.id !== currentSalle.id)
      : []
    const switchableSalles = otherSalles.filter(s =>
      !planning.some(p =>
        p.salle_id === s.id && p.jour_semaine === jour &&
        p.formateur_id !== formateur.id && statuts.includes(p.statut)
      )
    )

    const sessionIds = [s1Row, s2Row].filter(Boolean).map(r => r!.id)
    const salleIdx = currentSalle ? sallesPool.findIndex(s => s.id === currentSalle.id) : -1

    return (
      <div className={`rounded-lg border-2 ${blockBorder} overflow-hidden bg-white shadow-sm`}>
        {/* Header */}
        <div className={`px-2 py-1 ${headerBg} flex items-center justify-between`}>
          <span className="text-[10px] font-bold text-white uppercase tracking-wider">
            {isMatin ? '☀ Matin FP' : '🌿 Après-midi FP'}
          </span>
          {/* Badge salle + changement */}
          {currentSalle && (
            <div className="flex items-center gap-1">
              <SalleBadge nom={currentSalle.nom} color={salleIdx === 0 ? 'blue' : 'emerald'} />
              {switchableSalles.length > 0 && (
                <select
                  className="text-[7px] bg-white/20 text-white border-0 rounded px-0.5 cursor-pointer"
                  value={currentSalle.id}
                  onChange={e => changeSalle(sessionIds, e.target.value)}
                >
                  {sallesPool.map((s, i) => {
                    const disabled = switchableSalles.every(sw => sw.id !== s.id) && s.id !== currentSalle.id
                    return (
                      <option key={s.id} value={s.id} disabled={disabled}>
                        {s.nom.replace('Salle ', 'S')}
                      </option>
                    )
                  })}
                </select>
              )}
            </div>
          )}
        </div>

        <div className="p-1.5 flex flex-col gap-1">
          {/* S1 */}
          {!blockS1 && (s1Row ? (
            <div className={`px-2 py-1.5 ${slotBg1} rounded-sm`}>
              <div className="flex items-center justify-between">
                <span className={`text-[9px] font-mono font-semibold ${textColor}`}>{s1Time}</span>
                <button onClick={() => removeSession(s1Row.id)}
                  className="w-5 h-5 flex items-center justify-center rounded hover:bg-red-100 text-muted-foreground/40 hover:text-red-500 text-sm">×</button>
              </div>
              {renderGroupePicker(s1Row)}
            </div>
          ) : (freeSalle && canAdd && (
            <button
              onClick={() => addSession(formateur.id, jour, s1Statut, freeSalle.id)}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-sm text-xs font-medium opacity-60 hover:opacity-100 transition-all ${addCls1}`}
            >
              <span className="text-base leading-none">+</span>
              <span className="font-mono text-[10px]">{s1Time}</span>
              <SalleBadge nom={freeSalle.nom} color={sallesPool.indexOf(freeSalle) === 0 ? 'blue' : 'emerald'} />
            </button>
          )))}

          {/* S2 — visible si S1 existe (FP ou FAD) ou si S2 existe déjà */}
          {!blockS2 && (s1Row || s2Row || blockS1) && (
            s2Row ? (
              <div className={`px-2 py-1.5 ${slotBg2} rounded-sm`}>
                <div className="flex items-center justify-between">
                  <span className={`text-[9px] font-mono font-semibold ${textColor2}`}>{s2Time}</span>
                  <button onClick={() => removeSession(s2Row.id)}
                    className="w-5 h-5 flex items-center justify-center rounded hover:bg-red-100 text-muted-foreground/40 hover:text-red-500 text-sm">×</button>
                </div>
                {renderGroupePicker(s2Row)}
              </div>
            ) : ((s1Row || blockS1) && canAdd && currentSalle && (
              <button
                onClick={() => addSession(formateur.id, jour, s2Statut, currentSalle.id)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-sm text-xs font-medium opacity-60 hover:opacity-100 transition-all ${addCls2}`}
              >
                <span className="text-base leading-none">+</span>
                <span className="font-mono text-[10px]">{s2Time}</span>
              </button>
            ))
          )}
        </div>
      </div>
    )
  }

  // ── Render groupe picker ──────────────────────────────────

  function renderGroupePicker(row: PlanningFixe) {
    const groupeNom = groupesFormation.find(g => g.id === row.groupe_formation_id)?.nom
    return (
      <Select
        value={row.groupe_formation_id ?? '__none__'}
        onValueChange={val => changeGroupe(row.id, val === '__none__' ? null : val)}
      >
        <SelectTrigger className={`h-7 w-full text-xs px-2 mt-1 font-medium ${row.groupe_formation_id ? 'border-solid' : 'border-dashed text-muted-foreground/60'}`}>
          <SelectValue>
            {groupeNom ?? <span className="italic font-normal text-[10px]">Groupe…</span>}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__" className="text-xs italic text-muted-foreground">— Aucun —</SelectItem>
          {groupesFormation.map(g => (
            <SelectItem key={g.id} value={g.id} className="text-xs">{g.nom}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  // ── Render FAD block ──────────────────────────────────────

  function renderFADBlock(
    formateur: Formateur, jour: JourSemaine, canAdd: boolean,
    blockFadMatS1 = false, blockFadMatS2 = false,
    blockFadPmS1  = false, blockFadPmS2  = false,
  ) {
    // inclure les anciens statuts legacy pour rétrocompatibilité
    const rMatS1 = planning.filter(p => p.formateur_id === formateur.id && p.jour_semaine === jour && (p.statut === 'FAD Matin S1' || p.statut === 'FAD Matin'))
    const rMatS2 = planning.filter(p => p.formateur_id === formateur.id && p.jour_semaine === jour && p.statut === 'FAD Matin S2')
    const rPmS1  = planning.filter(p => p.formateur_id === formateur.id && p.jour_semaine === jour && (p.statut === 'FAD Après-midi S1' || p.statut === 'FAD Après-midi'))
    const rPmS2  = planning.filter(p => p.formateur_id === formateur.id && p.jour_semaine === jour && p.statut === 'FAD Après-midi S2')
    const fadH   = planning.find(p => p.formateur_id === formateur.id && p.jour_semaine === jour && p.statut === 'FAD 1h')

    const weeklyFad2h30 = new Set(
      planning
        .filter(p => p.formateur_id === formateur.id && FAD_2H30.includes(p.statut))
        .map(p => `${p.jour_semaine}:${p.statut}`)
    ).size
    const weeklyFad1h = planning.find(p => p.formateur_id === formateur.id && p.statut === 'FAD 1h')

    const hasFADhere = rMatS1.length > 0 || rMatS2.length > 0 || rPmS1.length > 0 || rPmS2.length > 0 || !!fadH
    const base = weeklyFad2h30 < 2 && !weeklyFad1h && canAdd
    const canNewMatS1 = base && !blockFadMatS1 && rMatS1.length === 0
    const canNewMatS2 = base && !blockFadMatS2 && rMatS2.length === 0
    const canNewPmS1  = base && !blockFadPmS1  && rPmS1.length === 0
    const canNewPmS2  = base && !blockFadPmS2  && rPmS2.length === 0
    const canAdd1h = weeklyFad2h30 >= 2 && !weeklyFad1h && canAdd
    const showFad1hSlot = !!fadH || (canAdd1h && hasFADhere)

    const showBlock = !!(hasFADhere || canNewMatS1 || canNewMatS2 || canNewPmS1 || canNewPmS2 || showFad1hSlot)
    if (!showBlock) return null

    function renderFadSlot(
      rows: typeof rMatS1,
      statut: StatutFixe,
      time: string,
      bg: string, textCls: string, borderCls: string,
      canNew: boolean,
    ) {
      if (rows.length > 0) {
        return (
          <div className={`px-2 py-1.5 ${bg} rounded-sm`}>
            <div className="flex items-center gap-1 mb-0.5">
              <span className={`text-[9px] font-mono font-semibold ${textCls}`}>{time}</span>
              <span className="text-[8px] text-teal-500">· {rows.length} grp</span>
            </div>
            {rows.map(row => (
              <div key={row.id} className="flex items-center gap-1 mt-0.5">
                <div className="flex-1">{renderGroupePicker(row)}</div>
                <button onClick={() => removeSession(row.id)} className="w-5 h-5 flex-shrink-0 flex items-center justify-center rounded hover:bg-red-100 text-muted-foreground/40 hover:text-red-500 text-sm">×</button>
              </div>
            ))}
            {rows.length < 3 && (
              <button onClick={() => addSession(formateur.id, jour, statut, null)}
                className={`w-full flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-[9px] font-medium ${textCls} hover:bg-teal-100 border border-dashed ${borderCls} mt-1 transition-all`}>
                <span>+</span><span>Fusionner un groupe</span>
              </button>
            )}
          </div>
        )
      }
      if (canNew) {
        return (
          <button onClick={() => addSession(formateur.id, jour, statut, null)}
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-sm text-xs font-medium ${bg} ${textCls} hover:bg-teal-100 border border-dashed ${borderCls} opacity-70 hover:opacity-100 transition-all`}>
            <span className="text-base leading-none">+</span>
            <span className="font-mono text-[10px]">{time}</span>
          </button>
        )
      }
      return null
    }

    return (
      <div className="rounded-lg border-2 border-teal-200 overflow-hidden bg-white shadow-sm">
        <div className="px-2 py-1 bg-teal-600 flex items-center justify-between">
          <span className="text-[10px] font-bold text-white uppercase tracking-wider">📡 FAD</span>
          <span className="text-[9px] text-teal-200 font-mono">{weeklyFad2h30}/2 × 2h30</span>
        </div>
        <div className="p-1.5 flex flex-col gap-1">
          {renderFadSlot(rMatS1, 'FAD Matin S1',       '08h30–11h00', 'bg-teal-50',    'text-teal-700', 'border-teal-300', canNewMatS1)}
          {renderFadSlot(rMatS2, 'FAD Matin S2',       '11h00–13h30', 'bg-teal-50/80', 'text-teal-600', 'border-teal-300', canNewMatS2)}
          {renderFadSlot(rPmS1,  'FAD Après-midi S1',  '13h30–16h00', 'bg-teal-50/60', 'text-teal-600', 'border-teal-200', canNewPmS1)}
          {renderFadSlot(rPmS2,  'FAD Après-midi S2',  '16h00–18h30', 'bg-teal-50/40', 'text-teal-500', 'border-teal-200', canNewPmS2)}
          {showFad1hSlot && (
            fadH ? (
              <div className="px-2 py-1.5 bg-teal-100 rounded-sm border border-teal-200">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-bold text-teal-700">Complément · 1h</span>
                  <button onClick={() => removeSession(fadH.id)} className="w-5 h-5 flex items-center justify-center rounded hover:bg-red-100 text-muted-foreground/40 hover:text-red-500 text-sm">×</button>
                </div>
                {renderGroupePicker(fadH)}
              </div>
            ) : (
              <button onClick={() => addSession(formateur.id, jour, 'FAD 1h', null)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-sm text-xs font-bold bg-teal-50 text-teal-600 hover:bg-teal-100 border border-teal-300 shadow-sm transition-all">
                <span className="text-base leading-none">+</span><span>Complément · 1h</span>
              </button>
            )
          )}
        </div>
      </div>
    )
  }

  // ── Génération PDF ───────────────────────────────────────

  const DUREE_PDF: Partial<Record<StatutFixe, number>> = {
    'Matin FP S1': 2.5, 'Matin FP S2': 2.5,
    'Après-midi FP S1': 2.5, 'Après-midi FP S2': 2.5,
    'FAD Matin': 2.5, 'FAD Après-midi': 2.5, 'FAD 1h': 1,
  }

  async function openGroupePDF(groupe: Groupe, poleNom: string) {
    const key = `groupe-${groupe.id}`
    if (pdfLoadingKey) return
    setPdfLoadingKey(key)
    try {
      const rows = planning.filter(p => p.groupe_formation_id === groupe.id)
      const planningRows = rows.map(p => ({
        jour_semaine: p.jour_semaine,
        statut: p.statut,
        formateur_nom: formateurs.find(f => f.id === p.formateur_id)?.nom ?? null,
      }))
      const totalHeures = rows.reduce((acc, p) => acc + (DUREE_PDF[p.statut] ?? 0), 0)

      const [{ pdf }, { createElement }, { GroupePlanningPDF }] = await Promise.all([
        import('@react-pdf/renderer'),
        import('react'),
        import('@/components/pdf/GroupePlanningPDF'),
      ])
      const blob = await pdf(createElement(GroupePlanningPDF as any, {
        groupeNom: groupe.nom, poleNom,
        planning: planningRows, totalSeances: rows.length, totalHeures,
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

  async function openSallePDF(salle: Salle, poleNom: string, formateurIds: string[]) {
    const key = `salle-${salle.id}`
    if (pdfLoadingKey) return
    setPdfLoadingKey(key)
    try {
      const FP_STATUTS: StatutFixe[] = ['Matin FP S1', 'Matin FP S2', 'Après-midi FP S1', 'Après-midi FP S2']
      const rows = planning.filter(p =>
        p.salle_id === salle.id && FP_STATUTS.includes(p.statut)
      )
      const planningRows = rows.map(p => ({
        jour_semaine: p.jour_semaine,
        statut: p.statut,
        formateur_nom: formateurs.find(f => f.id === p.formateur_id)?.nom ?? null,
        groupe_nom: groupesFormation.find(g => g.id === p.groupe_formation_id)?.nom ?? null,
      }))

      const [{ pdf }, { createElement }, { SallePlanningPDF }] = await Promise.all([
        import('@react-pdf/renderer'),
        import('react'),
        import('@/components/pdf/SallePlanningPDF'),
      ])
      const blob = await pdf(createElement(SallePlanningPDF as any, {
        salleNom: salle.nom, poleNom,
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

  // ── Render ─────────────────────────────────────────────────

  // Formateurs sans pôle affecté : regroupés dans une section "Non affectés"
  const formateursParPole = (pole: Pole) =>
    formateurs.filter(f => f.pole_id === pole.id)
  const sallesParPole = (pole: Pole) =>
    salles.filter(s => s.pole_id === pole.id)

  const formateursNonAffectes = formateurs.filter(f => !f.pole_id)

  // Pôles qui ont des formateurs
  const polesActifs = poles.filter(p => formateursParPole(p).length > 0)

  return (
    <div className="space-y-4">
      <div>
        <PageHeader
          icon={Users}
          title="Planning Pool Pôle — Scénario C"
          subtitle="Les formateurs de chaque pôle partagent les deux salles affectées."
          badge="Pool mixte"
        />
        <PageDivider />
      </div>

      {polesActifs.length === 0 && (
        <div className="rounded-lg border bg-amber-50 border-amber-200 px-4 py-6 text-center">
          <p className="text-sm font-semibold text-amber-800">Aucun pôle actif avec des formateurs</p>
          <p className="text-xs text-amber-600 mt-1">
            Allez dans <strong>Paramètres → Formateurs</strong> pour affecter les formateurs à des pôles.
          </p>
        </div>
      )}

      {polesActifs.map(pole => {
        const formateursDuPole = formateursParPole(pole)
        const sallesDuPole     = sallesParPole(pole)
        const formateurIds     = formateursDuPole.map(f => f.id)

        return (
          <div key={pole.id} className="rounded-xl border-2 border-slate-200 overflow-hidden bg-white shadow-sm">

            {/* ── En-tête pôle ── */}
            <div className="px-4 py-3 bg-gradient-to-r from-slate-700 to-slate-600 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex gap-1">
                  {sallesDuPole.map((s, i) => (
                    <span key={s.id} className={`text-[9px] font-bold px-2 py-0.5 rounded ${i === 0 ? 'bg-blue-200 text-blue-800' : 'bg-emerald-200 text-emerald-800'}`}>
                      {s.nom}
                    </span>
                  ))}
                  {sallesDuPole.length === 0 && (
                    <span className="text-[9px] text-slate-400">Aucune salle affectée</span>
                  )}
                </div>
                <span className="text-white font-semibold text-sm">{pole.nom}</span>
                {pole.code && <span className="text-[9px] text-slate-300 font-mono">{pole.code}</span>}
              </div>
              <div className="flex items-center gap-2">
                {sallesDuPole.map(salle => (
                  <button
                    key={salle.id}
                    onClick={() => openSallePDF(salle, pole.nom, formateurIds)}
                    disabled={!!pdfLoadingKey}
                    className="flex items-center gap-1 h-6 px-2 text-[10px] font-medium rounded border border-white/30 bg-white/10 text-white hover:bg-white/20 transition-all disabled:opacity-50"
                    title={`PDF emploi du temps ${salle.nom}`}
                  >
                    <FileDown className="h-3 w-3" />
                    {pdfLoadingKey === `salle-${salle.id}` ? '…' : salle.nom.replace('Salle ', 'S')}
                  </button>
                ))}
                <span className="text-[10px] text-slate-300">{formateursDuPole.length} formateurs · {sallesDuPole.length} salles</span>
              </div>
            </div>

            {sallesDuPole.length < 2 && (
              <div className="px-4 py-2 bg-amber-50 border-b border-amber-200">
                <p className="text-xs text-amber-700">
                  ⚠ Ce pôle n&apos;a que {sallesDuPole.length} salle affectée — le pool nécessite 2 salles par pôle.
                  Allez dans <strong>Paramètres → Salles</strong> pour affecter les salles.
                </p>
              </div>
            )}

            {/* ── Taux d'occupation par salle ── */}
            {sallesDuPole.length >= 2 && (
              <OccupationSalleBanner salles={sallesDuPole} planning={planning} />
            )}

            {/* ── Table ── */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground w-[130px]">Formateur</th>
                    {JOURS_SEMAINE.map(jour => {
                      const isSamedi = jour === 'Samedi'
                      return (
                        <th key={jour} className={`px-1 py-1.5 text-center font-medium text-muted-foreground min-w-[140px] ${isSamedi ? 'border-l-2 border-dashed border-muted-foreground/40' : ''}`}>
                          <div className={`text-xs font-medium ${isSamedi ? 'text-emerald-700' : ''}`}>{jour}</div>
                          {!isSamedi && sallesDuPole.length >= 2 && (
                            <div className="flex justify-center mt-0.5">
                              <OccupationPole salles={sallesDuPole} planning={planning} jour={jour} formateurIds={formateurIds} />
                            </div>
                          )}
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {formateursDuPole.map(formateur => {
                    const fpSeances = planning.filter(p =>
                      p.formateur_id === formateur.id &&
                      ['Matin FP S1','Matin FP S2','Après-midi FP S1','Après-midi FP S2'].includes(p.statut)
                    ).length
                    const fadSeances = new Set(
                      planning
                        .filter(p => p.formateur_id === formateur.id && FAD_2H30.concat(['FAD 1h']).includes(p.statut))
                        .map(p => `${p.jour_semaine}:${p.statut}`)
                    ).size
                    const seances = fpSeances + fadSeances
                    const canAdd = seances < MAX_SEANCES

                    const weeklyPresentielDays = JOURS_MON_VEN.filter(j =>
                      planning.some(p =>
                        p.formateur_id === formateur.id && p.jour_semaine === j &&
                        ['Matin FP S1','Matin FP S2','Après-midi FP S1','Après-midi FP S2'].includes(p.statut)
                      )
                    ).length

                    const fadHeures = new Set(
                      planning
                        .filter(p => p.formateur_id === formateur.id && FAD_2H30.includes(p.statut))
                        .map(p => `${p.jour_semaine}:${p.statut}`)
                    ).size * 2.5
                    const fad1hHeures = new Set(planning.filter(p => p.formateur_id === formateur.id && p.statut === 'FAD 1h').map(p => p.jour_semaine)).size
                    const fpHeures = planning.filter(p => p.formateur_id === formateur.id && ['Matin FP S1','Matin FP S2','Après-midi FP S1','Après-midi FP S2'].includes(p.statut)).length * 2.5
                    const totalHeures = fpHeures + fadHeures + fad1hHeures

                    const salleNomPDF = sallesDuPole.length > 0
                      ? sallesDuPole.map(s => s.nom).join(' / ')
                      : 'Pool pôle'

                    return (
                      <tr key={formateur.id} className="hover:bg-muted/20 transition-colors">
                        {/* Colonne nom */}
                        <td className="px-2 py-1.5 font-medium leading-tight w-[130px]">
                          <div className="flex flex-col gap-1">
                            <span className="text-[11px] font-semibold truncate">{formateur.nom}</span>
                            <span className="text-[8px] text-muted-foreground font-mono">{seances}/{MAX_SEANCES} séances</span>
                            <div className="flex gap-1 flex-wrap">
                              <span className={`text-[8px] px-1 py-0.5 rounded font-medium ${weeklyPresentielDays >= 4 ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'}`}>
                                Prés. {weeklyPresentielDays}/4
                              </span>
                              <span className={`text-[8px] px-1 py-0.5 rounded font-medium ${fadSeances >= 1 ? 'bg-teal-100 text-teal-700' : 'bg-slate-100 text-slate-400'}`}>
                                FAD {fadSeances}/2
                              </span>
                            </div>
                            <button
                              onClick={() => setViewFormateur({ formateur, salleNom: salleNomPDF })}
                              className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-all bg-[#003D70]/10 text-[#003D70] hover:bg-[#003D70]/20 border border-[#003D70]/20"
                              title="Voir emploi du temps"
                            >
                              <Eye className="h-3 w-3" />
                              <span>Voir EDT</span>
                            </button>
                            <PDFDownloadButton
                              formateurNom={formateur.nom}
                              matricule={formateur.matricule}
                              salleNom={salleNomPDF}
                              poleNom={pole.nom}
                              planning={planning
                                .filter(p => p.formateur_id === formateur.id)
                                .map(p => ({
                                  jour_semaine: p.jour_semaine,
                                  statut: p.statut,
                                  groupe_nom: groupesFormation.find(g => g.id === p.groupe_formation_id)?.nom ?? null,
                                }))
                              }
                              totalSeances={seances}
                              totalHeures={totalHeures}
                              dateGeneration={new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                            />
                          </div>
                        </td>

                        {/* Colonnes jours */}
                        {JOURS_SEMAINE.map(jour => {
                          const isSamedi = jour === 'Samedi'
                          const hasAny = planning.some(p =>
                            p.formateur_id === formateur.id && p.jour_semaine === jour
                          )
                          const isEmpty = !hasAny

                          const weeklyReposCount =
                            JOURS_MON_VEN.filter(j =>
                              !planning.some(p => p.formateur_id === formateur.id && p.jour_semaine === j)
                            ).length +
                            (!planning.some(p => p.formateur_id === formateur.id && p.jour_semaine === 'Samedi') ? 1 : 0)

                          const fid = formateur.id
                          const hasF = (s: StatutFixe) => planning.some(p => p.formateur_id === fid && p.jour_semaine === jour && p.statut === s)
                          // legacy 'FAD Matin'/'FAD Après-midi' ne bloque que S1 (affiché sous S1)
                          const hasFadMatS1 = hasF('FAD Matin S1') || hasF('FAD Matin')
                          const hasFadMatS2 = hasF('FAD Matin S2')
                          const hasFadPmS1  = hasF('FAD Après-midi S1') || hasF('FAD Après-midi')
                          const hasFadPmS2  = hasF('FAD Après-midi S2')
                          const hasFpMatS1  = hasF('Matin FP S1')
                          const hasFpMatS2  = hasF('Matin FP S2')
                          const hasFpPmS1   = hasF('Après-midi FP S1')
                          const hasFpPmS2   = hasF('Après-midi FP S2')

                          const matinBlock = renderFPBlock(formateur, jour, sallesDuPole, true,  canAdd, weeklyPresentielDays, hasFadMatS1, hasFadMatS2)
                          const pmBlock    = renderFPBlock(formateur, jour, sallesDuPole, false, canAdd, weeklyPresentielDays, hasFadPmS1, hasFadPmS2)
                          const fadBlock   = renderFADBlock(formateur, jour, canAdd, hasFpMatS1, hasFpMatS2, hasFpPmS1, hasFpPmS2)

                          const reposExcedentaire = !isSamedi && isEmpty && weeklyReposCount > 1

                          return (
                            <td key={jour} className={`px-1 py-1.5 align-top min-w-[140px] max-w-[180px] ${isSamedi ? 'border-l-2 border-dashed border-muted-foreground/30 bg-emerald-50/30' : ''}`}>
                              <div className="flex flex-col gap-1.5">
                                {matinBlock}
                                {pmBlock}
                                {fadBlock}
                                {isEmpty && !isSamedi && (
                                  reposExcedentaire ? (
                                    <div className="rounded-lg border-2 border-orange-200 bg-orange-50 px-2 py-2 text-center">
                                      <div className="text-[9px] font-bold text-orange-600">⚠ Repos excédentaire</div>
                                      <div className="text-[8px] text-orange-400 mt-0.5">Samedi compte déjà comme repos</div>
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

            {/* ── Légende salles ── */}
            {sallesDuPole.length >= 2 && (
              <div className="border-t px-4 py-2 text-xs text-muted-foreground flex items-center gap-4">
                {sallesDuPole.map((s, i) => (
                  <span key={s.id} className="flex items-center gap-1">
                    <span className={`px-1 py-0.5 rounded text-[9px] font-bold ${i === 0 ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {s.nom.replace('Salle ', 'S')}
                    </span>
                    {s.nom}
                  </span>
                ))}
                <span className="ml-auto flex items-center gap-1">
                  <span className="text-green-500">○</span> salle libre
                  <span className="text-red-500 ml-2">✓</span> salle prise
                </span>
              </div>
            )}

            {/* ── EDT Groupes de formation ── */}
            {groupesFormation.filter(g => g.pole_id === pole.id).length > 0 && (
              <div className="border-t px-4 py-3">
                <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <Users className="h-3 w-3" />
                  EDT par groupe de formation
                </h3>
                <div className="flex flex-wrap gap-2">
                  {groupesFormation.filter(g => g.pole_id === pole.id).map(groupe => {
                    const seances = planning.filter(p => p.groupe_formation_id === groupe.id).length
                    const isLoading = pdfLoadingKey === `groupe-${groupe.id}`
                    return (
                      <button
                        key={groupe.id}
                        onClick={() => openGroupePDF(groupe, pole.nom)}
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
          </div>
        )
      })}

      {/* Formateurs sans pôle */}
      {formateursNonAffectes.length > 0 && (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-3">
          <p className="text-xs font-semibold text-slate-600 mb-1">Formateurs sans pôle affecté</p>
          <div className="flex flex-wrap gap-2">
            {formateursNonAffectes.map(f => (
              <span key={f.id} className="text-[10px] bg-white border border-slate-200 px-2 py-0.5 rounded">{f.nom}</span>
            ))}
          </div>
        </div>
      )}

      {/* Modal fiche formateur */}
      {viewFormateur && (
        <FormateurScheduleModal
          formateur={viewFormateur.formateur}
          salleNom={viewFormateur.salleNom}
          planning={planning}
          groupesFormation={groupesFormation}
          onClose={() => setViewFormateur(null)}
        />
      )}

      {/* Note règles */}
      <div className="rounded-lg border bg-muted/30 p-4">
        <p className="text-sm font-medium mb-2">Règles Scénario C — Pool Pôle</p>
        <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
          <li>Chaque formateur du pôle peut travailler dans l&apos;une OU l&apos;autre des salles du pôle</li>
          <li>Chaque salle : max 1 formateur en Matin FP et max 1 en Après-midi FP par jour</li>
          <li>Règle hebdomadaire : 4 jours présentiel · 1 jour FAD · 1 jour repos · 1h FAD optionnel</li>
          <li>FAD : sans contrainte de salle physique (distanciel)</li>
        </ul>
      </div>
    </div>
  )
}
