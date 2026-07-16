import * as XLSX from 'xlsx'
import type {
  Formateur, Salle, Groupe, Pole, PlanningFixe,
  RotationSamediConfig, CycleReference, JourSemaine,
} from '@/types/planning'
import { JOURS_SEMAINE } from '@/types/planning'
import { getMoisCycle, getJoursDuMois, getSamedisDuMois, parseISODate, dayNumberToLabel } from './rotation'

export type ExportType = 'formateur' | 'salle' | 'pole' | 'groupe'

export interface ExportParams {
  annee: number
  mois: number
  salles: Salle[]
  groupes: Groupe[]
  poles?: Pole[]
  formateurs: Formateur[]
  planningFixe: PlanningFixe[]
  rotationConfig: RotationSamediConfig[]
  cycleReferences: CycleReference[]
}

interface SheetData {
  title: string
  headers: string[]
  rows: string[][]
}

const MOIS_LABELS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]

// ── Calcul statut d'un formateur pour un jour donné ──────────

function getStatutJour(
  formateurId: string,
  groupeId: string | null,
  date: Date,
  planningFixe: PlanningFixe[],
  rotationConfig: RotationSamediConfig[],
  cycleReferences: CycleReference[]
): string {
  const dayNum = date.getDay()
  if (dayNum === 0) return '—'    // Dimanche
  if (dayNum === 6) {             // Samedi
    if (!groupeId) return 'Repos'
    const ref = cycleReferences.find(c => c.groupe_id === groupeId)
    if (!ref) return '—'
    const ancrage = parseISODate(ref.date_ancrage)
    const pos = getMoisCycle(date.getFullYear(), date.getMonth() + 1, ancrage, ref.semaine_cycle_ancrage)
    return rotationConfig.find(
      c => c.groupe_id === groupeId && c.semaine_cycle === pos && c.formateur_id === formateurId
    )?.statut ?? 'Repos'
  }
  const jourLabel = dayNumberToLabel(dayNum) as JourSemaine
  if (!JOURS_SEMAINE.includes(jourLabel)) return '—'
  return planningFixe.find(
    p => p.formateur_id === formateurId && p.jour_semaine === jourLabel
  )?.statut ?? '—'
}

// ── Builders : produisent des SheetData[][] par type ─────────

function buildParFormateur(p: ExportParams): SheetData[] {
  const jours = getJoursDuMois(p.annee, p.mois)
  const dayHeaders = jours.map(j => `${dayNumberToLabel(j.getDay()).slice(0, 3)} ${j.getDate()}`)

  return p.formateurs.map(f => ({
    title: f.nom,
    headers: ['Formateur', ...dayHeaders],
    rows: [[
      f.nom,
      ...jours.map(j => getStatutJour(f.id, f.groupe_id, j, p.planningFixe, p.rotationConfig, p.cycleReferences)),
    ]],
  }))
}

function buildParSalle(p: ExportParams): SheetData[] {
  const jours = getJoursDuMois(p.annee, p.mois)
  const dayHeaders = jours.map(j => `${dayNumberToLabel(j.getDay()).slice(0, 3)} ${j.getDate()}`)

  return p.salles.map(salle => {
    const groupe = p.groupes.find(g => g.salle_id === salle.id)
    const formateurs = p.formateurs.filter(f => f.groupe_id === groupe?.id)
    return {
      title: salle.nom,
      headers: ['Formateur', ...dayHeaders],
      rows: formateurs.map(f => [
        f.nom,
        ...jours.map(j => getStatutJour(f.id, f.groupe_id, j, p.planningFixe, p.rotationConfig, p.cycleReferences)),
      ]),
    }
  })
}

function buildParPole(p: ExportParams): SheetData[] {
  const jours = getJoursDuMois(p.annee, p.mois)
  const dayHeaders = jours.map(j => `${dayNumberToLabel(j.getDay()).slice(0, 3)} ${j.getDate()}`)

  const sheets: SheetData[] = []

  // Formateurs sans pôle → feuille "Non affecté"
  const polesActifs = [...(p.poles ?? []), { id: '__none__', nom: 'Non affecté', code: null, description: null, actif: true, created_at: '' }]

  for (const pole of polesActifs) {
    const formateurs = pole.id === '__none__'
      ? p.formateurs.filter(f => !f.pole_id)
      : p.formateurs.filter(f => f.pole_id === pole.id)
    if (formateurs.length === 0) continue
    sheets.push({
      title: pole.nom.slice(0, 31),  // Excel sheet name max 31 chars
      headers: ['Formateur', 'Matricule', ...dayHeaders],
      rows: formateurs.map(f => [
        f.nom,
        f.matricule ?? '—',
        ...jours.map(j => getStatutJour(f.id, f.groupe_id, j, p.planningFixe, p.rotationConfig, p.cycleReferences)),
      ]),
    })
  }

  return sheets
}

