'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Check, X, Clock } from 'lucide-react'

export interface ProfileRow {
  id: string
  email: string
  nom: string | null
  role: 'admin' | 'formateur' | null
  statut: 'en_attente' | 'valide' | 'refuse'
  formateur_id: string | null
  created_at: string
}
export interface FormateurOption { id: string; nom: string }

export function UtilisateursClient({
  initialProfiles, formateurs,
}: { initialProfiles: ProfileRow[]; formateurs: FormateurOption[] }) {
  const supabase = createClient()
  const [rows, setRows] = useState<ProfileRow[]>(initialProfiles)
  const [busy, setBusy] = useState<string | null>(null)
  // sélection locale par ligne : rôle + formateur
  const [choix, setChoix] = useState<Record<string, { role: 'admin' | 'formateur'; formateurId: string }>>({})

  const formateursLies = new Set(
    rows.filter(r => r.role === 'formateur' && r.formateur_id).map(r => r.formateur_id!)
  )

  function setChoixRow(id: string, patch: Partial<{ role: 'admin' | 'formateur'; formateurId: string }>) {
    setChoix(prev => {
      const existing = prev[id] ?? { role: 'formateur' as const, formateurId: '' }
      return { ...prev, [id]: { ...existing, ...patch } }
    })
  }

  async function valider(row: ProfileRow) {
    const c = choix[row.id] ?? { role: 'formateur' as const, formateurId: '' }
    if (c.role === 'formateur' && !c.formateurId) {
      toast.error('Choisissez une fiche formateur.')
      return
    }
    setBusy(row.id)
    const { error } = await supabase
      .from('profiles')
      .update({
        statut: 'valide',
        role: c.role,
        formateur_id: c.role === 'formateur' ? c.formateurId : null,
      })
      .eq('id', row.id)
    setBusy(null)
    if (error) { toast.error('Échec de la validation.'); return }
    setRows(prev => prev.map(r => r.id === row.id
      ? { ...r, statut: 'valide', role: c.role, formateur_id: c.role === 'formateur' ? c.formateurId : null }
      : r))
    toast.success('Compte validé.')
  }

  async function refuser(row: ProfileRow) {
    setBusy(row.id)
    const { error } = await supabase.from('profiles')
      .update({ statut: 'refuse', role: null, formateur_id: null }).eq('id', row.id)
    setBusy(null)
    if (error) { toast.error('Échec.'); return }
    setRows(prev => prev.map(r => r.id === row.id ? { ...r, statut: 'refuse', role: null, formateur_id: null } : r))
    toast.success('Compte refusé.')
  }

  const enAttente = rows.filter(r => r.statut === 'en_attente')
  const valides   = rows.filter(r => r.statut === 'valide')
  const refuses   = rows.filter(r => r.statut === 'refuse')

  return (
    <div className="max-w-3xl space-y-8">
      <h1 className="text-xl font-bold text-[#0A2558]">Utilisateurs</h1>

      <section>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-amber-600 mb-3">
          <Clock className="h-4 w-4" /> En attente ({enAttente.length})
        </h2>
        <div className="space-y-2">
          {enAttente.length === 0 && <p className="text-sm text-gray-400">Aucune demande.</p>}
          {enAttente.map(row => {
            const c = choix[row.id] ?? { role: 'formateur' as const, formateurId: '' }
            return (
              <div key={row.id} className="rounded-xl border border-amber-200 bg-amber-50/40 p-3 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-40">
                  <p className="text-sm font-semibold">{row.nom ?? '—'}</p>
                  <p className="text-xs text-gray-500">{row.email}</p>
                </div>
                <select value={c.role} onChange={e => setChoixRow(row.id, { role: e.target.value as 'admin' | 'formateur' })}
                  className="h-9 rounded-lg border border-gray-200 bg-white px-2 text-sm">
                  <option value="formateur">Formateur</option>
                  <option value="admin">Admin</option>
                </select>
                {c.role === 'formateur' && (
                  <select value={c.formateurId} onChange={e => setChoixRow(row.id, { formateurId: e.target.value })}
                    className="h-9 rounded-lg border border-gray-200 bg-white px-2 text-sm">
                    <option value="">— Fiche formateur —</option>
                    {formateurs.filter(f => !formateursLies.has(f.id)).map(f => (
                      <option key={f.id} value={f.id}>{f.nom}</option>
                    ))}
                  </select>
                )}
                <button disabled={busy === row.id} onClick={() => valider(row)}
                  className="h-9 px-3 rounded-lg bg-emerald-600 text-white text-sm font-semibold flex items-center gap-1 disabled:opacity-60">
                  <Check className="h-4 w-4" /> Valider
                </button>
                <button disabled={busy === row.id} onClick={() => refuser(row)}
                  className="h-9 px-3 rounded-lg border border-red-200 text-red-600 text-sm font-semibold flex items-center gap-1 disabled:opacity-60">
                  <X className="h-4 w-4" /> Refuser
                </button>
              </div>
            )
          })}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-emerald-700 mb-3">Validés ({valides.length})</h2>
        <div className="space-y-1.5">
          {valides.map(row => (
            <div key={row.id} className="rounded-lg border border-gray-100 bg-white p-2.5 flex items-center gap-3 text-sm">
              <span className="flex-1 font-medium">{row.nom ?? row.email}</span>
              <span className="text-xs rounded-full bg-gray-100 px-2 py-0.5">{row.role}</span>
              <button onClick={() => refuser(row)} className="text-xs text-red-500 hover:underline">Révoquer</button>
            </div>
          ))}
        </div>
      </section>

      {refuses.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-500 mb-3">Refusés ({refuses.length})</h2>
          <div className="space-y-1.5">
            {refuses.map(row => (
              <div key={row.id} className="rounded-lg border border-gray-100 bg-gray-50 p-2.5 flex items-center gap-3 text-sm text-gray-500">
                <span className="flex-1">{row.nom ?? row.email}</span>
                <button onClick={() => valider(row)} className="text-xs text-emerald-600 hover:underline">Re-valider</button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
