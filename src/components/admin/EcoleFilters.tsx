import { Filter, X } from 'lucide-react'

interface EcoleFiltersProps {
  statutFilter: string
  setStatutFilter: (value: string) => void
  villeFilter: string
  setVilleFilter: (value: string) => void
  hasActiveFilters: boolean
  onClear: () => void
}

export default function EcoleFilters({
  statutFilter,
  setStatutFilter,
  villeFilter,
  setVilleFilter,
  hasActiveFilters,
  onClear
}: EcoleFiltersProps) {
  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-white">
          <Filter className="w-4 h-4 text-slate-400" />
          Filtres
        </div>
        {hasActiveFilters && (
          <button
            onClick={onClear}
            className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
          >
            <X className="w-3 h-3" />
            Effacer
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">Statut</label>
          <select
            value={statutFilter}
            onChange={(e) => setStatutFilter(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
          >
            <option value="">Tous</option>
            <option value="actif">Actif</option>
            <option value="suspendu">Suspendu</option>
            <option value="en_attente">En attente</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">Ville</label>
          <input
            type="text"
            value={villeFilter}
            onChange={(e) => setVilleFilter(e.target.value)}
            placeholder="Filtrer par ville..."
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>
      </div>
    </div>
  )
}
