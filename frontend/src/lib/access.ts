export type ProfileStatut = 'en_attente' | 'valide' | 'refuse'
export type ProfileRole = 'admin' | 'formateur' | null

export interface Profile {
  statut: ProfileStatut
  role: ProfileRole
}

export interface AccessDecision {
  allow: boolean
  redirect?: string
}

/** Routes accessibles sans être connecté. */
export const ANON_ROUTES = ['/login', '/signup']

/** Routes de consultation autorisées à un formateur validé. */
export const FORMATEUR_ROUTES = ['/planning-fixe', '/vue-mensuelle']

const HOME = '/planning-fixe'
const PENDING = '/compte-en-attente'

function matches(pathname: string, routes: string[]): boolean {
  return routes.some(r => pathname === r || pathname.startsWith(r + '/'))
}

/** Décision quand aucun utilisateur n'est connecté. */
export function accessForAnon(pathname: string): AccessDecision {
  if (matches(pathname, ANON_ROUTES)) return { allow: true }
  return { allow: false, redirect: '/login' }
}

/** Décision quand un utilisateur est connecté (profil éventuellement null). */
export function accessForUser(profile: Profile | null, pathname: string): AccessDecision {
  const valide = profile?.statut === 'valide'

  if (!valide) {
    if (pathname === PENDING) return { allow: true }
    return { allow: false, redirect: PENDING }
  }

  // Validé : ne pas rester sur les pages publiques / d'attente
  if (matches(pathname, ANON_ROUTES) || pathname === PENDING) {
    return { allow: false, redirect: HOME }
  }

  if (profile!.role === 'admin') return { allow: true }

  // formateur
  if (matches(pathname, FORMATEUR_ROUTES)) return { allow: true }
  return { allow: false, redirect: HOME }
}
