import {
  getSemaineCycle,
  getJoursDuMois,
  parseISODate,
  dayNumberToLabel,
} from '@/lib/rotation'
import type {
  Formateur, PlanningFixe, RotationSamediConfig, CycleReference,
  CompteurFormateur, JourSemaine, StatutFixe,
} from '@/types/planning'
import { JOURS_SEMAINE, DUREE_SEANCE_H } from '@/types/planning'

interface EquiteParams {
  formateurs: Formateur[]
  planningFixe: PlanningFixe[]
  rotationConfig: RotationSamediConfig[]
  cycleReferences: CycleReference[]
  anneeDebut: number
  moisDebut: number
  anneeFin: number
  moisFin: number
}

export function calculerEquite(params: EquiteParams): CompteurFormateur[] {
  const { formateurs, planningFixe, rotationConfig, cycleReferences } = params

  const compteurs: Map<string, CompteurFormateur> = new Map(
    formateurs.map(f => [f.id, {
      formateur: f,
      matin: 0, apresmidi: 0, distance: 0, repos: 0,
      samedis_travailles: 0, total_heures: 0,
    }])
  )

  // Itérer mois par mois sur la période
  let a = params.anneeDebut
  let m = params.moisDebut

  while (a < params.anneeFin || (a === params.anneeFin && m <= params.moisFin)) {
    const jours = getJoursDuMois(a, m)

    for (const jour of jours) {
      const dayNum = jour.getDay()

      if (dayNum === 6) {
        // Samedi
        for (const formateur of formateurs) {
          const groupeId = formateur.groupe_id
          if (!groupeId) continue
          const ref = cycleReferences.find(c => c.groupe_id === groupeId)
          if (!ref) continue

          const ancrage = parseISODate(ref.date_ancrage)
          const samediUTC = new Date(Date.UTC(jour.getFullYear(), jour.getMonth(), jour.getDate()))
          const semaine = getSemaineCycle(samediUTC, ancrage, ref.semaine_cycle_ancrage)
          const cfg = rotationConfig.find(
            c => c.groupe_id === groupeId && c.semaine_cycle === semaine && c.formateur_id === formateur.id
          )
          const statut = cfg?.statut ?? 'Repos'
          const cpt = compteurs.get(formateur.id)!

          if (statut === 'Matin') { cpt.matin++; cpt.samedis_travailles++ }
          else if (statut === 'Après-midi') { cpt.apresmidi++; cpt.samedis_travailles++ }
          else { cpt.repos++ }
        }
      } else {
        // Lundi–Vendredi
        const jourLabel = dayNumberToLabel(dayNum) as JourSemaine
        if (!JOURS_SEMAINE.includes(jourLabel)) continue

        for (const formateur of formateurs) {
          const pf = planningFixe.find(
            p => p.formateur_id === formateur.id && p.jour_semaine === jourLabel
          )
          if (!pf) continue
          const statut = pf.statut as StatutFixe
          const cpt = compteurs.get(formateur.id)!

          if (statut === 'Matin') cpt.matin++
          else if (statut === 'Après-midi') cpt.apresmidi++
          else if (statut === 'Distance') cpt.distance++
          else cpt.repos++
        }
      }
    }

    m++
    if (m > 12) { m = 1; a++ }
  }

  // Calculer total_heures
  for (const cpt of compteurs.values()) {
    cpt.total_heures = (cpt.matin + cpt.apresmidi + cpt.distance) * DUREE_SEANCE_H
  }

  return Array.from(compteurs.values())
}
