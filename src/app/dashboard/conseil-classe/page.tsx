'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useProfile } from '@/hooks/useProfile'
import { CalculateurMoyennes, BulletinData } from '@/lib/calculMoyennes'
import { 
  Users, 
  TrendingUp, 
  Award, 
  AlertTriangle, 
  CheckCircle, 
  ChevronRight,
  Loader2,
  FileText,
  Search,
  School,
  ArrowUpRight,
  ArrowDownRight,
  X,
  Save,
  Filter,
  FileDown,
  MinusCircle,
  TrendingDown
} from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { Skeleton, SkeletonCard, SkeletonTable } from '@/components/Skeleton'

interface Decision {
  eleve_id: string
  mention_officielle: string
  appreciation_globale: string
  decision_conseil: string
}

export default function ConseilClassePage() {
  const { profile, ecole, loading: profileLoading } = useProfile()
  const ecoleId = profile?.ecole_id || null

  const [classes, setClasses] = useState<any[]>([])
  const [selectedClasse, setSelectedClasse] = useState<string>('')
  const [selectedTrimestre, setSelectedTrimestre] = useState<1 | 2 | 3>(1)
  const [anneeScolaire, setAnneeScolaire] = useState('2026-2027')
  const [loading, setLoading] = useState(false)
  const [bulletins, setBulletins] = useState<BulletinData[]>([])
  const [search, setSearch] = useState('')
  const [editingEleve, setEditingEleve] = useState<BulletinData | null>(null)
  const [decision, setDecision] = useState({
    appreciation: '',
    decision: ''
  })
  const { showToast } = useToast()
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (ecoleId) loadClasses()
  }, [ecoleId])

  const [currentClasse, setCurrentClasse] = useState<any>(null)
  
  async function loadClasses() {
    const { data } = await supabase
      .from('classes')
      .select('*, niveaux(nom, cycle)')
      .eq('ecole_id', ecoleId as any)
      .order('nom_classe')
    setClasses(data ?? [])
  }

  useEffect(() => {
    if (selectedClasse) {
      const cls = classes.find(c => c.id === selectedClasse)
      setCurrentClasse(cls)
    }
  }, [selectedClasse, classes])

  async function loadData() {
    if (!selectedClasse) return
    setLoading(true)
    try {
      const data = await CalculateurMoyennes.genererBulletinsClasse(
        selectedClasse,
        selectedTrimestre,
        anneeScolaire
      )
      setBulletins(data)
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [selectedClasse, selectedTrimestre, anneeScolaire])

  async function handleEditDecision(b: BulletinData) {
    setEditingEleve(b)
    setDecision({
      appreciation: (b.eleve as any).appreciation_trimestre || '',
      decision: (b.eleve as any).decision_conseil || ''
    })
  }

  async function saveDecision() {
    if (!editingEleve || !ecoleId) return
    setSaving(true)
    try {
      const { error } = await (supabase.from('eleves') as any)
        .update({
          appreciation_trimestre: decision.appreciation,
          decision_conseil: decision.decision
        })
        .eq('id', editingEleve.eleve.id)

      if (error) throw error
      
      showToast('Décision enregistrée avec succès', 'success')
      setEditingEleve(null)
      loadData()
    } catch (error: any) {
      showToast('Erreur : ' + error.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const isPrimary = (currentClasse?.niveaux?.cycle === 'primaire')
  const validBulletins = bulletins.filter(b => b.moyenne_generale !== null);
  const stats = {
    moyenneClasse: validBulletins.length ? validBulletins.reduce((a, b) => a + (b.moyenne_generale || 0), 0) / validBulletins.length : 0,
    reussite: validBulletins.filter(b => (b.moyenne_generale || 0) >= (isPrimary ? 5 * 2 : 10)).length,
    echecs: validBulletins.filter(b => (b.moyenne_generale || 0) < (isPrimary ? 5 * 2 : 10)).length,
    felicitations: validBulletins.filter(b => (b.moyenne_generale || 0) >= (isPrimary ? 7 * 2 : 14)).length,
  }

  const filteredBulletins = bulletins.filter(b => 
    `${b.eleve.prenom} ${b.eleve.nom}`.toLowerCase().includes(search.toLowerCase())
  )

  if (profileLoading) return <div className="p-8"><Skeleton className="h-20 w-full" /><div className="mt-8 grid grid-cols-4 gap-4"><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /></div></div>

  return (
    <div className="space-y-8 pb-10">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
              <School className="w-4 h-4 text-emerald-400" />
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">Conseil de Classe</h1>
          </div>
          <p className="text-sm text-slate-500 font-medium tracking-tight">
            Analyse des performances et prise de décisions académiques.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 bg-slate-900 px-4 py-2 rounded-2xl border border-slate-700 shadow-sm relative group overflow-hidden transition-all hover:border-emerald-500/50">
            <select
              value={selectedClasse}
              onChange={(e) => setSelectedClasse(e.target.value)}
              className="bg-transparent border-none focus:outline-none text-sm font-black text-white pr-8 cursor-pointer appearance-none relative z-10"
            >
              <option value="" className="text-slate-900">Choisir une classe</option>
              {classes.map(c => <option key={c.id} value={c.id} className="text-slate-900">{c.nom_classe}</option>)}
            </select>
            <Users className="w-4 h-4 text-emerald-400 absolute right-4 pointer-events-none" />
          </div>

          <div className="flex items-center gap-3 bg-slate-900 px-4 py-2 rounded-2xl border border-slate-700 shadow-sm relative group overflow-hidden transition-all hover:border-emerald-500/50">
            <select
              value={selectedTrimestre}
              onChange={(e) => setSelectedTrimestre(Number(e.target.value) as 1 | 2 | 3)}
              className="bg-transparent border-none focus:outline-none text-sm font-black text-white pr-8 cursor-pointer appearance-none relative z-10"
            >
              <option value={1} className="text-slate-900">1er Trimestre</option>
              <option value={2} className="text-slate-900">2ème Trimestre</option>
              <option value={3} className="text-slate-900">3ème Trimestre</option>
            </select>
            <TrendingUp className="w-4 h-4 text-emerald-400 absolute right-4 pointer-events-none" />
          </div>

          <div className="flex items-center gap-3 bg-slate-900 px-4 py-2 rounded-2xl border border-slate-700 shadow-sm relative group overflow-hidden transition-all hover:border-emerald-500/50">
            <select
              value={anneeScolaire}
              onChange={(e) => setAnneeScolaire(e.target.value)}
              className="bg-transparent border-none focus:outline-none text-sm font-black text-white pr-8 cursor-pointer appearance-none relative z-10"
            >
              <option value="2025-2026" className="text-slate-900">2025-2026</option>
              <option value="2026-2027" className="text-slate-900">2026-2027</option>
              <option value="2027-2028" className="text-slate-900">2027-2028</option>
            </select>
            <TrendingUp className="w-4 h-4 text-emerald-400 absolute right-4 pointer-events-none" />
          </div>

          {selectedClasse && (
            <Link
              href={`/dashboard/bulletins?classe=${selectedClasse}&trimestre=${selectedTrimestre}`}
              className="flex items-center gap-2 px-6 py-2 rounded-2xl bg-emerald-500 text-slate-900 text-xs font-black uppercase tracking-widest hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20"
            >
              <FileText className="w-4 h-4" />
              Imprimer Bulletins
            </Link>
          )}
        </div>
      </div>

      {!selectedClasse ? (
        <div className="bg-slate-900 rounded-[2rem] border border-slate-800 shadow-xl p-12 lg:p-32 animate-in fade-in duration-500 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full -mr-32 -mt-32 blur-3xl" />
            
            <div className="max-w-2xl mx-auto text-center space-y-8">
              <div className="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center mx-auto relative border border-slate-700">
                  <div className="absolute inset-0 bg-emerald-500/10 rounded-full animate-pulse" />
                  <Users className="w-10 h-10 text-emerald-400 relative z-10" />
              </div>
              
              <div className="space-y-4">
                <h3 className="text-3xl font-black text-white tracking-tight">Conseil de Classe</h3>
                <p className="text-lg text-slate-400 font-medium">Pour préparer et gérer votre conseil de classe, suivez ces 3 étapes simples :</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left mt-12">
                <div className="bg-slate-800/50 p-6 rounded-3xl border border-slate-700">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-black mb-4">1</div>
                  <h4 className="text-white font-bold mb-2">Choisissez une classe</h4>
                  <p className="text-sm text-slate-400">Sélectionnez la classe et le trimestre en haut à droite pour charger les données.</p>
                </div>
                <div className="bg-slate-800/50 p-6 rounded-3xl border border-slate-700">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-black mb-4">2</div>
                  <h4 className="text-white font-bold mb-2">Analysez les résultats</h4>
                  <p className="text-sm text-slate-400">Consultez les moyennes, la progression et les suggestions générées automatiquement.</p>
                </div>
                <div className="bg-slate-800/50 p-6 rounded-3xl border border-slate-700">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-black mb-4">3</div>
                  <h4 className="text-white font-bold mb-2">Prenez des décisions</h4>
                  <p className="text-sm text-slate-400">Ajoutez vos appréciations globales et attribuez les félicitations ou sanctions pour chaque élève.</p>
                </div>
              </div>
            </div>
        </div>
      ) : loading ? (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
            </div>
            <SkeletonTable rows={10} columns={5} />
        </div>
      ) : (
        <div className="space-y-6 animate-in fade-in duration-500">
          {/* Stats Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-slate-900 p-6 rounded-[2rem] border border-slate-800 shadow-xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-24 h-24 bg-slate-500/10 rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-110" />
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 ml-1">Moyenne Classe</p>
                <div className="flex items-end gap-2">
                    <span className="text-3xl font-black text-white tracking-tighter leading-none">
                      {(isPrimary ? stats.moyenneClasse / 2 : stats.moyenneClasse).toFixed(2)}
                    </span>
                    <span className="text-xs font-black text-slate-500 uppercase tracking-widest">/{isPrimary ? '10' : '20'}</span>
                </div>
            </div>

            <div className="bg-slate-900 p-6 rounded-[2rem] border border-slate-800 shadow-xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-110" />
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400/60 mb-3 ml-1">Taux de Réussite</p>
                <div className="flex items-center gap-4">
                    <span className="text-3xl font-black text-emerald-400 tracking-tighter leading-none">
                      {bulletins.length > 0 ? ((stats.reussite / bulletins.length) * 100).toFixed(0) : '0'}%
                    </span>
                    <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                        <div className="h-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" style={{ width: `${bulletins.length > 0 ? (stats.reussite / bulletins.length) * 100 : 0}%` }} />
                    </div>
                </div>
            </div>

            <div className="bg-slate-900 p-6 rounded-[2rem] border border-slate-800 shadow-xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-110" />
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400/60 mb-3 ml-1">Félicitations</p>
                <div className="flex items-center justify-between">
                    <span className="text-3xl font-black text-emerald-400 tracking-tighter leading-none">{stats.felicitations}</span>
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20 shadow-sm">
                      <Award className="w-5 h-5" />
                    </div>
                </div>
            </div>

            <div className="bg-slate-900 p-6 rounded-[2rem] border border-slate-800 shadow-xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/10 rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-110" />
                <p className="text-[10px] font-black uppercase tracking-widest text-rose-400/60 mb-3 ml-1">En difficulté</p>
                <div className="flex items-center justify-between">
                    <span className="text-3xl font-black text-rose-400 tracking-tighter leading-none">{stats.echecs}</span>
                    <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-400 border border-rose-500/20 shadow-sm">
                        <AlertTriangle className="w-5 h-5" />
                    </div>
                </div>
            </div>
          </div>

          {/* Search Table */}
          <div className="bg-slate-900 rounded-[2rem] border border-slate-800 shadow-xl overflow-hidden flex flex-col transition-all duration-500 hover:shadow-2xl">
            <div className="px-8 py-6 border-b border-slate-800 bg-slate-800/30 flex flex-col sm:flex-row justify-between gap-6">
                <div className="relative flex-1 max-w-md group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-emerald-400 transition-colors" />
                    <input 
                        type="text" 
                        placeholder="Rechercher un élève par nom ou matricule…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-12 pr-6 py-3.5 bg-slate-800 border border-slate-700 rounded-xl text-sm font-bold text-white placeholder-slate-500 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500/50 transition-all outline-none shadow-inner"
                    />
                </div>
                <button className="flex items-center justify-center gap-3 px-8 py-3.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-xl text-sm font-black transition-all">
                    <FileText className="w-4 h-4" />
                    Exporter PV Conseil
                </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-800/30">
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Rang</th>
                    <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Élève</th>
                    <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Moyenne</th>
                    <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Progression</th>
                    <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Décision Suggérée</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredBulletins.map((b) => (
                    <tr key={b.eleve.id} className="group hover:bg-slate-800/50 transition-all duration-300">
                      <td className="px-8 py-5">
                        <span className={`inline-flex items-center justify-center w-10 h-10 rounded-xl font-black text-sm transition-transform group-hover:scale-110 ${
                            b.rang === 1 ? 'bg-amber-500/10 text-amber-500 shadow-sm border border-amber-500/20' : 
                            b.rang === 2 ? 'bg-slate-800 text-slate-300 shadow-sm border border-slate-700' :
                            b.rang === 3 ? 'bg-orange-500/10 text-orange-500 shadow-sm border border-orange-500/20' : 'text-slate-500 border border-transparent'
                        }`}>
                            {b.rang}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 font-black text-xs shadow-sm overflow-hidden group-hover:scale-110 group-hover:border-emerald-500/50 transition-all duration-500">
                                {b.eleve.photo_url ? <img src={b.eleve.photo_url} className="w-full h-full object-cover" /> : b.eleve.prenom[0]}
                            </div>
                            <div>
                                <p className="text-base font-black text-white leading-tight group-hover:text-emerald-400 transition-colors uppercase">{b.eleve.prenom} {b.eleve.nom}</p>
                                <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-0.5">{b.eleve.matricule}</p>
                            </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        {(() => {
                          if (b.moyenne_generale === null) {
                            return (
                              <div className="flex items-center gap-2">
                                <MinusCircle className="w-4 h-4 text-slate-600" />
                                <span className="font-black text-lg text-slate-600">N/É</span>
                              </div>
                            );
                          }
                          const val = isPrimary ? b.moyenne_generale / 2 : b.moyenne_generale;
                          const threshold = isPrimary ? 5 : 10;
                          return (
                            <div className="flex items-center gap-2">
                              {val < threshold ? <TrendingDown className="w-4 h-4 text-rose-500" /> : <TrendingUp className="w-4 h-4 text-emerald-400" />}
                              <span className={`font-black text-lg ${val < threshold ? 'text-rose-500' : 'text-emerald-400'}`}>
                                {val.toFixed(2)}
                              </span>
                              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">/{isPrimary ? '10' : '20'}</span>
                            </div>
                          )
                        })()}
                      </td>
                      <td className="px-6 py-5">
                        {b.moyenne_generale !== null ? (
                          b.moyenne_generale >= 12 ? (
                              <div className="flex items-center gap-2 text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg w-fit border border-emerald-500/20 shadow-sm">
                                  <ArrowUpRight className="w-3 h-3" />
                                  <span className="tracking-widest uppercase">+0.4 PTS</span>
                              </div>
                          ) : (
                              <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 bg-slate-800 px-2.5 py-1 rounded-lg w-fit border border-slate-700 shadow-sm">
                                  <ArrowDownRight className="w-3 h-3" />
                                  <span className="tracking-widest uppercase">-0.1 PTS</span>
                              </div>
                          )
                        ) : (
                           <div className="flex items-center gap-2 text-[10px] font-black text-slate-500 bg-slate-800 px-2.5 py-1 rounded-lg w-fit border border-slate-700 shadow-sm">
                               <MinusCircle className="w-3 h-3" />
                               <span className="tracking-widest uppercase">N/A</span>
                           </div>
                        )}
                      </td>
                      <td className="px-6 py-5">
                        <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-[0.15em] shadow-sm border ${
                            b.moyenne_generale !== null && b.moyenne_generale >= (isPrimary ? 7 : 14) ? 'bg-emerald-500 text-slate-900 border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]' :
                            b.moyenne_generale !== null && b.moyenne_generale >= (isPrimary ? 5 : 10) ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                            'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        }`}>
                            {b.mention}
                        </span>
                      </td>
                      <td className="px-8 py-5 text-right">
                        <button 
                          onClick={() => handleEditDecision(b)}
                          className="w-10 h-10 flex items-center justify-center bg-slate-800 border border-slate-700 rounded-xl text-slate-400 hover:text-emerald-400 hover:border-emerald-500/50 hover:bg-slate-700 transition-all shadow-sm group/btn"
                        >
                            <ChevronRight className="w-5 h-5 group-hover/btn:translate-x-0.5 transition-transform" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Decision Modal */}
      {editingEleve && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xl flex items-center justify-center z-[100] p-4">
          <div className="bg-slate-900 border border-slate-700/50 rounded-[2.5rem] p-10 w-full max-w-lg shadow-2xl animate-in zoom-in duration-300 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full -mr-16 -mt-16 blur-2xl" />
            
            <div className="relative z-10">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-14 min-w-[56px] h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20">
                  <FileText className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white tracking-tight">Décision du Conseil</h3>
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">Évaluation Trimestrielle</p>
                </div>
              </div>
              
              <div className="p-6 bg-slate-800/50 rounded-2xl border border-slate-700 mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center text-white text-xl font-black border border-slate-700 shadow-inner">
                    {editingEleve.eleve.prenom[0]}
                  </div>
                  <div>
                    <h4 className="text-base font-black text-white uppercase">{editingEleve.eleve.prenom} {editingEleve.eleve.nom}</h4>
                    <p className="text-xs font-black text-emerald-400 mt-0.5">
                      MOYENNE: <span className="tracking-tighter">{editingEleve.moyenne_generale !== null ? (isPrimary ? editingEleve.moyenne_generale / 2 : editingEleve.moyenne_generale).toFixed(2) : 'N/A'}/{isPrimary ? '10' : '20'}</span>
                      <span className="mx-2 text-slate-600">•</span>
                      {editingEleve.mention.toUpperCase()}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">Appréciation des Professeurs</label>
                  <textarea 
                    value={decision.appreciation}
                    onChange={(e) => setDecision({...decision, appreciation: e.target.value})}
                    className="w-full bg-slate-800 border-none rounded-xl px-4 py-3.5 text-sm font-bold text-white placeholder-slate-500 focus:ring-4 focus:ring-emerald-500/10 focus:bg-slate-800 transition-all shadow-inner min-h-[120px] outline-none"
                    placeholder="Saisissez l'appréciation globale de l'élève…"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">Sanction ou Distinction</label>
                  <select 
                    value={decision.decision}
                    onChange={(e) => setDecision({...decision, decision: e.target.value})}
                    className="w-full bg-slate-800 border-none rounded-xl px-4 py-3.5 text-sm font-bold text-white focus:ring-4 focus:ring-emerald-500/10 focus:bg-slate-800 transition-all outline-none"
                  >
                    <option value="" className="text-slate-500">Sélectionner une décision</option>
                    <option value="felicitations">🎖️ Félicitations du Conseil</option>
                    <option value="encouragements">👏 Encouragements</option>
                    <option value="tableau_honneur">⭐ Tableau d'Honneur</option>
                    <option value="passable">✅ Passage Simple</option>
                    <option value="avertissement_travail">⚠️ Avertissement Travail</option>
                    <option value="avertissement_conduite">🚫 Avertissement Conduite</option>
                    <option value="blame">❌ Blâme</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 mt-10">
                <button 
                  onClick={() => setEditingEleve(null)}
                  className="flex-1 px-6 py-4 rounded-xl text-sm font-black uppercase tracking-widest text-slate-500 hover:text-white hover:bg-slate-800 transition-all"
                >
                  Annuler
                </button>
                <button 
                  onClick={saveDecision}
                  disabled={saving}
                  className="flex-[2] py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-900 rounded-xl text-sm font-black transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                  Valider la Décision
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
