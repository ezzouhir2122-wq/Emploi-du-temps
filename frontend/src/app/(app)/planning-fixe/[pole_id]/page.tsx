export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PlanningPoleHeader } from './PlanningPoleHeader'
import { PlanningFixeClient } from '../PlanningFixeClient'
import { PlanningScenarioCClient } from '../../planning-scenario-c/PlanningScenarioCClient'
import type {
  Pole, Salle, Groupe, Formateur, PlanningFixe,
  RotationSamediConfig, CycleReference,
} from '@/types/planning'

export default async function PlanningPolePage({
  params,
}: {
  params: Promise<{ pole_id: string }>
}) {
  const { pole_id } = await params
  const supabase = await createClient()

  const [
    { data: poleRow },
    { data: allPoles },
    { data: salles },
    { data: groupesTech },      // groupes techniques (liés à une salle) — tous pôles
    { data: groupesFormation },  // groupes formation filtrés par ce pôle uniquement
    { data: formateurs },
    { data: planning },
    { data: rotationConfig },
    { data: cycleRef },
  ] = await Promise.all([
    supabase.from('poles').select('*').eq('id', pole_id).single(),
    supabase.from('poles').select('*').eq('actif', true).order('nom'),
    supabase.from('salles').select('*').eq('pole_id', pole_id).order('nom'),
    // Groupes techniques : ceux avec salle_id (pour le lookup salle→groupe dans StandardView)
    supabase.from('groupes').select('*').not('salle_id', 'is', null).order('nom'),
    // Groupes formation : uniquement ceux affectés à CE pôle
    supabase.from('groupes').select('*').is('salle_id', null).eq('pole_id', pole_id).order('nom'),
    supabase.from('formateurs').select('*, pole:poles(*)').eq('pole_id', pole_id).eq('actif', true).order('nom'),
    supabase.from('planning_fixe').select('*'),
    supabase.from('rotation_samedi_config').select('*'),
    supabase.from('cycle_reference').select('*'),
  ])

  if (!poleRow) notFound()

  const pole = poleRow as Pole

  // PlanningFixeClient attend `groupes` = tech + formation combinés
  // (il dérive groupesFormation en interne via filter(!salle_id))
  const groupesCombined = [
    ...((groupesTech ?? []) as Groupe[]),
    ...((groupesFormation ?? []) as Groupe[]),
  ]

  return (
    <div className="space-y-4">
      <PlanningPoleHeader pole={pole} allPoles={(allPoles ?? []) as Pole[]} />

      {pole.scenario_type === 'pool_mixed' ? (
        <PlanningScenarioCClient
          poles={[pole]}
          salles={(salles ?? []) as Salle[]}
          formateurs={(formateurs ?? []) as Formateur[]}
          planningFixe={(planning ?? []) as PlanningFixe[]}
          groupesFormation={(groupesFormation ?? []) as Groupe[]}
        />
      ) : (
        <PlanningFixeClient
          salles={(salles ?? []) as Salle[]}
          groupes={groupesCombined}
          formateurs={(formateurs ?? []) as Formateur[]}
          planningFixe={(planning ?? []) as PlanningFixe[]}
          activeScenario={null}
          rotationConfig={(rotationConfig ?? []) as RotationSamediConfig[]}
          cycleReferences={(cycleRef ?? []) as CycleReference[]}
        />
      )}
    </div>
  )
}
