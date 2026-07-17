'use client'

import { useState, useMemo } from 'react'
import { PageHeader, PageDivider } from '@/components/layout/PageHeader'
import { CalendarRange, ChevronLeft, ChevronRight, FileDown, Loader2, Building2, Users, LayoutDashboard, BarChart3, BookOpen, Layers } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getMoisCycle, getJoursDuMois, parseISODate, toISODateString, dayNumberToLabel } from '@/lib/rotation'
import { cn } from '@/lib/utils'
import type {
  Formateur, Groupe, Salle, PlanningFixe,
  RotationSamediConfig, CycleReference, Pole,
  JourSemaine, StatutFixe, StatutSamedi, SemaineCycle,
} from '@/types/planning'
import { JOURS_SEMAINE, DUREE_HEURES } from '@/types/planning'

const MOIS_LABELS = [
  'Janvier','Février','Mars','Avril','Mai','Juin',
  'Juillet','Août','Septembre','Octobre','Novembre','Décembre',
]

// ── Palette statuts ───────────────────────────────────────────────────────────

function getStatutMeta(statut: StatutFixe | StatutSamedi | null) {
  if (!statut) return null
  if (statut === 'Matin FP S1') return { abbr: 'MS1', bg: 'bg-blue-100', text: 'text-blue-700', dot: '#2563EB' }
  if (statut === 'Matin FP S2') return { abbr: 'MS2', bg: 'bg-blue-200', text: 'text-blue-800', dot: '#1D4ED8' }
  if (statut === 'Après-midi FP S1') return { abbr: 'PS1', bg: 'bg-amber-100', text: 'text-amber-700', dot: '#D97706' }
  if (statut === 'Après-midi FP S2') return { abbr: 'PS2', bg: 'bg-amber-200', text: 'text-amber-800', dot: '#B45309' }
  if (statut === 'FAD Matin') return { abbr: 'FAD', bg: 'bg-violet-100', text: 'text-violet-700', dot: '#6D28D9' }
  if (statut === 'FAD Après-midi') return { abbr: 'FAD', bg: 'bg-violet-100', text: 'text-violet-700', dot: '#6D28D9' }
  if (statut === 'FAD 1h') return { abbr: '1h', bg: 'bg-purple-100', text: 'text-purple-600', dot: '#7C3AED' }
  if (statut === 'Matin') return { abbr: 'M', bg: 'bg-blue-100', text: 'text-blue-700', dot: '#2563EB' }
  if (statut === 'Après-midi') return { abbr: 'PM', bg: 'bg-amber-100', text: 'text-amber-700', dot: '#D97706' }
  if (statut === 'Distance' || statut === 'Distance Matin' || statut === 'Distance Après-midi')
    return { abbr: 'FAD', bg: 'bg-violet-100', text: 'text-violet-700', dot: '#6D28D9' }
  if (statut === 'Repos') return { abbr: 'R', bg: 'bg-slate-100', text: 'text-slate-400', dot: '#CBD5E1' }
  return null
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  poles: Pole[]
  salles: Salle[]
  groupes: Groupe[]
  formateurs: Formateur[]
  planningFixe: PlanningFixe[]
  rotationConfig: RotationSamediConfig[]
  cycleReferences: CycleReference[]
}

const POLE_COLORS = [
  { bg: 'bg-[#003D70]', border: 'border-[#005FAD]', badge: 'bg-blue-100 text-blue-700' },
  { bg: 'bg-[#065F46]', border: 'border-[#059669]', badge: 'bg-emerald-100 text-emerald-700' },
  { bg: 'bg-[#4C1D95]', border: 'border-[#7C3AED]', badge: 'bg-violet-100 text-violet-700' },
  { bg: 'bg-[#78350F]', border: 'border-[#D97706]', badge: 'bg-amber-100 text-amber-700' },
  { bg: 'bg-[#7F1D1D]', border: 'border-[#DC2626]', badge: 'bg-red-100 text-red-700' },
  { bg: 'bg-[#164E63]', border: 'border-[#0891B2]', badge: 'bg-cyan-100 text-cyan-700' },
]

