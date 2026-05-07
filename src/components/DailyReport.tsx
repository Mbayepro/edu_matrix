'use client'

import { useState, useEffect } from 'react'
import { db } from '@/lib/db'
import { getTodayDate } from '@/lib/dateUtils'
import { 
  BarChart3, CheckCircle2, AlertCircle, TrendingUp, 
  ArrowRight, Loader2, Save, History
} from 'lucide-react'
import { addToSyncQueue } from '@/lib/syncService'
import { useToast } from '@/contexts/ToastContext'

export default function DailyReport({ ecoleId }: { ecoleId: string }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [stats, setStats] = useState<any>(null)
  const { showToast } = useToast()

  useEffect(() => {
    if (ecoleId) calculateTodayStats()
  }, [ecoleId])

  async function calculateTodayStats() {
    if (!db) return
    setLoading(true)
    try {
      const today = getTodayDate()
      
      // 1. Présences
      const presRaw = await db.presences.where('date').equals(today).and(p => p.ecole_id === ecoleId).toArray()
      const totalEleves = await db.eleves.where('ecole_id').equals(ecoleId).count()
      const presents = presRaw.filter(p => p.statut === 'présent' || p.statut === 'retard').length
      const absents = presRaw.filter(p => p.statut === 'absent').length
      
      // 2. Émargements (Cours donnés)
      const emargements = await db.emargements.where('ecole_id').equals(ecoleId).and(e => e.date_heure.startsWith(today)).toArray()
      
      // 3. Paiements
      const paiements = await db.paiements.where('ecole_id').equals(ecoleId).and(p => p.date_paiement.startsWith(today)).toArray()
      const totalCaisse = paiements.reduce((sum, p) => sum + Number(p.montant), 0)

      setStats({
        presence_rate: totalEleves > 0 ? (presents / totalEleves) * 100 : 0,
        presents,
        absents,
        nb_emargements: emargements.length,
        total_paiements: totalCaisse,
        nb_paiements: paiements.length
      })

    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function archiveReport() {
    if (!stats || !ecoleId || !db) return
    setSaving(true)
    try {
      const today = getTodayDate()
      const reportId = crypto.randomUUID()
      const reportData = {
        id: reportId,
        ecole_id: ecoleId,
        date: today,
        stats: stats,
        created_at: new Date().toISOString()
      }

      await db.rapports_journaliers.put(reportData)
      await addToSyncQueue('rapports_journaliers', 'INSERT', reportData, ecoleId)
      
      showToast('Rapport journalier archivé !', 'success')
    } catch (err) {
      console.error(err)
      showToast('Erreur lors de l\'archivage', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 flex items-center justify-center min-h-[200px]">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    )
  }

  return (
    <div className="premium-glass rounded-[3rem] overflow-hidden h-full flex flex-col">
      <div className="p-8 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-4">
           <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10">
              <BarChart3 className="w-6 h-6 text-emerald-400" />
           </div>
           <div>
              <h2 className="font-black text-white text-base uppercase tracking-wider">Bilan du Jour</h2>
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Temps réel — {new Date().toLocaleDateString('fr-FR')}</p>
           </div>
        </div>
        <button 
          onClick={archiveReport}
          disabled={saving}
          className="p-3 rounded-xl bg-white/5 text-slate-400 hover:text-emerald-400 hover:bg-white/10 transition-all disabled:opacity-50 border border-white/10"
          title="Archiver le rapport"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        </button>
      </div>

      <div className="p-8 flex-1 space-y-6">
         {/* Stats Grid */}
         <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/5 rounded-3xl p-5 border border-white/5">
               <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Présence</p>
               <div className="flex items-center gap-2">
                  <span className="text-xl font-black text-white">{stats.presence_rate.toFixed(0)}%</span>
                  {stats.presence_rate >= 90 ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <AlertCircle className="w-4 h-4 text-amber-500" />}
               </div>
            </div>
            <div className="bg-white/5 rounded-3xl p-5 border border-white/5">
               <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Cours donnés</p>
               <div className="flex items-center gap-2">
                  <span className="text-xl font-black text-white">{stats.nb_emargements}</span>
                  <TrendingUp className="w-4 h-4 text-blue-500" />
               </div>
            </div>
         </div>

         {/* Financial Summary */}
         <div className="bg-emerald-600 rounded-[2rem] p-6 text-white relative overflow-hidden group shadow-lg shadow-emerald-900/20">
            <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-110" />
            <p className="text-[9px] font-black uppercase tracking-widest text-emerald-200 mb-1">Encaissements du jour</p>
            <div className="flex items-center justify-between">
               <h3 className="text-2xl font-black">{stats.total_paiements.toLocaleString('fr-FR')} <span className="text-sm font-bold opacity-70">FCFA</span></h3>
               <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <ArrowRight className="w-4 h-4" />
               </div>
            </div>
            <p className="text-[9px] font-bold text-emerald-100 mt-2">{stats.nb_paiements} transaction(s) aujourd&apos;hui</p>
         </div>

         {/* Today's Context */}
         <div className="space-y-3">
            <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">
               <span>Détails</span>
               <History className="w-3.5 h-3.5" />
            </div>
            <div className="space-y-2">
               <div className="flex justify-between items-center p-3 bg-white/5 rounded-xl border border-white/5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Élèves présents</span>
                  <span className="text-xs font-black text-white">{stats.presents}</span>
               </div>
               <div className="flex justify-between items-center p-3 bg-white/5 rounded-xl border border-white/5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Absences signalées</span>
                  <span className="text-xs font-black text-rose-500">{stats.absents}</span>
               </div>
            </div>
         </div>
      </div>

      <div className="p-8 pt-0">
         <button 
           onClick={() => showToast('Historique bientôt disponible', 'info')}
           className="w-full py-4 bg-white text-slate-900 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-400 transition-all shadow-xl shadow-black/20"
         >
           Voir l&apos;historique complet
         </button>
      </div>
    </div>
  )
}
