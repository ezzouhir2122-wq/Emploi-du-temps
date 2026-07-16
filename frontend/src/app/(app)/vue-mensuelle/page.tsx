import { createClient } from '@/lib/supabase/server'
import { VueMensuelleClient } from './VueMensuelleClient'
import type { Formateur, Groupe, Salle, PlanningFixe, RotationSamediConfig, CycleReference } from '@/types/planning'

export default async function VueMensuellePage() {
  const supabase = await createClient()

  const [
    { data: salles },
    { data: groupes },
    { data: formateurs },
    { data: planning },
    { data: rotationConfig },
    { data: cycleRef },
  ] = await Promise.all([
    supabase.from('salles').select('*').order('nom'),
    supabase.from('groupes').select('*').order('nom'),
    supabase.from('formateurs').select('*').eq('actif', true).order('nom'),
    supabase.from('planning_fixe').select('*'),
    supabase.from('rotation_samedi_config').select('*'),
    supabase.from('cycle_reference').select('*'),
  ])

  return (
    <VueMensuelleClient
      salles={(salles ?? []) as Salle[]}
      groupes={(groupes ?? []) as Groupe[]}
      formateurs={(formateurs ?? []) as Formateur[]}
      planningFixe={(planning ?? []) as PlanningFixe[]}
      rotationConfig={(rotationConfig ?? []) as RotationSamediConfig[]}
      cycleReferences={(cycleRef ?? []) as CycleReference[]}
    />
  )
}
