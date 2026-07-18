export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { PolesDashboardClient } from './PolesDashboardClient'
import type { Pole, Salle, Formateur, PlanningFixe } from '@/types/planning'

export default async function PlanningFixePage() {
  const supabase = await createClient()

  const [
    { data: poles },
    { data: salles },
    { data: formateurs },
    { data: planning },
  ] = await Promise.all([
    supabase.from('poles').select('*').eq('actif', true).order('nom'),
    supabase.from('salles').select('*').order('nom'),
    supabase.from('formateurs').select('*').eq('actif', true).order('nom'),
    supabase.from('planning_fixe').select('formateur_id, jour_semaine, statut'),
  ])

  return (
    <PolesDashboardClient
      poles={(poles ?? []) as Pole[]}
      salles={(salles ?? []) as Salle[]}
      formateurs={(formateurs ?? []) as Formateur[]}
      planningFixe={(planning ?? []) as PlanningFixe[]}
    />
  )
}
