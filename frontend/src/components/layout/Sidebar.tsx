'use client'

import React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  CalendarDays,
  CalendarRange,
  BarChart3,
  Layers,
  Settings,
  Download,
  LogOut,
  BookOpen,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const navItems = [
  { href: '/planning-fixe',        label: 'Planning Hebdomadaire', icon: CalendarDays,  desc: 'Lun–Sam · Rotation incluse', group: 'planning' },
  { href: '/vue-mensuelle',        label: 'Vue mensuelle',         icon: CalendarRange, desc: 'Calendrier',                  group: 'planning' },
  { href: '/suivi-equite',         label: 'Suivi équité',          icon: BarChart3,     desc: 'Compteurs',                   group: 'planning' },
  { href: '/scenarios',            label: 'Scénarios',             icon: Layers,        desc: 'A / B / C',                   group: 'planning' },
  { href: '/exports',              label: 'Exports',               icon: Download,      desc: 'Excel / CSV / PDF',           group: 'planning' },
  { href: '/affectation-modules',  label: 'Affectation modules',   icon: BookOpen,      desc: 'Gestion pédagogique',         group: 'pedagogique' },
  { href: '/parametres',           label: 'Paramètres',            icon: Settings,      desc: 'Config',                      group: 'config' },
]

function NavLink({ href, label, icon: Icon, desc, pathname }: {
  href: string; label: string; icon: React.ElementType; desc: string; pathname: string
}) {
  const isActive = pathname === href || pathname.startsWith(href + '/')
  return (
    <Link
      href={href}
      className={cn(
        'nav-active group relative flex items-center gap-2 rounded-lg px-2 py-2 transition-all duration-150',
        isActive ? 'bg-white/10 text-white shadow-inner' : 'text-white/60 hover:bg-white/5 hover:text-white/90'
      )}
    >
      {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-[#00968C]" />}
      <span className={cn(
        'flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors',
        isActive ? 'bg-[#00968C] text-white shadow-md' : 'bg-white/5 text-white/50 group-hover:bg-white/10 group-hover:text-white/80'
      )}>
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0">
        <p className={cn('text-[11px] font-medium leading-none truncate', isActive ? 'text-white' : 'text-white/70')}>{label}</p>
        <p className="text-[9px] text-white/30 mt-0.5">{desc}</p>
      </div>
    </Link>
  )
}

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="ofppt-diamond-bg flex h-screen w-[190px] flex-col shrink-0 overflow-hidden">

      {/* ── Logo OFPPT ── */}
      <div className="flex items-center gap-2.5 px-3 py-3 border-b border-white/10">
        <div className="relative flex items-center justify-center shrink-0">
          <div className="absolute inset-0 rounded-full bg-[#00968C]/20 blur-lg scale-150" />
          <Image
            src="/OFPPT_Logo.png"
            alt="Logo OFPPT"
            width={38}
            height={38}
            className="relative z-10 drop-shadow-lg"
            priority
          />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold text-white/90 uppercase tracking-widest leading-tight">
            OFPPT
          </p>
          <p className="text-[8.5px] text-white/45 tracking-wide mt-0.5 leading-tight truncate">
            Emplois du Temps
          </p>
        </div>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 px-2 py-3 overflow-y-auto space-y-0.5">
        <p className="px-2 pt-0.5 pb-1.5 text-[8.5px] font-semibold uppercase tracking-widest text-white/30">
          Menu principal
        </p>
        {navItems.filter(i => i.group === 'planning').map(({ href, label, icon: Icon, desc }) => (
          <NavLink key={href} href={href} label={label} icon={Icon} desc={desc} pathname={pathname} />
        ))}

        <p className="px-2 pt-3 pb-1.5 text-[8.5px] font-semibold uppercase tracking-widest text-white/30">
          Gestion pédagogique
        </p>
        {navItems.filter(i => i.group === 'pedagogique').map(({ href, label, icon: Icon, desc }) => (
          <NavLink key={href} href={href} label={label} icon={Icon} desc={desc} pathname={pathname} />
        ))}

        <p className="px-2 pt-3 pb-1.5 text-[8.5px] font-semibold uppercase tracking-widest text-white/30">
          Configuration
        </p>
        {navItems.filter(i => i.group === 'config').map(({ href, label, icon: Icon, desc }) => (
          <NavLink key={href} href={href} label={label} icon={Icon} desc={desc} pathname={pathname} />
        ))}
      </nav>

      {/* ── Footer ── */}
      <div className="border-t border-white/10 px-2 py-2 space-y-1">
        <div className="mb-1 rounded-md bg-[#00968C]/15 border border-[#00968C]/25 px-2 py-1.5">
          <p className="text-[9px] text-[#00968C] font-medium truncate">مكتب التكوين المهني</p>
          <p className="text-[8px] text-white/30 mt-0.5">OFPPT</p>
        </div>
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-white/50 transition-colors hover:bg-white/5 hover:text-red-400"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/5">
            <LogOut className="h-3.5 w-3.5" />
          </span>
          <span className="text-[11px] font-medium">Déconnexion</span>
        </button>
      </div>
    </aside>
  )
}
