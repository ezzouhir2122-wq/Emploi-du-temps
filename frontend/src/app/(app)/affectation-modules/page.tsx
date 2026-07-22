export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { AffectationModulesClient } from './AffectationModulesClient'
import type { Pole, Groupe, Formateur, AffectationModule, AffectationTemplate } from '@/types/planning'

export default async function AffectationModulesPage() {
  const supabase = await createClient()

  const [
    { data: poles },
    { data: groupes },
    { data: formateurs },
    { data: affectations },
    { data: templates },
  ] = await Promise.all([
    supabase.from('poles').select('*').eq('actif', true).order('nom'),
    supabase.from('groupes').select('*').order('nom'),
    supabase.from('formateurs').select('*').eq('actif', true).order('nom'),
    supabase.from('affectations_modules').select('*').order('filiere_id, groupe_id, ordre'),
    supabase.from('affectation_templates').select('*').order('filiere_id, ordre'),
  ])

  return (
    <AffectationModulesClient
      poles={(poles ?? []) as Pole[]}
      groupes={(groupes ?? []) as Groupe[]}
      formateurs={(formateurs ?? []) as Formateur[]}
      affectations={(affectations ?? []) as AffectationModule[]}
      templates={(templates ?? []) as AffectationTemplate[]}
    />
  )
}
