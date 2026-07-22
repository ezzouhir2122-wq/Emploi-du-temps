export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { ParametresClient } from './ParametresClient'
import type { Pole, Salle, Groupe, Formateur, AffectationTemplate } from '@/types/planning'

export default async function ParametresPage() {
  const supabase = await createClient()

  const [{ data: poles }, { data: salles }, { data: groupes }, { data: formateurs }, { data: templates }] =
    await Promise.all([
      supabase.from('poles').select('*').order('nom'),
      supabase.from('salles').select('*').order('nom'),
      supabase.from('groupes').select('*').order('nom'),
      supabase.from('formateurs').select('*').order('nom'),
      supabase.from('affectation_templates').select('*').order('filiere_id, ordre'),
    ])

  return (
    <ParametresClient
      poles={(poles ?? []) as Pole[]}
      salles={(salles ?? []) as Salle[]}
      groupes={(groupes ?? []) as Groupe[]}
      formateurs={(formateurs ?? []) as Formateur[]}
      templates={(templates ?? []) as AffectationTemplate[]}
    />
  )
}
