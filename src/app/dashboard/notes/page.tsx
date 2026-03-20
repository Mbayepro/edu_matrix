'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Classe, Matiere, Evaluation, Eleve, Note, Niveau, Serie } from '@/lib/supabase'
import {
  Loader2,
  Save,
  Plus,
  Edit,
  Trash2,
  BookOpen,
  Users,
  Calendar,
  Filter,
} from 'lucide-react'
import { useProfile } from '@/hooks/useProfile'
import { useToast } from '@/contexts/ToastContext'

export default function NotesPage() {
  const { profile, loading: profileLoading } = useProfile()
  const ecoleId = profile?.ecole_id || null

  const [classes, setClasses] = useState<Classe[]>([])
  const [niveaux, setNiveaux] = useState<Niveau[]>([])
  const [series, setSeries] = useState<Serie[]>([])
  const [matieres, setMatieres] = useState<Matiere[]>([])
  const [evaluations, setEvaluations] = useState<Evaluation[]>([])
  const [eleves, setEleves] = useState<Eleve[]>([])
  const [notes, setNotes] = useState<Record<string, number>>({})
  const [moyennesGenerales, setMoyennesGenerales] = useState<Record<string, number>>({})
  
  const [selectedClasse, setSelectedClasse] = useState<string>('')
  const [selectedMatiere, setSelectedMatiere] = useState<string>('')
  const [selectedTrimestre, setSelectedTrimestre] = useState<1 | 2 | 3>(1)
  const [selectedEvaluation, setSelectedEvaluation] = useState<string>('')
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const { showToast } = useToast()
  const [showNewEvalModal, setShowNewEvalModal] = useState(false)
  const [newEval, setNewEval] = useState({
    type: 'controle' as 'controle' | 'devoir' | 'composition',
    date: new Date().toISOString().split('T')[0],
    coef: 1,
    bareme: 20,
  })

  useEffect(() => {
    if (selectedClasse) {
      loadMatieres()
      loadEleves()
    }
  }, [selectedClasse])

  useEffect(() => {
    if (selectedClasse && selectedMatiere && selectedTrimestre) {
      loadEvaluations()
    }
  }, [selectedClasse, selectedMatiere, selectedTrimestre])

  useEffect(() => {
    if (selectedEvaluation) {
      loadNotes()
    }
  }, [selectedEvaluation])

  async function loadBaseData(schoolId: string) {
    setLoading(true)
    try {
      await Promise.all([
        loadNiveaux(schoolId),
        loadSeries(schoolId),
        loadClasses(schoolId)
      ])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (ecoleId) {
       loadBaseData(ecoleId)
    } else if (!profileLoading && !ecoleId) {
       setLoading(false)
    }
  }, [ecoleId, profileLoading])

  async function loadNiveaux(schoolId: string) {
    const { data } = await supabase
      .from('niveaux')
      .select('*')
      .eq('ecole_id', schoolId)
      .eq('is_active', true)
      .order('ordre')
    setNiveaux(data ?? [])
  }

  async function loadSeries(schoolId: string) {
    const { data } = await supabase
      .from('series')
      .select('*')
      .eq('ecole_id', schoolId)
      .eq('is_active', true)
      .order('code')
    setSeries(data ?? [])
  }

  async function loadClasses(schoolId: string) {
    const { data } = await supabase
      .from('classes')
      .select('*, niveau_info:niveaux(cycle)')
      .eq('ecole_id', schoolId)
      .order('nom_classe')
    setClasses(data ?? [])
  }

  async function loadMatieres() {
    if (!selectedClasse || !ecoleId) return
    
    // Fetch matieres via coefficients_matieres if niveau_id exists
    const { data: classeData } = await supabase
      .from('classes')
      .select('niveau_id, serie_id, niveau_info:niveaux(cycle)')
      .eq('id', selectedClasse)
      .single()

    try {
      if (classeData?.niveau_id) {
        // Cas normal : classe liée à un niveau → on filtre par niveau
        let query = supabase
          .from('coefficients_matieres')
          .select(`matiere:matieres(*)`)
          .eq('ecole_id', ecoleId)
          .eq('niveau_id', classeData.niveau_id)
          .eq('is_obligatoire', true)

        if (classeData.serie_id) {
           query = query.or(`serie_id.eq.${classeData.serie_id},serie_id.is.null`)
        } else {
           query = query.is('serie_id', null)
        }

        const { data } = await query
        const list = data?.map((cm: any) => cm.matiere).filter(Boolean) as Matiere[]
        if (list && list.length > 0) {
          setMatieres(list)
          return
        }
      }
      
      // Fallback : classe sans niveau_id OU aucune matière trouvée dans coefficients
      // → on charge toutes les matières actives de l'école
      const { data: allMatieres } = await supabase
        .from('matieres')
        .select('*')
        .eq('ecole_id', ecoleId)
        .eq('is_active', true)
        .order('nom')
      setMatieres(allMatieres ?? [])
    } catch (error) {
      console.error('Erreur lors du chargement des matières:', error)
      // Fallback final : toutes les matières de l'école
      const { data } = await supabase.from('matieres').select('*').eq('ecole_id', ecoleId).eq('is_active', true).order('nom')
      setMatieres(data ?? [])
    }
  }

  async function loadEvaluations() {
    if (!selectedClasse || !selectedMatiere || !selectedTrimestre) return
    
    const { data } = await supabase
      .from('evaluations')
      .select('*, matiere:matieres(nom), classe:classes(nom_classe)')
      .eq('classe_id', selectedClasse)
      .eq('matiere_id', selectedMatiere)
      .eq('trimestre', selectedTrimestre)
      .order('date', { ascending: false })
    
    setEvaluations(data ?? [])
    if (data && data.length > 0) {
      setSelectedEvaluation(data[0].id)
    } else {
      setSelectedEvaluation('')
      setNotes({})
    }
  }

  async function loadEleves() {
    if (!selectedClasse) return
    
    const { data } = await supabase
      .from('eleves')
      .select('*')
      .eq('classe_id', selectedClasse)
      .order('nom')
    
    setEleves(data ?? [])
  }

  async function loadNotes() {
    if (!selectedEvaluation) return
    
    // Charger les notes de cette évaluation
    const { data: notesData } = await supabase
      .from('notes')
      .select('*, eleve:eleves(nom, prenom)')
      .eq('evaluation_id', selectedEvaluation)
    
    const notesMap: Record<string, number> = {}
    notesData?.forEach((note: any) => {
      notesMap[note.eleve_id] = note.note
    })
    setNotes(notesMap)

    // Charger les moyennes générales depuis la vue SQL pour le trimestre courant et l'école
    if (ecoleId && selectedClasse && selectedTrimestre) {
      const { data: moyennesData } = await supabase
        .from('v_moyennes_generales')
        .select('eleve_id, moyenne_generale')
        .eq('ecole_id', ecoleId) // isolation multi-école
        .eq('classe_id', selectedClasse)
        .eq('trimestre', selectedTrimestre)

      const moyennesMap: Record<string, number> = {}
      const isClassePrimaire = selectedClasseData?.niveau_info?.cycle === 'primaire'
      moyennesData?.forEach((m: any) => {
         moyennesMap[m.eleve_id] = Number(m.moyenne_generale)
      })
      setMoyennesGenerales(moyennesMap)
    }
  }

  async function createEvaluation() {
    if (!selectedClasse || !selectedMatiere || !ecoleId) return
    
    setSaving(true)
    try {
      const { data, error } = await supabase
        .from('evaluations')
        .insert({
          ecole_id: ecoleId,
          classe_id: selectedClasse,
          matiere_id: selectedMatiere,
          trimestre: selectedTrimestre,
          type: newEval.type,
          date: newEval.date,
          coef: newEval.coef,
          bareme: newEval.bareme,
        })
        .select()
        .single()

      if (!error && data) {
        setShowNewEvalModal(false)
        setNewEval({
          type: 'controle',
          date: new Date().toISOString().split('T')[0],
          coef: 1,
          bareme: 20,
        })
        await loadEvaluations()
      }
    } finally {
      setSaving(false)
    }
  }

  async function saveNotes() {
    if (!selectedEvaluation || eleves.length === 0) return
    
    setSaving(true)
    try {
      // Only upsert notes that were actually entered (skip students with no entry)
      const notesToInsert = eleves
        .filter(eleve => notes[eleve.id] !== undefined)
        .map(eleve => ({
          ecole_id: ecoleId!,
          eleve_id: eleve.id,
          evaluation_id: selectedEvaluation,
          note: notes[eleve.id],
        }))

      if (notesToInsert.length === 0) {
        showToast('Aucune note à enregistrer.')
        return
      }

      const { error } = await supabase
        .from('notes')
        .upsert(notesToInsert, {
          onConflict: 'eleve_id,evaluation_id',
          ignoreDuplicates: false,
        })

      if (!error) {
        showToast(`${notesToInsert.length} note(s) enregistrée(s) avec succès.`, 'success')
      } else {
        showToast('Erreur : ' + error.message, 'error')
      }
    } finally {
      setSaving(false)
    }
  }

  async function deleteEvaluation(id: string) {
    if (!confirm('Voulez-vous vraiment supprimer cette évaluation et toutes ses notes ?')) return
    setSaving(true)
    try {
      const { error } = await supabase.from('evaluations').delete().eq('id', id)
      if (!error) {
        showToast('Évaluation supprimée avec succès', 'success')
        setSelectedEvaluation('')
        await loadEvaluations()
      }
    } finally {
      setSaving(false)
    }
  }

  async function updateEvaluation(ev: Evaluation) {
    const newBareme = prompt('Nouveau Barème (ex: 20)?', ev.bareme.toString())
    if (!newBareme || isNaN(Number(newBareme))) return

    setSaving(true)
    try {
      const { error } = await supabase.from('evaluations').update({ bareme: Number(newBareme) }).eq('id', ev.id)
      if (!error) {
        showToast('Barème mis à jour', 'success')
        await loadEvaluations()
      }
    } finally {
      setSaving(false)
    }
  }

  const getMention = (note: number, bareme: number = 20): string => {
    if (note === undefined || note === null) return '-';
    
    // Si le barème est sur 10 (ex: primaire au Sénégal)
    if (bareme === 10) {
      if (note < 5) return 'Insuffisant'
      if (note < 6) return 'Passable'
      if (note < 7) return 'Assez bien'
      if (note < 8) return 'Bien'
      return 'Très bien'
    }

    // Sinon, comportement classique sur 20
    const noteSur20 = (note / bareme) * 20;
    
    if (noteSur20 < 10) return 'Insuffisant'
    if (noteSur20 < 12) return 'Passable'
    if (noteSur20 < 14) return 'Assez bien'
    if (noteSur20 < 16) return 'Bien'
    return 'Très bien'
  }

  const getNoteColor = (note: number, bareme: number = 20) => {
    if (note === undefined || note === null) return 'text-slate-500 bg-slate-50';
    
    // Si le barème est sur 10
    if (bareme === 10) {
      if (note < 5) return 'text-red-600 bg-red-50'
      if (note < 6) return 'text-orange-600 bg-orange-50'
      if (note < 7) return 'text-yellow-600 bg-yellow-50'
      return 'text-green-600 bg-green-50'
    }

    // Sinon, sur 20
    const noteSur20 = (note / bareme) * 20;
    
    if (noteSur20 < 10) return 'text-red-600 bg-red-50'
    if (noteSur20 < 12) return 'text-orange-600 bg-orange-50'
    if (noteSur20 < 14) return 'text-yellow-600 bg-yellow-50'
    return 'text-green-600 bg-green-50'
  }

  const selectedEvaluationData = evaluations.find(e => e.id === selectedEvaluation)
  const selectedClasseData = classes.find(c => c.id === selectedClasse)
  const selectedMatiereData = matieres.find(m => m.id === selectedMatiere)

  if (loading || profileLoading) {
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
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-600/10 flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-emerald-600" />
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Gestion des Notes</h1>
          </div>
          <p className="text-sm text-slate-500 font-medium tracking-tight">
            Saisissez les évaluations et suivez les performances académiques des élèves.
          </p>
        </div>

        {selectedEvaluationData && (
          <div className="flex items-center gap-4 px-4 py-2 bg-emerald-50 rounded-2xl border border-emerald-100 shadow-sm">
            <div className="text-center px-4 border-r border-emerald-100">
              <div className="text-[10px] font-black uppercase tracking-widest text-emerald-600/60">Type</div>
              <div className="text-sm font-black text-emerald-700 leading-tight uppercase">{selectedEvaluationData.type}</div>
            </div>
            <div className="text-center px-4">
              <div className="text-[10px] font-black uppercase tracking-widest text-emerald-600/60">Barème</div>
              <div className="text-sm font-black text-emerald-700 leading-tight">/{selectedEvaluationData.bareme}</div>
            </div>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-[2rem] border border-slate-200/60 shadow-sm p-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="space-y-2">
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Structure / Classe</label>
            <select
              value={selectedClasse}
              onChange={(e) => setSelectedClasse(e.target.value)}
              className="w-full bg-slate-50 border-none rounded-xl px-4 py-3.5 text-sm font-bold text-slate-700 focus:ring-4 focus:ring-emerald-500/10 focus:bg-white transition-all"
            >
              <option value="">Sélectionner une classe</option>
              {classes.map(cls => (
                <option key={cls.id} value={cls.id}>{cls.nom_classe}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Discipline / Matière</label>
            <select
              value={selectedMatiere}
              onChange={(e) => setSelectedMatiere(e.target.value)}
              className="w-full bg-slate-50 border-none rounded-xl px-4 py-3.5 text-sm font-bold text-slate-700 focus:ring-4 focus:ring-emerald-500/10 focus:bg-white transition-all"
            >
              <option value="">Sélectionner une matière</option>
              {matieres.map(mat => (
                <option key={mat.id} value={mat.id}>{mat.nom}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Période scolaire</label>
            <select
              value={selectedTrimestre}
              onChange={(e) => setSelectedTrimestre(Number(e.target.value) as 1 | 2 | 3)}
              className="w-full bg-slate-50 border-none rounded-xl px-4 py-3.5 text-sm font-bold text-slate-700 focus:ring-4 focus:ring-emerald-500/10 focus:bg-white transition-all"
            >
              <option value={1}>1er Trimestre</option>
              <option value={2}>2ème Trimestre</option>
              <option value={3}>3ème Trimestre</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Séance d&apos;Évaluation</label>
            <div className="flex gap-2">
              <select
                value={selectedEvaluation}
                onChange={(e) => setSelectedEvaluation(e.target.value)}
                className="flex-1 bg-slate-50 border-none rounded-xl px-4 py-3.5 text-sm font-bold text-slate-700 focus:ring-4 focus:ring-emerald-500/10 focus:bg-white transition-all"
              >
                <option value="">Choisir</option>
                {evaluations.map(evaluation => (
                  <option key={evaluation.id} value={evaluation.id}>
                    {evaluation.type.toUpperCase()} - {new Date(evaluation.date).toLocaleDateString('fr-FR')}
                  </option>
                ))}
              </select>
              <button
                onClick={() => {
                  const isPrimary = (classes.find(c => c.id === selectedClasse) as any)?.niveau_info?.cycle === 'primaire'
                  setNewEval(prev => ({ ...prev, bareme: isPrimary ? 10 : 20 }))
                  setShowNewEvalModal(true)
                }}
                disabled={!selectedClasse || !selectedMatiere}
                className="w-12 h-12 flex items-center justify-center bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-all shadow-lg shadow-emerald-600/20 disabled:opacity-30 disabled:grayscale"
                title="Ajouter une évaluation"
              >
                <Plus className="w-5 h-5 font-black" />
              </button>
            </div>
          </div>
        </div>

        {selectedEvaluationData && (
          <div className="mt-8 p-6 bg-slate-900 rounded-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500 opacity-5 blur-[80px] -mr-32 -mt-32" />
            <div className="relative z-10 flex flex-wrap items-center justify-between gap-6">
              <div className="flex items-center gap-6">
                <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center backdrop-blur-sm border border-white/10 text-white">
                  <Calendar className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-1">Détails de l&apos;évaluation</div>
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-black text-white capitalize">{selectedEvaluationData.type} de {selectedMatiereData?.nom}</h3>
                    <span className="px-2 py-0.5 rounded-md bg-white/10 text-white text-[10px] font-black uppercase tracking-widest">
                      Coef. {selectedEvaluationData.coef}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4 text-right">
                <div className="px-4 py-2 border-r border-white/10">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Classe</div>
                  <div className="text-sm font-black text-white">{selectedClasseData?.nom_classe}</div>
                </div>
                <div className="px-4 py-2 border-r border-white/10">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Date</div>
                  <div className="text-sm font-black text-white uppercase">{new Date(selectedEvaluationData.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</div>
                </div>
                <div className="flex items-center gap-2 pl-4">
                  <button 
                    onClick={() => updateEvaluation(selectedEvaluationData)}
                    className="p-2 rounded-lg bg-white/10 text-white hover:bg-emerald-500 transition-colors"
                    title="Modifier le barème"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => deleteEvaluation(selectedEvaluationData.id)}
                    className="p-2 rounded-lg bg-white/10 text-white hover:bg-red-500 transition-colors"
                    title="Supprimer l'évaluation"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Notes Table */}
      {selectedEvaluation && eleves.length > 0 && (
        <div className="bg-white rounded-[2rem] border border-slate-200/60 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Tableau de Saisie</h2>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-600" />
                <span className="text-base font-black text-slate-900">{eleves.length} élèves inscrits</span>
              </div>
            </div>
            
            <button
              onClick={saveNotes}
              disabled={saving}
              className="flex items-center justify-center gap-3 px-8 py-3.5 bg-slate-900 hover:bg-emerald-600 text-white text-sm font-black rounded-xl transition-all shadow-xl shadow-slate-900/10 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Enregistrement…
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Mettre à jour les notes
                </>
              )}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/30">
                  <th className="text-left px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Élève</th>
                  <th className="text-center px-4 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest w-40">Note / {selectedEvaluationData?.bareme || 20}</th>
                  <th className="text-center px-4 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest w-32">Évaluation</th>
                  <th className="text-center px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest w-40 bg-slate-50/50">Moyenne Générale</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {eleves.map((eleve) => {
                  const note = notes[eleve.id]
                  const moyenneEleve = moyennesGenerales[eleve.id]
                  return (
                    <tr key={eleve.id} className="group hover:bg-slate-50/80 transition-all duration-300">
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 text-xs font-black uppercase transition-transform group-hover:scale-110">
                            {eleve.prenom[0]}{eleve.nom[0]}
                          </div>
                          <div>
                            <p className="text-base font-black text-slate-900 leading-tight">{eleve.prenom} {eleve.nom}</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{eleve.matricule}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-5">
                        <div className="relative max-w-[120px] mx-auto group-focus-within:scale-105 transition-transform">
                          <input
                            type="number"
                            min="0"
                            max={selectedEvaluationData?.bareme || 20}
                            step="0.5"
                            value={note === undefined ? '' : note}
                            placeholder="—"
                            onChange={(e) => setNotes(prev => ({
                              ...prev,
                              [eleve.id]: e.target.value === '' ? undefined as any : Number(e.target.value)
                            }))}
                            className={`w-full px-4 py-3 text-center rounded-[1rem] text-base font-black transition-all border-2 focus:outline-none focus:ring-4 ${
                              note !== undefined 
                                ? 'bg-white border-emerald-500/20 text-emerald-700' 
                                : 'bg-slate-50 border-transparent text-slate-400 focus:bg-white focus:border-emerald-500'
                            }`}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-5 text-center">
                        <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider ${getNoteColor(note, selectedEvaluationData?.bareme)}`}>
                          {getMention(note, selectedEvaluationData?.bareme)}
                        </span>
                      </td>
                      <td className="px-8 py-5 text-center bg-slate-50/30">
                        {moyenneEleve !== undefined ? (
                          <div className="flex flex-col items-center">
                            <span className="text-lg font-black text-slate-900">
                              {(selectedClasseData?.niveau_info?.cycle === 'primaire' ? moyenneEleve / 2 : moyenneEleve).toFixed(2)}
                            </span>
                            <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Trim. {selectedTrimestre}</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center opacity-30">
                            <span className="text-sm font-black text-slate-300">—</span>
                            <span className="text-[9px] text-slate-300 font-black uppercase">N/A</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* New Evaluation Modal */}
      {showNewEvalModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[2.5rem] p-10 w-full max-w-lg shadow-2xl animate-in zoom-in duration-300 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full -mr-16 -mt-16" />
            
            <div className="relative z-10">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 rounded-2xl bg-emerald-600/10 flex items-center justify-center text-emerald-600">
                  <Plus className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">Nouvelle Évaluation</h3>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">{selectedMatiereData?.nom} — {selectedClasseData?.nom_classe}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">Nature de l&apos;épreuve</label>
                  <select
                    value={newEval.type}
                    onChange={(e) => setNewEval(prev => ({ ...prev, type: e.target.value as any }))}
                    className="w-full bg-slate-50 border-none rounded-xl px-4 py-3.5 text-sm font-bold text-slate-700 focus:ring-4 focus:ring-emerald-500/10 focus:bg-white transition-all"
                  >
                    <option value="controle">Contrôle de classe</option>
                    <option value="devoir">Devoir surveillé</option>
                    <option value="composition">Composition trimestrielle</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">Date</label>
                  <input
                    type="date"
                    value={newEval.date}
                    onChange={(e) => setNewEval(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full bg-slate-50 border-none rounded-xl px-4 py-3.5 text-sm font-bold text-slate-700 focus:ring-4 focus:ring-emerald-500/10 focus:bg-white transition-all shadow-sm"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">Barème</label>
                  <input
                    type="number"
                    min="1"
                    value={newEval.bareme}
                    onChange={(e) => setNewEval(prev => ({ ...prev, bareme: Number(e.target.value) }))}
                    className="w-full bg-slate-50 border-none rounded-xl px-4 py-3.5 text-sm font-bold text-slate-700 focus:ring-4 focus:ring-emerald-500/10 focus:bg-white transition-all shadow-sm"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">Poids (Coefficient)</label>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min="1"
                      max="10"
                      step="1"
                      value={newEval.coef}
                      onChange={(e) => setNewEval(prev => ({ ...prev, coef: Number(e.target.value) }))}
                      className="flex-1 h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                    />
                    <span className="w-12 h-12 flex items-center justify-center bg-emerald-50 rounded-xl text-emerald-700 font-bold border border-emerald-100">
                      {newEval.coef}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 mt-10">
                <button
                  onClick={() => setShowNewEvalModal(false)}
                  className="flex-1 px-6 py-4 rounded-xl text-sm font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all"
                >
                  Annuler
                </button>
                <button
                  onClick={createEvaluation}
                  disabled={saving}
                  className="flex-[2] py-4 bg-slate-900 hover:bg-emerald-600 text-white rounded-xl text-sm font-black transition-all shadow-xl shadow-slate-900/10 flex items-center justify-center gap-2"
                >
                  {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Créer l\'évaluation'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
