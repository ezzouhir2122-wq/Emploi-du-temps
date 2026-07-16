export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { ScenariosClient } from './ScenariosClient'
import type { Scenario } from '@/types/planning'

export default async function ScenariosPage() {
  const supabase = await createClient()
  const { data: scenarios } = await supabase
    .from('scenarios')
    .select('*')
    .order('created_at')

  return <ScenariosClient scenarios={(scenarios ?? []) as Scenario[]} />
}
