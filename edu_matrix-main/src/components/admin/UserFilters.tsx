import { Filter, X } from 'lucide-react'

interface UserFiltersProps {
  roleFilter: string
  setRoleFilter: (value: string) => void
  ecoleFilter: string
  setEcoleFilter: (value: string) => void
  hasActiveFilters: boolean
  onClear: () => void
  ecoles: { id: string; nom: string }[]
}

export default function UserFilters({
  roleFilter,
  setRoleFilter,
  ecoleFilter,
  setEcoleFilter,
  hasActiveFilters,
  onClear,
  ecoles
}: UserFiltersProps) {
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
          <label className="block text-xs font-medium text-slate-400 mb-1.5">Rôle</label>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
          >
            <option value="">Tous</option>
            <option value="superadmin">Super Admin</option>
            <option value="director">Directeur</option>
            <option value="teacher">Enseignant</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">École</label>
          <select
            value={ecoleFilter}
            onChange={(e) => setEcoleFilter(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
          >
            <option value="">Toutes</option>
            {ecoles.map((ecole) => (
              <option key={ecole.id} value={ecole.id}>
                {ecole.nom}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}
