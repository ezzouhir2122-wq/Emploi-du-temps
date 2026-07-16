'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { CheckCircle2, Layers, RotateCcw, Users } from 'lucide-react'
import { PageHeader, PageDivider } from '@/components/layout/PageHeader'
import { cn } from '@/lib/utils'
import type { Scenario, ScenarioConfig } from '@/types/planning'

interface Props {
  scenarios: Scenario[]
}

const SCENARIO_ICONS = {
  groups_fixed:    Layers,
  groups_rotating: RotateCcw,
  pool_mixed:      Users,
}

const SCENARIO_COLORS = {
  groups_fixed:    'border-blue-200 bg-blue-50',
  groups_rotating: 'border-amber-200 bg-amber-50',
  pool_mixed:      'border-purple-200 bg-purple-50',
}

const TYPE_LABELS = {
  groups_fixed:    'Groupes fixes',
  groups_rotating: 'Rotation de salle',
  pool_mixed:      'Pool mixte',
}

function describeConfig(config: ScenarioConfig): string {
  if (config.type === 'groups_rotating') {
    return `Échange de salle toutes les ${config.rotation_weeks} semaines`
  }
  if (config.type === 'pool_mixed') {
    return `Règle : ${config.assignment_rule}`
  }
  return 'Configuration par défaut'
}

export function ScenariosClient({ scenarios: initialScenarios }: Props) {
  const [scenarios, setScenarios] = useState<Scenario[]>(initialScenarios)
  const [activating, setActivating] = useState<string | null>(null)
  const supabase = createClient()

  async function handleActivate(scenarioId: string) {
    setActivating(scenarioId)

    // Désactiver tous les scénarios
    const { error: err1 } = await supabase
      .from('scenarios')
      .update({ actif: false })
      .neq('id', 'NONE')  // Update all

    // Activer le scénario choisi
    const { error: err2 } = await supabase
      .from('scenarios')
      .update({ actif: true })
      .eq('id', scenarioId)

    if (err1 || err2) {
      toast.error('Erreur lors de l\'activation du scénario')
    } else {
      setScenarios(prev =>
        prev.map(s => ({ ...s, actif: s.id === scenarioId }))
      )
      toast.success('Scénario activé')
    }

    setActivating(null)
  }

  const actif = scenarios.find(s => s.actif)

  return (
    <div className="space-y-6">
      <div>
        <PageHeader
          icon={Layers}
          title="Scénarios d'organisation"
          subtitle="Comparez et activez différentes configurations d'affectation des salles."
          badge="A / B / C"
        />
        <PageDivider />
      </div>

      {actif && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
          <span className="text-sm text-green-800">
            Scénario actif : <strong>{actif.nom}</strong>
          </span>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {scenarios.map(scenario => {
          const config = scenario.config as ScenarioConfig
          const Icon = SCENARIO_ICONS[config.type] ?? Layers
          const colorClass = SCENARIO_COLORS[config.type] ?? ''

          return (
            <div
              key={scenario.id}
              className={cn(
                'rounded-lg border-2 p-5 flex flex-col gap-4 transition-all',
                scenario.actif ? 'border-green-400 bg-green-50' : colorClass
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Icon className="h-5 w-5 text-muted-foreground" />
                  <h2 className="font-semibold">{scenario.nom}</h2>
                </div>
                <div className="flex gap-1 flex-wrap">
                  <Badge variant="outline" className="text-xs">
                    {TYPE_LABELS[config.type] ?? config.type}
                  </Badge>
                  {scenario.actif && (
                    <Badge className="text-xs bg-green-600">Actif</Badge>
                  )}
                </div>
              </div>

              {scenario.description && (
                <p className="text-sm text-muted-foreground">{scenario.description}</p>
              )}

              <div className="text-xs text-muted-foreground bg-muted/50 rounded p-2 font-mono">
                {describeConfig(config)}
              </div>

              <Button
                variant={scenario.actif ? 'secondary' : 'outline'}
                size="sm"
                disabled={scenario.actif || activating === scenario.id}
                onClick={() => handleActivate(scenario.id)}
                className="mt-auto"
              >
                {scenario.actif
                  ? '✓ Scénario actif'
                  : activating === scenario.id
                  ? 'Activation...'
                  : 'Activer ce scénario'}
              </Button>
            </div>
          )
        })}
      </div>

      <div className="rounded-lg border bg-muted/30 p-4">
        <p className="text-sm font-medium mb-2">Règles communes à tous les scénarios</p>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
          <li>100% occupation des salles : 1 Matin + 1 Après-midi physique par jour</li>
          <li>Maximum 5 jours/semaine par formateur (Distance compte)</li>
          <li>Le cycle Samedi reste perpétuel dans tous les scénarios</li>
          <li>Distance libère la salle mais compte dans la masse horaire</li>
        </ul>
      </div>
    </div>
  )
}