// ── Composant ─────────────────────────────────────────────────────────────────

export function VueMensuelleClient({
  poles, salles, groupes, formateurs, planningFixe, rotationConfig, cycleReferences,
}: Props) {
  const today = new Date()
  const [annee, setAnnee] = useState(today.getFullYear())
  const [mois, setMois] = useState(today.getMonth() + 1)
  const [pdfLoading, setPdfLoading] = useState<string | null>(null)

  function navMois(delta: number) {
    let m = mois + delta, a = annee
    if (m > 12) { m = 1; a++ }
    if (m < 1) { m = 12; a-- }
    setMois(m); setAnnee(a)
  }

  // Jours du mois (excl. Dimanche)
  const jours = useMemo(() => getJoursDuMois(annee, mois).filter(d => d.getDay() !== 0), [annee, mois])

  // Groupes techniques (liés à salle)
  const groupesTech = useMemo(() => groupes.filter(g => g.salle_id), [groupes])

  // Formateurs par salle (pour backward compat)
  function formateursDeSalle(salle: Salle): Formateur[] {
    const gt = groupesTech.find(g => g.salle_id === salle.id)
    return gt ? formateurs.filter(f => f.groupe_id === gt.id) : []
  }

  // Tous les statuts d'un formateur pour un jour
  function getStatutsFormateur(formateurId: string, salleId: string | null, date: Date): StatutFixe[] {
    const dayNum = date.getDay()
    if (dayNum === 0) return []

    if (dayNum === 6) {
      const ref = cycleReferences.find(c => c.salle_id === salleId)
      if (!ref) return ['Repos']
      const ancrage = parseISODate(ref.date_ancrage)
      const pos = getMoisCycle(date.getFullYear(), date.getMonth() + 1, ancrage, ref.semaine_cycle_ancrage) as SemaineCycle
      const cfg = rotationConfig.find(c => c.formateur_id === formateurId && c.salle_id === salleId && c.semaine_cycle === pos)
      const st = cfg?.statut ?? 'Repos'
      if (st === 'Repos') return ['Repos']
      if (st === 'Matin') return ['Matin FP S1']
      if (st === 'Après-midi') return ['Après-midi FP S1']
      return ['Repos']
    }

    const jourLabel = dayNumberToLabel(dayNum) as JourSemaine
    if (!JOURS_SEMAINE.includes(jourLabel)) return []
    return planningFixe
      .filter(p => p.formateur_id === formateurId && p.jour_semaine === jourLabel)
      .map(p => p.statut)
  }

  // Stats hebdomadaires formateur
  function statsFormateur(formateurId: string) {
    const rows = planningFixe.filter(p => p.formateur_id === formateurId)
    const heures = rows.reduce((acc, p) => acc + (DUREE_HEURES[p.statut] ?? 0), 0)
    const seances = rows.filter(p => ['Matin FP S1','Matin FP S2','Après-midi FP S1','Après-midi FP S2','FAD Matin','FAD Après-midi','FAD 1h'].includes(p.statut)).length
    const fpDays = new Set(rows.filter(p => ['Matin FP S1','Matin FP S2','Après-midi FP S1','Après-midi FP S2'].includes(p.statut)).map(p => p.jour_semaine)).size
    const fadDays = new Set(rows.filter(p => p.statut === 'FAD Matin' || p.statut === 'FAD Après-midi').map(p => p.jour_semaine)).size
    return { heures, seances, fpDays, fadDays }
  }

  // Données communes pour tous les PDF
  function buildPDFProps() {
    return {
      annee, mois,
      poles: poles.map(p => ({ id: p.id, nom: p.nom, code: p.code })),
      salles: salles.map(s => ({ id: s.id, nom: s.nom, pole_id: s.pole_id })),
      formateurs: formateurs.map(f => ({
        id: f.id, nom: f.nom, matricule: f.matricule,
        pole_id: f.pole_id,
        pole_nom: (f as any).pole?.nom ?? poles.find(p => p.id === f.pole_id)?.nom ?? null,
        salle_nom: salles.find(s => s.pole_id === f.pole_id)?.nom ?? null,
        groupe_id: f.groupe_id,
      })),
      groupes: groupes.map(g => ({ id: g.id, nom: g.nom, pole_id: g.pole_id, salle_id: g.salle_id })),
      planningFixe: planningFixe.map(p => ({
        formateur_id: p.formateur_id, jour_semaine: p.jour_semaine,
        statut: p.statut, salle_id: p.salle_id, groupe_formation_id: p.groupe_formation_id,
      })),
      rotationConfig: rotationConfig.map(r => ({
        formateur_id: r.formateur_id, salle_id: r.salle_id,
        semaine_cycle: r.semaine_cycle, statut: r.statut,
      })),
      cycleReferences: cycleReferences.map(c => ({
        salle_id: c.salle_id, date_ancrage: c.date_ancrage,
        semaine_cycle_ancrage: c.semaine_cycle_ancrage,
      })),
      logoUrl: `${window.location.origin}/OFPPT_Logo.png`,
    }
  }

  async function downloadPDF(viewKey: string, componentName: string, filename: string) {
    setPdfLoading(viewKey)
    try {
      const [{ pdf }, { createElement }, mod] = await Promise.all([
        import('@react-pdf/renderer'),
        import('react'),
        import('@/components/pdf/VueMensuellePDF'),
      ])
      const Component = (mod as any)[componentName]
      const blob = await pdf(createElement(Component as any, buildPDFProps()) as any).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Erreur génération PDF', err)
    } finally {
      setPdfLoading(null)
    }
  }

  // Définition des vues PDF disponibles
  const PDF_VIEWS = [
    {
      key: 'pole',
      label: 'Vue Pôle',
      desc: 'Stats & occupation par pôle',
      component: 'VueMensuellePolePDF',
      filename: `EDT_Poles_${MOIS_LABELS[mois - 1]}_${annee}.pdf`,
      icon: Building2,
      color: 'bg-[#003D70] hover:bg-[#005FAD] text-white',
      dot: '#005FAD',
    },
    {
      key: 'formateurs',
      label: 'Par Formateur',
      desc: 'Calendrier mensuel de chaque formateur',
      component: 'VueMensuelleFormateursPDF',
      filename: `EDT_Formateurs_${MOIS_LABELS[mois - 1]}_${annee}.pdf`,
      icon: Users,
      color: 'bg-[#065F46] hover:bg-[#059669] text-white',
      dot: '#059669',
    },
    {
      key: 'salles',
      label: 'Par Salle',
      desc: 'Occupation et affectations par salle',
      component: 'VueMensuelleSallesPDF',
      filename: `EDT_Salles_${MOIS_LABELS[mois - 1]}_${annee}.pdf`,
      icon: LayoutDashboard,
      color: 'bg-[#6B21A8] hover:bg-[#7C3AED] text-white',
      dot: '#7C3AED',
    },
    {
      key: 'groupes',
      label: 'Par Groupe',
      desc: 'Planning des groupes de formation',
      component: 'VueMensuelleGroupesPDF',
      filename: `EDT_Groupes_${MOIS_LABELS[mois - 1]}_${annee}.pdf`,
      icon: BookOpen,
      color: 'bg-[#78350F] hover:bg-[#D97706] text-white',
      dot: '#D97706',
    },
    {
      key: 'complet',
      label: 'Tout exporter',
      desc: 'Document complet — 4 vues',
      component: 'VueMensuellePDF',
      filename: `EDT_OFPPT_${MOIS_LABELS[mois - 1]}_${annee}.pdf`,
      icon: Layers,
      color: 'bg-slate-700 hover:bg-slate-900 text-white',
      dot: '#334155',
    },
  ]

  return (
    <div className="space-y-6">
      {/* ── En-tête ── */}
      <PageHeader
        icon={CalendarRange}
        title="Vue mensuelle"
        subtitle="Planning complet Lundi–Samedi · Statuts calculés automatiquement · Rotation Samedi incluse"
        badge="Calendrier"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navMois(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[120px] text-center font-semibold text-sm">
              {MOIS_LABELS[mois - 1]} {annee}
            </span>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navMois(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        }
      />
      <PageDivider />

      {/* ── Barre de sélection PDF ── */}
      <div className="rounded-xl border border-dashed border-muted-foreground/20 bg-muted/20 p-4">
        <div className="flex items-center gap-2 mb-3">
          <FileDown className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Exporter en PDF — choisissez le document
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {PDF_VIEWS.map(view => {
            const Icon = view.icon
            const isLoading = pdfLoading === view.key
            return (
              <button
                key={view.key}
                onClick={() => downloadPDF(view.key, view.component, view.filename)}
                disabled={pdfLoading !== null}
                className={`
                  flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold
                  transition-all duration-150 disabled:opacity-50 disabled:cursor-wait
                  shadow-sm ${view.color}
                `}
              >
                {isLoading
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                  : <Icon className="h-3.5 w-3.5 shrink-0" />
                }
                <div className="text-left">
                  <div className="leading-tight">{view.label}</div>
                  <div className="text-[9px] opacity-75 font-normal leading-tight mt-0.5 hidden sm:block">
                    {view.desc}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
        {pdfLoading && (
          <div className="mt-2 text-[10px] text-muted-foreground flex items-center gap-1.5">
            <Loader2 className="h-3 w-3 animate-spin" />
            Génération en cours… cela peut prendre quelques secondes.
          </div>
        )}
      </div>

      {/* ── Légende ── */}
      <div className="flex items-center gap-3 flex-wrap px-1">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Légende :</span>
        {[
          { abbr: 'MS1/MS2', bg: 'bg-blue-100', text: 'text-blue-700', label: 'Matin FP' },
          { abbr: 'PS1/PS2', bg: 'bg-amber-100', text: 'text-amber-700', label: 'Après-midi FP' },
          { abbr: 'FAD', bg: 'bg-violet-100', text: 'text-violet-700', label: 'FAD / Distanciel' },
          { abbr: 'R', bg: 'bg-slate-100', text: 'text-slate-400', label: 'Repos' },
        ].map(l => (
          <div key={l.abbr} className="flex items-center gap-1.5">
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${l.bg} ${l.text}`}>{l.abbr}</span>
            <span className="text-[10px] text-muted-foreground">{l.label}</span>
          </div>
        ))}
      </div>

      {/* ── Une section par pôle ── */}
      {poles.map((pole, poleIdx) => {
        const formateursDuPole = formateurs.filter(f => f.pole_id === pole.id)
        if (formateursDuPole.length === 0) return null

        const sallesDuPole = salles.filter(s => s.pole_id === pole.id)
        const colors = POLE_COLORS[poleIdx % POLE_COLORS.length]

        return (
          <div key={pole.id} className="rounded-xl border overflow-hidden shadow-sm">
            {/* Pole header */}
            <div className={`${colors.bg} px-4 py-3 flex items-center justify-between`}>
              <div className="flex items-center gap-3">
                <Building2 className="h-4 w-4 text-white/70 shrink-0" />
                <div>
                  <span className="text-sm font-bold text-white">{pole.nom}</span>
                  {pole.code && (
                    <span className="ml-2 text-[9px] font-mono text-white/60 border border-white/20 px-1.5 py-0.5 rounded">
                      {pole.code}
                    </span>
                  )}
                </div>
                {sallesDuPole.map(s => (
                  <span key={s.id} className="text-[9px] font-semibold px-2 py-0.5 rounded bg-white/15 text-white/80">
                    {s.nom}
                  </span>
                ))}
              </div>
              <span className="text-[10px] text-white/50">
                {formateursDuPole.length} formateur{formateursDuPole.length > 1 ? 's' : ''}
              </span>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="text-xs w-full">
                <thead>
                  <tr className="border-b bg-muted/40">
                    {/* Colonne formateur */}
                    <th className="px-2 py-2 text-left font-semibold text-muted-foreground sticky left-0 bg-muted/40 z-10 min-w-[120px] max-w-[120px] border-r">
                      Formateur
                    </th>
                    {/* Colonne stats hebdo */}
                    <th className="px-1 py-2 text-center font-medium text-muted-foreground min-w-[56px] max-w-[56px] border-r text-[9px]">
                      Stats
                    </th>
                    {/* Colonnes jours */}
                    {jours.map(jour => {
                      const isSam = jour.getDay() === 6
                      const dayLabel = dayNumberToLabel(jour.getDay()).slice(0, 2).toUpperCase()
                      const dateNum = jour.getDate()
                      const isToday = jour.toDateString() === today.toDateString()
                      return (
                        <th
                          key={toISODateString(jour)}
                          className={cn(
                            'px-0 py-1 text-center font-medium text-muted-foreground min-w-[24px] w-[24px]',
                            isSam && 'bg-emerald-50/60 border-l border-r border-emerald-200',
                            isToday && 'bg-blue-50'
                          )}
                        >
                          <div className={cn('text-[8px] font-medium', isSam && 'text-emerald-700')}>{dayLabel}</div>
                          <div className={cn(
                            'text-[9px] font-bold',
                            isSam ? 'text-emerald-700' : 'text-foreground',
                            isToday && 'bg-blue-500 text-white rounded-full w-4 h-4 flex items-center justify-center mx-auto text-[8px]',
                          )}>
                            {dateNum}
                          </div>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {formateursDuPole.map(formateur => {
                    const { heures, seances, fpDays, fadDays } = statsFormateur(formateur.id)
                    const salleF = sallesDuPole[0] ?? null
                    const isPct100 = seances >= 10

                    return (
                      <tr key={formateur.id} className="hover:bg-muted/20 transition-colors">
                        {/* Formateur */}
                        <td className="px-2 py-1.5 sticky left-0 bg-background border-r z-10 min-w-[120px] max-w-[120px]">
                          <div className="font-semibold text-[10px] leading-tight truncate">{formateur.nom}</div>
                          {formateur.matricule && (
                            <div className="text-[8px] text-muted-foreground mt-0.5 truncate">#{formateur.matricule}</div>
                          )}
                        </td>

                        {/* Stats */}
                        <td className="px-1 py-1 border-r text-center min-w-[56px] max-w-[56px]">
                          <div className={cn(
                            'text-[9px] font-bold',
                            isPct100 ? 'text-emerald-600' : 'text-[#005FAD]'
                          )}>
                            {heures}h · {seances}/10
                          </div>
                          <div className="flex gap-0.5 justify-center mt-0.5">
                            <span className={`text-[7px] px-0.5 rounded ${fpDays >= 4 ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'}`}>P{fpDays}</span>
                            <span className={`text-[7px] px-0.5 rounded ${fadDays >= 1 ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-400'}`}>F{fadDays}</span>
                          </div>
                        </td>

                        {/* Jours */}
                        {jours.map(jour => {
                          const isSam = jour.getDay() === 6
                          const isToday = jour.toDateString() === today.toDateString()
                          const statuts = getStatutsFormateur(formateur.id, salleF?.id ?? null, jour)

                          // Agrégat visuel
                          const hasMatin = statuts.some(s => s === 'Matin FP S1' || s === 'Matin FP S2' || s === 'Matin')
                          const hasPM = statuts.some(s => s === 'Après-midi FP S1' || s === 'Après-midi FP S2' || s === 'Après-midi')
                          const hasFAD = statuts.some(s => s.startsWith('FAD') || s.startsWith('Distance'))
                          const isRepos = statuts.includes('Repos')
                          const hasS2Matin = statuts.includes('Matin FP S2')
                          const hasS2PM = statuts.includes('Après-midi FP S2')

                          return (
                            <td
                              key={toISODateString(jour)}
                              className={cn(
                                'px-0 py-0.5 text-center align-middle w-[24px]',
                                isSam && 'bg-emerald-50/40 border-l border-r border-emerald-100',
                                isToday && 'bg-blue-50/40'
                              )}
                            >
                              {statuts.length === 0 ? (
                                <span className="text-muted-foreground/20 text-[8px]">·</span>
                              ) : isRepos ? (
                                <span className="inline-block w-2 h-2 rounded-full bg-slate-200" title="Repos" />
                              ) : (
                                <div className="flex flex-col items-center gap-0.5">
                                  {hasMatin && (
                                    <span className={cn(
                                      'text-[7px] font-bold px-0.5 rounded-sm leading-tight',
                                      hasS2Matin ? 'bg-blue-200 text-blue-800' : 'bg-blue-100 text-blue-600'
                                    )}>
                                      {hasS2Matin ? 'M✓' : 'M'}
                                    </span>
                                  )}
                                  {hasPM && (
                                    <span className={cn(
                                      'text-[7px] font-bold px-0.5 rounded-sm leading-tight',
                                      hasS2PM ? 'bg-amber-200 text-amber-800' : 'bg-amber-100 text-amber-600'
                                    )}>
                                      {hasS2PM ? 'P✓' : 'P'}
                                    </span>
                                  )}
                                  {hasFAD && (
                                    <span className="text-[7px] font-bold px-0.5 rounded-sm bg-violet-100 text-violet-600 leading-tight">
                                      F
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Légende salle par salle */}
            <div className="border-t px-4 py-2 bg-muted/20 flex items-center gap-4 text-[9px] text-muted-foreground">
              {sallesDuPole.map((s, i) => (
                <span key={s.id} className={cn('font-medium', i === 0 ? 'text-blue-600' : 'text-emerald-600')}>
                  {s.nom}
                </span>
              ))}
              <span className="ml-auto">
                M = Matin FP · M✓ = Matin + S2 · P = Après-midi FP · P✓ = PM + S2 · F = FAD · ● = Repos
              </span>
            </div>
          </div>
        )
      })}

      {/* Formateurs sans pôle */}
      {formateurs.filter(f => !f.pole_id).length > 0 && (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-3">
          <p className="text-xs font-semibold text-slate-600 mb-1">Formateurs sans pôle</p>
          <div className="overflow-x-auto">
            <table className="text-xs w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-3 py-1.5 text-left font-medium text-muted-foreground w-32">Formateur</th>
                  {jours.map(jour => {
                    const isSam = jour.getDay() === 6
                    return (
                      <th key={toISODateString(jour)} className={cn(
                        'px-0.5 py-1 text-center text-muted-foreground min-w-[28px]',
                        isSam && 'bg-emerald-50'
                      )}>
                        <div className="text-[8px]">{dayNumberToLabel(jour.getDay()).slice(0, 2)}</div>
                        <div className="text-[9px] font-bold">{jour.getDate()}</div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody className="divide-y">
                {formateurs.filter(f => !f.pole_id).map(formateur => (
                  <tr key={formateur.id} className="hover:bg-muted/20">
                    <td className="px-3 py-1.5 font-medium border-r">{formateur.nom}</td>
                    {jours.map(jour => {
                      const isSam = jour.getDay() === 6
                      const statuts = getStatutsFormateur(formateur.id, null, jour)
                      const hasMatin = statuts.some(s => s.includes('Matin'))
                      const hasPM = statuts.some(s => s.includes('midi'))
                      const hasFAD = statuts.some(s => s.startsWith('FAD'))
                      const isRepos = statuts.includes('Repos')
                      return (
                        <td key={toISODateString(jour)} className={cn('px-0.5 py-1 text-center', isSam && 'bg-emerald-50/40')}>
                          {isRepos ? <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-300" />
                           : hasMatin ? <span className="text-[7px] font-bold text-blue-600 bg-blue-50 px-0.5 rounded">M</span>
                           : hasPM ? <span className="text-[7px] font-bold text-amber-600 bg-amber-50 px-0.5 rounded">P</span>
                           : hasFAD ? <span className="text-[7px] font-bold text-violet-600 bg-violet-50 px-0.5 rounded">F</span>
                           : <span className="text-muted-foreground/20 text-[8px]">·</span>}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
