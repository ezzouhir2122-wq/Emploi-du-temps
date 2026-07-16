'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  CalendarDays,
  RotateCcw,
  CalendarRange,
  BarChart3,
  Layers,
  Settings,
  LogOut,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const navItems = [
  { href: '/planning-fixe',   label: 'Planning fixe',   icon: CalendarDays,  desc: 'Lun–Ven' },
  { href: '/rotation-samedi', label: 'Rotation Samedi', icon: RotateCcw,     desc: 'Cycle 3 sem.' },
  { href: '/vue-mensuelle',   label: 'Vue mensuelle',   icon: CalendarRange, desc: 'Calendrier' },
  { href: '/suivi-equite',    label: 'Suivi équité',    icon: BarChart3,     desc: 'Compteurs' },
  { href: '/scenarios',       label: 'Scénarios',       icon: Layers,        desc: 'A / B / C' },
  { href: '/parametres',      label: 'Paramètres',      icon: Settings,      desc: 'Config' },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="ofppt-diamond-bg flex h-screen w-64 flex-col shrink-0 overflow-hidden">

      {/* ── Logo OFPPT ── */}
      <div className="flex flex-col items-center gap-3 px-5 py-6 border-b border-white/10">
        <div className="relative flex items-center justify-center">
          {/* Glow halo derrière le logo */}
          <div className="absolute inset-0 rounded-full bg-[#00968C]/20 blur-xl scale-150" />
          <Image
            src="/ofppt-logo.svg"
            alt="Logo OFPPT"
            width={64}
            height={64}
            className="relative z-10 drop-shadow-lg"
            priority
          />
        </div>
        <div className="text-center">
          <p className="text-[11px] font-semibold text-white/90 uppercase tracking-widest leading-tight">
            OFPPT
          </p>
          <p className="text-[9.5px] text-white/50 tracking-wide mt-0.5 leading-tight">
            Gestion des Emplois du Temps
          </p>
        </div>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="px-3 pt-1 pb-2 text-[9.5px] font-semibold uppercase tracking-widest text-white/30">
          Menu principal
        </p>
        {navItems.map(({ href, label, icon: Icon, desc }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'nav-active group relative flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all duration-150',
                isActive
                  ? 'bg-white/10 text-white shadow-inner'
                  : 'text-white/60 hover:bg-white/5 hover:text-white/90'
              )}
            >
              {/* Active left bar */}
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-full bg-[#00968C]" />
              )}

              {/* Icon container */}
              <span className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors',
                isActive
                  ? 'bg-[#00968C] text-white shadow-md'
                  : 'bg-white/5 text-white/50 group-hover:bg-white/10 group-hover:text-white/80'
              )}>
                <Icon className="h-4 w-4" />
              </span>

              {/* Label */}
              <div className="min-w-0">
                <p className={cn('text-sm font-medium leading-none truncate',
                  isActive ? 'text-white' : 'text-white/70'
                )}>
                  {label}
                </p>
                <p className="text-[10px] text-white/35 mt-0.5">{desc}</p>
              </div>
            </Link>
          )
        })}
      </nav>

      {/* ── Footer ── */}
      <div className="border-t border-white/10 p-3 space-y-1">
        {/* Bandeau OFPPT */}
        <div className="mx-1 mb-2 rounded-md bg-[#00968C]/15 border border-[#00968C]/25 px-3 py-2">
          <p className="text-[10px] text-[#00968C] font-medium">مكتب التكوين المهني</p>
          <p className="text-[9px] text-white/35 mt-0.5">وإنعاش الشغل — OFPPT</p>
        </div>

        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-white/50 transition-colors hover:bg-white/5 hover:text-red-400"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white/5">
            <LogOut className="h-4 w-4" />
          </span>
          <span className="text-sm font-medium">Déconnexion</span>
        </button>
      </div>
    </aside>
  )
}
