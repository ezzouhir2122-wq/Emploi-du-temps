'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { PageHeader, PageDivider } from '@/components/layout/PageHeader'
import { Settings, Plus, Pencil, Power, Building2, Users, DoorOpen, GraduationCap, Upload, Trash2, Check, X } from 'lucide-react'
import { toast } from 'sonner'
import type { Pole, Salle, Groupe, Formateur } from '@/types/planning'

interface Props {
  poles: Pole[]
  salles: Salle[]
  groupes: Groupe[]
  formateurs: Formateur[]
}

// ── Helpers ───────────────────────────────────────────────────

function CheckList({
  label, items, selected, onChange, exclusive, takenBy,
}: {
  label: string
  items: { id: string; nom: string }[]
  selected: string[]
  onChange: (ids: string[]) => void
  exclusive?: boolean
  takenBy?: (id: string) => string | null
}) {
  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id])
  }
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
      <div className="rounded-lg border max-h-44 overflow-y-auto divide-y">
        {items.length === 0 && (
          <p className="px-3 py-2 text-xs text-muted-foreground italic">Aucun élément disponible</p>
        )}
        {items.map(item => {
          const taken = exclusive ? takenBy?.(item.id) : null
          const isChecked = selected.includes(item.id)
          const disabled = !isChecked && !!taken
          return (
            <label key={item.id} className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-muted/40 transition-colors ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}>
              <input
                type="checkbox"
                className="h-3.5 w-3.5 accent-[#00968C]"
                checked={isChecked}
                disabled={disabled}
                onChange={() => !disabled && toggle(item.id)}
              />
              <span className="text-xs flex-1">{item.nom}</span>
              {taken && !isChecked && (
                <span className="text-[10px] text-muted-foreground italic">{taken}</span>
              )}
            </label>
          )
        })}
      </div>
    </div>
  )
}

// ── Répartition formateurs par salle ─────────────────────────

