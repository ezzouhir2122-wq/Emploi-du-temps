'use client'

import {
  Document, Page, View, Text, StyleSheet, Image as PDFImage,
} from '@react-pdf/renderer'
import type { JourSemaine, StatutFixe, StatutSamedi, SemaineCycle } from '@/types/planning'

// ── Types ────────────────────────────────────────────────────────────────────

export interface FormateurData {
  id: string
  nom: string
  matricule?: string | null
  pole_id?: string | null
  pole_nom?: string | null
  salle_nom?: string | null
  salle_id?: string | null
  groupe_id?: string | null
}

export interface PoleData {
  id: string
  nom: string
  code?: string | null
}

export interface SalleData {
  id: string
  nom: string
  pole_id?: string | null
}

export interface GroupeData {
  id: string
  nom: string
  pole_id?: string | null
  salle_id?: string | null
}

export interface PlanningEntry {
  formateur_id: string
  jour_semaine: JourSemaine
  statut: StatutFixe
  salle_id?: string | null
  groupe_formation_id?: string | null
}

export interface RotationEntry {
  formateur_id: string
  salle_id?: string | null
  semaine_cycle: SemaineCycle
  statut: StatutSamedi
}

export interface CycleRef {
  salle_id?: string | null
  date_ancrage: string
  semaine_cycle_ancrage: SemaineCycle
}

export interface VueMensuellePDFProps {
  annee: number
  mois: number
  poles: PoleData[]
  salles: SalleData[]
  formateurs: FormateurData[]
  groupes: GroupeData[]
  planningFixe: PlanningEntry[]
  rotationConfig: RotationEntry[]
  cycleReferences: CycleRef[]
  logoUrl?: string
}

// ── Constantes ────────────────────────────────────────────────────────────────

const MOIS_FR = [
  'Janvier','Février','Mars','Avril','Mai','Juin',
  'Juillet','Août','Septembre','Octobre','Novembre','Décembre',
]

const JOURS_SHORT = ['Di','Lu','Ma','Me','Je','Ve','Sa']
const JOURS_SEMAINE: JourSemaine[] = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi']

const DAY_TO_JOUR: Record<number, JourSemaine> = {
  1: 'Lundi', 2: 'Mardi', 3: 'Mercredi', 4: 'Jeudi', 5: 'Vendredi', 6: 'Samedi',
}

const DUREE: Partial<Record<StatutFixe, number>> = {
  'Matin FP S1': 2.5, 'Matin FP S2': 2.5,
  'Après-midi FP S1': 2.5, 'Après-midi FP S2': 2.5,
  'FAD Matin': 2.5, 'FAD Après-midi': 2.5, 'FAD 1h': 1,
  'Matin': 5, 'Après-midi': 5, 'Distance': 5,
  'Distance Matin': 2.5, 'Distance Après-midi': 2.5,
}

