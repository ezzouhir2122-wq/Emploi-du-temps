export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { PlanningScenarioCClient } from './PlanningScenarioCClient'
import type { Pole, Salle, Formateur, PlanningFixe, Groupe } from '@/types/planning'

export default async function PlanningScenarioCPage() {
  const supabase = await createClient()

  const [
    { data: poles },
    { data: salles },
    { data: formateurs },
    { data: planning },
    { data: groupesFormation },
  ] = await Promise.all([
    supabase.from('poles').select('*').eq('actif', true).order('nom'),
    supabase.from('salles').select('*, pole:poles(*)').order('nom'),
    supabase.from('formateurs').select('*, pole:poles(*)').eq('actif', true).order('nom'),
    supabase.from('planning_fixe').select('*'),
    supabase.from('groupes').select('*').is('salle_id', null).order('nom'),
  ])

  return (
    <PlanningScenarioCClient
      poles={(poles ?? []) as Pole[]}
      salles={(salles ?? []) as Salle[]}
      formateurs={(formateurs ?? []) as Formateur[]}
      planningFixe={(planning ?? []) as PlanningFixe[]}
      groupesFormation={(groupesFormation ?? []) as Groupe[]}
    />
  )
}
