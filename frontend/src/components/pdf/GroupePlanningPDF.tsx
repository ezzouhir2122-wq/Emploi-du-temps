'use client'

import {
  Document, Page, View, Text, StyleSheet, Image as PDFImage,
} from '@react-pdf/renderer'
import type { JourSemaine, StatutFixe } from '@/types/planning'

export interface GroupePlanningRow {
  jour_semaine: JourSemaine
  statut: StatutFixe
  formateur_nom?: string | null
}

export interface GroupePlanningPDFProps {
  groupeNom: string
  poleNom?: string | null
  planning: GroupePlanningRow[]
  totalSeances: number
  totalHeures: number
  dateGeneration: string
  logoUrl?: string
}

const JOURS: JourSemaine[] = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
const JOURS_FULL: Record<JourSemaine, string> = {
  Lundi: 'LUNDI', Mardi: 'MARDI', Mercredi: 'MERCREDI',
  Jeudi: 'JEUDI', Vendredi: 'VENDREDI', Samedi: 'SAMEDI',
}

const SLOTS: { statut: StatutFixe; label: string; time: string; bg: string; fg: string; border: string; dot: string; extraStatuts?: StatutFixe[] }[] = [
  { statut: 'Matin FP S1',         label: 'Matin S1',       time: '08h30–11h',   bg: '#DBEAFE', fg: '#1D4ED8', border: '#93C5FD', dot: '#2563EB' },
  { statut: 'Matin FP S2',         label: 'Matin S2',       time: '11h–13h30',   bg: '#BFDBFE', fg: '#1E40AF', border: '#60A5FA', dot: '#1D4ED8' },
  { statut: 'Après-midi FP S1',    label: 'Après-midi S1',  time: '13h30–16h',   bg: '#D1FAE5', fg: '#065F46', border: '#6EE7B7', dot: '#059669' },
  { statut: 'Après-midi FP S2',    label: 'Après-midi S2',  time: '16h–18h30',   bg: '#A7F3D0', fg: '#064E3B', border: '#34D399', dot: '#047857' },
  { statut: 'FAD Matin S1',        label: 'FAD 08h30–11h',  time: '08h30–11h',   bg: '#EDE9FE', fg: '#6D28D9', border: '#C4B5FD', dot: '#8B5CF6', extraStatuts: ['FAD Matin'] },
  { statut: 'FAD Matin S2',        label: 'FAD 11h–13h30',  time: '11h–13h30',   bg: '#DDD6FE', fg: '#5B21B6', border: '#A78BFA', dot: '#7C3AED' },
  { statut: 'FAD Après-midi S1',   label: 'FAD 13h30–16h',  time: '13h30–16h',   bg: '#F5F3FF', fg: '#7C3AED', border: '#DDD6FE', dot: '#8B5CF6', extraStatuts: ['FAD Après-midi'] },
  { statut: 'FAD Après-midi S2',   label: 'FAD 16h–18h30',  time: '16h–18h30',   bg: '#E9D5FF', fg: '#6D28D9', border: '#C084FC', dot: '#9333EA' },
  { statut: 'FAD 1h',              label: 'FAD Complément', time: '1h dist.',     bg: '#EDE9FE', fg: '#6D28D9', border: '#C4B5FD', dot: '#8B5CF6' },
]

const BLUE      = '#005FAD'
const BLUE_DARK = '#003D70'
const BLUE_LIGHT = '#E8F4FB'
const GREEN     = '#059669'
const GOLD      = '#D97706'
const SLATE     = '#64748B'
const SLATE_LIGHT = '#F1F5F9'
const BORDER    = '#CBD5E1'
const TEXT_MAIN = '#0F172A'
const TEXT_SUB  = '#475569'

