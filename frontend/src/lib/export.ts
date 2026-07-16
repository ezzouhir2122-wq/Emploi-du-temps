import * as XLSX from 'xlsx'
import type {
  Formateur, Salle, Groupe, PlanningFixe,
  RotationSamediConfig, CycleReference, StatutFixe, StatutSamedi, JourSemaine,
} from '@/types/planning'
import { JOURS_SEMAINE } from '@/types/planning'
import { getSemaineCycle, getJoursDuMois, parseISODate, toISODateString, dayNumberToLabel } from './rotation'

interface ExportParams {
  annee: number
  mois: number
  salles: Salle[]
  groupes: Groupe[]
  formateurs: Formateur[]
  planningFixe: PlanningFixe[]
  rotationConfig: RotationSamediConfig[]
  cycleReferences: CycleReference[]
}

const MOIS_LABELS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]

function getStatutPourJour(
  formateurId: string,
  groupeId: string | null,
  date: Date,
  planningFixe: PlanningFixe[],
  rotationConfig: RotationSamediConfig[],
  cycleReferences: CycleReference[]
): StatutFixe | StatutSamedi | '—' {
  const dayNum = date.getDay()

  if (dayNum === 6) {
    if (!groupeId) return 'Repos'
    const ref = cycleReferences.find(c => c.groupe_id === groupeId)
    if (!ref) return '—'
    const ancrage = parseISODate(ref.date_ancrage)
    const samediUTC = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
    const semaine = getSemaineCycle(samediUTC, ancrage, ref.semaine_cycle_ancrage)
    return rotationConfig.find(
      c => c.groupe_id === groupeId && c.semaine_cycle === semaine && c.formateur_id === formateurId
    )?.statut ?? 'Repos'
  }

  const jourLabel = dayNumberToLabel(dayNum) as JourSemaine
  if (!JOURS_SEMAINE.includes(jourLabel)) return '—'
  return planningFixe.find(
    p => p.formateur_id === formateurId && p.jour_semaine === jourLabel
  )?.statut ?? '—'
}

export function exportExcel(params: ExportParams) {
  const { annee, mois } = params
  const jours = getJoursDuMois(annee, mois)
  const titre = `${MOIS_LABELS[mois - 1]} ${annee}`
  const wb = XLSX.utils.book_new()

  for (const salle of params.salles) {
    const groupe = params.groupes.find(g => g.salle_id === salle.id)
    const formateurs = params.formateurs.filter(f => f.groupe_id === groupe?.id)

    const headers = [
      'Formateur',
      ...jours.map(j => `${dayNumberToLabel(j.getDay()).slice(0, 3)} ${j.getDate()}`),
    ]

    const rows = formateurs.map(f => [
      f.nom,
      ...jours.map(j =>
        getStatutPourJour(f.id, f.groupe_id, j, params.planningFixe, params.rotationConfig, params.cycleReferences)
      ),
    ])

    const wsData = [headers, ...rows]
    const ws = XLSX.utils.aoa_to_sheet(wsData)
    ws['!cols'] = [{ wch: 16 }, ...jours.map(() => ({ wch: 12 }))]
    XLSX.utils.book_append_sheet(wb, ws, salle.nom)
  }

  XLSX.writeFile(wb, `Planning_${titre.replace(' ', '_')}.xlsx`)
}

export async function exportPDF(params: ExportParams) {
  // Import dynamique pour éviter le SSR
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const { annee, mois } = params
  const jours = getJoursDuMois(annee, mois)
  const titre = `${MOIS_LABELS[mois - 1]} ${annee}`

  const doc = new jsPDF({ orientation: 'landscape', format: 'a4' })

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text(`Planning OFPPT — ${titre}`, 14, 15)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')}`, 14, 22)

  let yOffset = 28

  for (const salle of params.salles) {
    const groupe = params.groupes.find(g => g.salle_id === salle.id)
    const formateurs = params.formateurs.filter(f => f.groupe_id === groupe?.id)

    if (yOffset > 150) {
      doc.addPage()
      yOffset = 15
    }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text(`${salle.nom}${groupe ? ` — ${groupe.nom}` : ''}`, 14, yOffset)
    yOffset += 4

    const headers = [
      'Formateur',
      ...jours.map(j => `${dayNumberToLabel(j.getDay()).slice(0, 3)}\n${j.getDate()}`),
    ]

    const rows = formateurs.map(f => [
      f.nom,
      ...jours.map(j =>
        getStatutPourJour(f.id, f.groupe_id, j, params.planningFixe, params.rotationConfig, params.cycleReferences)
      ),
    ])

    autoTable(doc, {
      head: [headers],
      body: rows,
      startY: yOffset,
      styles: { fontSize: 6, cellPadding: 1.5 },
      headStyles: { fillColor: [71, 85, 105], textColor: 255, fontSize: 6 },
      columnStyles: { 0: { cellWidth: 20, fontStyle: 'bold' } },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index > 0) {
          const val = String(data.cell.raw)
          if (val === 'Matin') data.cell.styles.fillColor = [219, 234, 254]
          else if (val === 'Après-midi') data.cell.styles.fillColor = [254, 243, 199]
          else if (val === 'Distance') data.cell.styles.fillColor = [237, 233, 254]
          else if (val === 'Repos') data.cell.styles.fillColor = [243, 244, 246]
        }
      },
    })

    yOffset = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY + 8
  }

  doc.save(`Planning_${titre.replace(' ', '_')}.pdf`)
}
