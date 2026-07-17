export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { PlanningFixeClient } from './PlanningFixeClient'
import type { Formateur, Groupe, Salle, PlanningFixe, Scenario, RotationSamediConfig, CycleReference } from '@/types/planning'

export default async function PlanningFixePage() {
  const supabase = await createClient()

  const [
    { data: salles },
    { data: groupes },
    { data: formateurs },
    { data: planning },
    { data: scenarios },
    { data: rotationConfig },
    { data: cycleRef },
  ] = await Promise.all([
    supabase.from('salles').select('*').order('nom'),
    supabase.from('groupes').select('*').order('nom'),
    supabase.from('formateurs').select('*').eq('actif', true).order('nom'),
    supabase.from('planning_fixe').select('*'),
    supabase.from('scenarios').select('*').eq('actif', true).limit(1),
    supabase.from('rotation_samedi_config').select('*'),
    supabase.from('cycle_reference').select('*'),
  ])

  const activeScenario = (scenarios?.[0] ?? null) as Scenario | null

  return (
    <PlanningFixeClient
      salles={(salles ?? []) as Salle[]}
      groupes={(groupes ?? []) as Groupe[]}
      formateurs={(formateurs ?? []) as Formateur[]}
      planningFixe={(planning ?? []) as PlanningFixe[]}
      activeScenario={activeScenario}
      rotationConfig={(rotationConfig ?? []) as RotationSamediConfig[]}
      cycleReferences={(cycleRef ?? []) as CycleReference[]}
    />
  )
}