// Palette
const BLUE      = '#005FAD'
const BLUE_DARK = '#003D70'
const BLUE_L    = '#EFF6FF'
const GREEN     = '#059669'
const GOLD      = '#D97706'
const VIOLET    = '#6D28D9'
const SLATE     = '#64748B'
const SLATE_L   = '#F1F5F9'
const BORDER    = '#CBD5E1'
const TEXT      = '#0F172A'
const TEXT_S    = '#475569'

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page: { fontFamily: 'Helvetica', backgroundColor: '#FFFFFF', paddingHorizontal: 0, paddingVertical: 0, paddingBottom: 24 },

  // Header band
  hBand: { backgroundColor: BLUE_DARK, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 10, minHeight: 60 },
  hLogo: { width: 44, height: 44, backgroundColor: '#FFFFFF', borderRadius: 4, padding: 3, marginRight: 12, alignItems: 'center', justifyContent: 'center' },
  hLogoImg: { width: 38, height: 38, objectFit: 'contain' },
  hOrg: { flex: 1 },
  hOrgName: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#FFFFFF', letterSpacing: 2 },
  hOrgFull: { fontSize: 6.5, color: '#BAD4EE', marginTop: 2 },
  hTitle: { flex: 1.2, alignItems: 'center' },
  hTitleText: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#FFFFFF', textAlign: 'center', letterSpacing: 0.5 },
  hTitleSub: { fontSize: 6, color: '#BAD4EE', textAlign: 'center', marginTop: 2 },
  hMois: { backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 5, paddingHorizontal: 10, paddingVertical: 6, alignItems: 'flex-end' },
  hMoisVal: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#FFFFFF' },
  hMoisLabel: { fontSize: 5.5, color: '#BAD4EE', textTransform: 'uppercase', letterSpacing: 0.5 },

  // Info strip
  strip: { backgroundColor: BLUE_L, borderBottomWidth: 2, borderBottomColor: BLUE, flexDirection: 'row', paddingHorizontal: 18, paddingVertical: 6 },
  stripCell: { flex: 1, borderRightWidth: 1, borderRightColor: '#C7DFF0', paddingRight: 12, marginRight: 12 },
  stripCellLast: { flex: 1 },
  stripLabel: { fontSize: 5.5, color: SLATE, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 1 },
  stripVal: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: TEXT },

  // Section header
  secHeader: { marginHorizontal: 16, marginTop: 12, marginBottom: 4, flexDirection: 'row', alignItems: 'center', gap: 8 },
  secBar: { width: 3, height: 14, borderRadius: 2 },
  secTitle: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: TEXT },
  secSub: { fontSize: 6.5, color: SLATE },

  // Table
  table: { marginHorizontal: 16, borderWidth: 1, borderColor: BORDER, borderRadius: 4, overflow: 'hidden' },
  thead: { flexDirection: 'row', backgroundColor: '#003D70' },
  tbody: {},

  // Cells
  thName: { width: 88, paddingVertical: 5, paddingHorizontal: 4, borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.15)' },
  thNameText: { fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: 'rgba(255,255,255,0.8)' },
  thStat: { width: 48, paddingVertical: 5, paddingHorizontal: 3, borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.15)', alignItems: 'center' },
  thStatText: { fontSize: 5.5, fontFamily: 'Helvetica-Bold', color: 'rgba(255,255,255,0.8)', textAlign: 'center' },
  thDay: { flex: 1, paddingVertical: 3, alignItems: 'center', borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.10)' },
  thDayNum: { fontSize: 6, fontFamily: 'Helvetica-Bold', color: '#FFFFFF' },
  thDayName: { fontSize: 4.5, color: 'rgba(255,255,255,0.60)' },
  thDaySam: { flex: 1, paddingVertical: 3, alignItems: 'center', borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.10)', backgroundColor: '#065F46' },

  row: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: BORDER, minHeight: 20 },
  rowAlt: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: BORDER, minHeight: 20, backgroundColor: '#FAFBFC' },
  tdName: { width: 88, paddingVertical: 3, paddingHorizontal: 4, justifyContent: 'center', borderRightWidth: 1, borderRightColor: BORDER },
  tdNameText: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: TEXT },
  tdNameSub: { fontSize: 5.5, color: SLATE, marginTop: 1 },
  tdStat: { width: 48, paddingVertical: 3, paddingHorizontal: 3, justifyContent: 'center', alignItems: 'center', borderRightWidth: 1, borderRightColor: BORDER },
  tdStatNum: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: BLUE },
  tdStatSub: { fontSize: 5, color: SLATE, textAlign: 'center' },
  tdDay: { flex: 1, paddingVertical: 2, alignItems: 'center', justifyContent: 'center', borderRightWidth: 0.5, borderRightColor: '#E8EFF7' },
  tdDaySam: { flex: 1, paddingVertical: 2, alignItems: 'center', justifyContent: 'center', borderRightWidth: 0.5, borderRightColor: '#D1FAE5', backgroundColor: '#F0FDF4' },

  // Status mini-cells
  dot: { width: 14, height: 7, borderRadius: 2, alignItems: 'center', justifyContent: 'center', marginBottom: 1 },
  dotText: { fontSize: 4, fontFamily: 'Helvetica-Bold', color: '#FFFFFF' },
  repos: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#E2E8F0' },
  empty: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#F1F5F9' },

  // Stats summary section
  statsGrid: { marginHorizontal: 16, marginTop: 8, flexDirection: 'row', gap: 8 },
  statCard: { flex: 1, borderWidth: 1, borderColor: BORDER, borderRadius: 5, padding: 8 },
  statCardTop: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  statCardDot: { width: 5, height: 5, borderRadius: 2.5 },
  statCardTitle: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: TEXT },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3, paddingBottom: 3, borderBottomWidth: 0.5, borderBottomColor: BORDER },
  statRowLast: { flexDirection: 'row', justifyContent: 'space-between' },
  statName: { fontSize: 6, color: TEXT_S, flex: 1 },
  statVal: { fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: TEXT },
  statUnit: { fontSize: 5.5, color: SLATE },

  // Pole group header
  poleBar: { marginHorizontal: 16, marginTop: 10, marginBottom: 3, flexDirection: 'row', alignItems: 'center', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 4 },
  poleBarText: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#FFFFFF' },
  poleBarSub: { fontSize: 5.5, color: 'rgba(255,255,255,0.75)', marginLeft: 8 },

  // Footer
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#F8FAFC', borderTopWidth: 1, borderTopColor: BORDER, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 4 },
  footerText: { fontSize: 6, color: '#94A3B8' },

  // Legend
  legend: { marginHorizontal: 16, marginTop: 6, flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  legendDot: { width: 8, height: 5, borderRadius: 1.5 },
  legendText: { fontSize: 5.5, color: SLATE },
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function getDaysList(annee: number, mois: number): Date[] {
  const days: Date[] = []
  const first = new Date(annee, mois - 1, 1)
  const last = new Date(annee, mois, 0)
  for (let d = new Date(first); d <= last; d.setDate(d.getDate() + 1)) {
    if (d.getDay() !== 0) days.push(new Date(d)) // exclude Dimanche
  }
  return days
}

function getMoisCycleCalc(annee: number, mois: number, dateAncrage: Date, moisCycleAncrage: SemaineCycle): SemaineCycle {
  const ancrageAnnee = dateAncrage.getUTCFullYear()
  const ancrageMois = dateAncrage.getUTCMonth() + 1
  const deltaMois = (annee - ancrageAnnee) * 12 + (mois - ancrageMois)
  const position = ((moisCycleAncrage - 1 + deltaMois) % 3 + 3) % 3
  return (position + 1) as SemaineCycle
}

function getStatutsForDay(
  formateurId: string,
  date: Date,
  planningFixe: PlanningEntry[],
  rotationConfig: RotationEntry[],
  cycleReferences: CycleRef[],
  salleId: string | null,
): StatutFixe[] {
  const dayNum = date.getDay()
  if (dayNum === 0) return []

  if (dayNum === 6) {
    // Samedi - chercher dans rotation par salle_id
    const ref = cycleReferences.find(c => c.salle_id === salleId)
    if (!ref) return ['Repos']
    const ancrage = new Date(ref.date_ancrage + 'T12:00:00Z')
    const pos = getMoisCycleCalc(date.getFullYear(), date.getMonth() + 1, ancrage, ref.semaine_cycle_ancrage)
    const cfg = rotationConfig.find(c =>
      c.formateur_id === formateurId && c.salle_id === salleId && c.semaine_cycle === pos
    )
    const statut = cfg?.statut ?? 'Repos'
    if (statut === 'Repos') return ['Repos']
    // Map legacy samedi statuts
    if (statut === 'Matin') return ['Matin FP S1']
    if (statut === 'Après-midi') return ['Après-midi FP S1']
    return ['Repos']
  }

  const jourLabel = DAY_TO_JOUR[dayNum]
  if (!jourLabel) return []
  return planningFixe
    .filter(p => p.formateur_id === formateurId && p.jour_semaine === jourLabel)
    .map(p => p.statut)
}

function heuresHebdo(formateurId: string, planningFixe: PlanningEntry[]): number {
  return planningFixe
    .filter(p => p.formateur_id === formateurId)
    .reduce((acc, p) => acc + (DUREE[p.statut] ?? 0), 0)
}

function seancesHebdo(formateurId: string, planningFixe: PlanningEntry[]): number {
  return planningFixe.filter(p =>
    p.formateur_id === formateurId &&
    ['Matin FP S1','Matin FP S2','Après-midi FP S1','Après-midi FP S2','FAD Matin','FAD Après-midi','FAD 1h'].includes(p.statut)
  ).length
}

function joursFP(formateurId: string, planningFixe: PlanningEntry[]): number {
  const days = new Set(
    planningFixe
      .filter(p => p.formateur_id === formateurId &&
        ['Matin FP S1','Matin FP S2','Après-midi FP S1','Après-midi FP S2'].includes(p.statut))
      .map(p => p.jour_semaine)
  )
  return days.size
}

function joursRepos(formateurId: string, planningFixe: PlanningEntry[]): number {
  const travail = new Set(
    planningFixe.filter(p => p.formateur_id === formateurId).map(p => p.jour_semaine)
  )
  return 6 - travail.size
}

// Taux occupation salle (FP uniquement, Lun-Ven, 5×4=20 sous-créneaux max)
function tauxOccupationSalle(salleId: string, formateurIds: string[], planningFixe: PlanningEntry[]): number {
  const slots = new Set<string>()
  for (const p of planningFixe) {
    if (!formateurIds.includes(p.formateur_id)) continue
    if (!['Matin FP S1','Matin FP S2','Après-midi FP S1','Après-midi FP S2'].includes(p.statut)) continue
    slots.add(`${p.jour_semaine}-${p.statut}`)
  }
  return Math.min(100, Math.round(slots.size / 20 * 100))
}

// ── Status cell renderer ──────────────────────────────────────────────────────

function StatusDots({ statuts }: { statuts: StatutFixe[] }) {
  if (statuts.length === 0) return <View style={s.empty} />

  const hasMatin = statuts.some(s => s === 'Matin FP S1' || s === 'Matin FP S2' || s === 'Matin')
  const hasPM    = statuts.some(s => s === 'Après-midi FP S1' || s === 'Après-midi FP S2' || s === 'Après-midi')
  const hasFAD   = statuts.some(s => s.startsWith('FAD'))
  const isRepos  = statuts.includes('Repos')

  if (isRepos) return <View style={s.repos} />

  return (
    <View style={{ alignItems: 'center', gap: 1 }}>
      {hasMatin && (
        <View style={[s.dot, { backgroundColor: '#2563EB' }]}>
          <Text style={s.dotText}>M</Text>
        </View>
      )}
      {hasPM && (
        <View style={[s.dot, { backgroundColor: '#D97706' }]}>
          <Text style={s.dotText}>PM</Text>
        </View>
      )}
      {hasFAD && !hasMatin && !hasPM && (
        <View style={[s.dot, { backgroundColor: '#6D28D9' }]}>
          <Text style={s.dotText}>FAD</Text>
        </View>
      )}
      {hasFAD && (hasMatin || hasPM) && (
        <View style={[s.dot, { backgroundColor: '#7C3AED' }]}>
          <Text style={[s.dotText, { fontSize: 3.5 }]}>FAD</Text>
        </View>
      )}
    </View>
  )
}

// ── Header commun ─────────────────────────────────────────────────────────────

function PDFHeader({ annee, mois, subtitle, logoUrl, formateursCount, sallesCount, polesCount }: {
  annee: number; mois: number; subtitle: string; logoUrl?: string
  formateursCount: number; sallesCount: number; polesCount: number
}) {
  return (
    <>
      <View style={s.hBand}>
        {logoUrl ? (
          <View style={s.hLogo}>
            <PDFImage src={logoUrl} style={s.hLogoImg} />
          </View>
        ) : <View style={{ width: 44, marginRight: 12 }} />}
        <View style={s.hOrg}>
          <Text style={s.hOrgName}>OFPPT</Text>
          <Text style={s.hOrgFull}>Office de la Formation Professionnelle et de la Promotion du Travail</Text>
        </View>
        <View style={s.hTitle}>
          <Text style={s.hTitleText}>EMPLOI DU TEMPS MENSUEL</Text>
          <Text style={s.hTitleSub}>{subtitle}</Text>
        </View>
        <View style={s.hMois}>
          <Text style={s.hMoisLabel}>Période</Text>
          <Text style={s.hMoisVal}>{MOIS_FR[mois - 1]} {annee}</Text>
        </View>
      </View>

      <View style={s.strip}>
        <View style={s.stripCell}>
          <Text style={s.stripLabel}>Formateurs actifs</Text>
          <Text style={s.stripVal}>{formateursCount} formateurs</Text>
        </View>
        <View style={s.stripCell}>
          <Text style={s.stripLabel}>Salles</Text>
          <Text style={s.stripVal}>{sallesCount} salles</Text>
        </View>
        <View style={s.stripCell}>
          <Text style={s.stripLabel}>Pôles</Text>
          <Text style={s.stripVal}>{polesCount} pôles actifs</Text>
        </View>
        <View style={s.stripCellLast}>
          <Text style={s.stripLabel}>Jours ouvrés</Text>
          <Text style={s.stripVal}>Lundi – Samedi</Text>
        </View>
      </View>
    </>
  )
}

// ── Page 1 : Planning par formateur ──────────────────────────────────────────

function PageFormateurs({
  annee, mois, days, poles, salles, formateurs, planningFixe,
  rotationConfig, cycleReferences, logoUrl,
}: {
  annee: number; mois: number; days: Date[]
  poles: PoleData[]; salles: SalleData[]; formateurs: FormateurData[]
  planningFixe: PlanningEntry[]; rotationConfig: RotationEntry[]
  cycleReferences: CycleRef[]; logoUrl?: string
}) {
  const POLE_COLORS = ['#005FAD','#059669','#7C3AED','#D97706','#DC2626','#0891B2']

  return (
    <Page size="A4" orientation="landscape" style={s.page}>
      <PDFHeader annee={annee} mois={mois} subtitle="Vue par Formateur — Planning fixe Lun–Sam"
        logoUrl={logoUrl} formateursCount={formateurs.length}
        sallesCount={salles.length} polesCount={poles.length} />

      {/* Section title */}
      <View style={s.secHeader}>
        <View style={[s.secBar, { backgroundColor: BLUE }]} />
        <Text style={s.secTitle}>Planning mensuel — par Formateur</Text>
        <Text style={s.secSub}>M = Matin FP · PM = Après-midi FP · FAD = Formation à Distance · ● = Repos</Text>
      </View>

      {/* Legend */}
      <View style={s.legend}>
        {[
          { label: 'Matin FP', color: '#2563EB' },
          { label: 'Après-midi FP', color: '#D97706' },
          { label: 'FAD / Distanciel', color: '#6D28D9' },
          { label: 'Repos', color: '#CBD5E1' },
        ].map(l => (
          <View key={l.label} style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: l.color }]} />
            <Text style={s.legendText}>{l.label}</Text>
          </View>
        ))}
      </View>

      {/* Tables per pole */}
      {poles.map((pole, poleIdx) => {
        const formateursDuPole = formateurs.filter(f => f.pole_id === pole.id)
        if (formateursDuPole.length === 0) return null
        const color = POLE_COLORS[poleIdx % POLE_COLORS.length]
        const sallesDuPole = salles.filter(s => s.pole_id === pole.id)
        const salleNom = sallesDuPole.map(s => s.nom).join(' / ') || '—'

        return (
          <View key={pole.id}>
            {/* Pole header */}
            <View style={[s.poleBar, { backgroundColor: color, marginTop: poleIdx === 0 ? 4 : 8 }]}>
              <Text style={s.poleBarText}>{pole.nom}</Text>
              {pole.code && <Text style={[s.poleBarText, { fontSize: 6, opacity: 0.8 }]}> · {pole.code}</Text>}
              <Text style={s.poleBarSub}>{salleNom} · {formateursDuPole.length} formateurs</Text>
            </View>

            {/* Table */}
            <View style={s.table}>
              <View style={s.thead}>
                <View style={s.thName}><Text style={s.thNameText}>Formateur</Text></View>
                <View style={s.thStat}><Text style={s.thStatText}>H/sem{'\n'}Séances</Text></View>
                {days.map(day => {
                  const isSam = day.getDay() === 6
                  return (
                    <View key={day.getTime()} style={isSam ? s.thDaySam : s.thDay}>
                      <Text style={s.thDayNum}>{day.getDate()}</Text>
                      <Text style={s.thDayName}>{JOURS_SHORT[day.getDay()]}</Text>
                    </View>
                  )
                })}
              </View>
              {formateursDuPole.map((formateur, idx) => {
                const hSem = heuresHebdo(formateur.id, planningFixe)
                const seances = seancesHebdo(formateur.id, planningFixe)

                return (
                  <View key={formateur.id} style={idx % 2 === 0 ? s.row : s.rowAlt}>
                    <View style={s.tdName}>
                      <Text style={s.tdNameText}>{formateur.nom}</Text>
                      {formateur.matricule && <Text style={s.tdNameSub}>Mat. {formateur.matricule}</Text>}
                    </View>
                    <View style={s.tdStat}>
                      <Text style={s.tdStatNum}>{hSem}h</Text>
                      <Text style={s.tdStatSub}>{seances} séances</Text>
                    </View>
                    {days.map(day => {
                      const isSam = day.getDay() === 6
                      const statuts = getStatutsForDay(
                        formateur.id, day, planningFixe, rotationConfig, cycleReferences,
                        formateur.salle_id ?? null
                      )
                      return (
                        <View key={day.getTime()} style={isSam ? s.tdDaySam : s.tdDay}>
                          <StatusDots statuts={statuts} />
                        </View>
                      )
                    })}
                  </View>
                )
              })}
            </View>
          </View>
        )
      })}

      <View style={s.footer}>
        <Text style={s.footerText}>OFPPT — Emploi du Temps · Planning par Formateur</Text>
        <Text style={s.footerText}>{MOIS_FR[mois - 1]} {annee}</Text>
      </View>
    </Page>
  )
}

