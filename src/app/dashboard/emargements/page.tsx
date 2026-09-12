'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { db } from '@/lib/db'
import { addToSyncQueue } from '@/lib/syncService'
import { useProfile } from '@/hooks/useProfile'
import { useToast } from '@/contexts/ToastContext'
import { 
  ClipboardList, 
  Search, 
  Filter, 
  Edit2, 
  Trash2, 
  Loader2,
  Calendar,
  User,
  BookOpen,
  X,
  Check
} from 'lucide-react'

export default function AdminEmargementsPage() {
  const { profile, loading: profileLoading } = useProfile()
  const { showToast } = useToast()
  
  const [emargements, setEmargements] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  
  const [editingItem, setEditingItem] = useState<any | null>(null)
  
  // Enrichment maps
  const [profMap, setProfMap] = useState<Map<string, string>>(new Map())
  const [classMap, setClassMap] = useState<Map<string, string>>(new Map())
  const [matMap, setMatMap] = useState<Map<string, string>>(new Map())

  useEffect(() => {
    if (profile?.ecole_id) {
      loadData()
    }
  }, [profile])

  async function loadData() {
    if (!db || !profile?.ecole_id) return
    setLoading(true)
    try {
      const schoolId = profile.ecole_id
      const [raw, profs, classes, mats] = await Promise.all([
        db.emargements.where('ecole_id').equals(schoolId).reverse().toArray(),
        db.profiles.where('ecole_id').equals(schoolId).toArray(),
        db.classes.where('ecole_id').equals(schoolId).toArray(),
        db.matieres.where('ecole_id').equals(schoolId).toArray()
      ])

      setProfMap(new Map(profs.map(p => [p.id, `${p.prenom} ${p.nom}`])))
      setClassMap(new Map(classes.map(c => [c.id, c.nom_classe])))
      setMatMap(new Map(mats.map(m => [m.id, m.nom])))
      
      setEmargements(raw)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cet émargement ?')) return
    try {
      if (!db) return
      await db.emargements.delete(id)
      await addToSyncQueue('emargements', 'DELETE', { id }, profile!.ecole_id!)
      setEmargements(prev => prev.filter(e => e.id !== id))
      showToast('Émargement supprimé', 'success')
    } catch (err) {
      showToast('Erreur lors de la suppression', 'error')
    }
  }

  async function handleUpdate() {
    if (!editingItem || !editingItem.sujet_cours.trim() || !db) return
    try {
      await db.emargements.update(editingItem.id, { sujet_cours: editingItem.sujet_cours })
      await addToSyncQueue('emargements', 'UPDATE', { id: editingItem.id, sujet_cours: editingItem.sujet_cours }, profile!.ecole_id!)
      setEmargements(prev => prev.map(e => e.id === editingItem.id ? editingItem : e))
      setEditingItem(null)
      showToast('Émargement mis à jour', 'success')
    } catch (err) {
      showToast('Erreur lors de la mise à jour', 'error')
    }
  }

  const filtered = emargements.filter(e => {
    const profName = profMap.get(e.prof_id)?.toLowerCase() || ''
    const sujet = e.sujet_cours.toLowerCase()
    const matiere = matMap.get(e.matiere_id)?.toLowerCase() || ''
    const s = searchTerm.toLowerCase()
    return profName.includes(s) || sujet.includes(s) || matiere.includes(s)
  })

  if (profileLoading || loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-slate-300" />
      </div>
    )
  }

  // Seul le directeur ou superadmin peut accéder
  if (profile?.role !== 'director' && profile?.role !== 'superadmin') {
     return <div className="p-10 text-center text-slate-500 font-bold uppercase tracking-widest">Accès restreint à l'administration.</div>
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
             <div className="w-2 h-8 bg-emerald-500 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
             Cahier de Textes
          </h1>
          <p className="text-slate-500 font-medium mt-1">Suivi et gestion des cours dispensés par les professeurs.</p>
        </div>

        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-emerald-400 transition-colors" />
          <input 
            type="text"
            placeholder="Rechercher un prof, un sujet..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-11 pr-6 py-3.5 bg-slate-900 border border-slate-700 text-white placeholder-slate-500 rounded-2xl text-sm w-full md:w-80 shadow-sm focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all"
          />
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-slate-900 rounded-[2.5rem] border border-slate-800 shadow-xl overflow-hidden transition-all duration-300">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-800/50 border-b border-slate-800">
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Date & Heure</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Enseignant</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Classe / Matière</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Sujet du cours</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-8 py-20 text-center text-slate-500 italic font-medium">Aucun émargement trouvé.</td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-800/50 transition-colors group">
                    <td className="px-8 py-5 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 transition-transform group-hover:scale-110">
                           <Calendar className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white">
                            {new Date(item.date_heure).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                          </p>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            {new Date(item.date_heure).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-white text-[10px] font-black">
                          {profMap.get(item.prof_id)?.[0]}
                        </div>
                        <p className="text-sm font-bold text-slate-300">{profMap.get(item.prof_id)}</p>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                       <div className="flex flex-col gap-1">
                         <span className="inline-flex w-fit px-2.5 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-black uppercase tracking-tight">{classMap.get(item.classe_id)}</span>
                         <span className="text-[11px] font-bold text-slate-500 uppercase tracking-tighter">{matMap.get(item.matiere_id)}</span>
                       </div>
                    </td>
                    <td className="px-8 py-5 max-w-md">
                      <p className="text-sm text-slate-300 font-medium line-clamp-2 leading-relaxed">{item.sujet_cours}</p>
                    </td>
                    <td className="px-8 py-5 text-right whitespace-nowrap">
                       <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0">
                         <button 
                           onClick={() => setEditingItem(item)}
                           className="p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-emerald-400 hover:border-emerald-500/20 hover:bg-slate-700 transition-all"
                           title="Modifier"
                         >
                           <Edit2 className="w-4 h-4" />
                         </button>
                         <button 
                           onClick={() => handleDelete(item.id)}
                           className="p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-rose-400 hover:border-rose-500/20 hover:bg-slate-700 transition-all"
                           title="Supprimer"
                         >
                           <Trash2 className="w-4 h-4" />
                         </button>
                       </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xl animate-in fade-in duration-300" onClick={() => setEditingItem(null)} />
          <div className="relative bg-slate-900 rounded-[2.5rem] p-8 w-full max-w-lg shadow-2xl border border-slate-700/50 space-y-6 animate-in zoom-in-95 fade-in duration-200">
             <div className="flex items-center justify-between">
                <h3 className="text-2xl font-black text-white tracking-tight">Modifier le cours</h3>
                <button 
                  onClick={() => setEditingItem(null)} 
                  className="p-3 rounded-full bg-slate-800 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/20 border border-slate-700 transition-all"
                >
                  <X className="w-5 h-5"/>
                </button>
             </div>
             
             <div className="space-y-4">
                 <div className="p-5 bg-slate-800/50 rounded-2xl border border-slate-700">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Contexte du cours</p>
                   <div className="flex items-center gap-3">
                      <div className="px-2 py-1 bg-emerald-500/10 rounded-lg text-[10px] font-black text-emerald-400 border border-emerald-500/20">
                        {classMap.get(editingItem.classe_id)}
                      </div>
                      <p className="text-sm font-bold text-white">
                        {profMap.get(editingItem.prof_id)} <span className="text-slate-500">—</span> {matMap.get(editingItem.matiere_id)}
                      </p>
                   </div>
                </div>

                <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Contenu / Sujet du cours</label>
                   <textarea 
                     autoFocus
                     value={editingItem.sujet_cours}
                     onChange={(e) => setEditingItem({...editingItem, sujet_cours: e.target.value})}
                     className="w-full bg-slate-800 border border-slate-700 rounded-3xl px-6 py-5 text-sm font-medium text-white focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all min-h-[160px] resize-none"
                     placeholder="Entrez le sujet du cours..."
                   />
                </div>
             </div>

             <div className="flex flex-col gap-3 pt-2">
                 <button 
                   onClick={handleUpdate}
                   className="w-full py-4.5 bg-emerald-500 hover:bg-emerald-400 text-slate-900 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
                 >
                   <Check className="w-4 h-4" />
                   Mettre à jour le cahier
                 </button>
                 <button 
                   onClick={() => setEditingItem(null)}
                   className="w-full py-4 bg-slate-800 text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:text-white hover:bg-slate-700 transition-all"
                 >
                   Annuler
                 </button>
             </div>
          </div>
        </div>
      )}
    </div>
  )
}
