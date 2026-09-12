import { CheckCircle2, XCircle, Clock } from 'lucide-react'

interface StatutBadgeProps {
  statut: 'actif' | 'suspendu' | 'en_attente'
}

export default function StatutBadge({ statut }: StatutBadgeProps) {
  switch (statut) {
    case 'actif':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Actif
        </span>
      )
    case 'suspendu':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
          <XCircle className="w-3.5 h-3.5" />
          Suspendu
        </span>
      )
    case 'en_attente':
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
          <Clock className="w-3.5 h-3.5" />
          En attente
        </span>
      )
  }
}
