'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { db } from '@/lib/db'
import { addToSyncQueue } from '@/lib/syncService'
import { useProfile } from '@/hooks/useProfile'
import { useTeacherClasses } from '@/hooks/useTeacherClasses'
import { useNetwork } from '@/hooks/useNetwork'
import { useToast } from '@/contexts/ToastContext'
import { 
  BookOpen, 
  Users, 
  Calendar, 
  Clock, 
  FileText, 
  CheckCircle, 
  Loader2,
  ChevronRight,
  History
} from 'lucide-react'

export default function EmargementPage() {
  const router = useRouter()
  const { profile, loading: profileLoading } = useProfile()
  const { isOnline } = useNetwork()
  const { showToast } = useToast()
  
  // Hook for teacher's assigned classes and subjects
  const { assignations, classeIds, loading: assignLoading } = useTeacherClasses(profile?.id)

  const [classes, setClasses] = useState<any[]>([])
  const [matieres, setMatieres] = useState<any[]>([])
  const [history, setHistory] = useState<any[]>([])
  
  const [selectedClasse, setSelectedClasse] = useState('')
  const [selectedMatiere, setSelectedMatiere] = useState('')
  const [sujetCours, setSujetCours] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(true)

  // Load Classes and History from Dexie
  useEffect(() => {
    if (profile?.ecole_id) {
      loadInitialData()
    }
  }, [profile, classeIds])

  async function loadInitialData() {
    if (!db) return
    try {
      // 1. Classes assigned to teacher
      const classList = await db.classes.where('id').anyOf(classeIds).toArray()
      setClasses(classList)

      // 2. Load History (Last 5 emargements)
      const lastEmargements = await db.emargements
        .where('prof_id').equals(profile!.id)
        .reverse()
        .limit(5)
        .toArray()
      
      // Enrich history with names
      const allMatieres = await db.matieres.toArray()
      const matMap = new Map(allMatieres.map(m => [m.id, m.nom]))
      const classMap = new Map(classList.map(c => [c.id, c.nom_classe]))

      setHistory(lastEmargements.map(e => ({
        ...e,
        classe_nom: classMap.get(e.classe_id) || 'N/A',
        matiere_nom: matMap.get(e.matiere_id) || 'N/A'
      })))
    } catch (err) {
      console.error('Error loading initial data:', err)
    } finally {
      setLoadingHistory(false)
    }
  }

  // Load Matieres based on selected class
  useEffect(() => {
    if (selectedClasse) {
      loadMatieres(selectedClasse)
    } else {
      setMatieres([])
    }
  }, [selectedClasse, assignations])

  async function loadMatieres(classeId: string) {
    if (!db) return
    const assignedMatiereIds = assignations
      .filter(a => a.classe_id === classeId)
      .map(a => a.matiere_id)
      .filter(id => id !== null) as string[]

    let classMatieres = []
    if (assignedMatiereIds.length > 0) {
      classMatieres = await db.matieres.where('id').anyOf(assignedMatiereIds).toArray()
    } else {
      // If no specific subjects assigned, might be primary teacher or similar
      classMatieres = await db.matieres.where('ecole_id').equals(profile!.ecole_id!).toArray()
    }
    setMatieres(classMatieres)
  }

  async function handleEmarger() {
    if (!selectedClasse || !selectedMatiere || !sujetCours.trim()) {
      showToast('Veuillez remplir tous les champs.', 'error')
      return
    }

    setSubmitting(true)
    try {
      const newEmargement = {
        id: crypto.randomUUID(),
        prof_id: profile!.id,
        classe_id: selectedClasse,
        matiere_id: selectedMatiere,
        date_heure: new Date().toISOString(),
        sujet_cours: sujetCours,
        ecole_id: profile!.ecole_id!
      }

      // 1. Save to Dexie (Offline-First)
      await db.emargements.add(newEmargement)

      // 2. Add to Sync Queue
      await addToSyncQueue('emargements', 'INSERT', newEmargement, profile!.ecole_id!)

      showToast('Émargement enregistré avec succès !', 'success')
      
      // Reset form and reload history
      setSujetCours('')
      loadInitialData()
    } catch (err) {
      console.error('Error emargeant:', err)
      showToast('Erreur lors de l\'enregistrement.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  if (profileLoading || assignLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/10 flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-emerald-400" />
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Cahier de Textes</h1>
          </div>
          <p className="text-sm text-slate-500 font-medium tracking-tight">Enregistrez vos émargements et le contenu de vos cours.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Form */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-[2rem] border border-slate-200/60 shadow-sm p-8 space-y-6">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <div className="w-1.5 h-6 bg-emerald-600 rounded-full" />
Nouvel Émargement
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">Classe</label>
                <select 
                  value={selectedClasse} 
                  onChange={(e) => setSelectedClasse(e.target.value)}
                  className="w-full bg-slate-50 border-none rounded-xl px-4 py-3.5 text-sm font-bold text-slate-700 focus:ring-4 focus:ring-indigo-500/10"
                >
                  <option value="">Sélectionner une classe</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.nom_classe}</option>)}
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">Matière</label>
                <select 
                  value={selectedMatiere} 
                  onChange={(e) => setSelectedMatiere(e.target.value)}
                  disabled={!selectedClasse}
                  className="w-full bg-slate-50 border-none rounded-xl px-4 py-3.5 text-sm font-bold text-slate-700 focus:ring-4 focus:ring-indigo-500/10 disabled:opacity-50"
                >
                  <option value="">Sélectionner la matière</option>
                  {matieres.map(m => <option key={m.id} value={m.id}>{m.nom}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">Sujet / Titre du cours</label>
              <textarea 
                value={sujetCours}
                onChange={(e) => setSujetCours(e.target.value)}
                placeholder="Ex: Les équations du second degré..."
                className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-sm font-medium text-slate-700 focus:ring-4 focus:ring-indigo-500/10 min-h-[120px]"
              />
            </div>

            <button
              onClick={handleEmarger}
              disabled={submitting}
              className="w-full py-4 bg-emerald-600 text-white rounded-2xl text-sm font-black uppercase tracking-widest transition-all hover:bg-slate-900 shadow-xl shadow-indigo-600/20 disabled:bg-slate-300"
            >
              {submitting ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Valider mon Émargement'}
            </button>
          </div>
        </div>

        {/* Recent Activity / History */}
        <div className="space-y-6">
          <div className="bg-white rounded-[2rem] border border-slate-200/60 shadow-sm p-6">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2 mb-6">
              <History className="w-4 h-4 text-emerald-400" />
              Récents émargements
            </h3>

            {loadingHistory ? (
              <div className="flex justify-center py-6">
                <Loader2 className="w-6 h-6 animate-spin text-slate-200" />
              </div>
            ) : history.length === 0 ? (
              <p className="text-xs text-slate-400 font-medium text-center py-6 italic">Aucun historique local.</p>
            ) : (
              <div className="space-y-4">
                {history.map((h) => (
                  <div key={h.id} className="p-4 rounded-2xl bg-slate-50/50 border border-slate-100 space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded bg-white flex items-center justify-center shadow-sm">
                          <CheckCircle className="w-3 h-3 text-emerald-500" />
                        </div>
                        <span className="text-[10px] font-black uppercase text-emerald-400">{h.classe_nom}</span>
                      </div>
                      <span className="text-[9px] font-bold text-slate-400">{new Date(h.date_heure).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p className="text-xs font-bold text-slate-700 line-clamp-1">{h.sujet_cours}</p>
                    <p className="text-[9px] text-slate-400 font-medium">{h.matiere_nom}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-emerald-600 rounded-[2rem] p-6 text-white overflow-hidden relative group">
            <div className="relative z-10 space-y-4">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                <CheckCircle className="w-5 h-5" />
              </div>
              <h4 className="font-black text-lg">Mode Hors-ligne</h4>
              <p className="text-sm font-medium text-indigo-100">Vos émargements sont sauvegardés localement et synchronisés dès votre retour sur le réseau.</p>
            </div>
            <div className="absolute -right-4 -bottom-4 w-32 h-32 bg-white/10 rounded-full blur-3xl transition-all group-hover:scale-150" />
          </div>
        </div>
      </div>
    </div>
  )
}
