'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { PageHeader, PageDivider } from '@/components/layout/PageHeader'
import { Settings } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Plus, Pencil, Power } from 'lucide-react'
import type { Salle, Groupe, Formateur } from '@/types/planning'

interface Props {
  salles: Salle[]
  groupes: Groupe[]
  formateurs: Formateur[]
}

export function ParametresClient({ salles: initSalles, groupes: initGroupes, formateurs: initFormateurs }: Props) {
  const [salles, setSalles] = useState<Salle[]>(initSalles)
  const [groupes, setGroupes] = useState<Groupe[]>(initGroupes)
  const [formateurs, setFormateurs] = useState<Formateur[]>(initFormateurs)

  const [newFormateur, setNewFormateur] = useState<{ nom: string; groupe_id: string | null }>({ nom: '', groupe_id: null })
  const [editingFormateur, setEditingFormateur] = useState<Formateur | null>(null)

  const supabase = createClient()

  async function handleAddFormateur() {
    if (!newFormateur.nom.trim()) return

    const { data, error } = await supabase
      .from('formateurs')
      .insert({ nom: newFormateur.nom.toUpperCase().trim(), groupe_id: newFormateur.groupe_id || null })
      .select()
      .single()

    if (error) { toast.error('Erreur lors de l\'ajout'); return }
    setFormateurs(prev => [...prev, data as Formateur])
    setNewFormateur({ nom: '', groupe_id: '' })
    toast.success('Formateur ajouté')
  }

  async function handleUpdateFormateur() {
    if (!editingFormateur) return

    const { error } = await supabase
      .from('formateurs')
      .update({ nom: editingFormateur.nom.toUpperCase().trim(), groupe_id: editingFormateur.groupe_id })
      .eq('id', editingFormateur.id)

    if (error) { toast.error('Erreur lors de la mise à jour'); return }
    setFormateurs(prev => prev.map(f => f.id === editingFormateur.id ? editingFormateur : f))
    setEditingFormateur(null)
    toast.success('Formateur mis à jour')
  }

  async function handleToggleActif(formateur: Formateur) {
    const { error } = await supabase
      .from('formateurs')
      .update({ actif: !formateur.actif })
      .eq('id', formateur.id)

    if (error) { toast.error('Erreur'); return }
    setFormateurs(prev =>
      prev.map(f => f.id === formateur.id ? { ...f, actif: !f.actif } : f)
    )
    toast.success(formateur.actif ? 'Formateur désactivé' : 'Formateur activé')
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <PageHeader
          icon={Settings}
          title="Paramètres"
          subtitle="Gérez les formateurs, groupes et salles."
          badge="Config"
        />
        <PageDivider />
      </div>

      {/* Salles (lecture) */}
      <section className="space-y-3">
        <h2 className="font-semibold text-lg">Salles</h2>
        <div className="rounded-lg border divide-y">
          {salles.map(salle => {
            const groupe = groupes.find(g => g.salle_id === salle.id)
            return (
              <div key={salle.id} className="flex items-center justify-between px-4 py-3">
                <span className="font-medium">{salle.nom}</span>
                {groupe && <span className="text-sm text-muted-foreground">{groupe.nom}</span>}
              </div>
            )
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          Les salles sont configurées en base de données. Contactez l&apos;administrateur DB pour les modifier.
        </p>
      </section>

      {/* Groupes (lecture) */}
      <section className="space-y-3">
        <h2 className="font-semibold text-lg">Groupes</h2>
        <div className="rounded-lg border divide-y">
          {groupes.map(groupe => {
            const salle = salles.find(s => s.id === groupe.salle_id)
            const effectif = formateurs.filter(f => f.groupe_id === groupe.id && f.actif).length
            return (
              <div key={groupe.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <span className="font-medium">{groupe.nom}</span>
                  {salle && <span className="ml-2 text-sm text-muted-foreground">→ {salle.nom}</span>}
                </div>
                <Badge variant="outline">{effectif} formateur{effectif > 1 ? 's' : ''}</Badge>
              </div>
            )
          })}
        </div>
      </section>

      {/* Formateurs */}
      <section className="space-y-3">
        <h2 className="font-semibold text-lg">Formateurs</h2>

        {/* Liste */}
        <div className="rounded-lg border divide-y">
          {formateurs.map(formateur => (
            <div key={formateur.id} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <span className={formateur.actif ? 'font-medium' : 'font-medium text-muted-foreground line-through'}>
                  {formateur.nom}
                </span>
                <span className="text-sm text-muted-foreground">
                  {groupes.find(g => g.id === formateur.groupe_id)?.nom ?? '—'}
                </span>
                {!formateur.actif && <Badge variant="secondary" className="text-xs">Inactif</Badge>}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => setEditingFormateur(formateur)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`h-7 px-2 ${formateur.actif ? 'text-destructive' : 'text-green-600'}`}
                  onClick={() => handleToggleActif(formateur)}
                >
                  <Power className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Formulaire d'édition */}
        {editingFormateur && (
          <div className="rounded-lg border p-4 bg-muted/30 space-y-3">
            <p className="text-sm font-medium">Modifier {editingFormateur.nom}</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Nom</Label>
                <Input
                  value={editingFormateur.nom}
                  onChange={e => setEditingFormateur(prev => prev ? { ...prev, nom: e.target.value } : null)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Groupe</Label>
                <Select
                  value={editingFormateur.groupe_id ?? ''}
                  onValueChange={v => setEditingFormateur(prev => prev ? { ...prev, groupe_id: v } : null)}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Aucun groupe" />
                  </SelectTrigger>
                  <SelectContent>
                    {groupes.map(g => (
                      <SelectItem key={g.id} value={g.id}>{g.nom}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleUpdateFormateur}>Enregistrer</Button>
              <Button size="sm" variant="ghost" onClick={() => setEditingFormateur(null)}>Annuler</Button>
            </div>
          </div>
        )}

        {/* Ajout */}
        <div className="rounded-lg border p-4 space-y-3">
          <p className="text-sm font-medium">Ajouter un formateur</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Nom</Label>
              <Input
                placeholder="NOM FORMATEUR"
                value={newFormateur.nom}
                onChange={e => setNewFormateur(prev => ({ ...prev, nom: e.target.value }))}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Groupe</Label>
              <Select
                value={newFormateur.groupe_id ?? ''}
                onValueChange={v => setNewFormateur(prev => ({ ...prev, groupe_id: v }))}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Choisir un groupe" />
                </SelectTrigger>
                <SelectContent>
                  {groupes.map(g => (
                    <SelectItem key={g.id} value={g.id}>{g.nom}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button size="sm" onClick={handleAddFormateur} disabled={!newFormateur.nom.trim()}>
            <Plus className="h-4 w-4 mr-1" />
            Ajouter
          </Button>
        </div>
      </section>
    </div>
  )
}
