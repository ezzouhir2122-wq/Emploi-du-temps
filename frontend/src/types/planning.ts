// ============================================================
// Types métier partagés — OFPPT Planning
// ============================================================

export type JourSemaine = 'Lundi' | 'Mardi' | 'Mercredi' | 'Jeudi' | 'Vendredi'
export type StatutFixe = 'Matin' | 'Après-midi' | 'Distance' | 'Repos'
export type StatutSamedi = 'Matin' | 'Après-midi' | 'Repos'
export type SemaineCycle = 1 | 2 | 3
export type TypeScenario = 'groups_fixed' | 'groups_rotating' | 'pool_mixed'

export const JOURS_SEMAINE: JourSemaine[] = [
  'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi',
]

export const STATUTS_FIXES: StatutFixe[] = ['Matin', 'Après-midi', 'Distance', 'Repos']

// Statuts qui occupent physiquement la salle
export const STATUTS_PHYSIQUES: StatutFixe[] = ['Matin', 'Après-midi']

// Statuts qui comptent dans la masse horaire du formateur
export const STATUTS_TRAVAIL: StatutFixe[] = ['Matin', 'Après-midi', 'Distance']

// Durée en heures de chaque séance
export const DUREE_SEANCE_H = 5

// ---- Entités ----

export interface Salle {
  id: string
  nom: string
  created_at: string
}

export interface Groupe {
  id: string
  nom: string
  salle_id: string | null
  created_at: string
  salle?: Salle
}

export interface Formateur {
  id: string
  nom: string
  groupe_id: string | null
  actif: boolean
  created_at: string
  groupe?: Groupe
}

export interface PlanningFixe {
  id: string
  formateur_id: string
  jour_semaine: JourSemaine
  statut: StatutFixe
  formateur?: Formateur
}

export interface RotationSamediConfig {
  id: string
  groupe_id: string
  semaine_cycle: SemaineCycle
  formateur_id: string
  statut: StatutSamedi
  formateur?: Formateur
}

export interface CycleReference {
  id: string
  groupe_id: string
  date_ancrage: string  // ISO date string YYYY-MM-DD
  semaine_cycle_ancrage: SemaineCycle
}

// ---- Scénarios ----

export interface ScenarioConfigGroupsFixed {
  type: 'groups_fixed'
}

export interface ScenarioConfigGroupsRotating {
  type: 'groups_rotating'
  rotation_weeks: number
}

export interface ScenarioConfigPoolMixed {
  type: 'pool_mixed'
  assignment_rule: 'round_robin' | string
}

export type ScenarioConfig =
  | ScenarioConfigGroupsFixed
  | ScenarioConfigGroupsRotating
  | ScenarioConfigPoolMixed

export interface Scenario {
  id: string
  nom: string
  description: string | null
  config: ScenarioConfig
  actif: boolean
  created_at: string
}

// ---- Vue calculée ----

export interface StatutJour {
  date: string           // ISO date string
  jour: JourSemaine | 'Samedi'
  statut: StatutFixe | StatutSamedi
  estSamedi: boolean
  semaineCycle?: SemaineCycle
}

export interface PlanningJourFormateur {
  formateur: Formateur
  jours: StatutJour[]
}

// ---- Suivi équité ----

export interface CompteurFormateur {
  formateur: Formateur
  matin: number
  apresmidi: number
  distance: number
  repos: number
  samedis_travailles: number   // Samedis avec statut Matin ou Après-midi
  total_heures: number         // (matin + apresmidi + distance) * DUREE_SEANCE_H
}
