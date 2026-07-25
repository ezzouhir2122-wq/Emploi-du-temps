import { describe, it, expect } from 'vitest'
import { accessForUser, accessForAnon, type Profile } from '@/lib/access'

const enAttente: Profile = { statut: 'en_attente', role: null }
const refuse: Profile    = { statut: 'refuse', role: null }
const admin: Profile     = { statut: 'valide', role: 'admin' }
const formateur: Profile = { statut: 'valide', role: 'formateur' }

describe('accessForAnon', () => {
  it('laisse passer /login et /signup', () => {
    expect(accessForAnon('/login').allow).toBe(true)
    expect(accessForAnon('/signup').allow).toBe(true)
  })
  it('redirige toute route protégée vers /login', () => {
    expect(accessForAnon('/planning-fixe')).toEqual({ allow: false, redirect: '/login' })
    expect(accessForAnon('/compte-en-attente')).toEqual({ allow: false, redirect: '/login' })
  })
})

describe('accessForUser — non validé', () => {
  it('force /compte-en-attente pour en_attente', () => {
    expect(accessForUser(enAttente, '/planning-fixe')).toEqual({ allow: false, redirect: '/compte-en-attente' })
  })
  it('laisse /compte-en-attente accessible', () => {
    expect(accessForUser(enAttente, '/compte-en-attente').allow).toBe(true)
  })
  it('traite refuse comme non validé', () => {
    expect(accessForUser(refuse, '/planning-fixe')).toEqual({ allow: false, redirect: '/compte-en-attente' })
  })
  it('traite un profil manquant comme non validé', () => {
    expect(accessForUser(null, '/planning-fixe')).toEqual({ allow: false, redirect: '/compte-en-attente' })
  })
})

describe('accessForUser — admin', () => {
  it('accède à tout', () => {
    expect(accessForUser(admin, '/parametres/utilisateurs').allow).toBe(true)
    expect(accessForUser(admin, '/planning-fixe').allow).toBe(true)
  })
  it('quitte les pages publiques vers /planning-fixe', () => {
    expect(accessForUser(admin, '/login')).toEqual({ allow: false, redirect: '/planning-fixe' })
    expect(accessForUser(admin, '/compte-en-attente')).toEqual({ allow: false, redirect: '/planning-fixe' })
  })
})

describe('accessForUser — formateur', () => {
  it('accède à ses routes de consultation', () => {
    expect(accessForUser(formateur, '/planning-fixe').allow).toBe(true)
    expect(accessForUser(formateur, '/vue-mensuelle').allow).toBe(true)
  })
  it('est renvoyé de toute route admin vers /planning-fixe', () => {
    expect(accessForUser(formateur, '/parametres/utilisateurs')).toEqual({ allow: false, redirect: '/planning-fixe' })
    expect(accessForUser(formateur, '/suivi-equite')).toEqual({ allow: false, redirect: '/planning-fixe' })
  })
})
