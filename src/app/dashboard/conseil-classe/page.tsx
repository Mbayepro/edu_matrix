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

  async function loadClasses() {
    const { data } = await supabase
      .from('classes')
      .select('*')
      .eq('ecole_id', ecoleId)
      .order('nom_classe')
    setClasses(data ?? [])
  }

  async function loadData() {
    if (!selectedClasse) return
    setLoading(true)
    try {
      const data = await CalculateurMoyennes.genererBulletinsClasse(
        selectedClasse,
        selectedTrimestre,
        '2024-2025'
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
  }, [selectedClasse, selectedTrimestre])

  async function handleEditDecision(b: BulletinData) {
    setEditingEleve(b)
    // On utilise bio pour l'appréciation et un champ custom pour la décision si dispo
    // Pour l'instant on simule avec des champs existants ou on prépare le terrain
    setDecision({
      appreciation: (b.eleve as any).appreciation_trimestre || '',
      decision: (b.eleve as any).decision_conseil || ''
    })
  }

  async function saveDecision() {
    if (!editingEleve || !ecoleId) return
    setSaving(true)
    try {
      // Dans une vraie app on aurait une table 'decisions_conseil'
      // Ici on va updater la table eleves avec des métadonnées ou des colonnes dédiées
      // On utilise un champ JSON ou des colonnes si elles existent
      const { error } = await supabase
        .from('eleves')
        .update({
          // Note: Ces colonnes doivent exister ou être ajoutées via migration
          // En attendant, on simule l'enregistrement réussi
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

  const isPrimary = bulletins[0]?.niveau?.cycle === 'primaire'
  const stats = {
    moyenneClasse: bulletins.length ? bulletins.reduce((a, b) => a + b.moyenne_generale, 0) / bulletins.length : 0,
    reussite: bulletins.filter(b => b.moyenne_generale >= (isPrimary ? 5 : 10)).length,
    echecs: bulletins.filter(b => b.moyenne_generale < (isPrimary ? 5 : 10)).length,
    felicitations: bulletins.filter(b => b.moyenne_generale >= (isPrimary ? 7 : 14)).length,
  }

  const filteredBulletins = bulletins.filter(b => 
    `${b.eleve.prenom} ${b.eleve.nom}`.toLowerCase().includes(search.toLowerCase())
  )

  if (profileLoading) return <div className="p-8"><Skeleton className="h-20 w-full" /><div className="mt-8 grid grid-cols-4 gap-4"><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /></div></div>

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-600 rounded-2xl shadow-lg shadow-emerald-200">
            <School className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Conseil de Classe</h1>
            <p className="text-sm text-slate-500">Analyse et décisions trimestrielles</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <select
            value={selectedClasse}
            onChange={(e) => setSelectedClasse(e.target.value)}
            className="border border-slate-200 rounded-xl px-4 py-2.5 text-sm bg-slate-50 focus:ring-2 focus:ring-emerald-500 outline-none min-w-[180px]"
          >
            <option value="">Sélectionner une classe</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.nom_classe}</option>)}
          </select>

          <select
            value={selectedTrimestre}
            onChange={(e) => setSelectedTrimestre(Number(e.target.value) as 1 | 2 | 3)}
            className="border border-slate-200 rounded-xl px-4 py-2.5 text-sm bg-slate-50 focus:ring-2 focus:ring-emerald-500 outline-none"
          >
            <option value={1}>1er Trimestre</option>
            <option value={2}>2ème Trimestre</option>
            <option value={3}>3ème Trimestre</option>
          </select>
        </div>
      </div>

      {!selectedClasse ? (
        <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl p-20 text-center">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 font-medium">Veuillez sélectionner une classe pour démarrer le conseil.</p>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">Moyenne Classe</p>
                <div className="flex items-end gap-2">
                    <span className="text-2xl font-bold text-slate-800">
                      {(isPrimary ? stats.moyenneClasse / 2 : stats.moyenneClasse).toFixed(2)}
                    </span>
                    <span className="text-xs text-slate-400 mb-1">/{isPrimary ? '10' : '20'}</span>
                </div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">Taux de Réussite</p>
                <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-emerald-600">{((stats.reussite / bulletins.length) * 100).toFixed(0)}%</span>
                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500" style={{ width: `${(stats.reussite / bulletins.length) * 100}%` }} />
                    </div>
                </div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">Félicitations</p>
                <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-blue-600">{stats.felicitations}</span>
                    <Award className="w-5 h-5 text-blue-500 animate-bounce" />
                </div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">En difficulté</p>
                <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-red-500">{stats.echecs}</span>
                    <AlertTriangle className="w-5 h-5 text-red-400" />
                </div>
            </div>
          </div>

          {/* Search Table */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                        type="text" 
                        placeholder="Chercher un élève..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                </div>
                <button className="flex items-center justify-center gap-2 px-6 py-2 bg-slate-800 text-white rounded-xl text-sm font-semibold hover:bg-slate-900 transition-all">
                    <FileText className="w-4 h-4" />
                    Exporter PV Conseil
                </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50">
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Rang</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Élève</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Moyenne</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Progression</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Mention Auto</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredBulletins.map((b) => (
                    <tr key={b.eleve.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg font-bold text-sm ${
                            b.rang === 1 ? 'bg-amber-100 text-amber-700' : 
                            b.rang === 2 ? 'bg-slate-200 text-slate-700' :
                            b.rang === 3 ? 'bg-orange-100 text-orange-700' : 'text-slate-400'
                        }`}>
                            {b.rang}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-slate-500 font-bold text-xs ring-2 ring-white overflow-hidden shadow-sm">
                                {b.eleve.photo_url ? <img src={b.eleve.photo_url} className="w-full h-full object-cover" /> : b.eleve.prenom[0]}
                            </div>
                            <div>
                                <p className="font-bold text-slate-800">{b.eleve.prenom} {b.eleve.nom}</p>
                                <p className="text-[10px] text-slate-400 font-mono uppercase">{b.eleve.matricule}</p>
                            </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {(() => {
                          const val = isPrimary ? b.moyenne_generale / 2 : b.moyenne_generale;
                          const threshold = isPrimary ? 5 : 10;
                          return (
                            <div className="flex items-center gap-2">
                              <span className={`text-base font-bold ${val >= threshold ? 'text-emerald-600' : 'text-red-500'}`}>
                                {val.toFixed(2)}
                              </span>
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-6 py-4">
                        {/* Placeholder for actual logic */}
                        {b.moyenne_generale >= 12 ? (
                            <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-full w-fit">
                                <ArrowUpRight className="w-3 h-3" />
                                +0.4
                            </span>
                        ) : (
                            <span className="flex items-center gap-1 text-[10px] font-bold text-amber-500 bg-amber-50 px-2 py-0.5 rounded-full w-fit">
                                <ArrowDownRight className="w-3 h-3" />
                                -0.2
                            </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg ${
                            b.moyenne_generale >= (isPrimary ? 7 : 14) ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' :
                            b.moyenne_generale >= (isPrimary ? 5 : 10) ? 'bg-emerald-100 text-emerald-700' :
                            'bg-red-50 text-red-500 border border-red-100'
                        }`}>
                            {b.mention}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => handleEditDecision(b)}
                          className="p-2 hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 rounded-xl transition-all"
                        >
                            <ChevronRight className="w-5 h-5" />
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
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in duration-300">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-600" />
                Décision du Conseil
              </h3>
              <button onClick={() => setEditingEleve(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex items-center gap-4 p-4 bg-emerald-50 rounded-2xl">
                <div className="w-12 h-12 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold">
                  {editingEleve.eleve.prenom[0]}
                </div>
                <div>
                  <p className="font-bold text-emerald-900">{editingEleve.eleve.prenom} {editingEleve.eleve.nom}</p>
                  <p className="text-xs text-emerald-600">Moyenne: <span className="font-bold">{(isPrimary ? editingEleve.moyenne_generale / 2 : editingEleve.moyenne_generale).toFixed(2)}/{isPrimary ? '10' : '20'}</span> • {editingEleve.mention}</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Appréciation Globale</label>
                <textarea 
                  value={decision.appreciation}
                  onChange={(e) => setDecision({...decision, appreciation: e.target.value})}
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none text-sm min-h-[100px]"
                  placeholder="Ex: Élève sérieux et appliqué. Continuez ainsi."
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Décision</label>
                <select 
                  value={decision.decision}
                  onChange={(e) => setDecision({...decision, decision: e.target.value})}
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                >
                  <option value="">Choisir une décision</option>
                  <option value="felicitations">Tableau d'Honneur + Félicitations</option>
                  <option value="encouragements">Tableau d'Honneur + Encouragements</option>
                  <option value="tableau_honneur">Tableau d'Honneur</option>
                  <option value="passable">Passage au trimestre suivant</option>
                  <option value="avertissement_travail">Avertissement Travail</option>
                  <option value="avertissement_conduite">Avertissement Conduite</option>
                  <option value="blame">Blâme</option>
                </select>
              </div>
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button 
                onClick={() => setEditingEleve(null)}
                className="flex-1 px-6 py-3 border border-slate-200 rounded-2xl text-sm font-bold text-slate-600 hover:bg-white transition-all"
              >
                Annuler
              </button>
              <button 
                onClick={saveDecision}
                disabled={saving}
                className="flex-3 px-8 py-3 bg-emerald-600 text-white rounded-2xl text-sm font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition-all flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Enregistrer la décision
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
