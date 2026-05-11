'use client'

import { useEffect, useState } from 'react'
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
  Save
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
  const [anneeScolaire, setAnneeScolaire] = useState('2025-2026')
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
  const stats = {
    moyenneClasse: bulletins.length ? bulletins.reduce((a, b) => a + b.moyenne_generale, 0) / bulletins.length : 0,
    reussite: bulletins.filter(b => b.moyenne_generale >= (isPrimary ? 5 * 2 : 10)).length,
    echecs: bulletins.filter(b => b.moyenne_generale < (isPrimary ? 5 * 2 : 10)).length,
    felicitations: bulletins.filter(b => b.moyenne_generale >= (isPrimary ? 7 * 2 : 14)).length,
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
            <div className="w-8 h-8 rounded-lg bg-emerald-600/10 flex items-center justify-center">
              <School className="w-4 h-4 text-emerald-600" />
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Conseil de Classe</h1>
          </div>
          <p className="text-sm text-slate-500 font-medium tracking-tight">
            Analyse des performances et prise de décisions académiques.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-2xl border border-slate-200 shadow-sm relative group overflow-hidden transition-all hover:border-emerald-200">
            <select
              value={selectedClasse}
              onChange={(e) => setSelectedClasse(e.target.value)}
              className="bg-transparent border-none focus:outline-none text-sm font-black text-slate-900 pr-8 cursor-pointer appearance-none relative z-10"
            >
              <option value="">Choisir une classe</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.nom_classe}</option>)}
            </select>
            <Users className="w-4 h-4 text-emerald-600 absolute right-4 pointer-events-none" />
          </div>

          <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-2xl border border-slate-200 shadow-sm relative group overflow-hidden transition-all hover:border-emerald-200">
            <select
              value={selectedTrimestre}
              onChange={(e) => setSelectedTrimestre(Number(e.target.value) as 1 | 2 | 3)}
              className="bg-transparent border-none focus:outline-none text-sm font-black text-slate-900 pr-8 cursor-pointer appearance-none relative z-10"
            >
              <option value={1}>1er Trimestre</option>
              <option value={2}>2ème Trimestre</option>
              <option value={3}>3ème Trimestre</option>
            </select>
            <TrendingUp className="w-4 h-4 text-emerald-600 absolute right-4 pointer-events-none" />
          </div>

          <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-2xl border border-slate-200 shadow-sm relative group overflow-hidden transition-all hover:border-emerald-200">
            <input 
              type="text"
              value={anneeScolaire}
              onChange={(e) => setAnneeScolaire(e.target.value)}
              className="bg-transparent border-none focus:outline-none text-sm font-black text-slate-900 pr-8 cursor-pointer w-24"
            />
            <School className="w-4 h-4 text-emerald-600 absolute right-4 pointer-events-none" />
          </div>
        </div>
      </div>

      {!selectedClasse ? (
        <div className="bg-white rounded-[2rem] border border-slate-200/60 shadow-sm p-32 text-center animate-in fade-in duration-500">
            <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-8 relative">
                <div className="absolute inset-0 bg-emerald-500/10 rounded-full animate-pulse" />
                <Users className="w-10 h-10 text-slate-300 relative z-10" />
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-2 tracking-tight">Conseil de Classe en attente</h3>
            <p className="text-base text-slate-400 font-medium max-w-sm mx-auto">Veuillez sélectionner une classe pour démarrer l&apos;analyse et la prise de décisions.</p>
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
            <div className="bg-white p-6 rounded-[2rem] border border-slate-200/60 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-24 h-24 bg-slate-500/5 rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-110" />
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 ml-1">Moyenne Classe</p>
                <div className="flex items-end gap-2">
                    <span className="text-3xl font-black text-slate-900 tracking-tighter leading-none">
                      {(isPrimary ? stats.moyenneClasse / 2 : stats.moyenneClasse).toFixed(2)}
                    </span>
                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest">/{isPrimary ? '10' : '20'}</span>
                </div>
            </div>

            <div className="bg-white p-6 rounded-[2rem] border border-slate-200/60 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-110" />
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600/60 mb-3 ml-1">Taux de Réussite</p>
                <div className="flex items-center gap-4">
                    <span className="text-3xl font-black text-emerald-600 tracking-tighter leading-none">
                      {bulletins.length > 0 ? ((stats.reussite / bulletins.length) * 100).toFixed(0) : '0'}%
                    </span>
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 shadow-lg shadow-emerald-500/20" style={{ width: `${bulletins.length > 0 ? (stats.reussite / bulletins.length) * 100 : 0}%` }} />
                    </div>
                </div>
            </div>

            <div className="bg-white p-6 rounded-[2rem] border border-slate-200/60 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-110" />
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-600/60 mb-3 ml-1">Félicitations</p>
                <div className="flex items-center justify-between">
                    <span className="text-3xl font-black text-blue-600 tracking-tighter leading-none">{stats.felicitations}</span>
                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100 shadow-sm">
                      <Award className="w-5 h-5" />
                    </div>
                </div>
            </div>

            <div className="bg-white p-6 rounded-[2rem] border border-slate-200/60 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-110" />
                <p className="text-[10px] font-black uppercase tracking-widest text-red-600/60 mb-3 ml-1">En difficulté</p>
                <div className="flex items-center justify-between">
                    <span className="text-3xl font-black text-red-600 tracking-tighter leading-none">{stats.echecs}</span>
                    <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-red-600 border border-red-100 shadow-sm">
                        <AlertTriangle className="w-5 h-5 text-red-400" />
                    </div>
                </div>
            </div>
          </div>

          {/* Search Table */}
          <div className="bg-white rounded-[2rem] border border-slate-200/60 shadow-sm overflow-hidden flex flex-col transition-all duration-500 hover:shadow-xl hover:shadow-emerald-900/5">
            <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/10 flex flex-col sm:flex-row justify-between gap-6">
                <div className="relative flex-1 max-w-md group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                    <input 
                        type="text" 
                        placeholder="Rechercher un élève par nom ou matricule…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-12 pr-6 py-3.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 focus:bg-white transition-all outline-none shadow-sm"
                    />
                </div>
                <button className="flex items-center justify-center gap-3 px-8 py-3.5 bg-slate-900 hover:bg-emerald-600 text-white rounded-xl text-sm font-black transition-all shadow-xl shadow-slate-900/10">
                    <FileText className="w-4 h-4" />
                    Exporter PV Conseil
                </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/30">
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Rang</th>
                    <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Élève</th>
                    <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Moyenne</th>
                    <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Progression</th>
                    <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Décision Suggérée</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredBulletins.map((b) => (
                    <tr key={b.eleve.id} className="group hover:bg-slate-50/80 transition-all duration-300">
                      <td className="px-8 py-5">
                        <span className={`inline-flex items-center justify-center w-10 h-10 rounded-xl font-black text-sm transition-transform group-hover:scale-110 ${
                            b.rang === 1 ? 'bg-amber-100 text-amber-700 shadow-sm border border-amber-200/50' : 
                            b.rang === 2 ? 'bg-slate-100 text-slate-600 shadow-sm border border-slate-200/50' :
                            b.rang === 3 ? 'bg-orange-100 text-orange-700 shadow-sm border border-orange-200/50' : 'text-slate-400 border border-transparent'
                        }`}>
                            {b.rang}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200/60 flex items-center justify-center text-slate-400 font-black text-xs shadow-sm overflow-hidden group-hover:scale-110 group-hover:border-emerald-200 transition-all duration-500">
                                {b.eleve.photo_url ? <img src={b.eleve.photo_url} className="w-full h-full object-cover" /> : b.eleve.prenom[0]}
                            </div>
                            <div>
                                <p className="text-base font-black text-slate-900 leading-tight group-hover:text-emerald-600 transition-colors uppercase">{b.eleve.prenom} {b.eleve.nom}</p>
                                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-0.5">{b.eleve.matricule}</p>
                            </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        {(() => {
                          const val = isPrimary ? b.moyenne_generale / 2 : b.moyenne_generale;
                          const threshold = isPrimary ? 5 : 10;
                          return (
                            <div className="flex items-center gap-2">
                              <span className={`text-lg font-black tracking-tighter ${val >= threshold ? 'text-emerald-600' : 'text-red-500'}`}>
                                {val.toFixed(2)}
                              </span>
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">/{isPrimary ? '10' : '20'}</span>
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-6 py-5">
                        {b.moyenne_generale >= 12 ? (
                            <div className="flex items-center gap-2 text-[10px] font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg w-fit border border-emerald-100/50 shadow-sm">
                                <ArrowUpRight className="w-3 h-3" />
                                <span className="tracking-widest uppercase">+0.4 PTS</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 text-[10px] font-black text-amber-600 bg-amber-50 px-2.5 py-1 rounded-lg w-fit border border-amber-100/50 shadow-sm">
                                <ArrowDownRight className="w-3 h-3" />
                                <span className="tracking-widest uppercase">-0.2 PTS</span>
                            </div>
                        )}
                      </td>
                      <td className="px-6 py-5">
                        <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-[0.15em] shadow-sm border ${
                            b.moyenne_generale >= (isPrimary ? 7 : 14) ? 'bg-indigo-600 text-white border-indigo-700 shadow-indigo-200' :
                            b.moyenne_generale >= (isPrimary ? 5 : 10) ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                            'bg-red-50 text-red-600 border-red-100'
                        }`}>
                            {b.mention}
                        </span>
                      </td>
                      <td className="px-8 py-5 text-right">
                        <button 
                          onClick={() => handleEditDecision(b)}
                          className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-emerald-600 hover:border-emerald-200 hover:bg-emerald-50 transition-all shadow-sm group/btn"
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[2.5rem] p-10 w-full max-w-lg shadow-2xl animate-in zoom-in duration-300 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full -mr-16 -mt-16" />
            
            <div className="relative z-10">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-14 min-w-[56px] h-14 rounded-2xl bg-emerald-600/10 flex items-center justify-center text-emerald-600">
                  <FileText className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">Décision du Conseil</h3>
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">Évaluation Trimestrielle</p>
                </div>
              </div>
              
              <div className="p-6 bg-slate-50/50 rounded-2xl border border-slate-100 mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-slate-900 flex items-center justify-center text-white text-xl font-black shadow-lg shadow-slate-900/10">
                    {editingEleve.eleve.prenom[0]}
                  </div>
                  <div>
                    <h4 className="text-base font-black text-slate-900 uppercase">{editingEleve.eleve.prenom} {editingEleve.eleve.nom}</h4>
                    <p className="text-xs font-black text-emerald-600 mt-0.5">
                      MOYENNE: <span className="tracking-tighter">{(isPrimary ? editingEleve.moyenne_generale / 2 : editingEleve.moyenne_generale).toFixed(2)}/{isPrimary ? '10' : '20'}</span>
                      <span className="mx-2 text-slate-300">•</span>
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
                    className="w-full bg-slate-50 border-none rounded-xl px-4 py-3.5 text-sm font-bold text-slate-700 focus:ring-4 focus:ring-emerald-500/10 focus:bg-white transition-all shadow-sm min-h-[120px]"
                    placeholder="Saisissez l'appréciation globale de l'élève…"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">Sanction ou Distinction</label>
                  <select 
                    value={decision.decision}
                    onChange={(e) => setDecision({...decision, decision: e.target.value})}
                    className="w-full bg-slate-50 border-none rounded-xl px-4 py-3.5 text-sm font-bold text-slate-700 focus:ring-4 focus:ring-emerald-500/10 focus:bg-white transition-all"
                  >
                    <option value="">Sélectionner une décision</option>
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
                  className="flex-1 px-6 py-4 rounded-xl text-sm font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all"
                >
                  Annuler
                </button>
                <button 
                  onClick={saveDecision}
                  disabled={saving}
                  className="flex-[2] py-4 bg-slate-900 hover:bg-emerald-600 text-white rounded-xl text-sm font-black transition-all shadow-xl shadow-slate-900/10 flex items-center justify-center gap-3 disabled:opacity-50"
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
