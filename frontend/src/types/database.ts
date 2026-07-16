// ============================================================
// Types de base de données Supabase
// Idéalement générés via : npx supabase gen types typescript --project-id <id> > src/types/database.ts
// Ce fichier sert de référence manuelle en attendant le typegen
// ============================================================

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Views: Record<string, never>
    Functions: Record<string, never>
    CompositeTypes: Record<string, never>
    Tables: {
      salles: {
        Row: {
          id: string
          nom: string
          created_at: string
        }
        Insert: {
          id?: string
          nom: string
          created_at?: string
        }
        Update: {
          id?: string
          nom?: string
          created_at?: string
        }
      }
      groupes: {
        Row: {
          id: string
          nom: string
          salle_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          nom: string
          salle_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          nom?: string
          salle_id?: string | null
          created_at?: string
        }
      }
      formateurs: {
        Row: {
          id: string
          nom: string
          groupe_id: string | null
          actif: boolean
          created_at: string
        }
        Insert: {
          id?: string
          nom: string
          groupe_id?: string | null
          actif?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          nom?: string
          groupe_id?: string | null
          actif?: boolean
          created_at?: string
        }
      }
      planning_fixe: {
        Row: {
          id: string
          formateur_id: string
          jour_semaine: 'Lundi' | 'Mardi' | 'Mercredi' | 'Jeudi' | 'Vendredi'
          statut: 'Matin' | 'Après-midi' | 'Distance' | 'Repos'
        }
        Insert: {
          id?: string
          formateur_id: string
          jour_semaine: 'Lundi' | 'Mardi' | 'Mercredi' | 'Jeudi' | 'Vendredi'
          statut: 'Matin' | 'Après-midi' | 'Distance' | 'Repos'
        }
        Update: {
          id?: string
          formateur_id?: string
          jour_semaine?: 'Lundi' | 'Mardi' | 'Mercredi' | 'Jeudi' | 'Vendredi'
          statut?: 'Matin' | 'Après-midi' | 'Distance' | 'Repos'
        }
      }
      rotation_samedi_config: {
        Row: {
          id: string
          groupe_id: string
          semaine_cycle: 1 | 2 | 3
          formateur_id: string
          statut: 'Matin' | 'Après-midi' | 'Repos'
        }
        Insert: {
          id?: string
          groupe_id: string
          semaine_cycle: 1 | 2 | 3
          formateur_id: string
          statut: 'Matin' | 'Après-midi' | 'Repos'
        }
        Update: {
          id?: string
          groupe_id?: string
          semaine_cycle?: 1 | 2 | 3
          formateur_id?: string
          statut?: 'Matin' | 'Après-midi' | 'Repos'
        }
      }
      cycle_reference: {
        Row: {
          id: string
          groupe_id: string
          date_ancrage: string
          semaine_cycle_ancrage: 1 | 2 | 3
        }
        Insert: {
          id?: string
          groupe_id: string
          date_ancrage: string
          semaine_cycle_ancrage: 1 | 2 | 3
        }
        Update: {
          id?: string
          groupe_id?: string
          date_ancrage?: string
          semaine_cycle_ancrage?: 1 | 2 | 3
        }
      }
      scenarios: {
        Row: {
          id: string
          nom: string
          description: string | null
          config: Json
          actif: boolean
          created_at: string
        }
        Insert: {
          id?: string
          nom: string
          description?: string | null
          config?: Json
          actif?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          nom?: string
          description?: string | null
          config?: Json
          actif?: boolean
          created_at?: string
        }
      }
    }
    Enums: {
      jour_semaine: 'Lundi' | 'Mardi' | 'Mercredi' | 'Jeudi' | 'Vendredi'
      statut_fixe: 'Matin' | 'Après-midi' | 'Distance' | 'Repos'
      statut_samedi: 'Matin' | 'Après-midi' | 'Repos'
    }
  }
}
