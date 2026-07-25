import { Sidebar } from '@/components/layout/Sidebar'
import { Toaster } from 'sonner'
import { RoleProvider } from '@/components/RoleProvider'
import { createClient } from '@/lib/supabase/server'
import { fetchProfile } from '@/lib/supabase/profile'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const profile = user ? await fetchProfile(supabase, user.id) : null

  return (
    <RoleProvider role={profile?.role ?? null}>
      <div className="flex h-full bg-[#F4F7FB]">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Top accent line */}
          <div className="h-[3px] w-full bg-gradient-to-r from-[#005FAD] via-[#00968C] to-[#005FAD] shrink-0" />
          <main className="flex-1 overflow-auto p-3">{children}</main>
        </div>
        <Toaster richColors position="bottom-right" />
      </div>
    </RoleProvider>
  )
}