// ── Page 2 : Planning par Salle ───────────────────────────────────────────────

function PageSalles({
  annee, mois, days, poles, salles, formateurs, planningFixe,
  rotationConfig, cycleReferences, logoUrl,
}: {
  annee: number; mois: number; days: Date[]
  poles: PoleData[]; salles: SalleData[]; formateurs: FormateurData[]
  planningFixe: PlanningEntry[]; rotationConfig: RotationEntry[]
  cycleReferences: CycleRef[]; logoUrl?: string
}) {
  const SALLE_COLORS = ['#1E40AF','#065F46','#6B21A8','#92400E','#991B1B','#0E7490']

  return (
    <Page size="A4" orientation="landscape" style={s.page}>
      <PDFHeader annee={annee} mois={mois} subtitle="Vue par Salle — Occupation et affectations"
        logoUrl={logoUrl} formateursCount={formateurs.length}
        sallesCount={salles.length} polesCount={poles.length} />

      <View style={s.secHeader}>
        <View style={[s.secBar, { backgroundColor: GREEN }]} />
        <Text style={s.secTitle}>Planning mensuel — par Salle</Text>
        <Text style={s.secSub}>Occupation de chaque salle par formateur et par jour</Text>
      </View>

      {salles.filter(sal => sal.pole_id).map((salle, salleIdx) => {
        const pole = poles.find(p => p.id === salle.pole_id)
        const formateursDeSalle = formateurs.filter(f => f.pole_id === salle.pole_id)
        if (formateursDeSalle.length === 0) return null
        const color = SALLE_COLORS[salleIdx % SALLE_COLORS.length]
        const taux = tauxOccupationSalle(salle.id, formateursDeSalle.map(f => f.id), planningFixe)

        return (
          <View key={salle.id}>
            <View style={[s.poleBar, { backgroundColor: color, marginTop: salleIdx === 0 ? 4 : 8 }]}>
              <Text style={s.poleBarText}>{salle.nom}</Text>
              <Text style={s.poleBarSub}>{pole?.nom ?? '—'} · Taux d'occupation FP : {taux}%</Text>
            </View>

            <View style={s.table}>
              <View style={s.thead}>
                <View style={s.thName}><Text style={s.thNameText}>Formateur</Text></View>
                <View style={s.thStat}><Text style={s.thStatText}>Taux{'\n'}H/sem</Text></View>
                {days.map(day => {
                  const isSam = day.getDay() === 6
                  return (
                    <View key={day.getTime()} style={isSam ? s.thDaySam : s.thDay}>
                      <Text style={s.thDayNum}>{day.getDate()}</Text>
                      <Text style={s.thDayName}>{JOURS_SHORT[day.getDay()]}</Text>
                    </View>
                  )
                })}
              </View>
              {formateursDeSalle.map((formateur, idx) => {
                const hSem = heuresHebdo(formateur.id, planningFixe)
                const seances = seancesHebdo(formateur.id, planningFixe)
                const pctF = Math.round(seances / 10 * 100)

                return (
                  <View key={formateur.id} style={idx % 2 === 0 ? s.row : s.rowAlt}>
                    <View style={s.tdName}>
                      <Text style={s.tdNameText}>{formateur.nom}</Text>
                      <Text style={s.tdNameSub}>{formateur.matricule ? `Mat. ${formateur.matricule}` : ''}</Text>
                    </View>
                    <View style={s.tdStat}>
                      <Text style={s.tdStatNum}>{pctF}%</Text>
                      <Text style={s.tdStatSub}>{hSem}h/sem</Text>
                    </View>
                    {days.map(day => {
                      const isSam = day.getDay() === 6
                      const statuts = getStatutsForDay(
                        formateur.id, day, planningFixe, rotationConfig, cycleReferences, salle.id
                      )
                      return (
                        <View key={day.getTime()} style={isSam ? s.tdDaySam : s.tdDay}>
                          <StatusDots statuts={statuts} />
                        </View>
                      )
                    })}
                  </View>
                )
              })}
            </View>
          </View>
        )
      })}

      <View style={s.footer}>
        <Text style={s.footerText}>OFPPT — Emploi du Temps · Planning par Salle</Text>
        <Text style={s.footerText}>{MOIS_FR[mois - 1]} {annee}</Text>
      </View>
    </Page>
  )
}

