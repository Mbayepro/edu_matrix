'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useProfile } from '@/hooks/useProfile'
import { useToast } from '@/contexts/ToastContext'
import { 
  Settings2, Loader2, Save, ChevronLeft, 
  BookOpen, Layers, Info, CheckCircle2,
  AlertCircle
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function CoefficientsPage() {
  const router = useRouter()
  const { profile, loading: profileLoading } = useProfile()
  const ecoleId = profile?.ecole_id
  const { showToast } = useToast()

  const [matieres, setMatieres] = useState<any[]>([])
  const [niveaux, setNiveaux] = useState<any[]>([])
  const [series, setSeries] = useState<any[]>([])
  const [coefficients, setCoefficients] = useState<any[]>([])
  
  const [selectedNiveau, setSelectedNiveau] = useState<string>('')
  const [selectedSerie, setSelectedSerie] = useState<string>('')
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Grille de saisie : [matiereId] -> { coef, active }
  const [grid, setGrid] = useState<Record<string, { coef: number, active: boolean }>>({})

  useEffect(() => {
    if (ecoleId) {
      loadData(ecoleId)
    }
  }, [ecoleId])

  // Met à jour la grille dès que le niveau ou la série change
  useEffect(() => {
    if (selectedNiveau || matieres.length > 0) {
      updateGrid()
    }
  }, [selectedNiveau, selectedSerie, coefficients, matieres])

  async function loadData(eid: string) {
    setLoading(true)
    try {
      const [mRes, nRes, sRes, cRes] = await Promise.all([
        supabase.from('matieres').select('*').eq('ecole_id', eid).eq('is_active', true).order('nom'),
        supabase.from('niveaux').select('*').eq('ecole_id', eid).order('nom'),
        supabase.from('series').select('*').eq('ecole_id', eid).order('nom'),
        supabase.from('coefficients_matieres').select('*').eq('ecole_id', eid)
      ])

      setMatieres(mRes.data || [])
      setNiveaux(nRes.data || [])
      setSeries(sRes.data || [])
      setCoefficients(cRes.data || [])
      
      if (nRes.data && (nRes.data as any).length > 0) {
        setSelectedNiveau((nRes.data[0] as any).id)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  function updateGrid() {
    const newGrid: Record<string, { coef: number, active: boolean }> = {}
    
    // Valeurs par défaut basées sur la table matieres
    matieres.forEach(m => {
      newGrid[m.id] = { coef: m.coefficient || 1, active: false }
    })

    // Surcharge avec les coefficients spécifiques déjà enregistrés
    coefficients.forEach(c => {
      if (c.niveau_id === selectedNiveau && (!selectedSerie ? !c.serie_id : c.serie_id === selectedSerie)) {
        newGrid[c.matiere_id] = { coef: c.coefficient, active: true }
      }
    })

    setGrid(newGrid)
  }

  async function handleSave() {
    if (!ecoleId || !selectedNiveau) return
    setSaving(true)
    try {
      // 1. Suppression des anciens coefficients pour ce couple Niveau/Série
      let deleteQuery = (supabase.from('coefficients_matieres' as any) as any)
        .delete()
        .eq('ecole_id', ecoleId)
        .eq('niveau_id', selectedNiveau)
      
      if (selectedSerie) {
        deleteQuery = deleteQuery.eq('serie_id', selectedSerie)
      } else {
        deleteQuery = deleteQuery.is('serie_id', null)
      }

      const { error: delErr } = await deleteQuery
      if (delErr) throw delErr

      // 2. Insertion des nouveaux coefficients (uniquement ceux cochés comme "Spécifiques")
      const toInsert = Object.entries(grid)
        .filter(([_, data]) => data.active)
        .map(([matiereId, data]) => ({
          ecole_id: ecoleId,
          niveau_id: selectedNiveau,
          serie_id: selectedSerie || null,
          matiere_id: matiereId,
          coefficient: data.coef,
          is_obligatoire: true
        }))

      if (toInsert.length > 0) {
        const { error: insErr } = await (supabase.from('coefficients_matieres' as any) as any).insert(toInsert)
        if (insErr) throw insErr
      }

      showToast('Grille des coefficients enregistrée avec succès !', 'success')
      
      // Rafraîchir les données locales
      const { data } = await supabase.from('coefficients_matieres').select('*').eq('ecole_id', ecoleId)
      setCoefficients(data || [])
    } catch (err: any) {
      console.error(err)
      showToast('Erreur lors de la sauvegarde : ' + err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading || profileLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-emerald-600" />
        <p className="text-slate-400 font-medium animate-pulse uppercase tracking-widest text-[10px]">Chargement des référentiels...</p>
      </div>
    )
  }

  const selectedNiveauLabel = niveaux.find(n => n.id === selectedNiveau)?.nom || 'Niveau sélectionné'

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20 animate-in fade-in duration-700">
      {/* Header Premium */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-start gap-5">
          <Link href="/dashboard/matieres" className="mt-1 p-3 bg-white rounded-2xl border border-slate-200 text-slate-400 hover:text-emerald-600 hover:border-emerald-200 hover:shadow-lg hover:shadow-emerald-500/5 transition-all duration-300">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none mb-2">Configuration des Coefficients</h1>
            <p className="text-sm text-slate-500 font-medium tracking-tight">Personnalisez la pondération des matières par niveau et par série.</p>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving || !selectedNiveau}
          className="flex items-center gap-3 px-8 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-[0.1em] text-[10px] hover:bg-emerald-600 transition-all duration-300 shadow-xl shadow-slate-900/10 disabled:opacity-50 active:scale-95"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Enregistrer la configuration
        </button>
      </div>

      {/* Selectors Glassmorphism */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-white p-8 rounded-[2.5rem] border border-slate-200/60 shadow-sm relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-500/5 rounded-full -mr-20 -mt-20 group-hover:scale-125 transition-transform duration-700" />
        
        <div className="space-y-3 relative z-10">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">1. Niveau d&apos;enseignement</label>
          <div className="relative group/select">
            <Layers className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within/select:text-emerald-500 transition-colors" />
            <select
              value={selectedNiveau}
              onChange={e => setSelectedNiveau(e.target.value)}
              className="w-full bg-slate-50 border-2 border-transparent rounded-[1.25rem] pl-14 pr-6 py-4.5 text-sm font-bold text-slate-700 focus:ring-0 focus:border-emerald-500/30 focus:bg-white transition-all appearance-none cursor-pointer shadow-sm hover:bg-slate-100"
            >
              <option value="">Sélectionner un niveau...</option>
              {niveaux.map(n => (
                <option key={n.id} value={n.id}>{n.nom}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-3 relative z-10">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">2. Spécialité / Série (Optionnel)</label>
          <div className="relative group/select">
            <Settings2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within/select:text-emerald-500 transition-colors" />
            <select
              value={selectedSerie}
              onChange={e => setSelectedSerie(e.target.value)}
              className="w-full bg-slate-50 border-2 border-transparent rounded-[1.25rem] pl-14 pr-6 py-4.5 text-sm font-bold text-slate-700 focus:ring-0 focus:border-emerald-500/30 focus:bg-white transition-all appearance-none cursor-pointer shadow-sm hover:bg-slate-100"
            >
              <option value="">Tronc Commun (Toutes les séries)</option>
              {series.filter(s => s.niveau_id === selectedNiveau).map(s => (
                <option key={s.id} value={s.id}>{s.nom} ({s.code})</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Dynamic Grid */}
      <div className="bg-white rounded-[3rem] border border-slate-200/50 shadow-sm overflow-hidden">
        <div className="px-10 py-8 border-b border-slate-100 bg-slate-50/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-600/10 flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">Grille : {selectedNiveauLabel}</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Cliquez sur le badge pour activer un coefficient spécifique</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-5 py-2 bg-white text-emerald-600 text-[10px] font-black uppercase tracking-widest rounded-2xl border border-emerald-100 shadow-sm">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            {matieres.length} disciplines disponibles
          </div>
        </div>

        {!selectedNiveau ? (
          <div className="py-32 text-center space-y-4">
            <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto border-2 border-dashed border-slate-200">
              <Info className="w-10 h-10 text-slate-300" />
            </div>
            <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-[10px]">Veuillez sélectionner un niveau académique</p>
          </div>
        ) : niveaux.length === 0 ? (
          <div className="py-32 text-center space-y-6">
            <AlertCircle className="w-16 h-16 text-amber-400 mx-auto" />
            <div className="space-y-2">
              <p className="text-slate-800 font-black uppercase text-sm">Aucun niveau configuré</p>
              <p className="text-slate-400 text-xs max-w-sm mx-auto leading-relaxed">
                Vous devez d&apos;abord définir les niveaux de votre école (6ème, 5ème, etc.) dans les paramètres pour configurer les coefficients.
              </p>
            </div>
          </div>
        ) : (
          <div className="p-10">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {matieres.map(m => {
                const isCustom = grid[m.id]?.active
                return (
                  <div 
                    key={m.id} 
                    className={`group/card p-7 rounded-[2.25rem] border-2 transition-all duration-500 ${
                      isCustom 
                        ? 'border-emerald-500 bg-emerald-50/40 ring-8 ring-emerald-500/5 shadow-xl shadow-emerald-500/5' 
                        : 'border-slate-100 bg-white hover:border-emerald-200 hover:shadow-xl hover:shadow-slate-200/30'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-6">
                      <div className="flex-1 min-w-0 pr-4">
                        <h3 className="font-black text-slate-900 uppercase text-[11px] tracking-tight group-hover/card:text-emerald-700 transition-colors truncate">{m.nom}</h3>
                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-[0.2em] mt-1.5">{m.code || 'CODE'}</p>
                      </div>
                      <button
                        onClick={() => setGrid(g => ({ ...g, [m.id]: { ...g[m.id], active: !g[m.id].active } }))}
                        className={`p-3 rounded-2xl transition-all duration-300 transform active:scale-90 shadow-sm ${
                          isCustom 
                            ? 'bg-emerald-600 text-white shadow-emerald-500/40' 
                            : 'bg-slate-50 text-slate-300 hover:bg-emerald-50 hover:text-emerald-500'
                        }`}
                        title={isCustom ? 'Utiliser coefficient spécifique' : 'Utiliser coefficient par défaut'}
                      >
                        <CheckCircle2 className={`w-5 h-5 ${isCustom ? 'animate-in zoom-in duration-300' : ''}`} />
                      </button>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Pondération (Coeff.)</label>
                          <span className={`text-[9px] font-black uppercase ${isCustom ? 'text-emerald-600' : 'text-slate-300'}`}>
                            {isCustom ? 'Mode Spécifique' : 'Mode Défaut'}
                          </span>
                        </div>
                        <div className="relative">
                           <input
                            type="number"
                            min="1"
                            max="20"
                            step="0.5"
                            value={grid[m.id]?.coef}
                            onChange={e => setGrid(g => ({ ...g, [m.id]: { ...g[m.id], coef: Number(e.target.value) } }))}
                            className={`w-full bg-white border-2 rounded-2xl px-5 py-4 text-sm font-black transition-all duration-300 focus:ring-0 ${
                              isCustom 
                                ? 'border-emerald-300 text-emerald-700 focus:border-emerald-500' 
                                : 'border-slate-100 text-slate-400 focus:border-emerald-200'
                            }`}
                          />
                          {!isCustom && (
                             <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[9px] text-slate-300 font-black uppercase pointer-events-none">
                               Base: {m.coefficient}
                             </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Bottom info banner */}
            <div className="mt-16 p-8 bg-slate-950 rounded-[2.5rem] border border-white/5 relative overflow-hidden group shadow-2xl">
               <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full -mr-32 -mt-32 blur-3xl group-hover:scale-125 transition-transform duration-1000" />
               <div className="flex flex-col md:flex-row items-center justify-between gap-8 relative z-10">
                 <div className="flex items-center gap-6">
                   <div className="w-16 h-16 rounded-[1.5rem] bg-emerald-500/20 flex items-center justify-center text-emerald-400 border border-emerald-500/20 shadow-inner">
                      <Info className="w-8 h-8" />
                   </div>
                   <div className="text-left space-y-1">
                     <p className="text-sm font-black text-white uppercase tracking-widest">Impact sur les moyennes</p>
                     <p className="text-xs text-slate-400 leading-relaxed max-w-lg">
                       Les coefficients enregistrés ici remplacent les coefficients globaux lors de la génération des bulletins et du calcul des moyennes générales pour ce niveau spécifique.
                     </p>
                   </div>
                 </div>
                 <button
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full md:w-auto px-12 py-5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] transition-all duration-300 shadow-2xl shadow-emerald-500/20 active:scale-95 flex items-center justify-center gap-3"
                 >
                   {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                   Valider la configuration
                 </button>
               </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
