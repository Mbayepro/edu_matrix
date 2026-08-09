'use client'

import { useState, useEffect } from 'react'
import { db } from '@/lib/db'
import { getTodayDate } from '@/lib/dateUtils'
import { detectAtRiskStudents, AtRiskStudent } from '@/lib/intelligence'
import { 
  X, Zap, TrendingUp, AlertCircle, CheckCircle2, 
  Users, DollarSign, BookOpen, Loader2, Award, Calendar, Download
} from 'lucide-react'
import { jsPDF } from 'jspdf'

interface FlashReportModalProps {
  isOpen: boolean
  onClose: () => void
  ecoleId: string
  ecoleNom?: string
}

export default function FlashReportModal({ isOpen, onClose, ecoleId, ecoleNom }: FlashReportModalProps) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any>(null)
  const [isExporting, setIsExporting] = useState(false)

  useEffect(() => {
    if (isOpen && ecoleId) {
      loadData()
    }
  }, [isOpen, ecoleId])

  async function loadData() {
    setLoading(true)
    try {
      const today = getTodayDate()
      
      // 1. Synthèse globale
      let totalEleves = 0
      let totalProfs = 0
      if (db) {
        totalEleves = await db.eleves.where('ecole_id').equals(ecoleId).count()
        totalProfs = await db.profiles.where('ecole_id').equals(ecoleId).and(p => p.role === 'teacher').count()
      }
      
      // 2. Présences
      let presRaw = []
      let presents = 0
      let absents = 0
      if (db) {
        presRaw = await db.presences.where('date').equals(today).and(p => p.ecole_id === ecoleId).toArray()
        presents = presRaw.filter(p => p.statut === 'présent' || p.statut === 'retard').length
        absents = presRaw.filter(p => p.statut === 'absent').length
      }
      const presenceRate = totalEleves > 0 ? ((presents / totalEleves) * 100).toFixed(1) : 0
      
      // 3. Finances
      let impayes = 0
      let paiementsJour = []
      let totalCaisseJour = 0
      if (db) {
        // Recalculer le statut pour corriger les faux positifs "impayé" (élèves sans frais)
        const eleves = await db.eleves.where('ecole_id').equals(ecoleId).toArray()
        for (const e of eleves) {
          await db.recalculateEleveStatus(e.id)
        }

        impayes = await db.eleves.where('ecole_id').equals(ecoleId).and(e => e.statut_paiement === 'impayé').count()
        paiementsJour = await db.paiements.where('ecole_id').equals(ecoleId).and(p => p.date_paiement.startsWith(today)).toArray()
        totalCaisseJour = paiementsJour.reduce((sum, p) => sum + Number(p.montant), 0)
      }

      // 4. Pédagogie (Élèves en difficulté)
      const risks = await detectAtRiskStudents(ecoleId)

      setData({
        totalEleves,
        totalProfs,
        presents,
        absents,
        presenceRate,
        impayes,
        totalCaisseJour,
        nbPaiementsJour: paiementsJour.length,
        risksCount: risks.length,
      })
    } catch (err) {
      console.error("Erreur lors de la génération du rapport flash:", err)
    } finally {
      setLoading(false)
    }
  }

  const exportPDF = () => {
    setIsExporting(true)
    try {
      const doc = new jsPDF()
      doc.setFontSize(22)
      doc.text(`Bilan du Jour - ${ecoleNom || 'Etablissement'}`, 20, 20)
      
      doc.setFontSize(12)
      doc.text(`Date : ${new Date().toLocaleDateString('fr-FR')}`, 20, 30)

      doc.setFontSize(16)
      doc.text("Sante Financiere", 20, 50)
      doc.setFontSize(12)
      doc.text(`Encaissements du jour : ${data?.totalCaisseJour?.toLocaleString('fr-FR')} FCFA`, 20, 60)
      doc.text(`Eleves avec paiements en retard : ${data?.impayes}`, 20, 70)

      doc.setFontSize(16)
      doc.text("Vie Scolaire", 20, 90)
      doc.setFontSize(12)
      doc.text(`Taux de presence : ${data?.presenceRate}%`, 20, 100)
      doc.text(`Absents du jour : ${data?.absents}`, 20, 110)

      doc.setFontSize(16)
      doc.text("Pedagogie", 20, 130)
      doc.setFontSize(12)
      doc.text(`Eleves en risque (chute de resultats) : ${data?.risksCount}`, 20, 140)

      doc.save(`Bilan_Du_Jour_${new Date().toISOString().split('T')[0]}.pdf`)
    } catch (e) {
      console.error(e)
    } finally {
      setIsExporting(false)
    }
  }

  if (!isOpen) return null

  // Narrative summary generation
  let narrative = ""
  if (data) {
    narrative = `Aujourd'hui, l'établissement compte **${data.totalEleves} élèves** et **${data.totalProfs} enseignants**. `
    narrative += `Le taux de présence est **${Number(data.presenceRate) >= 90 ? 'excellent' : Number(data.presenceRate) >= 75 ? 'moyen' : 'critique'} (${data.presenceRate}%)**. `
    
    if (data.impayes > 0) {
      narrative += `Attention, **${data.impayes} élèves** ont des retards de paiement. `
    } else {
      narrative += `Aucun retard de paiement signalé. `
    }

    if (data.risksCount > 0) {
      narrative += `Pédagogiquement, **${data.risksCount} élèves** nécessitent une attention particulière suite à une baisse de résultats.`
    } else {
      narrative += `La situation pédagogique globale est stable, aucun élève n'est en décrochage soudain.`
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-xl animate-in fade-in duration-300">
      <div 
        className="bg-slate-900 border border-slate-700/50 rounded-[2.5rem] w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl animate-in zoom-in-95 duration-300"
        onClick={e => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="sticky top-0 z-10 bg-slate-900/80 backdrop-blur-md p-6 sm:px-8 sm:py-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
              <Zap className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white">Bilan du Jour</h2>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
                Vue instantanée de l'établissement
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
             <button 
               onClick={exportPDF}
               disabled={loading || isExporting}
               className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-sm font-bold transition-all disabled:opacity-50"
             >
               {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
               <span>Export PDF</span>
             </button>
             <button 
               onClick={onClose}
               className="p-3 rounded-full bg-slate-800 hover:bg-rose-500/10 hover:text-rose-400 text-slate-400 transition-all border border-slate-700 hover:border-rose-500/20"
             >
               <X className="w-5 h-5" />
             </button>
          </div>
        </div>

        {/* BODY */}
        <div className="p-6 sm:p-8">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 className="w-10 h-10 animate-spin text-amber-400" />
              <p className="text-sm font-bold text-slate-400 animate-pulse">Génération du bilan...</p>
            </div>
          ) : data ? (
            <div className="space-y-8">
              
              {/* NARRATIVE SUMMARY */}
              <div className="bg-slate-800/50 rounded-3xl p-6 sm:p-8 border border-slate-700/50 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-amber-400 to-emerald-400" />
                <h3 className="text-sm font-black text-slate-300 uppercase tracking-widest mb-4 flex items-center gap-2">
                   <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                   Le mot de synthèse
                </h3>
                <p className="text-lg sm:text-xl text-white font-medium leading-relaxed" 
                   dangerouslySetInnerHTML={{ __html: narrative.replace(/\*\*(.*?)\*\*/g, '<span class="text-amber-400 font-bold">$1</span>') }}>
                </p>
              </div>

              {/* METRICS GRID */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* FINANCES */}
                <div className="bg-slate-800/30 rounded-3xl p-6 border border-slate-700/50 hover:bg-slate-800/50 transition-colors">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                      <DollarSign className="w-5 h-5 text-emerald-400" />
                    </div>
                    <h4 className="font-bold text-white uppercase text-sm">Finances</h4>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Caisse du Jour</p>
                      <p className="text-2xl font-black text-emerald-400">{data.totalCaisseJour.toLocaleString('fr-FR')} <span className="text-sm">FCFA</span></p>
                      <p className="text-xs text-slate-500 font-medium">{data.nbPaiementsJour} transaction(s)</p>
                    </div>
                    <div className="h-px w-full bg-slate-700/50" />
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Impayés / Retards</p>
                      <div className="flex items-center gap-2">
                        <p className={`text-xl font-black ${data.impayes > 0 ? 'text-rose-400' : 'text-slate-300'}`}>{data.impayes}</p>
                        {data.impayes > 0 && <AlertCircle className="w-4 h-4 text-rose-400" />}
                      </div>
                    </div>
                  </div>
                </div>

                {/* VIE SCOLAIRE */}
                <div className="bg-slate-800/30 rounded-3xl p-6 border border-slate-700/50 hover:bg-slate-800/50 transition-colors">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                      <Users className="w-5 h-5 text-blue-400" />
                    </div>
                    <h4 className="font-bold text-white uppercase text-sm">Vie Scolaire</h4>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Présence</p>
                      <p className="text-2xl font-black text-blue-400">{data.presenceRate}%</p>
                      <p className="text-xs text-slate-500 font-medium">{data.presents} présents</p>
                    </div>
                    <div className="h-px w-full bg-slate-700/50" />
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Absences signalées</p>
                      <div className="flex items-center gap-2">
                        <p className={`text-xl font-black ${data.absents > 0 ? 'text-amber-400' : 'text-slate-300'}`}>{data.absents}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* PEDAGOGIE */}
                <div className="bg-slate-800/30 rounded-3xl p-6 border border-slate-700/50 hover:bg-slate-800/50 transition-colors">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
                      <BookOpen className="w-5 h-5 text-violet-400" />
                    </div>
                    <h4 className="font-bold text-white uppercase text-sm">Pédagogie</h4>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Effectif Total</p>
                      <p className="text-2xl font-black text-violet-400">{data.totalEleves}</p>
                      <p className="text-xs text-slate-500 font-medium">Pour {data.totalProfs} profs</p>
                    </div>
                    <div className="h-px w-full bg-slate-700/50" />
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Élèves en difficulté</p>
                      <div className="flex items-center gap-2">
                        <p className={`text-xl font-black ${data.risksCount > 0 ? 'text-rose-400' : 'text-slate-300'}`}>{data.risksCount}</p>
                        {data.risksCount > 0 && <TrendingUp className="w-4 h-4 text-rose-400 rotate-180" />}
                      </div>
                    </div>
                  </div>
                </div>

              </div>

            </div>
          ) : (
            <div className="text-center text-slate-500">Erreur de chargement des données.</div>
          )}
        </div>
      </div>
    </div>
  )
}
