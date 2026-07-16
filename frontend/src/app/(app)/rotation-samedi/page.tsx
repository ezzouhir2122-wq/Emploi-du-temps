export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { RotationSamediClient } from './RotationSamediClient'
import type { Salle, Formateur, RotationSamediConfig, CycleReference } from '@/types/planning'

export default async function RotationSamediPage() {
  const supabase = await createClient()

  const [{ data: salles }, { data: formateurs }, { data: rotationConfig }, { data: cycleRef }] =
    await Promise.all([
      supabase.from('salles').select('*').order('nom'),
      supabase.from('formateurs').select('*').eq('actif', true).order('nom'),
      supabase.from('rotation_samedi_config').select('*'),
      supabase.from('cycle_reference').select('*'),
    ])

  return (
    <RotationSamediClient
      salles={(salles ?? []) as Salle[]}
      formateurs={(formateurs ?? []) as Formateur[]}
      rotationConfig={(rotationConfig ?? []) as RotationSamediConfig[]}
      cycleReferences={(cycleRef ?? []) as CycleReference[]}
    />
  )
}
