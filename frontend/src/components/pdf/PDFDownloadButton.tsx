'use client'

import { useState } from 'react'
import { FileDown, Loader2 } from 'lucide-react'
import type { JourSemaine, StatutFixe } from '@/types/planning'

export interface PDFDownloadButtonProps {
  formateurNom: string
  matricule?: string | null
  salleNom: string
  poleNom?: string | null
  planning: { jour_semaine: JourSemaine; statut: StatutFixe; groupe_nom?: string | null }[]
  totalSeances: number
  totalHeures: number
  dateGeneration: string
}

export function PDFDownloadButton(props: PDFDownloadButtonProps) {
  const [loading, setLoading] = useState(false)

  const handleClick = async () => {
    setLoading(true)
    try {
      // Chargement lazy — @react-pdf/renderer uniquement au clic
      const [{ pdf }, { createElement }, { FormateurPlanningPDF }] = await Promise.all([
        import('@react-pdf/renderer'),
        import('react'),
        import('./FormateurPlanningPDF'),
      ])

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const logoUrl = `${window.location.origin}/OFPPT_Logo.png`
      const blob = await pdf(createElement(FormateurPlanningPDF as any, { ...props, logoUrl }) as any).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `EDT_${props.formateurNom.replace(/\s+/g, '_')}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Erreur génération PDF', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      title="Exporter PDF"
      className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-all bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 hover:border-red-300 disabled:opacity-50 disabled:cursor-wait"
    >
      {loading
        ? <Loader2 className="h-3 w-3 animate-spin" />
        : <FileDown className="h-3 w-3" />
      }
      <span>PDF</span>
    </button>
  )
}
