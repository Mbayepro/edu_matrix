'use client'

import { useEffect, useState, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { CalculateurMoyennes } from '@/lib/calculMoyennes'
import type { BulletinData } from '@/lib/calculMoyennes'
import type { Classe, Ecole } from '@/lib/supabase'
import {
  generateSingleBulletinPDF,
  generateAllBulletinsPDF as generateAllPDF,
} from '@/lib/bulletinPdfGenerator'
import {
  Loader2,
  Download,
  FileText,
  AlertCircle,
  Cloud,
  KeyRound,
} from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { useTeacherClasses } from '@/hooks/useTeacherClasses'
import { useNetwork } from '@/hooks/useNetwork'
import { db } from '@/lib/db'

export default function BulletinsPage() {
  const searchParams = useSearchParams()
  const [ecoleId, setEcoleId] = useState<string | null>(null)
  const [profileId, setProfileId] = useState<string | null>(null)
  const [isTeacher, setIsTeacher] = useState(false)
  const [ecole, setEcole] = useState<Ecole | null>(null)
  const [classes, setClasses] = useState<Classe[]>([])
  const [selectedClasse, setSelectedClasse] = useState<string>('')
  const [selectedTrimestre, setSelectedTrimestre] = useState<1 | 2 | 3>(1)
  const [anneeScolaire, setAnneeScolaire] = useState(() => {
    const today = new Date();
    return today.getMonth() >= 8 
      ? `${today.getFullYear()}-${today.getFullYear() + 1}`
      : `${today.getFullYear() - 1}-${today.getFullYear()}`
  })
  const [typePeriode, setTypePeriode] = useState<'trimestre' | 'semestre'>('trimestre')
  const [bulletins, setBulletins] = useState<BulletinData[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingBulletins, setLoadingBulletins] = useState(false)
  const [generating, setGenerating] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [includePIN, setIncludePIN] = useState(false)
  const { showToast } = useToast()
  
  const { isOnline } = useNetwork()

  // Professeur : uniquement ses classes assignées
  const { classeIds: teacherClasseIds, loading: teacherLoading } = useTeacherClasses(
    isTeacher ? profileId : null
  )

  // Générer les années scolaires disponibles
  const anneesScolaires = [
    '2023-2024',
    '2024-2025',
    '2025-2026',
    '2026-2027',
    '2027-2028'
  ]

  useEffect(() => {
    init()
  }, [])

  useEffect(() => {
    const c = searchParams.get('classe')
    const t = searchParams.get('trimestre')
    if (c) setSelectedClasse(c)
    if (t) setSelectedTrimestre(Number(t) as 1 | 2 | 3)
  }, [searchParams])

  useEffect(() => {
    if (ecoleId) {
      if (isTeacher && teacherLoading) return
      Promise.all([loadEcole(), loadClasses()]).finally(() => {
        setLoading(false)
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ecoleId, isTeacher, teacherLoading, useMemo(() => teacherClasseIds.join(','), [teacherClasseIds])])

  useEffect(() => {
    if (selectedClasse && selectedTrimestre && anneeScolaire) {
      loadBulletins()
    }
  }, [selectedClasse, selectedTrimestre, anneeScolaire, isOnline])

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }

    const { data: prof } = await supabase
      .from('profiles')
      .select('id, ecole_id, role')
      .eq('user_id', user.id)
      .single() as { data: { id: string; ecole_id: string | null; role: string } | null; error: unknown }
    
    if (prof?.ecole_id) {
      setEcoleId(prof.ecole_id)
      setProfileId(prof.id)
      setIsTeacher(prof.role === 'teacher')
    } else {
      setLoading(false)
    }
  }

  async function loadEcole() {
    if (!ecoleId) return
    const { data } = await supabase.from('ecoles').select('*').eq('id', ecoleId).single() as { data: import('@/lib/supabase').Ecole | null; error: unknown }
    setEcole(data)
    if (data?.type_periode) {
      setTypePeriode(data.type_periode)
    }
  }

  async function loadClasses() {
    if (!ecoleId) return
    
    // Fallback Dexie si offline ou pour rapidité
    const localClasses = await db?.classes.where('ecole_id').equals(ecoleId).toArray()
    if (localClasses?.length) {
      setClasses(localClasses as any)
      return
    }

    if (isTeacher) {
      if (teacherClasseIds.length === 0) {
        setClasses([])
        return
      }
      const { data } = await supabase.from('classes').select('*').in('id', teacherClasseIds).order('nom_classe')
      setClasses(data ?? [])
    } else {
      const { data } = await supabase.from('classes').select('*').eq('ecole_id', ecoleId).order('nom_classe')
      setClasses(data ?? [])
    }
  }

  async function loadBulletins() {
    if (!selectedClasse || !selectedTrimestre) return
    setLoadingBulletins(true)
    setErrorMsg(null)
    try {
      if (isOnline) {
        const bulletinsData = await CalculateurMoyennes.genererBulletinsClasse(selectedClasse, selectedTrimestre, anneeScolaire)
        setBulletins(bulletinsData)
        if (bulletinsData.length > 0 && bulletinsData.filter(b => b.matieres.length > 0).length > 0) {
          showToast(`${bulletinsData.length} bulletins calculés (Cloud).`, 'success')
        }
      } else {
        // OFFLINE MODE via Dexie
        const bulletinsData = await db?.getBulletinsCalculés(selectedClasse, selectedTrimestre, anneeScolaire)
        setBulletins(bulletinsData || [])
        if (bulletinsData && bulletinsData.length > 0) {
          showToast(`${bulletinsData.length} bulletins calculés (Mode Hors-ligne).`, 'info')
        }
      }
    } catch (error: any) {
      console.error(error)
      setErrorMsg(error.message || 'Erreur lors du calcul')
      setBulletins([])
    } finally {
      setLoadingBulletins(false)
    }
  }

  async function generateBulletinPDF(bulletin: BulletinData) {
    setGenerating(bulletin.eleve.id)
    try {
      await generateSingleBulletinPDF(bulletin, ecole, typePeriode, includePIN)
      showToast('PDF téléchargé avec succès !', 'success')
    } catch (e) {
      console.error(e)
      showToast('Erreur lors de la génération du PDF.', 'error')
    } finally {
      setGenerating(null)
    }
  }

  async function handleGenerateAll() {
    if (bulletins.length === 0) return
    setGenerating('all')
    try {
      const classeNom = classes.find(c => c.id === selectedClasse)?.nom_classe || 'Classe'
      await generateAllPDF(bulletins, ecole, typePeriode, classeNom, includePIN)
      showToast(`${bulletins.length} bulletins exportés en PDF !`, 'success')
    } catch (e) {
      console.error(e)
      showToast('Erreur lors de la génération des PDFs.', 'error')
    } finally {
      setGenerating(null)
    }
  }


  const selectedClasseData = classes.find(c => c.id === selectedClasse)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex items-center gap-2 text-slate-500 text-sm">
          <Loader2 className="w-5 h-5 animate-spin" />
          Chargement...
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-600/10 flex items-center justify-center border border-emerald-500/20">
              <FileText className="w-4 h-4 text-emerald-400" />
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">Bulletins Scolaires</h1>
          </div>
          <p className="text-sm text-slate-400 font-medium tracking-tight">
            Sélectionnez une classe pour calculer les moyennes et générer les bulletins officiels.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Cloud Indicator */}
          <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 transition-all ${
            isOnline ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-white/5 border-white/5 text-slate-400'
          }`}>
            <Cloud className={`w-4 h-4 ${isOnline ? 'fill-emerald-400 animate-pulse' : 'fill-slate-400'}`} />
            <span className="text-[10px] font-black uppercase tracking-widest">
              {isOnline ? 'Prêt à imprimer' : 'Hors-ligne'}
            </span>
          </div>

          {bulletins.length > 0 && (
            <button
              onClick={handleGenerateAll}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg bg-emerald-600 text-white hover:bg-emerald-500 shadow-emerald-600/20 hover:scale-105 active:scale-95"
            >
              {generating === 'all' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              Imprimer tous les bulletins
            </button>
          )}
        </div>
      </div>

      <div className="premium-glass rounded-[2rem] p-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Classe / Structure</label>
            <select 
              value={selectedClasse} 
              onChange={(e) => setSelectedClasse(e.target.value)} 
              className="w-full bg-white/5 border border-white/5 rounded-xl px-4 py-3.5 text-sm font-black text-white focus:ring-4 focus:ring-emerald-500/10 focus:bg-white/10 transition-all appearance-none"
            >
              <option value="" className="bg-slate-900">Sélectionner</option>
              {classes.map(cls => <option key={cls.id} value={cls.id} className="bg-slate-900">{cls.nom_classe}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Période scolaire</label>
            <select 
              value={selectedTrimestre} 
              onChange={(e) => setSelectedTrimestre(Number(e.target.value) as 1|2|3)} 
              className="w-full bg-white/5 border border-white/5 rounded-xl px-4 py-3.5 text-sm font-black text-white focus:ring-4 focus:ring-emerald-500/10 focus:bg-white/10 transition-all appearance-none"
            >
              {typePeriode === 'semestre' ? (
                <>
                  <option value={1} className="bg-slate-900">1er Semestre</option>
                  <option value={2} className="bg-slate-900">2ème Semestre</option>
                </>
              ) : (
                <>
                  <option value={1} className="bg-slate-900">1er Trimestre</option>
                  <option value={2} className="bg-slate-900">2ème Trimestre</option>
                  <option value={3} className="bg-slate-900">3ème Trimestre</option>
                </>
              )}
            </select>
          </div>
          <div className="space-y-2">
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Année Scolaire</label>
            <select 
              value={anneeScolaire} 
              onChange={(e) => setAnneeScolaire(e.target.value)} 
              className="w-full bg-white/5 border border-white/5 rounded-xl px-4 py-3.5 text-sm font-black text-white focus:ring-4 focus:ring-emerald-500/10 focus:bg-white/10 transition-all appearance-none"
            >
              {anneesScolaires.map(an => <option key={an} value={an} className="bg-slate-900">{an}</option>)}
            </select>
          </div>
          {/* Toggle PIN Parent */}
          <div className="flex items-center gap-3 pt-6">
            <button
              onClick={() => setIncludePIN(v => !v)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest border-2 transition-all ${
                includePIN
                  ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                  : 'bg-white/5 border-white/5 text-slate-400'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              PIN Parent {includePIN ? 'inclus' : 'masqué'}
            </button>
          </div>
        </div>
      </div>

      {!isOnline && bulletins.length > 0 && (
         <div className="bg-amber-500/10 border-l-4 border-amber-500 p-4 rounded-r-2xl border border-white/5 animate-in slide-in-from-left duration-300">
           <div className="flex items-center gap-3">
             <AlertCircle className="w-5 h-5 text-amber-400" />
             <p className="text-sm font-bold text-amber-300">
               Mode Consultation activé. Reconnectez-vous pour générer les PDF officiels.
             </p>
           </div>
         </div>
      )}

      {loadingBulletins && (
        <div className="flex flex-col items-center justify-center p-20 gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-emerald-400" />
          <p className="text-sm font-bold text-slate-400 animate-pulse uppercase tracking-widest text-center">
            Calcul des moyennes et préparation des bulletins en cours...<br/>
            <span className="text-[10px] opacity-70">Cette opération peut prendre quelques secondes.</span>
          </p>
        </div>
      )}

      {bulletins.length === 0 && !loadingBulletins && (
        <div className="premium-glass rounded-[2rem] p-20 text-center space-y-4">
          <div className="w-20 h-20 rounded-3xl bg-white/5 flex items-center justify-center mx-auto border border-white/10">
            <FileText className="w-10 h-10 text-slate-500" />
          </div>
          <div className="max-w-xs mx-auto">
            <h3 className="text-lg font-black text-white uppercase tracking-tight">Aucun bulletin à afficher</h3>
            <p className="text-sm text-slate-500 font-medium">
              {!selectedClasse 
                ? "Veuillez d'abord sélectionner une classe et une période dans les filtres ci-dessus." 
                : "Aucune note n'a été saisie pour cette classe sur cette période."}
            </p>
          </div>
        </div>
      )}

      {bulletins.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in duration-500">
          {bulletins.map((bulletin) => (
            <div key={bulletin.eleve.id} className="premium-glass rounded-[2rem] p-6 border border-white/5 hover:border-emerald-500/30 transition-all duration-300 hover:scale-[1.01] hover:shadow-xl hover:shadow-emerald-950/20 group">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 text-white flex items-center justify-center font-black uppercase">
                    {bulletin.eleve.prenom[0]}{bulletin.eleve.nom[0]}
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white">{bulletin.eleve.prenom} {bulletin.eleve.nom}</h3>
                    <p className="text-[10px] font-black uppercase text-slate-500 tracking-wider mt-0.5">{bulletin.eleve.matricule || 'N/A'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-[10px] uppercase font-black text-slate-500">Moyenne</p>
                    <div className="flex items-center gap-2">
                      {bulletin.annual?.progression !== null && bulletin.annual?.progression !== undefined && (
                        <div className={`flex items-center text-[10px] font-black ${bulletin.annual.progression >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {bulletin.annual.progression >= 0 ? '↑' : '↓'}
                          {Math.abs(bulletin.annual.progression).toFixed(2)}
                        </div>
                      )}
                      <p className="text-xl font-black text-white">{bulletin.moyenne_generale.toFixed(2)}</p>
                    </div>
                    {bulletin.annual && (
                      <div className="mt-1 flex flex-col items-end gap-1">
                        <p className="text-[9px] font-bold text-slate-400">Annuel: {bulletin.annual.moyenne_annuelle.toFixed(2)}</p>
                        {bulletin.annual.decision && bulletin.annual.decision !== 'En attente' && (
                          <span className={`text-[8px] px-2 py-0.5 rounded-full font-black uppercase tracking-tighter border ${
                            bulletin.annual.decision === 'Passage' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                            bulletin.annual.decision === 'Redoublement' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                            'bg-rose-500/10 text-rose-400 border-rose-500/20'
                          }`}>
                            {bulletin.annual.decision}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <button 
                    onClick={() => generateBulletinPDF(bulletin)} 
                    className="p-3 rounded-xl transition-all shadow-lg bg-emerald-600 text-white hover:bg-emerald-500 hover:scale-105 active:scale-95 shadow-emerald-600/20"
                  >
                    <Download className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