// ── Page 3 : Statistiques & Résumé par pôle ──────────────────────────────────

function PageStats({
  annee, mois, poles, salles, formateurs, groupes, planningFixe, logoUrl,
}: {
  annee: number; mois: number
  poles: PoleData[]; salles: SalleData[]; formateurs: FormateurData[]
  groupes: GroupeData[]; planningFixe: PlanningEntry[]; logoUrl?: string
}) {
  const POLE_COLORS = ['#005FAD','#059669','#7C3AED','#D97706','#DC2626','#0891B2']
  // Groupes formation réels (sans salle_id)
  const groupesFormation = groupes.filter(g => !g.salle_id)

  return (
    <Page size="A4" orientation="landscape" style={s.page}>
      <PDFHeader annee={annee} mois={mois} subtitle="Statistiques — Volume horaire, occupation, équité"
        logoUrl={logoUrl} formateursCount={formateurs.length}
        sallesCount={salles.length} polesCount={poles.length} />

      <View style={s.secHeader}>
        <View style={[s.secBar, { backgroundColor: GOLD }]} />
        <Text style={s.secTitle}>Statistiques par Pôle — Volume horaire & Taux d'occupation</Text>
        <Text style={s.secSub}>Données hebdomadaires fixes · Lundi–Vendredi + Samedi rotation</Text>
      </View>

      {poles.map((pole, poleIdx) => {
        const formateursDuPole = formateurs.filter(f => f.pole_id === pole.id)
        if (formateursDuPole.length === 0) return null
        const sallesDuPole = salles.filter(s => s.pole_id === pole.id)
        const color = POLE_COLORS[poleIdx % POLE_COLORS.length]

        // Taux d'occupation par salle
        const tauxSalles = sallesDuPole.map(sal => ({
          salle: sal,
          taux: tauxOccupationSalle(sal.id, formateursDuPole.map(f => f.id), planningFixe),
        }))

        return (
          <View key={pole.id} style={{ marginTop: poleIdx === 0 ? 4 : 10 }}>
            <View style={[s.poleBar, { backgroundColor: color }]}>
              <Text style={s.poleBarText}>{pole.nom}</Text>
              {pole.code && <Text style={s.poleBarSub}> · {pole.code}</Text>}
              <Text style={s.poleBarSub}>
                {'  '}
                {sallesDuPole.map((sal, i) => `${sal.nom}: ${tauxSalles[i]?.taux ?? 0}%`).join(' · ')}
              </Text>
            </View>

            <View style={s.table}>
              {/* Header */}
              <View style={[s.thead]}>
                {[
                  { label: 'Formateur', w: 100 },
                  { label: 'Mat.', w: 45 },
                  { label: 'H/sem.', w: 40 },
                  { label: 'Séances\n/10', w: 40 },
                  { label: 'Jours FP\n/5', w: 40 },
                  { label: 'Jours FAD\n/1', w: 40 },
                  { label: 'Jours\nRepos', w: 38 },
                  { label: 'Taux\noccup.', w: 40 },
                  { label: 'Salle(s)\naffectée(s)', w: 80 },
                  { label: 'Groupes de\nformation', w: 0, flex: 1 },
                ].map((col, i) => (
                  <View key={i} style={[
                    { paddingVertical: 5, paddingHorizontal: 4, borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.15)', alignItems: 'center' },
                    col.flex ? { flex: col.flex } : { width: col.w },
                  ]}>
                    <Text style={s.thStatText}>{col.label}</Text>
                  </View>
                ))}
              </View>

              {formateursDuPole.map((formateur, idx) => {
                const hSem = heuresHebdo(formateur.id, planningFixe)
                const seances = seancesHebdo(formateur.id, planningFixe)
                const fpDays = joursFP(formateur.id, planningFixe)
                const reposDays = joursRepos(formateur.id, planningFixe)
                const fadDays = JOURS_SEMAINE.filter(j =>
                  planningFixe.some(p => p.formateur_id === formateur.id && p.jour_semaine === j &&
                    (p.statut === 'FAD Matin' || p.statut === 'FAD Après-midi'))
                ).length
                const pct = Math.round(seances / 10 * 100)
                const isPct100 = pct === 100

                // Groupes enseignés par ce formateur
                const groupeIds = new Set(
                  planningFixe
                    .filter(p => p.formateur_id === formateur.id && p.groupe_formation_id)
                    .map(p => p.groupe_formation_id!)
                )
                const groupeNoms = groupesFormation
                  .filter(g => groupeIds.has(g.id))
                  .map(g => g.nom)
                  .join(', ')

                const rowStyle = idx % 2 === 0 ? s.row : s.rowAlt

                return (
                  <View key={formateur.id} style={rowStyle}>
                    {[
                      { val: formateur.nom, w: 100, bold: true },
                      { val: formateur.matricule ?? '—', w: 45 },
                      { val: `${hSem}h`, w: 40, color: BLUE },
                      { val: `${seances}/10`, w: 40, color: isPct100 ? GREEN : TEXT },
                      { val: `${fpDays}/5`, w: 40, color: fpDays >= 4 ? GREEN : GOLD },
                      { val: `${fadDays}/1`, w: 40, color: fadDays >= 1 ? VIOLET : SLATE },
                      { val: `${reposDays}j`, w: 38, color: reposDays <= 1 ? GREEN : GOLD },
                      { val: `${pct}%`, w: 40, color: isPct100 ? GREEN : pct >= 70 ? GOLD : '#DC2626' },
                      { val: sallesDuPole.map(s => s.nom).join(' / ') || '—', w: 80 },
                    ].map((cell, ci) => (
                      <View key={ci} style={[
                        { paddingVertical: 4, paddingHorizontal: 4, justifyContent: 'center', borderRightWidth: 0.5, borderRightColor: BORDER },
                        { width: cell.w },
                      ]}>
                        <Text style={[{ fontSize: 6.5, color: (cell as any).color ?? TEXT }, (cell as any).bold ? { fontFamily: 'Helvetica-Bold' } : {}]}>
                          {cell.val}
                        </Text>
                      </View>
                    ))}
                    <View style={{ flex: 1, paddingVertical: 4, paddingHorizontal: 4, justifyContent: 'center' }}>
                      <Text style={{ fontSize: 5.5, color: TEXT_S }}>{groupeNoms || '—'}</Text>
                    </View>
                  </View>
                )
              })}
            </View>
          </View>
        )
      })}

      <View style={s.footer}>
        <Text style={s.footerText}>OFPPT — Emploi du Temps · Statistiques & Volume horaire</Text>
        <Text style={s.footerText}>{MOIS_FR[mois - 1]} {annee}</Text>
      </View>
    </Page>
  )
}

