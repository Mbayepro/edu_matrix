import { Building, MoreVertical, Users } from 'lucide-react'
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
  onEdit: (ecole: Ecole) => void
  onToggleStatus: (ecole: Ecole) => void
  onDelete: (ecole: Ecole) => void
}

export default function EcoleTable({
  ecoles,
  searchQuery,
  onEdit,
  onToggleStatus,
  onDelete
}: EcoleTableProps) {
  const [actionMenuId, setActionMenuId] = useState<string | null>(null)

  const filteredEcoles = ecoles.filter(ecole =>
    ecole.nom?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ecole.ville?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
      {/* Desktop View */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-800/50 text-slate-300 font-medium">
            <tr>
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
