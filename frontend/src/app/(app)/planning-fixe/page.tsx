export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { PlanningFixeClient } from './PlanningFixeClient'
import type { Formateur, Groupe, Salle, PlanningFixe } from '@/types/planning'

export default async function PlanningFixePage() {
  const supabase = await createClient()

  const [{ data: salles }, { data: groupes }, { data: formateurs }, { data: planning }] =
    await Promise.all([
      supabase.from('salles').select('*').order('nom'),
      supabase.from('groupes').select('*').order('nom'),
      supabase.from('formateurs').select('*').eq('actif', true).order('nom'),
      supabase.from('planning_fixe').select('*'),
    ])

  return (
    <PlanningFixeClient
      salles={(salles ?? []) as Salle[]}
      groupes={(groupes ?? []) as Groupe[]}
      formateurs={(formateurs ?? []) as Formateur[]}
      planningFixe={(planning ?? []) as PlanningFixe[]}
    />
  )
}