// ── Page 4 : Planning par Groupe de formation ──────────────────────────────────

function PageGroupes({
  annee, mois, days, poles, salles, formateurs, groupes, planningFixe,
  rotationConfig, cycleReferences, logoUrl,
}: {
  annee: number; mois: number; days: Date[]
  poles: PoleData[]; salles: SalleData[]; formateurs: FormateurData[]
  groupes: GroupeData[]; planningFixe: PlanningEntry[]
  rotationConfig: RotationEntry[]; cycleReferences: CycleRef[]; logoUrl?: string
}) {
  const groupesFormation = groupes.filter(g => !g.salle_id)

  return (
    <Page size="A4" orientation="landscape" style={s.page}>
      <PDFHeader annee={annee} mois={mois} subtitle="Vue par Groupe de Formation — Séances et formateurs"
        logoUrl={logoUrl} formateursCount={formateurs.length}
        sallesCount={salles.length} polesCount={poles.length} />

      <View style={s.secHeader}>
        <View style={[s.secBar, { backgroundColor: VIOLET }]} />
        <Text style={s.secTitle}>Planning mensuel — par Groupe de Formation</Text>
        <Text style={s.secSub}>Formateur affecté à chaque groupe pour chaque jour du mois</Text>
      </View>

      {groupesFormation.length === 0 && (
        <View style={{ marginHorizontal: 16, marginTop: 16, padding: 12, borderWidth: 1, borderColor: BORDER, borderRadius: 4 }}>
          <Text style={{ fontSize: 8, color: SLATE, textAlign: 'center' }}>
            Aucun groupe de formation saisi. Définissez les groupes dans Paramètres → Groupes.
          </Text>
        </View>
      )}

      {groupesFormation.map((groupe, gIdx) => {
        // Formateurs qui ont ce groupe dans leur planning
        const formateurIds = new Set(
          planningFixe.filter(p => p.groupe_formation_id === groupe.id).map(p => p.formateur_id)
        )
        const formateursDuGroupe = formateurs.filter(f => formateurIds.has(f.id))
        if (formateursDuGroupe.length === 0) return null

        const pole = poles.find(p => p.id === groupe.pole_id)

        return (
          <View key={groupe.id}>
            <View style={[s.poleBar, { backgroundColor: '#1E40AF', marginTop: gIdx === 0 ? 4 : 8 }]}>
              <Text style={s.poleBarText}>{groupe.nom}</Text>
              {pole && <Text style={s.poleBarSub}> · Pôle : {pole.nom}</Text>}
            </View>

            <View style={s.table}>
              <View style={s.thead}>
                <View style={s.thName}><Text style={s.thNameText}>Formateur</Text></View>
                {days.map(day => {
                  const isSam = day.getDay() === 6
                  return (
                    <View key={day.getTime()} style={isSam ? s.thDaySam : s.thDay}>
                      <Text style={s.thDayNum}>{day.getDate()}</Text>
                      <Text style={s.thDayName}>{JOURS_SHORT[day.getDay()]}</Text>
                    </View>
                  )
                })}
              </View>
              {formateursDuGroupe.map((formateur, idx) => {
                return (
                  <View key={formateur.id} style={idx % 2 === 0 ? s.row : s.rowAlt}>
                    <View style={s.tdName}>
                      <Text style={s.tdNameText}>{formateur.nom}</Text>
                    </View>
                    {days.map(day => {
                      const isSam = day.getDay() === 6
                      const dayNum = day.getDay()
                      const jourLabel = DAY_TO_JOUR[dayNum]
                      // Check if this formateur has this groupe on this day
                      const hasGroupe = jourLabel ? planningFixe.some(p =>
                        p.formateur_id === formateur.id &&
                        p.jour_semaine === jourLabel &&
                        p.groupe_formation_id === groupe.id
                      ) : false

                      return (
                        <View key={day.getTime()} style={isSam ? s.tdDaySam : s.tdDay}>
                          {hasGroupe ? (
                            <View style={[s.dot, { backgroundColor: '#1D4ED8' }]}>
                              <Text style={s.dotText}>✓</Text>
                            </View>
                          ) : (
                            <View style={s.empty} />
                          )}
                        </View>
                      )
                    })}
                  </View>
                )
              })}
            </View>
          </View>
        )
      })}

      <View style={s.footer}>
        <Text style={s.footerText}>OFPPT — Emploi du Temps · Planning par Groupe de Formation</Text>
        <Text style={s.footerText}>{MOIS_FR[mois - 1]} {annee}</Text>
      </View>
    </Page>
  )
}