function RepartitionPanel({
  selectedFormateurs, selectedSalles, allFormateurs, allSalles, repartition, onChange,
}: {
  selectedFormateurs: string[]
  selectedSalles: string[]
  allFormateurs: Formateur[]
  allSalles: Salle[]
  repartition: Record<string, string>
  onChange: (r: Record<string, string>) => void
}) {
  if (selectedFormateurs.length === 0 || selectedSalles.length === 0) return null
  const sallesChoisies = allSalles.filter(s => selectedSalles.includes(s.id))
  const formateursChoisis = allFormateurs.filter(f => selectedFormateurs.includes(f.id))

  return (
    <div className="space-y-2 border rounded-lg p-3 bg-amber-50/50 dark:bg-amber-950/10 border-amber-200 dark:border-amber-800/30">
      <p className="text-xs font-semibold text-amber-800 dark:text-amber-400 uppercase tracking-wide flex items-center gap-1.5">
        <DoorOpen className="h-3.5 w-3.5" /> Répartition des formateurs par salle
      </p>
      <p className="text-[11px] text-muted-foreground">Chaque formateur doit être affecté à une salle pour apparaître dans le planning.</p>
      <div className="space-y-1.5">
        {formateursChoisis.map(f => (
          <div key={f.id} className="flex items-center gap-2">
            <span className="text-xs w-40 truncate font-medium">{f.nom}</span>
            <Select
              value={repartition[f.id] ?? ''}
              onValueChange={v => onChange({ ...repartition, [f.id]: v ?? '' })}
            >
              <SelectTrigger className="h-7 flex-1 text-xs">
                <SelectValue placeholder="— Choisir une salle —" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">— Non affecté —</SelectItem>
                {sallesChoisies.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.nom}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Onglet Pôles ─────────────────────────────────────────────

function PolesTab({
  initPoles, initSalles, initFormateurs, initGroupes,
}: {
  initPoles: Pole[]
  initSalles: Salle[]
  initFormateurs: Formateur[]
  initGroupes: Groupe[]
}) {
  const [poles, setPoles] = useState<Pole[]>(initPoles)
  const [salles, setSalles] = useState<Salle[]>(initSalles)
  const [formateurs, setFormateurs] = useState<Formateur[]>(initFormateurs)
  const [groupes, setGroupes] = useState<Groupe[]>(initGroupes)

  const [newPole, setNewPole] = useState({ nom: '', code: '', description: '' })
  const [newSalles, setNewSalles] = useState<string[]>([])
  const [newFormateurs, setNewFormateurs] = useState<string[]>([])
  const [newGroupes, setNewGroupes] = useState<string[]>([])

  const [deletingPoleId, setDeletingPoleId] = useState<string | null>(null)
  const [editingPole, setEditingPole] = useState<Pole | null>(null)
  const [editSalles, setEditSalles] = useState<string[]>([])
  const [editFormateurs, setEditFormateurs] = useState<string[]>([])
  const [editGroupes, setEditGroupes] = useState<string[]>([])
  // répartition : formateurId → salleId
  const [newRepartition, setNewRepartition] = useState<Record<string, string>>({})
  const [editRepartition, setEditRepartition] = useState<Record<string, string>>({})

  const supabase = createClient()

  // Retourne le nom du pôle qui possède déjà cet item (exclusive)
  function poleOwnerSalle(salleId: string) {
    const s = salles.find(x => x.id === salleId)
    if (!s?.pole_id) return null
    return poles.find(p => p.id === s.pole_id)?.nom ?? null
  }
  function poleOwnerFormateur(fId: string) {
    const f = formateurs.find(x => x.id === fId)
    if (!f?.pole_id) return null
    return poles.find(p => p.id === f.pole_id)?.nom ?? null
  }

  // Salles disponibles = pas encore affectées à un AUTRE pôle
  function sallesDisponibles(currentPoleId?: string) {
    return salles.filter(s => !s.pole_id || s.pole_id === currentPoleId)
  }
  function formateursDisponibles(currentPoleId?: string) {
    return formateurs.filter(f => !f.pole_id || f.pole_id === currentPoleId)
  }

  // Retourne ou crée un groupe technique lié à une salle (pour la chaîne formateur→groupe→salle)
  async function getOrCreateGroupeSalle(salleId: string, poleId: string): Promise<string> {
    const existing = groupes.find(g => g.salle_id === salleId)
    if (existing) {
      if (existing.pole_id !== poleId) {
        await supabase.from('groupes').update({ pole_id: poleId }).eq('id', existing.id)
        setGroupes(prev => prev.map(g => g.id === existing.id ? { ...g, pole_id: poleId } : g))
      }
      return existing.id
    }
    const salleName = salles.find(s => s.id === salleId)?.nom ?? salleId
    const { data, error } = await supabase
      .from('groupes')
      .insert({ nom: `Grp-${salleName}`, salle_id: salleId, pole_id: poleId })
      .select().single()
    if (error || !data) return ''
    const newGroupe = data as Groupe
    setGroupes(prev => [...prev, newGroupe].sort((a, b) => a.nom.localeCompare(b.nom)))
    return newGroupe.id
  }

  async function applyAssignments(
    poleId: string,
    selSalles: string[],
    selFormateurs: string[],
    selGroupes: string[],
    repartition: Record<string, string>
  ) {
    // Salles : affecter les sélectionnées, désaffecter les anciennes de ce pôle non sélectionnées
    const prevSalles = salles.filter(s => s.pole_id === poleId).map(s => s.id)
    const toUnassignSalles = prevSalles.filter(id => !selSalles.includes(id))
    if (selSalles.length) await supabase.from('salles').update({ pole_id: poleId }).in('id', selSalles)
    if (toUnassignSalles.length) await supabase.from('salles').update({ pole_id: null }).in('id', toUnassignSalles)

    const prevFormateurs = formateurs.filter(f => f.pole_id === poleId).map(f => f.id)
    const toUnassignF = prevFormateurs.filter(id => !selFormateurs.includes(id))
    if (selFormateurs.length) await supabase.from('formateurs').update({ pole_id: poleId }).in('id', selFormateurs)
    if (toUnassignF.length) await supabase.from('formateurs').update({ pole_id: null, groupe_id: null }).in('id', toUnassignF)

    // Groupes (partagés)
    const prevGroupes = groupes.filter(g => g.pole_id === poleId && !g.salle_id).map(g => g.id)
    const toUnassignG = prevGroupes.filter(id => !selGroupes.includes(id))
    if (selGroupes.length) await supabase.from('groupes').update({ pole_id: poleId }).in('id', selGroupes)
    if (toUnassignG.length) await supabase.from('groupes').update({ pole_id: null }).in('id', toUnassignG)

    // Répartition par salle : créer/trouver le groupe technique et lier les formateurs
    const salleToGroupe: Record<string, string> = {}
    for (const [fId, salleId] of Object.entries(repartition)) {
      if (!selFormateurs.includes(fId) || !selSalles.includes(salleId)) continue
      if (!salleToGroupe[salleId]) {
        salleToGroupe[salleId] = await getOrCreateGroupeSalle(salleId, poleId)
      }
      const groupeId = salleToGroupe[salleId]
      if (groupeId) {
        await supabase.from('formateurs').update({ groupe_id: groupeId }).eq('id', fId)
      }
    }
    // Formateurs non répartis → groupe_id null
    const nonRepartis = selFormateurs.filter(id => !repartition[id])
    if (nonRepartis.length) await supabase.from('formateurs').update({ groupe_id: null }).in('id', nonRepartis)

    // Mise à jour état local
    setSalles(prev => prev.map(s => {
      if (selSalles.includes(s.id)) return { ...s, pole_id: poleId }
      if (toUnassignSalles.includes(s.id)) return { ...s, pole_id: null }
      return s
    }))
    setFormateurs(prev => prev.map(f => {
      const newGroupeId = repartition[f.id] ? salleToGroupe[repartition[f.id]] : null
      if (selFormateurs.includes(f.id)) return { ...f, pole_id: poleId, groupe_id: newGroupeId ?? f.groupe_id }
      if (toUnassignF.includes(f.id)) return { ...f, pole_id: null, groupe_id: null }
      return f
    }))
    setGroupes(prev => prev.map(g => {
      if (selGroupes.includes(g.id)) return { ...g, pole_id: poleId }
      if (toUnassignG.includes(g.id)) return { ...g, pole_id: null }
      return g
    }))
  }

  async function handleAdd() {
    if (!newPole.nom.trim()) return
    const { data, error } = await supabase
      .from('poles')
      .insert({ nom: newPole.nom.trim(), code: newPole.code.trim() || null, description: newPole.description.trim() || null })
      .select().single()
    if (error) { toast.error('Erreur lors de la création'); return }
    const created = data as Pole
    setPoles(prev => [...prev, created].sort((a, b) => a.nom.localeCompare(b.nom)))
    await applyAssignments(created.id, newSalles, newFormateurs, newGroupes, newRepartition)
    setNewPole({ nom: '', code: '', description: '' })
    setNewSalles([]); setNewFormateurs([]); setNewGroupes([]); setNewRepartition({})
    toast.success('Pôle créé avec ses affectations')
  }

  function openEdit(pole: Pole) {
    setEditingPole(pole)
    const poleSalles = salles.filter(s => s.pole_id === pole.id).map(s => s.id)
    const poleFormateurs = formateurs.filter(f => f.pole_id === pole.id)
    setEditSalles(poleSalles)
    setEditFormateurs(poleFormateurs.map(f => f.id))
    setEditGroupes(groupes.filter(g => g.pole_id === pole.id && !g.salle_id).map(g => g.id))
    // Reconstruire la répartition existante : formateur → salle via groupe
    const rep: Record<string, string> = {}
    for (const f of poleFormateurs) {
      if (!f.groupe_id) continue
      const g = groupes.find(gr => gr.id === f.groupe_id)
      if (g?.salle_id && poleSalles.includes(g.salle_id)) rep[f.id] = g.salle_id
    }
    setEditRepartition(rep)
  }

  async function handleUpdate() {
    if (!editingPole) return
    const { error } = await supabase
      .from('poles')
      .update({ nom: editingPole.nom.trim(), code: editingPole.code?.trim() || null, description: editingPole.description?.trim() || null })
      .eq('id', editingPole.id)
    if (error) { toast.error('Erreur lors de la mise à jour'); return }
    setPoles(prev => prev.map(p => p.id === editingPole.id ? editingPole : p))
    await applyAssignments(editingPole.id, editSalles, editFormateurs, editGroupes, editRepartition)
    setEditingPole(null)
    toast.success('Pôle mis à jour')
  }

  async function handleToggle(pole: Pole) {
    const { error } = await supabase.from('poles').update({ actif: !pole.actif }).eq('id', pole.id)
    if (error) { toast.error('Erreur'); return }
    setPoles(prev => prev.map(p => p.id === pole.id ? { ...p, actif: !p.actif } : p))
    toast.success(pole.actif ? 'Pôle désactivé' : 'Pôle activé')
  }

  async function handleDeletePole(poleId: string) {
    // Désaffecter salles, formateurs et groupes avant suppression
    await supabase.from('salles').update({ pole_id: null }).eq('pole_id', poleId)
    await supabase.from('formateurs').update({ pole_id: null, groupe_id: null }).eq('pole_id', poleId)
    await supabase.from('groupes').update({ pole_id: null }).eq('pole_id', poleId)
    const { error } = await supabase.from('poles').delete().eq('id', poleId)
    if (error) { toast.error('Erreur lors de la suppression'); return }
    setPoles(prev => prev.filter(p => p.id !== poleId))
    setSalles(prev => prev.map(s => s.pole_id === poleId ? { ...s, pole_id: null } : s))
    setFormateurs(prev => prev.map(f => f.pole_id === poleId ? { ...f, pole_id: null, groupe_id: null } : f))
    setGroupes(prev => prev.map(g => g.pole_id === poleId ? { ...g, pole_id: null } : g))
    setDeletingPoleId(null)
    toast.success('Pôle supprimé')
  }

  return (
    <div className="space-y-4">
      {/* Liste des pôles */}
      <div className="rounded-lg border divide-y">
        {poles.length === 0 && (
          <p className="px-4 py-6 text-sm text-muted-foreground text-center">Aucun pôle — ajoutez-en un ci-dessous.</p>
        )}
        {poles.map(pole => {
          const nbSalles = salles.filter(s => s.pole_id === pole.id).length
          const nbFormateurs = formateurs.filter(f => f.pole_id === pole.id).length
          const nbGroupes = groupes.filter(g => g.pole_id === pole.id).length
          return (
            <div key={pole.id} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#005FAD]/10">
                  <Building2 className="h-4 w-4 text-[#005FAD]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className={`font-medium text-sm ${!pole.actif ? 'text-muted-foreground line-through' : ''}`}>
                      {pole.nom}
                    </p>
                    {pole.code && <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{pole.code}</span>}
                    {!pole.actif && <Badge variant="secondary" className="text-xs">Inactif</Badge>}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {nbSalles > 0 && <span className="text-[10px] text-amber-600"><DoorOpen className="h-3 w-3 inline mr-0.5" />{nbSalles} salle{nbSalles > 1 ? 's' : ''}</span>}
                    {nbFormateurs > 0 && <span className="text-[10px] text-[#00968C]"><Users className="h-3 w-3 inline mr-0.5" />{nbFormateurs} formateur{nbFormateurs > 1 ? 's' : ''}</span>}
                    {nbGroupes > 0 && <span className="text-[10px] text-[#005FAD]"><GraduationCap className="h-3 w-3 inline mr-0.5" />{nbGroupes} groupe{nbGroupes > 1 ? 's' : ''}</span>}
                  </div>
                </div>
              </div>
              <div className="flex gap-1.5">
                <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => openEdit(pole)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost" size="sm"
                  className={`h-7 px-2 ${pole.actif ? 'text-destructive' : 'text-green-600'}`}
                  onClick={() => handleToggle(pole)}
                >
                  <Power className="h-3.5 w-3.5" />
                </Button>
                {deletingPoleId === pole.id ? (
                  <div className="flex gap-1">
                    <Button size="sm" variant="destructive" className="h-7 px-2 text-xs" onClick={() => handleDeletePole(pole.id)}>
                      <Check className="h-3 w-3 mr-1" />Confirmer
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setDeletingPoleId(null)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-muted-foreground hover:text-destructive" onClick={() => setDeletingPoleId(pole.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Édition */}
      {editingPole && (
        <div className="rounded-lg border p-4 bg-muted/30 space-y-4">
          <p className="text-sm font-semibold">Modifier : {editingPole.nom}</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Nom du pôle</Label>
              <Input value={editingPole.nom} onChange={e => setEditingPole(p => p ? { ...p, nom: e.target.value } : null)} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Code (facultatif)</Label>
              <Input value={editingPole.code ?? ''} onChange={e => setEditingPole(p => p ? { ...p, code: e.target.value } : null)} className="h-8 text-sm font-mono" placeholder="ex: POLE-INFO" />
            </div>
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Description (facultatif)</Label>
              <Input value={editingPole.description ?? ''} onChange={e => setEditingPole(p => p ? { ...p, description: e.target.value } : null)} className="h-8 text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <CheckList
              label="Salles (exclusif)"
              items={sallesDisponibles(editingPole.id)}
              selected={editSalles}
              onChange={setEditSalles}
              exclusive
              takenBy={id => {
                const owner = poleOwnerSalle(id)
                return owner && owner !== editingPole.nom ? owner : null
              }}
            />
            <CheckList
              label="Formateurs (exclusif)"
              items={formateursDisponibles(editingPole.id)}
              selected={editFormateurs}
              onChange={setEditFormateurs}
              exclusive
              takenBy={id => {
                const owner = poleOwnerFormateur(id)
                return owner && owner !== editingPole.nom ? owner : null
              }}
            />
            <CheckList
              label="Groupes de formation (partagés)"
              items={groupes.filter(g => !g.salle_id)}
              selected={editGroupes}
              onChange={setEditGroupes}
            />
          </div>
          <RepartitionPanel
            selectedFormateurs={editFormateurs}
            selectedSalles={editSalles}
            allFormateurs={formateurs}
            allSalles={salles}
            repartition={editRepartition}
            onChange={setEditRepartition}
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleUpdate}>Enregistrer</Button>
            <Button size="sm" variant="ghost" onClick={() => setEditingPole(null)}>Annuler</Button>
          </div>
        </div>
      )}

      {/* Ajout */}
      <div className="rounded-lg border p-4 space-y-4">
        <p className="text-sm font-semibold flex items-center gap-2"><Plus className="h-4 w-4" /> Nouveau pôle</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Nom du pôle *</Label>
            <Input placeholder="ex: Pôle Informatique" value={newPole.nom} onChange={e => setNewPole(p => ({ ...p, nom: e.target.value }))} className="h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Code (facultatif)</Label>
            <Input placeholder="ex: POLE-INFO" value={newPole.code} onChange={e => setNewPole(p => ({ ...p, code: e.target.value }))} className="h-8 text-sm font-mono" />
          </div>
          <div className="col-span-2 space-y-1">
            <Label className="text-xs">Description (facultatif)</Label>
            <Input placeholder="Description du pôle..." value={newPole.description} onChange={e => setNewPole(p => ({ ...p, description: e.target.value }))} className="h-8 text-sm" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <CheckList
            label="Salles (exclusif)"
            items={sallesDisponibles()}
            selected={newSalles}
            onChange={setNewSalles}
            exclusive
            takenBy={id => poleOwnerSalle(id)}
          />
          <CheckList
            label="Formateurs (exclusif)"
            items={formateursDisponibles()}
            selected={newFormateurs}
            onChange={setNewFormateurs}
            exclusive
            takenBy={id => poleOwnerFormateur(id)}
          />
          <CheckList
            label="Groupes de formation (partagés)"
            items={groupes.filter(g => !g.salle_id)}
            selected={newGroupes}
            onChange={setNewGroupes}
          />
        </div>
        <RepartitionPanel
          selectedFormateurs={newFormateurs}
          selectedSalles={newSalles}
          allFormateurs={formateurs}
          allSalles={salles}
          repartition={newRepartition}
          onChange={setNewRepartition}
        />
        <Button size="sm" onClick={handleAdd} disabled={!newPole.nom.trim()}>
          <Plus className="h-4 w-4 mr-1" /> Créer le pôle
        </Button>
      </div>
    </div>
  )
}

// ── Onglet Formateurs ─────────────────────────────────────────

function FormateursTab({
  initFormateurs, poles, groupes,
}: { initFormateurs: Formateur[]; poles: Pole[]; groupes: Groupe[] }) {
  const [formateurs, setFormateurs] = useState<Formateur[]>(initFormateurs)
  const [editingFormateur, setEditingFormateur] = useState<Formateur | null>(null)
  const [deletingFormateurId, setDeletingFormateurId] = useState<string | null>(null)
  const [newFormateur, setNewFormateur] = useState({
    nom: '', matricule: '', pole_id: '', groupe_id: '',
  })
  const [filterPole, setFilterPole] = useState<string>('all')
  const supabase = createClient()

  const filtered = filterPole === 'all'
    ? formateurs
    : formateurs.filter(f => f.pole_id === filterPole)

  async function handleAdd() {
    if (!newFormateur.nom.trim()) return
    const { data, error } = await supabase
      .from('formateurs')
      .insert({
        nom: newFormateur.nom.toUpperCase().trim(),
        matricule: newFormateur.matricule.trim() || null,
        pole_id: newFormateur.pole_id || null,
        groupe_id: newFormateur.groupe_id || null,
      })
      .select().single()
    if (error) { toast.error('Erreur lors de l\'ajout'); return }
    setFormateurs(prev => [...prev, data as Formateur].sort((a, b) => a.nom.localeCompare(b.nom)))
    setNewFormateur({ nom: '', matricule: '', pole_id: '', groupe_id: '' })
    toast.success('Formateur ajouté')
  }

  async function handleUpdate() {
    if (!editingFormateur) return
    const { error } = await supabase
      .from('formateurs')
      .update({
        nom: editingFormateur.nom.toUpperCase().trim(),
        matricule: editingFormateur.matricule?.trim() || null,
        pole_id: editingFormateur.pole_id || null,
        groupe_id: editingFormateur.groupe_id || null,
      })
      .eq('id', editingFormateur.id)
    if (error) { toast.error('Erreur lors de la mise à jour'); return }
    setFormateurs(prev => prev.map(f => f.id === editingFormateur.id ? editingFormateur : f))
    setEditingFormateur(null)
    toast.success('Formateur mis à jour')
  }

  async function handleToggle(f: Formateur) {
    const { error } = await supabase.from('formateurs').update({ actif: !f.actif }).eq('id', f.id)
    if (error) { toast.error('Erreur'); return }
    setFormateurs(prev => prev.map(x => x.id === f.id ? { ...x, actif: !x.actif } : x))
    toast.success(f.actif ? 'Formateur désactivé' : 'Formateur activé')
  }

  async function handleDeleteFormateur(fId: string) {
    await supabase.from('planning_fixe').delete().eq('formateur_id', fId)
    const { error } = await supabase.from('formateurs').delete().eq('id', fId)
    if (error) { toast.error('Erreur lors de la suppression'); return }
    setFormateurs(prev => prev.filter(f => f.id !== fId))
    setDeletingFormateurId(null)
    toast.success('Formateur supprimé')
  }

  const activePoles = poles.filter(p => p.actif)
  const groupesForPole = (poleId: string | null) =>
    groupes.filter(g => !poleId || g.pole_id === poleId || !g.pole_id)

  return (
    <div className="space-y-4">
      {/* Filtre par pôle */}
      <div className="flex items-center gap-2">
        <Label className="text-xs text-muted-foreground shrink-0">Filtrer par pôle :</Label>
        <Select value={filterPole} onValueChange={v => setFilterPole(v ?? 'all')}>
          <SelectTrigger className="h-8 w-48 text-xs">
            <SelectValue>{filterPole === 'all' ? 'Tous les pôles' : poles.find(p => p.id === filterPole)?.nom}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les pôles</SelectItem>
            {poles.map(p => <SelectItem key={p.id} value={p.id}>{p.nom}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">{filtered.length} formateur(s)</span>
      </div>

      {/* Liste */}
      <div className="rounded-lg border divide-y">
        {filtered.length === 0 && (
          <p className="px-4 py-6 text-sm text-muted-foreground text-center">Aucun formateur pour ce pôle.</p>
        )}
        {filtered.map(f => {
          const pole = poles.find(p => p.id === f.pole_id)
          const groupe = groupes.find(g => g.id === f.groupe_id)
          return (
            <div key={f.id} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#00968C]/10 text-[#00968C] font-bold text-xs">
                  {f.nom.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className={`font-medium text-sm ${!f.actif ? 'text-muted-foreground line-through' : ''}`}>
                      {f.nom}
                    </p>
                    {f.matricule && (
                      <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        {f.matricule}
                      </span>
                    )}
                    {!f.actif && <Badge variant="secondary" className="text-xs">Inactif</Badge>}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {pole && <span className="text-xs text-[#005FAD]">{pole.nom}</span>}
                    {pole && groupe && <span className="text-xs text-muted-foreground">·</span>}
                    {groupe && <span className="text-xs text-muted-foreground">{groupe.nom}</span>}
                  </div>
                </div>
              </div>
              <div className="flex gap-1.5">
                <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setEditingFormateur(f)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost" size="sm"
                  className={`h-7 px-2 ${f.actif ? 'text-destructive' : 'text-green-600'}`}
                  onClick={() => handleToggle(f)}
                >
                  <Power className="h-3.5 w-3.5" />
                </Button>
                {deletingFormateurId === f.id ? (
                  <div className="flex gap-1">
                    <Button size="sm" variant="destructive" className="h-7 px-2 text-xs" onClick={() => handleDeleteFormateur(f.id)}>
                      <Check className="h-3 w-3 mr-1" />Confirmer
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setDeletingFormateurId(null)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-muted-foreground hover:text-destructive" onClick={() => setDeletingFormateurId(f.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Édition */}
      {editingFormateur && (
        <div className="rounded-lg border p-4 bg-muted/30 space-y-3">
          <p className="text-sm font-medium">Modifier : {editingFormateur.nom}</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Nom *</Label>
              <Input value={editingFormateur.nom} onChange={e => setEditingFormateur(p => p ? { ...p, nom: e.target.value } : null)} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">N° Matricule</Label>
              <Input value={editingFormateur.matricule ?? ''} onChange={e => setEditingFormateur(p => p ? { ...p, matricule: e.target.value } : null)} className="h-8 text-sm font-mono" placeholder="ex: F-2024-001" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Pôle</Label>
              <Select value={editingFormateur.pole_id ?? ''} onValueChange={v => setEditingFormateur(p => p ? { ...p, pole_id: v || null } : null)}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Aucun pôle" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Aucun pôle</SelectItem>
                  {activePoles.map(p => <SelectItem key={p.id} value={p.id}>{p.nom}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Groupe de formation</Label>
              <Select value={editingFormateur.groupe_id ?? ''} onValueChange={v => setEditingFormateur(p => p ? { ...p, groupe_id: v || null } : null)}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Aucun groupe" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Aucun groupe</SelectItem>
                  {groupesForPole(editingFormateur.pole_id).map(g => <SelectItem key={g.id} value={g.id}>{g.nom}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleUpdate}>Enregistrer</Button>
            <Button size="sm" variant="ghost" onClick={() => setEditingFormateur(null)}>Annuler</Button>
          </div>
        </div>
      )}

      {/* Ajout */}
      <div className="rounded-lg border p-4 space-y-3">
        <p className="text-sm font-medium flex items-center gap-2"><Plus className="h-4 w-4" /> Nouveau formateur</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Nom *</Label>
            <Input placeholder="NOM FORMATEUR" value={newFormateur.nom} onChange={e => setNewFormateur(p => ({ ...p, nom: e.target.value }))} className="h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">N° Matricule</Label>
            <Input placeholder="ex: F-2024-001" value={newFormateur.matricule} onChange={e => setNewFormateur(p => ({ ...p, matricule: e.target.value }))} className="h-8 text-sm font-mono" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Pôle</Label>
            <Select value={newFormateur.pole_id} onValueChange={v => setNewFormateur(p => ({ ...p, pole_id: v ?? '', groupe_id: '' }))}>
              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Choisir un pôle" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">Aucun pôle</SelectItem>
                {activePoles.map(p => <SelectItem key={p.id} value={p.id}>{p.nom}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Groupe de formation</Label>
            <Select value={newFormateur.groupe_id} onValueChange={v => setNewFormateur(p => ({ ...p, groupe_id: v ?? '' }))}>
              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Choisir un groupe" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">Aucun groupe</SelectItem>
                {groupesForPole(newFormateur.pole_id || null).map(g => <SelectItem key={g.id} value={g.id}>{g.nom}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button size="sm" onClick={handleAdd} disabled={!newFormateur.nom.trim()}>
          <Plus className="h-4 w-4 mr-1" /> Ajouter le formateur
        </Button>
      </div>
    </div>
  )
}

// ── Onglet Salles ─────────────────────────────────────────────

const MAX_FORMATEURS_PAR_SALLE = 3

function SallesTab({ initSalles, poles, groupes: initGroupes, initFormateurs }: {
  initSalles: Salle[]
  poles: Pole[]
  groupes: Groupe[]
  initFormateurs: Formateur[]
}) {
  const [salles, setSalles] = useState<Salle[]>(initSalles)
  const [groupes, setGroupes] = useState<Groupe[]>(initGroupes)
  const [formateurs, setFormateurs] = useState<Formateur[]>(initFormateurs)
  const [adding, setAdding] = useState(false)
  const [newSalle, setNewSalle] = useState({ nom: '', pole_id: '' })
  const [editingSalle, setEditingSalle] = useState<{ id: string; nom: string } | null>(null)
  const [deletingSalleId, setDeletingSalleId] = useState<string | null>(null)
  const supabase = createClient()

  // Groupe technique lié à une salle (crée si absent)
  async function getOrCreateGroupeSalle(salleId: string): Promise<string> {
    const existing = groupes.find(g => g.salle_id === salleId)
    if (existing) return existing.id
    const salle = salles.find(s => s.id === salleId)
    const { data, error } = await supabase
      .from('groupes')
      .insert({ nom: `Grp-${salle?.nom ?? salleId}`, salle_id: salleId, pole_id: salle?.pole_id ?? null })
      .select().single()
    if (error || !data) return ''
    const g = data as Groupe
    setGroupes(prev => [...prev, g])
    return g.id
  }

  // Formateurs actuellement affectés à une salle (via groupe technique)
  function formateursParSalle(salleId: string): Formateur[] {
    const g = groupes.find(gr => gr.salle_id === salleId)
    if (!g) return []
    return formateurs.filter(f => f.groupe_id === g.id)
  }

  // Formateurs disponibles (pas encore dans une salle, ou dans cette salle)
  function formateursDisponibles(salleId: string): Formateur[] {
    const salleGroupeIds = new Set(groupes.filter(g => g.salle_id).map(g => g.id))
    const groupeSalle = groupes.find(g => g.salle_id === salleId)
    return formateurs.filter(f => {
      if (!f.groupe_id) return true                        // sans salle
      if (f.groupe_id === groupeSalle?.id) return false    // déjà dans cette salle
      if (salleGroupeIds.has(f.groupe_id)) return false    // dans une autre salle
      return true
    })
  }

  async function assignFormateur(salleId: string, formateurId: string) {
    const groupeId = await getOrCreateGroupeSalle(salleId)
    if (!groupeId) return
    const { error } = await supabase.from('formateurs').update({ groupe_id: groupeId }).eq('id', formateurId)
    if (error) { toast.error('Erreur lors de l\'affectation'); return }
    setFormateurs(prev => prev.map(f => f.id === formateurId ? { ...f, groupe_id: groupeId } : f))
    toast.success('Formateur affecté')
  }

  async function unassignFormateur(formateurId: string) {
    const { error } = await supabase.from('formateurs').update({ groupe_id: null }).eq('id', formateurId)
    if (error) { toast.error('Erreur'); return }
    setFormateurs(prev => prev.map(f => f.id === formateurId ? { ...f, groupe_id: null } : f))
    toast.success('Formateur retiré de la salle')
  }

  async function handleAssignPole(salleId: string, poleId: string | null) {
    const { error } = await supabase.from('salles').update({ pole_id: poleId }).eq('id', salleId)
    if (error) { toast.error('Erreur'); return }
    setSalles(prev => prev.map(s => s.id === salleId ? { ...s, pole_id: poleId } : s))
    toast.success('Salle mise à jour')
  }

  async function handleRenameSalle() {
    if (!editingSalle?.nom.trim()) return
    const { error } = await supabase.from('salles').update({ nom: editingSalle.nom.trim() }).eq('id', editingSalle.id)
    if (error) { toast.error('Erreur'); return }
    setSalles(prev => prev.map(s => s.id === editingSalle.id ? { ...s, nom: editingSalle.nom.trim() } : s))
    setEditingSalle(null)
    toast.success('Salle renommée')
  }

  async function handleDeleteSalle(salleId: string) {
    await supabase.from('groupes').update({ salle_id: null }).eq('salle_id', salleId)
    await supabase.from('formateurs').update({ groupe_id: null }).in('groupe_id',
      (groupes.filter(g => g.salle_id === salleId).map(g => g.id)))
    const { error } = await supabase.from('salles').delete().eq('id', salleId)
    if (error) { toast.error('Erreur lors de la suppression'); return }
    setSalles(prev => prev.filter(s => s.id !== salleId))
    setDeletingSalleId(null)
    toast.success('Salle supprimée')
  }

  async function handleAddSalle() {
    if (!newSalle.nom.trim()) return
    const { data, error } = await supabase
      .from('salles')
      .insert({ nom: newSalle.nom.trim(), pole_id: newSalle.pole_id || null })
      .select().single()
    if (error) { toast.error('Erreur lors de la création'); return }
    setSalles(prev => [...prev, data as Salle].sort((a, b) => a.nom.localeCompare(b.nom)))
    setNewSalle({ nom: '', pole_id: '' })
    setAdding(false)
    toast.success('Salle créée')
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border divide-y">
        {salles.map(salle => {
          const pole = poles.find(p => p.id === salle.pole_id)
          const isEditing = editingSalle?.id === salle.id
          const formsSalle = formateursParSalle(salle.id)
          const dispo = formateursDisponibles(salle.id)
          const isFull = formsSalle.length >= MAX_FORMATEURS_PAR_SALLE
          return (
            <div key={salle.id} className="px-4 py-3 space-y-2">
              {/* Ligne principale salle */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-amber-100">
                    <DoorOpen className="h-4 w-4 text-amber-600" />
                  </div>
                  {isEditing ? (
                    <div className="flex items-center gap-2 flex-1">
                      <Input
                        value={editingSalle.nom}
                        onChange={e => setEditingSalle(s => s ? { ...s, nom: e.target.value } : null)}
                        onKeyDown={e => { if (e.key === 'Enter') handleRenameSalle(); if (e.key === 'Escape') setEditingSalle(null) }}
                        className="h-7 text-sm flex-1 max-w-[180px]"
                        autoFocus
                      />
                      <Button size="sm" className="h-7 px-2" onClick={handleRenameSalle}><Check className="h-3 w-3" /></Button>
                      <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setEditingSalle(null)}><X className="h-3 w-3" /></Button>
                    </div>
                  ) : (
                    <p className="font-medium text-sm">{salle.nom}</p>
                  )}
                </div>
                {!isEditing && (
                  <div className="flex items-center gap-2 shrink-0">
                    {pole && (
                      <span className="text-xs text-[#005FAD] bg-[#005FAD]/10 px-2 py-0.5 rounded-full">{pole.nom}</span>
                    )}
                    <Select value={salle.pole_id ?? ''} onValueChange={v => handleAssignPole(salle.id, v || null)}>
                      <SelectTrigger className="h-7 w-36 text-xs">
                        <SelectValue placeholder="Affecter à un pôle" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">— Aucun pôle —</SelectItem>
                        {poles.filter(p => p.actif).map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.nom}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setEditingSalle({ id: salle.id, nom: salle.nom })}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    {deletingSalleId === salle.id ? (
                      <div className="flex gap-1">
                        <Button size="sm" variant="destructive" className="h-7 px-2 text-xs" onClick={() => handleDeleteSalle(salle.id)}>
                          <Check className="h-3 w-3 mr-1" />Confirmer
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setDeletingSalleId(null)}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-muted-foreground hover:text-destructive" onClick={() => setDeletingSalleId(salle.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {/* Formateurs affectés */}
              <div className="ml-11 flex items-center gap-2 flex-wrap">
                <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide shrink-0">
                  Formateurs
                </span>
                {formsSalle.map(f => (
                  <span key={f.id} className="inline-flex items-center gap-1 rounded-full bg-[#00968C]/10 text-[#00968C] px-2 py-0.5 text-xs font-medium">
                    {f.nom}
                    <button
                      onClick={() => unassignFormateur(f.id)}
                      className="ml-0.5 text-[#00968C]/50 hover:text-red-500 transition-colors leading-none"
                      title="Retirer de la salle"
                    >×</button>
                  </span>
                ))}
                {!isFull && dispo.length > 0 && (
                  <Select onValueChange={(fId) => assignFormateur(salle.id, fId as string)}>
                    <SelectTrigger className="h-6 w-auto px-2 text-xs border-dashed text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors gap-1">
                      <Plus className="h-3 w-3" />
                      <span>Ajouter</span>
                    </SelectTrigger>
                    <SelectContent>
                      {dispo.map(f => (
                        <SelectItem key={f.id} value={f.id} className="text-xs">{f.nom}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <span className={`text-[10px] font-mono ml-1 ${isFull ? 'text-emerald-600 font-semibold' : 'text-muted-foreground/60'}`}>
                  {formsSalle.length}/{MAX_FORMATEURS_PAR_SALLE}
                </span>
                {isFull && <span className="text-[10px] text-emerald-600 font-medium">· complet</span>}
              </div>
            </div>
          )
        })}
      </div>

      {adding ? (
        <div className="rounded-lg border p-4 space-y-3">
          <p className="text-sm font-medium">Nouvelle salle</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Numéro / Nom de salle *</Label>
              <Input placeholder="ex: Salle 101" value={newSalle.nom} onChange={e => setNewSalle(p => ({ ...p, nom: e.target.value }))} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Pôle</Label>
              <Select value={newSalle.pole_id} onValueChange={v => setNewSalle(p => ({ ...p, pole_id: v ?? '' }))}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Choisir un pôle" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Aucun pôle</SelectItem>
                  {poles.filter(p => p.actif).map(p => <SelectItem key={p.id} value={p.id}>{p.nom}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAddSalle} disabled={!newSalle.nom.trim()}>Créer</Button>
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Annuler</Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4 mr-1" /> Ajouter une salle
        </Button>
      )}
    </div>
  )
}

// ── Onglet Groupes ─────────────────────────────────────────────

function GroupesTab({ initGroupes, poles, salles }: { initGroupes: Groupe[]; poles: Pole[]; salles: Salle[] }) {
  const [groupes, setGroupes] = useState<Groupe[]>(initGroupes)
  const [adding, setAdding] = useState(false)
  const [newGroupe, setNewGroupe] = useState({ nom: '', salle_id: '', pole_id: '' })
  const [importing, setImporting] = useState(false)
  const [editingGroupe, setEditingGroupe] = useState<{ id: string; nom: string } | null>(null)
  const [deletingGroupeId, setDeletingGroupeId] = useState<string | null>(null)
  const supabase = createClient()

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setImporting(true)
    try {
      let noms: string[] = []
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        const XLSX = await import('xlsx')
        const buf = await file.arrayBuffer()
        const wb = XLSX.read(buf, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 }) as string[][]
        noms = rows.flatMap(row => row).map(v => String(v ?? '').trim()).filter(Boolean)
      } else {
        const text = await file.text()
        noms = text.split(/[\n\r;,]+/).map(s => s.trim()).filter(Boolean)
      }
      if (noms.length === 0) { toast.error('Aucun nom trouvé dans le fichier'); return }

      let added = 0
      for (const nom of noms) {
        const { data, error } = await supabase
          .from('groupes')
          .insert({ nom })
          .select()
          .single()
        if (!error && data) {
          setGroupes(prev => {
            if (prev.some(g => g.nom === nom)) return prev
            return [...prev, data as Groupe].sort((a, b) => a.nom.localeCompare(b.nom))
          })
          added++
        }
      }
      toast.success(`${added} groupe(s) importé(s) sur ${noms.length}`)
    } finally {
      setImporting(false)
    }
  }

  async function handleAssignPole(groupeId: string, poleId: string | null) {
    const { error } = await supabase.from('groupes').update({ pole_id: poleId }).eq('id', groupeId)
    if (error) { toast.error('Erreur'); return }
    setGroupes(prev => prev.map(g => g.id === groupeId ? { ...g, pole_id: poleId } : g))
    toast.success('Groupe mis à jour')
  }

  async function handleRenameGroupe() {
    if (!editingGroupe?.nom.trim()) return
    const { error } = await supabase.from('groupes').update({ nom: editingGroupe.nom.trim() }).eq('id', editingGroupe.id)
    if (error) { toast.error('Erreur'); return }
    setGroupes(prev => prev.map(g => g.id === editingGroupe.id ? { ...g, nom: editingGroupe.nom.trim() } : g))
    setEditingGroupe(null)
    toast.success('Groupe renommé')
  }

  async function handleDeleteGroupe(groupeId: string) {
    await supabase.from('formateurs').update({ groupe_id: null }).eq('groupe_id', groupeId)
    await supabase.from('planning_fixe').delete().eq('groupe_formation_id', groupeId)
    const { error } = await supabase.from('groupes').delete().eq('id', groupeId)
    if (error) { toast.error('Erreur lors de la suppression'); return }
    setGroupes(prev => prev.filter(g => g.id !== groupeId))
    setDeletingGroupeId(null)
    toast.success('Groupe supprimé')
  }

  async function handleAddGroupe() {
    if (!newGroupe.nom.trim()) return
    const { data, error } = await supabase
      .from('groupes')
      .insert({ nom: newGroupe.nom.trim(), salle_id: newGroupe.salle_id || null, pole_id: newGroupe.pole_id || null })
      .select().single()
    if (error) { toast.error('Erreur lors de la création'); return }
    setGroupes(prev => [...prev, data as Groupe].sort((a, b) => a.nom.localeCompare(b.nom)))
    setNewGroupe({ nom: '', salle_id: '', pole_id: '' })
    setAdding(false)
    toast.success('Groupe créé')
  }

  return (
    <div className="space-y-4">
      {/* Import button */}
      <div className="flex items-center gap-2">
        <label className={`flex items-center gap-2 cursor-pointer rounded-lg border border-dashed border-[#00968C]/50 bg-[#00968C]/5 hover:bg-[#00968C]/10 px-3 py-2 text-sm font-medium text-[#00968C] transition-colors ${importing ? 'opacity-50 pointer-events-none' : ''}`}>
          <Upload className="h-4 w-4" />
          {importing ? 'Import en cours…' : 'Importer depuis Excel / CSV'}
          <input type="file" accept=".xlsx,.xls,.csv,.txt" className="sr-only" onChange={handleImport} disabled={importing} />
        </label>
        <span className="text-xs text-muted-foreground">Un nom par ligne (CSV) ou colonne A (Excel)</span>
      </div>

      <div className="rounded-lg border divide-y">
        {groupes.filter(g => !g.salle_id).map(groupe => {
          const pole = poles.find(p => p.id === groupe.pole_id)
          const isEditing = editingGroupe?.id === groupe.id
          return (
            <div key={groupe.id} className="flex items-center justify-between px-4 py-3 gap-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#00968C]/10">
                  <GraduationCap className="h-4 w-4 text-[#00968C]" />
                </div>
                {isEditing ? (
                  <div className="flex items-center gap-2 flex-1">
                    <Input
                      value={editingGroupe.nom}
                      onChange={e => setEditingGroupe(g => g ? { ...g, nom: e.target.value } : null)}
                      onKeyDown={e => { if (e.key === 'Enter') handleRenameGroupe(); if (e.key === 'Escape') setEditingGroupe(null) }}
                      className="h-7 text-sm flex-1 max-w-[200px]"
                      autoFocus
                    />
                    <Button size="sm" className="h-7 px-2" onClick={handleRenameGroupe}><Check className="h-3 w-3" /></Button>
                    <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setEditingGroupe(null)}><X className="h-3 w-3" /></Button>
                  </div>
                ) : (
                  <div>
                    <p className="font-medium text-sm">{groupe.nom}</p>
                  </div>
                )}
              </div>
              {!isEditing && (
                <div className="flex items-center gap-2 shrink-0">
                  {pole && (
                    <span className="text-xs text-[#005FAD] bg-[#005FAD]/10 px-2 py-0.5 rounded-full">{pole.nom}</span>
                  )}
                  <Select value={groupe.pole_id ?? ''} onValueChange={v => handleAssignPole(groupe.id, v || null)}>
                    <SelectTrigger className="h-7 w-36 text-xs">
                      <SelectValue placeholder="Affecter à un pôle" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">— Aucun pôle —</SelectItem>
                      {poles.filter(p => p.actif).map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.nom}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setEditingGroupe({ id: groupe.id, nom: groupe.nom })}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  {deletingGroupeId === groupe.id ? (
                    <div className="flex gap-1">
                      <Button size="sm" variant="destructive" className="h-7 px-2 text-xs" onClick={() => handleDeleteGroupe(groupe.id)}>
                        <Check className="h-3 w-3 mr-1" />Confirmer
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setDeletingGroupeId(null)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-muted-foreground hover:text-destructive" onClick={() => setDeletingGroupeId(groupe.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {adding ? (
        <div className="rounded-lg border p-4 space-y-3">
          <p className="text-sm font-medium">Nouveau groupe de formation</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Nom du groupe *</Label>
              <Input placeholder="ex: GRP-DEV-101" value={newGroupe.nom} onChange={e => setNewGroupe(p => ({ ...p, nom: e.target.value }))} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Salle attribuée</Label>
              <Select value={newGroupe.salle_id} onValueChange={v => setNewGroupe(p => ({ ...p, salle_id: v ?? '' }))}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Choisir une salle" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Aucune salle</SelectItem>
                  {salles.map(s => <SelectItem key={s.id} value={s.id}>{s.nom}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Pôle</Label>
              <Select value={newGroupe.pole_id} onValueChange={v => setNewGroupe(p => ({ ...p, pole_id: v ?? '' }))}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Choisir un pôle" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Aucun pôle</SelectItem>
                  {poles.filter(p => p.actif).map(p => <SelectItem key={p.id} value={p.id}>{p.nom}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAddGroupe} disabled={!newGroupe.nom.trim()}>Créer</Button>
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Annuler</Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4 mr-1" /> Ajouter un groupe
        </Button>
      )}
    </div>
  )
}

// ── Composant principal ───────────────────────────────────────

export function ParametresClient({ poles, salles, groupes, formateurs }: Props) {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <PageHeader
          icon={Settings}
          title="Paramètres"
          subtitle="Gérez les pôles, formateurs, salles et groupes de formation."
          badge="Config"
        />
        <PageDivider />
      </div>

      <Tabs defaultValue="poles">
        <TabsList className="mb-6">
          <TabsTrigger value="poles" className="gap-2 px-4">
            <Building2 className="h-4 w-4" /> Pôles
          </TabsTrigger>
          <TabsTrigger value="formateurs" className="gap-2 px-4">
            <Users className="h-4 w-4" /> Formateurs
          </TabsTrigger>
          <TabsTrigger value="salles" className="gap-2 px-4">
            <DoorOpen className="h-4 w-4" /> Salles
          </TabsTrigger>
          <TabsTrigger value="groupes" className="gap-2 px-4">
            <GraduationCap className="h-4 w-4" /> Groupes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="poles">
          <PolesTab initPoles={poles} initSalles={salles} initFormateurs={formateurs} initGroupes={groupes} />
        </TabsContent>

        <TabsContent value="formateurs">
          <FormateursTab initFormateurs={formateurs} poles={poles} groupes={groupes} />
        </TabsContent>

        <TabsContent value="salles">
          <SallesTab initSalles={salles} poles={poles} groupes={groupes} initFormateurs={formateurs} />
        </TabsContent>

        <TabsContent value="groupes">
          <GroupesTab initGroupes={groupes} poles={poles} salles={salles} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
