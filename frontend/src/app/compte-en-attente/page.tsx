import { createClient } from '@/lib/supabase/server'
import { fetchProfile } from '@/lib/supabase/profile'
import { LogoutButton } from './LogoutButton'
import { Clock, XCircle } from 'lucide-react'

export default async function CompteEnAttentePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const profile = user ? await fetchProfile(supabase, user.id) : null
  const refuse = profile?.statut === 'refuse'

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F4F7FB] px-6">
      <div className="w-full max-w-md text-center">
        {refuse
          ? <XCircle className="h-14 w-14 text-red-500 mx-auto mb-4" />
          : <Clock className="h-14 w-14 text-amber-500 mx-auto mb-4" />}
        <h1 className="text-2xl font-bold text-[#0A2558] mb-2">
          {refuse ? 'Compte refusé' : 'Compte en attente de validation'}
        </h1>
        <p className="text-sm text-gray-500 mb-8">
          {refuse
            ? "Votre demande d'accès a été refusée. Contactez l'administrateur si vous pensez qu'il s'agit d'une erreur."
            : "Votre inscription a bien été prise en compte. Un administrateur doit valider votre accès avant que vous puissiez utiliser l'application."}
        </p>
        <LogoutButton />
      </div>
    </div>
  )
}
