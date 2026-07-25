import { createClient } from '@/lib/supabase/server'
import { UtilisateursClient, type ProfileRow, type FormateurOption } from './UtilisateursClient'

export default async function UtilisateursPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, email, nom, role, statut, formateur_id, created_at')
    .order('created_at', { ascending: true })

  const { data: formateurs } = await supabase
    .from('formateurs')
    .select('id, nom')
    .order('nom', { ascending: true })

  return (
    <UtilisateursClient
      initialProfiles={(profiles ?? []) as ProfileRow[]}
      formateurs={(formateurs ?? []) as FormateurOption[]}
      currentUserId={user?.id ?? null}
    />
  )
}
