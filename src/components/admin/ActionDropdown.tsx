import { MoreVertical, Edit, Power, PowerOff, Trash2 } from 'lucide-react'
import { useState } from 'react'

interface ActionDropdownProps {
  isOpen: boolean
  onClose: () => void
  onEdit?: () => void
  onToggleStatus?: () => void
  onDelete?: () => void
  itemType: 'ecole' | 'user'
  currentStatus?: 'actif' | 'suspendu' | 'en_attente'
}

export default function ActionDropdown({
  isOpen,
  onClose,
  onEdit,
  onToggleStatus,
  onDelete,
  itemType,
  currentStatus
}: ActionDropdownProps) {
  if (!isOpen) return null

  const handleAction = (action: () => void) => {
    action()
    onClose()
  }

  return (
    <div className="absolute right-0 top-full mt-1 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 overflow-hidden py-1 animate-in fade-in duration-150">
      {onEdit && (
        <button
          type="button"
          onClick={() => handleAction(onEdit)}
          className="w-full px-4 py-2 text-left text-sm text-slate-300 hover:bg-slate-700 hover:text-white flex items-center gap-2 transition-colors"
        >
          <Edit className="w-4 h-4" />
          Modifier
        </button>
      )}

      {onToggleStatus && (
        <button
          type="button"
          onClick={() => handleAction(onToggleStatus)}
          className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 transition-colors ${
            currentStatus === 'actif'
              ? 'text-amber-400 hover:bg-amber-500/10'
              : 'text-emerald-400 hover:bg-emerald-500/10'
          }`}
        >
          {currentStatus === 'actif' ? (
            <>
              <PowerOff className="w-4 h-4" />
              Suspendre
            </>
          ) : (
            <>
              <Power className="w-4 h-4" />
              Activer
            </>
          )}
        </button>
      )}

      {onDelete && (
        <>
          <div className="h-px bg-slate-700 my-1" />
          <button
            type="button"
            onClick={() => handleAction(onDelete)}
            className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 flex items-center gap-2 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Supprimer
          </button>
        </>
      )}
    </div>
  )
}
