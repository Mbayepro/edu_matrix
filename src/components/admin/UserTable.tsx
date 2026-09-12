import { MoreVertical, Trash2 } from 'lucide-react'
import { useState } from 'react'
import RoleBadge from './RoleBadge'
import ActionDropdown from './ActionDropdown'

interface User {
  id: string
  prenom: string
  nom: string
  role: 'superadmin' | 'director' | 'teacher'
  created_at: string
  ecole?: { nom: string }
  ecole_id?: string
}

interface UserTableProps {
  users: User[]
  searchQuery: string
  roleFilter: string
  ecoleFilter: string
  onDelete: (user: User) => void
}

export default function UserTable({ users, searchQuery, roleFilter, ecoleFilter, onDelete }: UserTableProps) {
  const [actionMenuId, setActionMenuId] = useState<string | null>(null)

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.nom?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         user.prenom?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         user.ecole?.nom?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesRole = !roleFilter || user.role === roleFilter
    const matchesEcole = !ecoleFilter || user.ecole_id === ecoleFilter
    return matchesSearch && matchesRole && matchesEcole
  })

  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
      {/* Desktop View */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-800/50 text-slate-300 font-medium">
            <tr>
              <th className="px-4 py-3">Utilisateur</th>
              <th className="px-4 py-3">Rôle</th>
              <th className="px-4 py-3">École</th>
              <th className="px-4 py-3">Date d'inscription</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {filteredUsers.map((user) => (
              <tr key={user.id} className="hover:bg-slate-800/30 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-white font-bold shrink-0">
                      {user.prenom?.charAt(0)}{user.nom?.charAt(0)}
                    </div>
                    <div className="truncate max-w-[150px]">
                      <p className="font-medium text-white">{user.prenom} {user.nom}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <RoleBadge role={user.role} />
                </td>
                <td className="px-4 py-3 truncate max-w-[120px] text-slate-400">
                  {user.ecole?.nom || <span className="italic">Aucune</span>}
                </td>
                <td className="px-4 py-3 text-slate-400">
                  {new Date(user.created_at).toLocaleDateString('fr-FR')}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="relative inline-block text-left">
                    <button
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setActionMenuId(actionMenuId === user.id ? null : user.id)
                      }}
                      className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    <ActionDropdown
                      isOpen={actionMenuId === user.id}
                      onClose={() => setActionMenuId(null)}
                      onDelete={() => onDelete(user)}
                      itemType="user"
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
        {filteredUsers.map((user) => (
          <div key={user.id} className="p-4 space-y-3 hover:bg-slate-800/30 transition-colors">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-white font-bold shrink-0">
                  {user.prenom?.charAt(0)}{user.nom?.charAt(0)}
                </div>
                <div>
                  <p className="font-bold text-white">{user.prenom} {user.nom}</p>
                  <p className="text-xs text-slate-400">{user.ecole?.nom || 'Sans établissement'}</p>
                </div>
              </div>
              <div className="relative inline-block text-left">
                <button
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setActionMenuId(actionMenuId === user.id ? null : user.id)
                  }}
                  className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors border border-slate-700"
                >
                  <MoreVertical className="w-5 h-5" />
                </button>

                <ActionDropdown
                  isOpen={actionMenuId === user.id}
                  onClose={() => setActionMenuId(null)}
                  onDelete={() => onDelete(user)}
                  itemType="user"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <RoleBadge role={user.role} />
              <span className="text-xs text-slate-500">
                {new Date(user.created_at).toLocaleDateString('fr-FR')}
              </span>
            </div>
          </div>
        ))}
      </div>

      {filteredUsers.length === 0 && (
        <div className="p-12 text-center text-slate-500">
          <p>Aucun utilisateur trouvé</p>
        </div>
      )}
    </div>
  )
}
