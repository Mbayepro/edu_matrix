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
      .select('*')
      .eq('ecole_id', schoolId)
      .order('nom_classe')
    setClasses(data ?? [])
  }

  async function loadMatieres() {
    if (!selectedClasse || !ecoleId) return
    
    // Fetch matieres via coefficients_matieres if niveau_id exists
    const { data: classeData } = await supabase
      .from('classes')
      .select('niveau_id, serie_id')
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

  const getMention = (note: number): string => {
    if (note < 10) return 'Insuffisant'
    if (note < 12) return 'Passable'
    if (note < 14) return 'Assez bien'
    if (note < 16) return 'Bien'
    return 'Très bien'
  }

  const getNoteColor = (note: number) => {
    if (note < 10) return 'text-red-600 bg-red-50'
    if (note < 12) return 'text-orange-600 bg-orange-50'
    if (note < 14) return 'text-yellow-600 bg-yellow-50'
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
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <BookOpen className="w-5 h-5 text-emerald-600" />
        <h1 className="text-xl font-bold text-slate-800">Gestion des notes</h1>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Classe</label>
            <select
              value={selectedClasse}
              onChange={(e) => setSelectedClasse(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Choisir une classe</option>
              {classes.map(cls => (
                <option key={cls.id} value={cls.id}>{cls.nom_classe}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Matière</label>
            <select
              value={selectedMatiere}
              onChange={(e) => setSelectedMatiere(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Choisir une matière</option>
              {matieres.map(mat => (
                <option key={mat.id} value={mat.id}>{mat.nom}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Trimestre</label>
            <select
              value={selectedTrimestre}
              onChange={(e) => setSelectedTrimestre(Number(e.target.value) as 1 | 2 | 3)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value={1}>Trimestre 1</option>
              <option value={2}>Trimestre 2</option>
              <option value={3}>Trimestre 3</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Évaluation</label>
            <div className="flex gap-2">
              <select
                value={selectedEvaluation}
                onChange={(e) => setSelectedEvaluation(e.target.value)}
                className="flex-1 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Choisir une évaluation</option>
                {evaluations.map(evaluation => (
                  <option key={evaluation.id} value={evaluation.id}>
                    {evaluation.type} - {new Date(evaluation.date).toLocaleDateString('fr-FR')}
                  </option>
                ))}
              </select>
              <button
                onClick={() => setShowNewEvalModal(true)}
                disabled={!selectedClasse}
                className="px-3 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title={!selectedClasse ? 'Sélectionnez dabord une classe' : 'Créer une évaluation'}
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Evaluation Info */}
        {selectedEvaluationData && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
            <div className="flex items-center justify-between">
              <div className="text-sm">
                <span className="font-semibold text-emerald-800">
                  {selectedEvaluationData.type.toUpperCase()}
                </span>
                <span className="text-emerald-600 ml-2">
                  {selectedMatiereData?.nom} - {selectedClasseData?.nom_classe}
                </span>
                <span className="text-emerald-600 ml-2">
                  Coef: {selectedEvaluationData.coef} / Barème: {selectedEvaluationData.bareme}
                </span>
              </div>
              <div className="text-xs text-emerald-600">
                {new Date(selectedEvaluationData.date).toLocaleDateString('fr-FR')}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Notes Table */}
      {selectedEvaluation && eleves.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-400" />
                <h2 className="text-sm font-semibold text-slate-700">
                  Saisie des notes ({eleves.length} élèves)
                </h2>
              </div>
              <button
                onClick={saveNotes}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Enregistrement...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Enregistrer les notes
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Élève
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide w-32">
                    Note / {selectedEvaluationData?.bareme || 20}
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide w-24">
                    Mention (Note)
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide w-32 bg-emerald-50 whitespace-nowrap">
                    Moy. G. Trim {selectedTrimestre}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {eleves.map((eleve) => {
                  const note = notes[eleve.id] || 0
                  const moyenneEleve = moyennesGenerales[eleve.id]
                  return (
                    <tr key={eleve.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div>
                          <div className="font-medium text-slate-800">
                            {eleve.prenom} {eleve.nom}
                          </div>
                          <div className="text-xs text-slate-400">
                            {eleve.matricule}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min="0"
                          max={selectedEvaluationData?.bareme || 20}
                          step="0.5"
                          value={note === undefined ? '' : note}
                          onChange={(e) => setNotes(prev => ({
                            ...prev,
                            [eleve.id]: e.target.value === '' ? undefined as any : Number(e.target.value)
                          }))}
                          className={`w-full px-3 py-2 text-center border rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 ${getNoteColor(note)}`}
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${getNoteColor(note)}`}>
                          {getMention(note)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center bg-emerald-50/30">
                        {moyenneEleve !== undefined ? (
                          <div className="flex flex-col items-center">
                            <span className="font-bold text-slate-800">{moyenneEleve.toFixed(2)}</span>
                            <span className="text-[10px] text-slate-500">{getMention(moyenneEleve)}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">
              Nouvelle évaluation
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Type</label>
                <select
                  value={newEval.type}
                  onChange={(e) => setNewEval(prev => ({ ...prev, type: e.target.value as any }))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="controle">Contrôle</option>
                  <option value="devoir">Devoir</option>
                  <option value="composition">Composition</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Date</label>
                <input
                  type="date"
                  value={newEval.date}
                  onChange={(e) => setNewEval(prev => ({ ...prev, date: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">Coefficient</label>
                  <input
                    type="number"
                    min="1"
                    value={newEval.coef}
                    onChange={(e) => setNewEval(prev => ({ ...prev, coef: Number(e.target.value) }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">Barème</label>
                  <input
                    type="number"
                    min="1"
                    value={newEval.bareme}
                    onChange={(e) => setNewEval(prev => ({ ...prev, bareme: Number(e.target.value) }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowNewEvalModal(false)}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={createEvaluation}
                disabled={saving}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Création...
                  </>
                ) : (
                  'Créer'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
