import { Sidebar } from '@/components/layout/Sidebar'
import { Toaster } from 'sonner'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full bg-[#F4F7FB]">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top accent line */}
        <div className="h-[3px] w-full bg-gradient-to-r from-[#005FAD] via-[#00968C] to-[#005FAD] shrink-0" />
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
      <Toaster richColors position="bottom-right" />
    </div>
  )
}
