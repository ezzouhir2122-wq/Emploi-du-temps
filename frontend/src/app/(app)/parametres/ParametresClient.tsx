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
import { Settings, Plus, Pencil, Power, Building2, Users, DoorOpen, GraduationCap, Upload } from 'lucide-react'
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

  const [editingPole, setEditingPole] = useState<Pole | null>(null)
  const [editSalles, setEditSalles] = useState<string[]>([])
  const [editFormateurs, setEditFormateurs] = useState<string[]>([])
  const [editGroupes, setEditGroupes] = useState<string[]>([])

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

  async function applyAssignments(poleId: string, selSalles: string[], selFormateurs: string[], selGroupes: string[], prevPoleId?: string) {
    // Salles : affecter les sélectionnées, désaffecter les anciennes de ce pôle non sélectionnées
    const prevSalles = salles.filter(s => s.pole_id === (prevPoleId ?? poleId)).map(s => s.id)
    const toUnassignSalles = prevSalles.filter(id => !selSalles.includes(id))
    if (selSalles.length) await supabase.from('salles').update({ pole_id: poleId }).in('id', selSalles)
    if (toUnassignSalles.length) await supabase.from('salles').update({ pole_id: null }).in('id', toUnassignSalles)

    const prevFormateurs = formateurs.filter(f => f.pole_id === (prevPoleId ?? poleId)).map(f => f.id)
    const toUnassignF = prevFormateurs.filter(id => !selFormateurs.includes(id))
    if (selFormateurs.length) await supabase.from('formateurs').update({ pole_id: poleId }).in('id', selFormateurs)
    if (toUnassignF.length) await supabase.from('formateurs').update({ pole_id: null }).in('id', toUnassignF)

    // Groupes (partagés) : affecter sélectionnés, désaffecter ceux du pôle non sélectionnés
    const prevGroupes = groupes.filter(g => g.pole_id === (prevPoleId ?? poleId)).map(g => g.id)
    const toUnassignG = prevGroupes.filter(id => !selGroupes.includes(id))
    if (selGroupes.length) await supabase.from('groupes').update({ pole_id: poleId }).in('id', selGroupes)
    if (toUnassignG.length) await supabase.from('groupes').update({ pole_id: null }).in('id', toUnassignG)

    // Mise à jour état local
    setSalles(prev => prev.map(s => {
      if (selSalles.includes(s.id)) return { ...s, pole_id: poleId }
      if (toUnassignSalles.includes(s.id)) return { ...s, pole_id: null }
      return s
    }))
    setFormateurs(prev => prev.map(f => {
      if (selFormateurs.includes(f.id)) return { ...f, pole_id: poleId }
      if (toUnassignF.includes(f.id)) return { ...f, pole_id: null }
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
    await applyAssignments(created.id, newSalles, newFormateurs, newGroupes)
    setNewPole({ nom: '', code: '', description: '' })
    setNewSalles([]); setNewFormateurs([]); setNewGroupes([])
    toast.success('Pôle créé avec ses affectations')
  }

  function openEdit(pole: Pole) {
    setEditingPole(pole)
    setEditSalles(salles.filter(s => s.pole_id === pole.id).map(s => s.id))
    setEditFormateurs(formateurs.filter(f => f.pole_id === pole.id).map(f => f.id))
    setEditGroupes(groupes.filter(g => g.pole_id === pole.id).map(g => g.id))
  }

  async function handleUpdate() {
    if (!editingPole) return
    const { error } = await supabase
      .from('poles')
      .update({ nom: editingPole.nom.trim(), code: editingPole.code?.trim() || null, description: editingPole.description?.trim() || null })
      .eq('id', editingPole.id)
    if (error) { toast.error('Erreur lors de la mise à jour'); return }
    setPoles(prev => prev.map(p => p.id === editingPole.id ? editingPole : p))
    await applyAssignments(editingPole.id, editSalles, editFormateurs, editGroupes)
    setEditingPole(null)
    toast.success('Pôle mis à jour')
  }

  async function handleToggle(pole: Pole) {
    const { error } = await supabase.from('poles').update({ actif: !pole.actif }).eq('id', pole.id)
    if (error) { toast.error('Erreur'); return }
    setPoles(prev => prev.map(p => p.id === pole.id ? { ...p, actif: !p.actif } : p))
    toast.success(pole.actif ? 'Pôle désactivé' : 'Pôle activé')
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
              label="Groupes (partagés)"
              items={groupes}
              selected={editGroupes}
              onChange={setEditGroupes}
            />
          </div>
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
            label="Groupes (partagés)"
            items={groupes}
            selected={newGroupes}
            onChange={setNewGroupes}
          />
        </div>
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

function SallesTab({ initSalles, poles, groupes }: { initSalles: Salle[]; poles: Pole[]; groupes: Groupe[] }) {
  const [salles, setSalles] = useState<Salle[]>(initSalles)
  const [adding, setAdding] = useState(false)
  const [newSalle, setNewSalle] = useState({ nom: '', pole_id: '' })
  const supabase = createClient()

  async function handleAssignPole(salleId: string, poleId: string | null) {
    const { error } = await supabase.from('salles').update({ pole_id: poleId }).eq('id', salleId)
    if (error) { toast.error('Erreur'); return }
    setSalles(prev => prev.map(s => s.id === salleId ? { ...s, pole_id: poleId } : s))
    toast.success('Salle mise à jour')
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
          const groupe = groupes.find(g => g.salle_id === salle.id)
          const pole = poles.find(p => p.id === salle.pole_id)
          return (
            <div key={salle.id} className="flex items-center justify-between px-4 py-3 gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-100">
                  <DoorOpen className="h-4 w-4 text-amber-600" />
                </div>
                <div>
                  <p className="font-medium text-sm">{salle.nom}</p>
                  {groupe && <p className="text-xs text-muted-foreground">{groupe.nom}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {pole && (
                  <span className="text-xs text-[#005FAD] bg-[#005FAD]/10 px-2 py-0.5 rounded-full">{pole.nom}</span>
                )}
                <Select
                  value={salle.pole_id ?? ''}
                  onValueChange={v => handleAssignPole(salle.id, v || null)}
                >
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
        {groupes.map(groupe => {
          const salle = salles.find(s => s.id === groupe.salle_id)
          const pole = poles.find(p => p.id === groupe.pole_id)
          return (
            <div key={groupe.id} className="flex items-center justify-between px-4 py-3 gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#00968C]/10">
                  <GraduationCap className="h-4 w-4 text-[#00968C]" />
                </div>
                <div>
                  <p className="font-medium text-sm">{groupe.nom}</p>
                  {salle && <p className="text-xs text-muted-foreground">→ {salle.nom}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {pole && (
                  <span className="text-xs text-[#005FAD] bg-[#005FAD]/10 px-2 py-0.5 rounded-full">{pole.nom}</span>
                )}
                <Select
                  value={groupe.pole_id ?? ''}
                  onValueChange={v => handleAssignPole(groupe.id, v || null)}
                >
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
              </div>
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
          <SallesTab initSalles={salles} poles={poles} groupes={groupes} />
        </TabsContent>

        <TabsContent value="groupes">
          <GroupesTab initGroupes={groupes} poles={poles} salles={salles} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