function buildParGroupe(p: ExportParams): SheetData[] {
  const samedis = getSamedisDuMois(p.annee, p.mois)

  return p.groupes.map(groupe => {
    const formateursGroupe = p.formateurs.filter(f => f.groupe_id === groupe.id)
    if (formateursGroupe.length === 0) return null

    const ref = p.cycleReferences.find(c => c.groupe_id === groupe.id)
    const ancrage = ref ? parseISODate(ref.date_ancrage) : null
    const pos = ancrage ? getMoisCycle(p.annee, p.mois, ancrage, ref!.semaine_cycle_ancrage) : null

    // Planning fixe Lun–Ven (même pour tous — ce sont leurs formateurs)
    const jourHeaders = JOURS_SEMAINE
    const headers = ['Formateur', ...jourHeaders, ...samedis.map(s => `Sam ${s.getUTCDate()}`)]
    const rows = formateursGroupe.map(f => {
      const jourStatuts = jourHeaders.map(jour =>
        p.planningFixe.find(pf => pf.formateur_id === f.id && pf.jour_semaine === jour)?.statut ?? '—'
      )
      const samediStatuts = samedis.map(s => {
        if (!pos) return '—'
        return p.rotationConfig.find(
          c => c.groupe_id === groupe.id && c.semaine_cycle === pos && c.formateur_id === f.id
        )?.statut ?? 'Repos'
      })
      return [f.nom, ...jourStatuts, ...samediStatuts]
    })

    return { title: groupe.nom.slice(0, 31), headers, rows }
  }).filter(Boolean) as SheetData[]
}

function getBuilder(type: ExportType) {
  if (type === 'formateur') return buildParFormateur
  if (type === 'salle')     return buildParSalle
  if (type === 'pole')      return buildParPole
  return buildParGroupe
}

// ── Export Excel ─────────────────────────────────────────────

export function exportExcel(params: ExportParams, type: ExportType = 'salle') {
  const sheets = getBuilder(type)(params)
  const titre = `${MOIS_LABELS[params.mois - 1]}_${params.annee}`
  const wb = XLSX.utils.book_new()

  for (const sheet of sheets) {
    const wsData = [sheet.headers, ...sheet.rows]
    const ws = XLSX.utils.aoa_to_sheet(wsData)
    ws['!cols'] = sheet.headers.map((_, i) => ({ wch: i === 0 ? 20 : i === 1 && type === 'pole' ? 12 : 10 }))

    // Coloration en-tête
    const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1')
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r: 0, c })]
      if (cell) {
        cell.s = { fill: { fgColor: { rgb: '0A2558' } }, font: { color: { rgb: 'FFFFFF' }, bold: true }, alignment: { horizontal: 'center' } }
      }
    }
    XLSX.utils.book_append_sheet(wb, ws, sheet.title)
  }

  const typeLabel = { formateur: 'Formateurs', salle: 'Salles', pole: 'Poles', groupe: 'Groupes' }[type]
  XLSX.writeFile(wb, `EDT_${typeLabel}_${titre}.xlsx`)
}

// ── Export CSV ───────────────────────────────────────────────

export function exportCSV(params: ExportParams, type: ExportType = 'salle') {
  const sheets = getBuilder(type)(params)
  const titre = `${MOIS_LABELS[params.mois - 1]}_${params.annee}`
  const typeLabel = { formateur: 'Formateurs', salle: 'Salles', pole: 'Poles', groupe: 'Groupes' }[type]

  const csvLines: string[] = []
  for (const sheet of sheets) {
    csvLines.push(`### ${sheet.title}`)
    csvLines.push(sheet.headers.map(h => `"${h}"`).join(';'))
    for (const row of sheet.rows) {
      csvLines.push(row.map(v => `"${v}"`).join(';'))
    }
    csvLines.push('')
  }

  const blob = new Blob(['﻿' + csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `EDT_${typeLabel}_${titre}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Export PDF ───────────────────────────────────────────────

export async function exportPDF(params: ExportParams, type: ExportType = 'salle') {
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const sheets = getBuilder(type)(params)
  const titre = `${MOIS_LABELS[params.mois - 1]} ${params.annee}`
  const typeLabel = { formateur: 'par Formateur', salle: 'par Salle', pole: 'par Pôle', groupe: 'par Groupe' }[type]
  const typeLabel2 = { formateur: 'Formateurs', salle: 'Salles', pole: 'Poles', groupe: 'Groupes' }[type]

  const doc = new jsPDF({ orientation: 'landscape', format: 'a4' })
  let firstPage = true

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text(`Emploi du Temps OFPPT — ${titre} (${typeLabel})`, 14, 15)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')}`, 14, 22)

  let yOffset = 28

  for (const sheet of sheets) {
    if (!firstPage) {
      doc.addPage()
      yOffset = 15
    }
    firstPage = false

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text(sheet.title, 14, yOffset)
    yOffset += 4

    autoTable(doc, {
      head: [sheet.headers],
      body: sheet.rows,
      startY: yOffset,
      styles: { fontSize: 6, cellPadding: 1.5 },
      headStyles: { fillColor: [10, 37, 88], textColor: 255, fontSize: 6 },
      columnStyles: { 0: { cellWidth: 22, fontStyle: 'bold' } },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index > 0) {
          const val = String(data.cell.raw)
          if (val === 'Matin')       data.cell.styles.fillColor = [219, 234, 254]
          else if (val === 'Après-midi') data.cell.styles.fillColor = [254, 243, 199]
          else if (val === 'Distance')   data.cell.styles.fillColor = [237, 233, 254]
          else if (val === 'Repos')      data.cell.styles.fillColor = [243, 244, 246]
        }
      },
    })

    yOffset = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY + 8
  }

  doc.save(`EDT_${typeLabel2}_${titre.replace(' ', '_')}.pdf`)
}
