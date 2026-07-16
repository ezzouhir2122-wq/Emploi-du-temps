'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Eye, EyeOff, ArrowRight, Loader2 } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [loading, setLoading]   = useState(false)
  const router   = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Email ou mot de passe incorrect.')
      setLoading(false)
      return
    }
    router.push('/planning-fixe')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex">

      {/* ── Panneau gauche — OFPPT Brand ── */}
      <div className="ofppt-diamond-bg hidden lg:flex lg:w-[52%] flex-col relative overflow-hidden">

        {/* Losanges décoratifs géants en fond */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-24 -right-24 w-96 h-96 rounded-[4rem] rotate-12 border-2 border-white/5" />
          <div className="absolute -top-12 -right-12 w-72 h-72 rounded-[3rem] rotate-12 border border-white/5" />
          <div className="absolute bottom-20 -left-32 w-80 h-80 rounded-[3rem] -rotate-12 border-2 border-[#00968C]/20" />
          <div className="absolute bottom-40 -left-16 w-56 h-56 rounded-[2rem] -rotate-12 border border-[#00968C]/15" />
          {/* Teal gradient blob */}
          <div className="absolute top-1/3 right-1/4 w-64 h-64 rounded-full bg-[#00968C]/10 blur-3xl" />
          <div className="absolute bottom-1/4 left-1/3 w-48 h-48 rounded-full bg-[#005FAD]/15 blur-3xl" />
        </div>

        <div className="relative z-10 flex flex-col h-full px-14 py-12">

          {/* Logo + titre */}
          <div className="flex items-center gap-4 mb-auto">
            <Image src="/ofppt-logo.svg" alt="OFPPT" width={52} height={52} className="drop-shadow-lg" />
            <div>
              <p className="text-white font-bold text-lg tracking-tight leading-none">OFPPT</p>
              <p className="text-white/50 text-xs mt-0.5 tracking-wide">مكتب التكوين المهني وإنعاش الشغل</p>
            </div>
          </div>

          {/* Headline */}
          <div className="my-auto">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#00968C]/30 bg-[#00968C]/10 px-3 py-1 mb-6">
              <span className="h-1.5 w-1.5 rounded-full bg-[#00968C] animate-pulse" />
              <span className="text-[#00968C] text-xs font-medium tracking-wide">Système de gestion</span>
            </div>

            <h1 className="text-4xl font-bold text-white leading-tight mb-4">
              Gestion des<br />
              <span className="text-[#00968C]">Emplois du Temps</span>
            </h1>

            <p className="text-white/50 text-sm leading-relaxed max-w-xs">
              Planification, rotation Samedi et suivi d&apos;équité — pour vos formateurs OFPPT.
            </p>

            {/* Feature pills */}
            <div className="flex flex-wrap gap-2 mt-8">
              {['Planning fixe Lun–Ven', 'Rotation Samedi auto', 'Suivi équité', 'Export PDF/Excel'].map(f => (
                <span key={f} className="text-[11px] text-white/60 bg-white/5 border border-white/10 rounded-full px-3 py-1">
                  {f}
                </span>
              ))}
            </div>
          </div>

          {/* Footer brand */}
          <div className="mt-auto pt-8 border-t border-white/10">
            <p className="text-white/25 text-[11px] tracking-wider uppercase">
              الطريق الأثير للمستقبل
            </p>
          </div>
        </div>
      </div>

      {/* ── Panneau droit — Formulaire ── */}
      <div className="flex-1 flex items-center justify-center bg-[#F4F7FB] px-6 lg:px-16">
        <div className="w-full max-w-sm">

          {/* Logo mobile uniquement */}
          <div className="flex lg:hidden items-center gap-3 mb-10">
            <Image src="/ofppt-logo.svg" alt="OFPPT" width={40} height={40} />
            <p className="font-bold text-[#0A2558]">OFPPT Planning</p>
          </div>

          {/* Header */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-[#0A2558] mb-1 tracking-tight">
              Connexion
            </h2>
            <p className="text-sm text-gray-500">
              Accès réservé aux administrateurs
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Email */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700" htmlFor="email">
                Adresse email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="admin@ofppt.ma"
                className="w-full h-11 rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-all focus:border-[#005FAD] focus:ring-2 focus:ring-[#005FAD]/15"
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700" htmlFor="password">
                Mot de passe
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full h-11 rounded-xl border border-gray-200 bg-white px-4 pr-11 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-all focus:border-[#005FAD] focus:ring-2 focus:ring-[#005FAD]/15"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full h-12 rounded-xl bg-[#005FAD] text-white font-semibold text-sm overflow-hidden transition-all hover:bg-[#0050A0] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#005FAD]/40"
            >
              <span className="flex items-center justify-center gap-2">
                {loading ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Connexion en cours…</>
                ) : (
                  <> Se connecter <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></>
                )}
              </span>
              {/* Teal shimmer on hover */}
              <span className="absolute inset-0 bg-gradient-to-r from-[#00968C]/0 via-[#00968C]/10 to-[#00968C]/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 ease-in-out pointer-events-none" />
            </button>
          </form>

          {/* Footer */}
          <p className="mt-8 text-center text-xs text-gray-400">
            OFPPT — Office de la Formation Professionnelle et de la Promotion du Travail
          </p>
        </div>
      </div>
    </div>
  )
}
