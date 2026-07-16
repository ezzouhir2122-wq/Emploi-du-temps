export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { ExportsClient } from './ExportsClient'
import type { Formateur, Salle, Groupe, Pole, PlanningFixe, RotationSamediConfig, CycleReference } from '@/types/planning'

export default async function ExportsPage() {
  const supabase = await createClient()

  const [
    { data: formateurs },
    { data: salles },
    { data: groupes },
    { data: poles },
    { data: planningFixe },
    { data: rotationConfig },
    { data: cycleReferences },
  ] = await Promise.all([
    supabase.from('formateurs').select('*').eq('actif', true).order('nom'),
    supabase.from('salles').select('*').order('nom'),
    supabase.from('groupes').select('*').order('nom'),
    supabase.from('poles').select('*').eq('actif', true).order('nom'),
    supabase.from('planning_fixe').select('*'),
    supabase.from('rotation_samedi_config').select('*'),
    supabase.from('cycle_references').select('*'),
  ])

  return (
    <ExportsClient
      formateurs={(formateurs ?? []) as Formateur[]}
      salles={(salles ?? []) as Salle[]}
      groupes={(groupes ?? []) as Groupe[]}
      poles={(poles ?? []) as Pole[]}
      planningFixe={(planningFixe ?? []) as PlanningFixe[]}
      rotationConfig={(rotationConfig ?? []) as RotationSamediConfig[]}
      cycleReferences={(cycleReferences ?? []) as CycleReference[]}
    />
  )
}
