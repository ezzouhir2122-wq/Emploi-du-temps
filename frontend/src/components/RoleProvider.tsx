'use client'

import { createContext, useContext } from 'react'
import type { ProfileRole } from '@/lib/access'

const RoleContext = createContext<ProfileRole>(null)

export function RoleProvider({ role, children }: { role: ProfileRole; children: React.ReactNode }) {
  return <RoleContext.Provider value={role}>{children}</RoleContext.Provider>
}

export function useRole(): { role: ProfileRole; isAdmin: boolean; isFormateur: boolean } {
  const role = useContext(RoleContext)
  return { role, isAdmin: role === 'admin', isFormateur: role === 'formateur' }
}
