import type { SupabaseClient } from '@supabase/supabase-js'
import type { Profile } from '@/lib/access'

/** Charge le statut + rôle du profil d'un utilisateur. Renvoie null si absent. */
export async function fetchProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<Profile | null> {
  const { data } = await supabase
    .from('profiles')
    .select('statut, role')
    .eq('id', userId)
    .single()

  if (!data) return null
  return { statut: data.statut, role: data.role }
}
