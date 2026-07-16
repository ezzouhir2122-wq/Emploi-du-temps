export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { RotationSamediClient } from './RotationSamediClient'
import type { Groupe, Formateur, RotationSamediConfig, CycleReference } from '@/types/planning'

export default async function RotationSamediPage() {
  const supabase = await createClient()

  const [{ data: groupes }, { data: formateurs }, { data: rotationConfig }, { data: cycleRef }] =
    await Promise.all([
      supabase.from('groupes').select('*, salle:salles(*)').order('nom'),
      supabase.from('formateurs').select('*').eq('actif', true).order('nom'),
      supabase.from('rotation_samedi_config').select('*'),
      supabase.from('cycle_reference').select('*'),
    ])

  return (
    <RotationSamediClient
      groupes={(groupes ?? []) as Groupe[]}
      formateurs={(formateurs ?? []) as Formateur[]}
      rotationConfig={(rotationConfig ?? []) as RotationSamediConfig[]}
      cycleReferences={(cycleRef ?? []) as CycleReference[]}
    />
  )
}
