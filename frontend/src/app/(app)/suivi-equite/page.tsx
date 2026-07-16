export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { SuiviEquiteClient } from './SuiviEquiteClient'
import type { Formateur, Groupe, PlanningFixe, RotationSamediConfig, CycleReference } from '@/types/planning'

export default async function SuiviEquitePage() {
  const supabase = await createClient()

  const [{ data: groupes }, { data: formateurs }, { data: planning }, { data: rotation }, { data: cycle }] =
    await Promise.all([
      supabase.from('groupes').select('*').order('nom'),
      supabase.from('formateurs').select('*').eq('actif', true).order('nom'),
      supabase.from('planning_fixe').select('*'),
      supabase.from('rotation_samedi_config').select('*'),
      supabase.from('cycle_reference').select('*'),
    ])

  return (
    <SuiviEquiteClient
      groupes={(groupes ?? []) as Groupe[]}
      formateurs={(formateurs ?? []) as Formateur[]}
      planningFixe={(planning ?? []) as PlanningFixe[]}
      rotationConfig={(rotation ?? []) as RotationSamediConfig[]}
      cycleReferences={(cycle ?? []) as CycleReference[]}
    />
  )
}