const s = StyleSheet.create({
  page: { fontFamily: 'Helvetica', backgroundColor: '#FFFFFF', paddingHorizontal: 0, paddingVertical: 0 },
  headerBand: { backgroundColor: BLUE_DARK, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, minHeight: 72 },
  logoWrap: { width: 56, height: 56, backgroundColor: '#FFFFFF', borderRadius: 4, alignItems: 'center', justifyContent: 'center', padding: 4, marginRight: 14 },
  logoImg: { width: 48, height: 48, objectFit: 'contain' },
  logoPlaceholder: { width: 56, height: 56, marginRight: 14 },
  orgBlock: { flex: 1 },
  orgName: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#FFFFFF', letterSpacing: 3 },
  orgFull: { fontSize: 7.5, color: '#BAD4EE', marginTop: 2, letterSpacing: 0.3 },
  titleBlock: { alignItems: 'center', flex: 1.4 },
  docTitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#FFFFFF', textAlign: 'center', letterSpacing: 0.8 },
  docSubtitle: { fontSize: 7, color: '#BAD4EE', textAlign: 'center', marginTop: 3, letterSpacing: 0.3 },
  anneeBlock: { alignItems: 'flex-end', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 8, minWidth: 100 },
  anneeLabel: { fontSize: 6.5, color: '#BAD4EE', textTransform: 'uppercase', letterSpacing: 0.5 },
  anneeValue: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#FFFFFF', marginTop: 2 },
  infoStrip: { backgroundColor: BLUE_LIGHT, borderBottomWidth: 2, borderBottomColor: BLUE, flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 8, gap: 0 },
  infoCell: { flex: 1, borderRightWidth: 1, borderRightColor: '#C7DFF0', paddingRight: 14, paddingLeft: 0, marginRight: 14 },
  infoCellLast: { flex: 1, paddingLeft: 0 },
  infoLabel: { fontSize: 6, color: SLATE, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 2 },
  infoValue: { fontSize: 9.5, fontFamily: 'Helvetica-Bold', color: TEXT_MAIN },
  infoValueSub: { fontSize: 7.5, color: TEXT_SUB, marginTop: 1 },
  tableWrap: { paddingHorizontal: 16, paddingTop: 12, flex: 1 },
  tableHeader: { flexDirection: 'row', marginBottom: 3 },
  slotColHead: { width: 84 },
  dayColHead: { flex: 1, marginLeft: 3 },
  dayHeaderCell: { backgroundColor: BLUE, paddingVertical: 6, paddingHorizontal: 4, borderRadius: 4, alignItems: 'center' },
  dayHeaderCellSam: { backgroundColor: GREEN, paddingVertical: 6, paddingHorizontal: 4, borderRadius: 4, alignItems: 'center' },
  dayHeaderText: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#FFFFFF' },
  slotRow: { flexDirection: 'row', marginBottom: 3 },
  slotLabel: { width: 84, paddingRight: 6, justifyContent: 'center', paddingTop: 2 },
  slotDot: { width: 6, height: 6, borderRadius: 3, marginBottom: 3 },
  slotLabelText: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#374151' },
  slotTimeText: { fontSize: 5.5, color: '#9CA3AF', marginTop: 1 },
  cell: { flex: 1, minHeight: 48, marginLeft: 3, borderRadius: 4, padding: 5, borderWidth: 1 },
  cellTypeTag: { fontSize: 5.5, fontFamily: 'Helvetica-Bold', marginBottom: 1, textTransform: 'uppercase', letterSpacing: 0.3 },
  cellTime: { fontSize: 7, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  cellMain: { fontSize: 9, fontFamily: 'Helvetica-Bold', marginTop: 1 },
  cellEmpty: { flex: 1, minHeight: 48, marginLeft: 3, borderRadius: 4, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' },
  cellRepos: { flex: 1, minHeight: 48, marginLeft: 3, borderRadius: 4, backgroundColor: SLATE_LIGHT, borderWidth: 1, borderColor: BORDER, alignItems: 'center', justifyContent: 'center' },
  cellReposText: { fontSize: 7, color: '#94A3B8', fontFamily: 'Helvetica-BoldOblique' },
  emptyMsg: { alignItems: 'center', paddingVertical: 24 },
  emptyText: { fontSize: 10, color: '#94A3B8' },
  summaryBar: { flexDirection: 'row', marginHorizontal: 16, marginTop: 10, borderWidth: 1, borderColor: BORDER, borderRadius: 6, overflow: 'hidden' },
  summaryCell: { flex: 1, paddingVertical: 7, paddingHorizontal: 10, borderRightWidth: 1, borderRightColor: BORDER, alignItems: 'center' },
  summaryCellLast: { flex: 1, paddingVertical: 7, paddingHorizontal: 10, alignItems: 'center' },
  summaryBigNum: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: TEXT_MAIN },
  summaryNumUnit: { fontSize: 8, color: SLATE },
  summaryCaption: { fontSize: 6, color: SLATE, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 2 },
  legendWrap: { flexDirection: 'row', gap: 10, alignItems: 'center', flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 7, height: 7, borderRadius: 3.5 },
  legendText: { fontSize: 6.5, color: TEXT_SUB },
  sigSection: { flexDirection: 'row', marginHorizontal: 16, marginTop: 12, gap: 12 },
  sigBox: { flex: 1, borderWidth: 1, borderColor: BORDER, borderRadius: 6, padding: 10 },
  sigTitle: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: TEXT_MAIN, marginBottom: 28 },
  sigLine: { borderTopWidth: 1, borderTopColor: BORDER, marginTop: 4 },
  sigName: { fontSize: 6.5, color: SLATE, marginTop: 4, textAlign: 'center' },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#F8FAFC', borderTopWidth: 1, borderTopColor: BORDER, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 5 },
  footerLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  footerDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: BLUE },
  footerText: { fontSize: 6.5, color: '#94A3B8' },
  footerRef: { fontSize: 6.5, color: SLATE, fontFamily: 'Helvetica-Bold' },
})

