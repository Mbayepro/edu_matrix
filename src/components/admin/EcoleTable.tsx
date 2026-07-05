import { Building, MoreVertical, Users, Check } from 'lucide-react'
import { useState } from 'react'
import StatutBadge from './StatutBadge'
import ActionDropdown from './ActionDropdown'

interface Ecole {
  id: string
  nom: string
  ville: string
  statut: 'actif' | 'suspendu' | 'en_attente'
  created_at: string
  profiles?: [{ count: number }]
}

interface EcoleTableProps {
  ecoles: Ecole[]
  searchQuery: string
  statutFilter: string
  villeFilter: string
  onEdit: (ecole: Ecole) => void
  onToggleStatus: (ecole: Ecole) => void
  onDelete: (ecole: Ecole) => void
  onBulkToggleStatus: (ecoleIds: string[], newStatus: string) => void
  onBulkDelete: (ecoleIds: string[]) => void
}

export default function EcoleTable({
  ecoles,
  searchQuery,
  statutFilter,
  villeFilter,
  onEdit,
  onToggleStatus,
  onDelete,
  onBulkToggleStatus,
  onBulkDelete
}: EcoleTableProps) {
  const [actionMenuId, setActionMenuId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const filteredEcoles = ecoles.filter(ecole => {
    const matchesSearch = ecole.nom?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         ecole.ville?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatut = !statutFilter || ecole.statut === statutFilter
    const matchesVille = !villeFilter || ecole.ville?.toLowerCase().includes(villeFilter.toLowerCase())
    return matchesSearch && matchesStatut && matchesVille
  })

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredEcoles.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredEcoles.map(e => e.id)))
    }
  }

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
  }

  const handleBulkAction = (action: 'activate' | 'suspend' | 'delete') => {
    const ids = Array.from(selectedIds)
    if (action === 'delete') {
      onBulkDelete(ids)
    } else {
      onBulkToggleStatus(ids, action === 'activate' ? 'actif' : 'suspendu')
    }
    setSelectedIds(new Set())
  }

  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="bg-emerald-600/10 border-b border-emerald-600/20 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-emerald-400">
            <Check className="w-4 h-4" />
            <span>{selectedIds.size} école(s) sélectionnée(s)</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleBulkAction('activate')}
              className="px-3 py-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 rounded-lg hover:bg-emerald-500/20 transition-colors"
            >
              Activer
            </button>
            <button
              onClick={() => handleBulkAction('suspend')}
              className="px-3 py-1.5 text-xs font-medium text-amber-400 bg-amber-500/10 rounded-lg hover:bg-amber-500/20 transition-colors"
            >
              Suspendre
            </button>
            <button
              onClick={() => handleBulkAction('delete')}
              className="px-3 py-1.5 text-xs font-medium text-red-400 bg-red-500/10 rounded-lg hover:bg-red-500/20 transition-colors"
            >
              Supprimer
            </button>
          </div>
        </div>
      )}

      {/* Desktop View */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-800/50 text-slate-300 font-medium">
            <tr>
              <th className="px-4 py-3 w-10">
                <input
                  type="checkbox"
                  checked={selectedIds.size === filteredEcoles.length && filteredEcoles.length > 0}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-900"
                />
              </th>
              <th className="px-4 py-3">Nom</th>
              <th className="px-4 py-3">Ville</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3">Utilisateurs</th>
              <th className="px-4 py-3">Date création</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {filteredEcoles.map((ecole) => (
              <tr key={ecole.id} className="hover:bg-slate-800/30 transition-colors">
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(ecole.id)}
                    onChange={() => toggleSelect(ecole.id)}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-900"
                  />
                </td>
                <td className="px-4 py-3 font-medium text-white">{ecole.nom}</td>
                <td className="px-4 py-3 text-slate-400">{ecole.ville}</td>
                <td className="px-4 py-3">
                  <StatutBadge statut={ecole.statut} />
                </td>
                <td className="px-4 py-3">
                  <span className="bg-slate-800 px-2 py-0.5 rounded text-xs text-slate-300 flex items-center gap-1 w-fit">
                    <Users className="w-3 h-3" />
                    {ecole.profiles?.[0]?.count || 0}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-400">
                  {new Date(ecole.created_at).toLocaleDateString('fr-FR')}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="relative inline-block text-left">
                    <button
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setActionMenuId(actionMenuId === ecole.id ? null : ecole.id)
                      }}
                      className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    <ActionDropdown
                      isOpen={actionMenuId === ecole.id}
                      onClose={() => setActionMenuId(null)}
                      onEdit={() => onEdit(ecole)}
                      onToggleStatus={() => onToggleStatus(ecole)}
                      onDelete={() => onDelete(ecole)}
                      itemType="ecole"
                      currentStatus={ecole.statut}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile View */}
      <div className="md:hidden divide-y divide-slate-800">
        {filteredEcoles.map((ecole) => (
          <div key={ecole.id} className="p-4 space-y-3 hover:bg-slate-800/30 transition-colors">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-bold text-white">{ecole.nom}</h3>
                <p className="text-sm text-slate-400 flex items-center gap-1 mt-1">
                  <Building className="w-3 h-3" />
                  {ecole.ville || 'Ville non spécifiée'}
                </p>
              </div>
              <div className="relative inline-block text-left">
                <button
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setActionMenuId(actionMenuId === ecole.id ? null : ecole.id)
                  }}
                  className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors border border-slate-700"
                >
                  <MoreVertical className="w-5 h-5" />
                </button>

                <ActionDropdown
                  isOpen={actionMenuId === ecole.id}
                  onClose={() => setActionMenuId(null)}
                  onEdit={() => onEdit(ecole)}
                  onToggleStatus={() => onToggleStatus(ecole)}
                  onDelete={() => onDelete(ecole)}
                  itemType="ecole"
                  currentStatus={ecole.statut}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <StatutBadge statut={ecole.statut} />
              <span className="bg-slate-800 px-2 py-1 rounded text-xs text-slate-300 flex items-center gap-1">
                <Users className="w-3 h-3" />
                {ecole.profiles?.[0]?.count || 0}
              </span>
              <span className="text-xs text-slate-500">
                {new Date(ecole.created_at).toLocaleDateString('fr-FR')}
              </span>
            </div>
          </div>
        ))}
      </div>

      {filteredEcoles.length === 0 && (
        <div className="p-12 text-center text-slate-500">
          <p>Aucune école trouvée</p>
        </div>
      )}
    </div>
  )
}
