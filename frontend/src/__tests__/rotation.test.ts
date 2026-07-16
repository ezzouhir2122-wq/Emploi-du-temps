import { describe, it, expect } from 'vitest'
import {
  getSemaineCycle,
  getSamedisDuMois,
  getPremierSamediDuMois,
  getAncrageSeptembre,
  parseISODate,
  toISODateString,
} from '@/lib/rotation'

// Date d'ancrage de référence : 07/09/2024 = Samedi, semaine 1 du cycle
const ANCRAGE = parseISODate('2024-09-07')
const ANCRAGE_CYCLE: 1 | 2 | 3 = 1

describe('getSemaineCycle', () => {
  it('retourne 1 pour la date d\'ancrage elle-même', () => {
    expect(getSemaineCycle(ANCRAGE, ANCRAGE, ANCRAGE_CYCLE)).toBe(1)
  })

  it('retourne 2 pour le Samedi suivant (+1 semaine)', () => {
    const s = parseISODate('2024-09-14')
    expect(getSemaineCycle(s, ANCRAGE, ANCRAGE_CYCLE)).toBe(2)
  })

  it('retourne 3 pour +2 semaines', () => {
    const s = parseISODate('2024-09-21')
    expect(getSemaineCycle(s, ANCRAGE, ANCRAGE_CYCLE)).toBe(3)
  })

  it('retourne 1 pour +3 semaines (bouclage)', () => {
    const s = parseISODate('2024-09-28')
    expect(getSemaineCycle(s, ANCRAGE, ANCRAGE_CYCLE)).toBe(1)
  })

  it('ne se réinitialise pas en changeant de mois', () => {
    // +4 semaines = semaine 2
    const s = parseISODate('2024-10-05')
    expect(getSemaineCycle(s, ANCRAGE, ANCRAGE_CYCLE)).toBe(2)
  })

  it('ne se réinitialise pas en changeant d\'année', () => {
    // 07/09/2024 = ancrage semaine 1
    // Calcul : 07/09/2024 -> 01/03/2025 = 25 semaines plus tard
    // 25 % 3 = 1, donc semaine 2
    const s = parseISODate('2025-03-01')
    const deltaWeeks = Math.round((s.getTime() - ANCRAGE.getTime()) / (7 * 24 * 60 * 60 * 1000))
    const expected = ((ANCRAGE_CYCLE - 1 + deltaWeeks) % 3 + 3) % 3 + 1
    expect(getSemaineCycle(s, ANCRAGE, ANCRAGE_CYCLE)).toBe(expected)
  })

  it('fonctionne en sens inverse (date antérieure à l\'ancrage)', () => {
    // -1 semaine par rapport à l'ancrage = semaine 3 (cycle rétroactif)
    const s = parseISODate('2024-08-31')
    expect(getSemaineCycle(s, ANCRAGE, ANCRAGE_CYCLE)).toBe(3)
  })

  it('fonctionne avec semaine d\'ancrage = 2', () => {
    const s = parseISODate('2024-09-14') // +1 semaine
    expect(getSemaineCycle(s, ANCRAGE, 2)).toBe(3)
  })

  it('fonctionne avec semaine d\'ancrage = 3', () => {
    const s = parseISODate('2024-09-14') // +1 semaine
    expect(getSemaineCycle(s, ANCRAGE, 3)).toBe(1)
  })
})

describe('getSamedisDuMois', () => {
  it('retourne les bons Samedis pour Septembre 2024', () => {
    const samedis = getSamedisDuMois(2024, 9)
    const dates = samedis.map(d => d.getDate())
    expect(dates).toEqual([7, 14, 21, 28])
  })

  it('retourne les bons Samedis pour Octobre 2024', () => {
    const samedis = getSamedisDuMois(2024, 10)
    const dates = samedis.map(d => d.getDate())
    expect(dates).toEqual([5, 12, 19, 26])
  })

  it('retourne les bons Samedis pour Février 2025 (5 samedis)', () => {
    const samedis = getSamedisDuMois(2025, 2)
    expect(samedis).toHaveLength(4) // Fév 2025 : 4 samedis (1,8,15,22)
  })
})

describe('getPremierSamediDuMois', () => {
  it('retourne 07/09/2024 pour Septembre 2024', () => {
    const d = getPremierSamediDuMois(2024, 9)
    expect(toISODateString(d)).toBe('2024-09-07')
  })

  it('retourne 05/10/2024 pour Octobre 2024', () => {
    const d = getPremierSamediDuMois(2024, 10)
    expect(toISODateString(d)).toBe('2024-10-05')
  })

  it('retourne 01/03/2025 pour Mars 2025 (commence un Samedi)', () => {
    const d = getPremierSamediDuMois(2025, 3)
    expect(toISODateString(d)).toBe('2025-03-01')
  })
})

describe('getAncrageSeptembre', () => {
  it('retourne 07/09/2024 pour l\'année 2024', () => {
    const d = getAncrageSeptembre(2024)
    expect(toISODateString(d)).toBe('2024-09-07')
  })

  it('retourne 06/09/2025 pour l\'année 2025', () => {
    const d = getAncrageSeptembre(2025)
    expect(toISODateString(d)).toBe('2025-09-06')
  })
})

describe('parseISODate', () => {
  it('parse sans décalage de fuseau horaire', () => {
    const d = parseISODate('2024-09-07')
    expect(d.getUTCFullYear()).toBe(2024)
    expect(d.getUTCMonth()).toBe(8) // 0-indexé
    expect(d.getUTCDate()).toBe(7)
  })
})
