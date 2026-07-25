'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Loader2, ArrowRight, CheckCircle2 } from 'lucide-react'

export default function SignupPage() {
  const [nom, setNom]           = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState<string | null>(null)
  const [loading, setLoading]   = useState(false)
  const [done, setDone]         = useState(false)
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { nom } },
    })

    setLoading(false)
    if (error) {
      setError("Impossible de créer le compte. Vérifiez l'email ou réessayez.")
      return
    }
    setDone(true)
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F4F7FB] px-6">
        <div className="w-full max-w-sm text-center">
          <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-[#0A2558] mb-2">Vérifiez votre email</h2>
          <p className="text-sm text-gray-500 mb-6">
            Un lien de confirmation vous a été envoyé. Après confirmation, votre compte
            devra être validé par un administrateur avant de pouvoir accéder à l&apos;application.
          </p>
          <Link href="/login" className="text-sm font-semibold text-[#005FAD] hover:underline">
            Retour à la connexion
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F4F7FB] px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-[#0A2558] mb-1 tracking-tight">Créer un compte</h2>
          <p className="text-sm text-gray-500">Votre accès sera validé par un administrateur.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700" htmlFor="nom">Nom complet</label>
            <input id="nom" type="text" value={nom} onChange={e => setNom(e.target.value)} required
              className="w-full h-11 rounded-xl border border-gray-200 bg-white px-4 text-sm outline-none focus:border-[#005FAD] focus:ring-2 focus:ring-[#005FAD]/15" />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700" htmlFor="email">Adresse email</label>
            <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email"
              className="w-full h-11 rounded-xl border border-gray-200 bg-white px-4 text-sm outline-none focus:border-[#005FAD] focus:ring-2 focus:ring-[#005FAD]/15" />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700" htmlFor="password">Mot de passe</label>
            <input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} autoComplete="new-password"
              className="w-full h-11 rounded-xl border border-gray-200 bg-white px-4 text-sm outline-none focus:border-[#005FAD] focus:ring-2 focus:ring-[#005FAD]/15" />
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <button type="submit" disabled={loading}
            className="w-full h-12 rounded-xl bg-[#005FAD] text-white font-semibold text-sm hover:bg-[#0050A0] active:scale-[0.98] disabled:opacity-70 flex items-center justify-center gap-2">
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Création…</> : <>Créer le compte <ArrowRight className="h-4 w-4" /></>}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          Déjà un compte ? <Link href="/login" className="font-semibold text-[#005FAD] hover:underline">Se connecter</Link>
        </p>
      </div>
    </div>
  )
}
