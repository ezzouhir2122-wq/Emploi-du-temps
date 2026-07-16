// ============================================================
// lib/rotation.ts — Logique pure du cycle de 3 semaines
//
// RÈGLE MÉTIER : Le cycle ne se réinitialise JAMAIS.
// Il est calculé par rapport à une date d'ancrage unique (date_ancrage)
// correspondant à un Samedi de référence dont on connaît la semaine du cycle.
//
// Formule : semaineCycle(S) = ((ancrage - 1 + ΔSemaines) % 3) + 1
// où ΔSemaines = nombre de semaines entre date_ancrage et S (peut être négatif)
// ============================================================

import type { SemaineCycle } from '@/types/planning'

const MS_PAR_SEMAINE = 7 * 24 * 60 * 60 * 1000

/**
 * Calcule la semaine du cycle (1, 2 ou 3) pour un Samedi donné,
 * à partir d'une date d'ancrage et de sa semaine de cycle connue.
 *
 * Fonctionne dans les deux sens : passé et futur.
 * Ne dépend d'aucune logique annuelle — le cycle est perpétuel.
 */
export function getSemaineCycle(
  dateSamedi: Date,
  dateAncrage: Date,
  semaineCycleAncrage: SemaineCycle
): SemaineCycle {
  const deltaMs = dateSamedi.getTime() - dateAncrage.getTime()
  const deltaWeeks = Math.round(deltaMs / MS_PAR_SEMAINE)
  const position = ((semaineCycleAncrage - 1 + deltaWeeks) % 3 + 3) % 3
  return (position + 1) as SemaineCycle
}

/**
 * Retourne tous les Samedis d'un mois/année donné.
 * mois : 1–12
 */
export function getSamedisDuMois(annee: number, mois: number): Date[] {
  const samedis: Date[] = []
  const premier = new Date(annee, mois - 1, 1)
  const dernier = new Date(annee, mois, 0)

  for (let d = new Date(premier); d <= dernier; d.setDate(d.getDate() + 1)) {
    if (d.getDay() === 6) {
      samedis.push(new Date(d))
    }
  }
  return samedis
}

/**
 * Retourne tous les jours Lundi–Samedi d'un mois/année donné,
 * groupés par semaine ISO.
 */
export function getJoursDuMois(annee: number, mois: number): Date[] {
  const jours: Date[] = []
  const premier = new Date(annee, mois - 1, 1)
  const dernier = new Date(annee, mois, 0)

  for (let d = new Date(premier); d <= dernier; d.setDate(d.getDate() + 1)) {
    const dayOfWeek = d.getDay()
    // 1=Lundi ... 6=Samedi (0=Dimanche exclu)
    if (dayOfWeek >= 1 && dayOfWeek <= 6) {
      jours.push(new Date(d))
    }
  }
  return jours
}

/**
 * Convertit un numéro de jour JS (0=Dim...6=Sam) en libellé français.
 */
export function dayNumberToLabel(day: number): string {
  const labels = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
  return labels[day] ?? ''
}

/**
 * Parse une date ISO (YYYY-MM-DD) en objet Date UTC sans décalage horaire.
 * Évite le piège des fuseaux horaires lors du calcul de semaines.
 */
export function parseISODate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

/**
 * Formate une Date en string ISO YYYY-MM-DD.
 */
export function toISODateString(date: Date): string {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Retourne le premier Samedi d'un mois/année donné.
 * Utilisé pour calculer l'ancrage d'une nouvelle année de formation.
 */
export function getPremierSamediDuMois(annee: number, mois: number): Date {
  const premier = new Date(Date.UTC(annee, mois - 1, 1))
  const dayOfWeek = premier.getUTCDay()
  // 6 = Samedi
  const offsetJoursVersSamedi = dayOfWeek === 6 ? 0 : (6 - dayOfWeek + 7) % 7
  premier.setUTCDate(premier.getUTCDate() + offsetJoursVersSamedi)
  return premier
}

/**
 * Retourne le premier Samedi de Septembre de l'année donnée.
 * C'est la date d'ancrage standard pour une nouvelle année OFPPT.
 */
export function getAncrageSeptembre(annee: number): Date {
  return getPremierSamediDuMois(annee, 9)
}
