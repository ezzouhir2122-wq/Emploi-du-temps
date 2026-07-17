// ============================================================
// Types métier partagés — OFPPT Planning
// ============================================================

export type JourSemaine = 'Lundi' | 'Mardi' | 'Mercredi' | 'Jeudi' | 'Vendredi' | 'Samedi'
export type StatutFixe =
  | 'Matin FP S1' | 'Matin FP S2'
  | 'Après-midi FP S1' | 'Après-midi FP S2'
  | 'FAD Matin' | 'FAD Après-midi'
  | 'Repos'
  // Legacy (rétrocompatibilité données existantes)
  | 'Matin' | 'Après-midi' | 'Distance' | 'Distance Matin' | 'Distance Après-midi'

export type StatutSamedi = 'Matin' | 'Après-midi' | 'Repos'
export type SemaineCycle = 1 | 2 | 3
export type TypeScenario = 'groups_fixed' | 'groups_rotating' | 'pool_mixed'

export const JOURS_SEMAINE: JourSemaine[] = [
  'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi',
]

// Statuts sélectionnables dans l'UI (hors legacy)
export const STATUTS_FIXES: StatutFixe[] = [
  'Matin FP S1', 'Matin FP S2',
  'Après-midi FP S1', 'Après-midi FP S2',
  'FAD Matin', 'FAD Après-midi',
]

// Statuts qui occupent physiquement la salle (compte dans les 24 sous-créneaux)
export const STATUTS_PHYSIQUES: StatutFixe[] = [
  'Matin FP S1', 'Matin FP S2', 'Après-midi FP S1', 'Après-midi FP S2',
  'Matin', 'Après-midi', // legacy
]

// Statuts qui comptent dans la masse horaire du formateur
export const STATUTS_TRAVAIL: StatutFixe[] = [
  'Matin FP S1', 'Matin FP S2', 'Après-midi FP S1', 'Après-midi FP S2',
  'FAD Matin', 'FAD Après-midi',
  'Matin', 'Après-midi', 'Distance', 'Distance Matin', 'Distance Après-midi', // legacy
]

// Horaires par statut
export const STATUT_TIMES: Partial<Record<StatutFixe, string>> = {
  'Matin FP S1':       '08h30–11h00',
  'Matin FP S2':       '11h00–13h30',
  'Après-midi FP S1':  '13h30–16h00',
  'Après-midi FP S2':  '16h00–18h30',
}

// Durée en heures de chaque séance
export const DUREE_SEANCE_H = 5

// ---- Entités ----

export interface Pole {
  id: string
  nom: string
  code: string | null
  description: string | null
  actif: boolean
  created_at: string
}

export interface Salle {
  id: string
  nom: string
  pole_id: string | null
  created_at: string
  pole?: Pole
}

export interface Groupe {
  id: string
  nom: string
  salle_id: string | null
  pole_id: string | null
  created_at: string
  salle?: Salle
  pole?: Pole
}

export interface Formateur {
  id: string
  nom: string
  matricule: string | null
  groupe_id: string | null
  pole_id: string | null
  actif: boolean
  created_at: string
  groupe?: Groupe
  pole?: Pole
}

export interface PlanningFixe {
  id: string
  formateur_id: string
  jour_semaine: JourSemaine
  statut: StatutFixe
  salle_id: string | null           // utilisé uniquement en Scénario C (pool_mixed)
  groupe_formation_id: string | null // groupe enseigné lors de cette séance
  formateur?: Formateur
}

export interface RotationSamediConfig {
  id: string
  groupe_id: string | null
  salle_id: string | null
  semaine_cycle: SemaineCycle
  formateur_id: string
  statut: StatutSamedi
  formateur?: Formateur
}

export interface CycleReference {
  id: string
  groupe_id: string | null
  salle_id: string | null
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