// ── Documents individuels ─────────────────────────────────────────────────────

export function VueMensuelleFormateursPDF(props: VueMensuellePDFProps) {
  const days = getDaysList(props.annee, props.mois)
  return (
    <Document>
      <PageFormateurs {...props} days={days} />
    </Document>
  )
}

export function VueMensuelleSallesPDF(props: VueMensuellePDFProps) {
  const days = getDaysList(props.annee, props.mois)
  return (
    <Document>
      <PageSalles {...props} days={days} />
    </Document>
  )
}

export function VueMensuellePolePDF(props: VueMensuellePDFProps) {
  return (
    <Document>
      <PageStats {...props} />
    </Document>
  )
}

export function VueMensuelleGroupesPDF(props: VueMensuellePDFProps) {
  const days = getDaysList(props.annee, props.mois)
  return (
    <Document>
      <PageGroupes {...props} days={days} />
    </Document>
  )
}

// ── Document complet (toutes vues) ───────────────────────────────────────────

export function VueMensuellePDF({
  annee, mois, poles, salles, formateurs, groupes, planningFixe,
  rotationConfig, cycleReferences, logoUrl,
}: VueMensuellePDFProps) {
  const days = getDaysList(annee, mois)

  return (
    <Document>
      <PageFormateurs
        annee={annee} mois={mois} days={days}
        poles={poles} salles={salles} formateurs={formateurs}
        planningFixe={planningFixe} rotationConfig={rotationConfig}
        cycleReferences={cycleReferences} logoUrl={logoUrl}
      />
      <PageSalles
        annee={annee} mois={mois} days={days}
        poles={poles} salles={salles} formateurs={formateurs}
        planningFixe={planningFixe} rotationConfig={rotationConfig}
        cycleReferences={cycleReferences} logoUrl={logoUrl}
      />
      <PageStats
        annee={annee} mois={mois}
        poles={poles} salles={salles} formateurs={formateurs}
        groupes={groupes} planningFixe={planningFixe} logoUrl={logoUrl}
      />
      <PageGroupes
        annee={annee} mois={mois} days={days}
        poles={poles} salles={salles} formateurs={formateurs}
        groupes={groupes} planningFixe={planningFixe}
        rotationConfig={rotationConfig} cycleReferences={cycleReferences} logoUrl={logoUrl}
      />
    </Document>
  )
}