function getRows(planning: GroupePlanningRow[], jour: JourSemaine, statut: StatutFixe, extraStatuts?: StatutFixe[]) {
  const allStatuts = [statut, ...(extraStatuts ?? [])]
  return planning.filter(r => r.jour_semaine === jour && (allStatuts as string[]).includes(r.statut))
}

function hasAnySession(planning: GroupePlanningRow[], jour: JourSemaine) {
  return planning.some(r => r.jour_semaine === jour)
}

function anneeFormation() {
  const now = new Date()
  const y = now.getFullYear()
  return now.getMonth() >= 8 ? `${y}/${y + 1}` : `${y - 1}/${y}`
}

export function GroupePlanningPDF({
  groupeNom, poleNom, planning, totalSeances, totalHeures, dateGeneration, logoUrl,
}: GroupePlanningPDFProps) {
  const activeSlots = SLOTS.filter(slot => {
    const allStatuts = [slot.statut, ...(slot.extraStatuts ?? [])]
    return planning.some(r => (allStatuts as string[]).includes(r.statut))
  })
  const joursActifs = JOURS.filter(j => hasAnySession(planning, j)).length
  const refDoc = `EDT-GRP-${dateGeneration.replace(/[^0-9]/g, '')}-${groupeNom.replace(/\s+/g, '')}`

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={s.page}>

        <View style={s.headerBand}>
          {logoUrl ? (
            <View style={s.logoWrap}><PDFImage src={logoUrl} style={s.logoImg} /></View>
          ) : <View style={s.logoPlaceholder} />}
          <View style={s.orgBlock}>
            <Text style={s.orgName}>OFPPT</Text>
            <Text style={s.orgFull}>Office de la Formation Professionnelle et de la Promotion du Travail</Text>
            {poleNom && <Text style={[s.orgFull, { marginTop: 4, color: '#8BBFDB' }]}>Pôle : {poleNom}</Text>}
          </View>
          <View style={s.titleBlock}>
            <Text style={s.docTitle}>EMPLOI DU TEMPS — GROUPE DE FORMATION</Text>
            <Text style={s.docSubtitle}>Planning hebdomadaire fixe — Formation Professionnelle</Text>
          </View>
          <View style={s.anneeBlock}>
            <Text style={s.anneeLabel}>Année de formation</Text>
            <Text style={s.anneeValue}>{anneeFormation()}</Text>
          </View>
        </View>

        <View style={s.infoStrip}>
          <View style={s.infoCell}>
            <Text style={s.infoLabel}>Groupe de formation</Text>
            <Text style={s.infoValue}>{groupeNom}</Text>
          </View>
          {poleNom && (
            <View style={s.infoCell}>
              <Text style={s.infoLabel}>Pôle</Text>
              <Text style={s.infoValue}>{poleNom}</Text>
            </View>
          )}
          <View style={s.infoCell}>
            <Text style={s.infoLabel}>Type de planning</Text>
            <Text style={s.infoValue}>Hebdomadaire fixe</Text>
            <Text style={s.infoValueSub}>Lun – Sam · Cycle perpétuel</Text>
          </View>
          <View style={s.infoCellLast}>
            <Text style={s.infoLabel}>Généré le</Text>
            <Text style={s.infoValue}>{dateGeneration}</Text>
            <Text style={s.infoValueSub}>Réf. : {refDoc}</Text>
          </View>
        </View>

        <View style={s.tableWrap}>
          <View style={s.tableHeader}>
            <View style={s.slotColHead} />
            {JOURS.map(jour => (
              <View key={jour} style={s.dayColHead}>
                <View style={jour === 'Samedi' ? s.dayHeaderCellSam : s.dayHeaderCell}>
                  <Text style={s.dayHeaderText}>{JOURS_FULL[jour]}</Text>
                </View>
              </View>
            ))}
          </View>

          {activeSlots.map(slot => (
            <View key={slot.statut} style={s.slotRow}>
              <View style={s.slotLabel}>
                <View style={[s.slotDot, { backgroundColor: slot.dot }]} />
                <Text style={s.slotLabelText}>{slot.label}</Text>
                <Text style={s.slotTimeText}>{slot.time}</Text>
              </View>
              {JOURS.map(jour => {
                const rows = getRows(planning, jour, slot.statut, slot.extraStatuts)
                const dayHasSessions = hasAnySession(planning, jour)
                if (rows.length > 0) {
                  const row = rows[0]
                  return (
                    <View key={jour} style={[s.cell, { backgroundColor: slot.bg, borderColor: slot.border }]}>
                      <Text style={[s.cellTypeTag, { color: slot.fg }]}>{slot.label}</Text>
                      <Text style={[s.cellTime, { color: slot.fg }]}>{slot.time}</Text>
                      {row.formateur_nom
                        ? <Text style={[s.cellMain, { color: slot.fg }]}>{row.formateur_nom}</Text>
                        : <Text style={[s.cellMain, { color: '#94A3B8', fontFamily: 'Helvetica-Oblique' }]}>—</Text>
                      }
                    </View>
                  )
                }
                if (!dayHasSessions) {
                  return (
                    <View key={jour} style={s.cellRepos}>
                      <Text style={s.cellReposText}>Repos</Text>
                    </View>
                  )
                }
                return <View key={jour} style={s.cellEmpty} />
              })}
            </View>
          ))}

          {activeSlots.length === 0 && (
            <View style={s.emptyMsg}>
              <Text style={s.emptyText}>Aucune séance planifiée pour ce groupe</Text>
            </View>
          )}
        </View>

        <View style={s.summaryBar}>
          <View style={[s.summaryCell, { backgroundColor: BLUE_LIGHT }]}>
            <Text style={[s.summaryBigNum, { color: BLUE }]}>{totalSeances}</Text>
            <Text style={s.summaryCaption}>Séances / semaine</Text>
          </View>
          <View style={[s.summaryCell, { backgroundColor: '#F0FDF4' }]}>
            <Text style={[s.summaryBigNum, { color: GREEN }]}>{totalHeures}<Text style={[s.summaryNumUnit, { color: GREEN }]}>h</Text></Text>
            <Text style={s.summaryCaption}>Volume horaire hebdo</Text>
          </View>
          <View style={[s.summaryCell, { backgroundColor: '#FFFBEB' }]}>
            <Text style={[s.summaryBigNum, { color: GOLD }]}>{joursActifs}<Text style={[s.summaryNumUnit, { color: GOLD }]}>/6</Text></Text>
            <Text style={s.summaryCaption}>Jours de formation</Text>
          </View>
          <View style={[s.summaryCellLast, { flex: 3, alignItems: 'flex-start', paddingHorizontal: 16 }]}>
            <Text style={[s.summaryCaption, { marginBottom: 5 }]}>Légende des créneaux</Text>
            <View style={s.legendWrap}>
              {[
                { label: 'Présentiel Matin S1', color: '#3B82F6' },
                { label: 'Présentiel Matin S2', color: '#2563EB' },
                { label: 'Présentiel Après-midi S1', color: '#F97316' },
                { label: 'Présentiel Après-midi S2', color: '#F59E0B' },
                { label: 'FAD / Distanciel', color: '#7C3AED' },
              ].map(l => (
                <View key={l.label} style={s.legendItem}>
                  <View style={[s.legendDot, { backgroundColor: l.color }]} />
                  <Text style={s.legendText}>{l.label}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        <View style={s.sigSection}>
          <View style={s.sigBox}>
            <Text style={s.sigTitle}>Le / La Formateur(trice) Principal(e)</Text>
            <View style={s.sigLine} />
            <Text style={s.sigName}>Signature</Text>
          </View>
          <View style={s.sigBox}>
            <Text style={s.sigTitle}>Le Chef de Département</Text>
            <View style={s.sigLine} />
            <Text style={s.sigName}>Signature & Cachet</Text>
          </View>
          <View style={s.sigBox}>
            <Text style={s.sigTitle}>Le / La Directeur(trice)</Text>
            <View style={s.sigLine} />
            <Text style={s.sigName}>Signature & Cachet</Text>
          </View>
        </View>

        <View style={s.footer}>
          <View style={s.footerLeft}>
            <View style={s.footerDot} />
            <Text style={s.footerText}>OFPPT — Groupe : {groupeNom}</Text>
          </View>
          <Text style={s.footerRef}>{refDoc}</Text>
          <Text style={s.footerText}>{dateGeneration}</Text>
        </View>
      </Page>
    </Document>
  )
}
