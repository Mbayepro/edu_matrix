import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Loader2, FileText, Plus, X, Calendar, Save, Trash2, Edit2 } from 'lucide-react';

interface Matiere {
  id: string;
  nom: string;
  coefficient: number;
  is_obligatoire: boolean;
}

interface Niveau {
  id: string;
  code: string;
  nom: string;
  cycle: 'primaire' | 'moyen' | 'secondaire';
}

interface Serie {
  id: string;
  code: string;
  nom: string;
}

interface Evaluation {
  id: string;
  type: 'controle' | 'devoir' | 'composition';
  date: string;
  coef: number;
  bareme: number;
  matiere_id: string;
}

interface Note {
  id: string;
  evaluation_id: string;
  eleve_id: string;
  note: number;
}

interface GradesEntryProps {
  classeId: string;
  trimestre: number;
}

export default function GradesEntry({ classeId, trimestre }: GradesEntryProps) {
  const [matieres, setMatieres] = useState<Matiere[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showNewEvalModal, setShowNewEvalModal] = useState(false);
  const [selectedMatiereId, setSelectedMatiereId] = useState<string>('');
  const [newEval, setNewEval] = useState({
    type: 'controle' as 'controle' | 'devoir' | 'composition',
    date: new Date().toISOString().split('T')[0],
    coef: 1,
    bareme: 20,
  });
  const [niveau, setNiveau] = useState<Niveau | null>(null);
  const [serie, setSerie] = useState<Serie | null>(null);

  // Charger les informations de la classe (niveau et série)
  useEffect(() => {
    const loadClasseInfo = async () => {
      const { data: classe, error } = await supabase
        .from('classes')
        .select(`
          niveau_id,
          serie_id,
          niveaux(id, code, nom, cycle),
          series(id, code, nom)
        `)
        .eq('id', classeId)
        .single();

      if (error) {
        console.error('Erreur lors du chargement de la classe:', error);
        return;
      }

      setNiveau(classe.niveaux);
      setSerie(classe.series);
    };

    loadClasseInfo();
  }, [classeId]);

  // Charger les matières avec coefficients dynamiques selon le niveau et la série
  useEffect(() => {
    const loadMatieres = async () => {
      if (!niveau) return;

      let query = supabase
        .from('coefficients_matieres')
        .select(`
          coefficient,
          is_obligatoire,
          matieres(id, nom, cycle)
        `)
        .eq('niveau_id', niveau.id);

      // Pour le secondaire, filtrer par série si elle existe
      if (niveau.cycle === 'secondaire' && serie) {
        query = query.or(`serie_id.eq.${serie.id},serie_id.is.null`);
      } else {
        query = query.is('serie_id', null);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Erreur lors du chargement des matières:', error);
        return;
      }

      const matieresFormatees: Matiere[] = data?.map((item: { coefficient: string; is_obligatoire: boolean; matieres: { id: string; nom: string } }) => ({
        id: item.matieres.id,
        nom: item.matieres.nom,
        coefficient: parseFloat(item.coefficient),
        is_obligatoire: item.is_obligatoire
      })) || [];

      setMatieres(matieresFormatees);
    };

    loadMatieres();
  }, [niveau, serie]);

  // Charger les évaluations de la classe pour le trimestre
  useEffect(() => {
    const loadEvaluations = async () => {
      const { data, error } = await supabase
        .from('evaluations')
        .select('*')
        .eq('classe_id', classeId)
        .eq('trimestre', trimestre)
        .order('date', { ascending: true });

      if (error) {
        console.error('Erreur lors du chargement des évaluations:', error);
        return;
      }

      setEvaluations(data || []);
    };

    loadEvaluations();
  }, [classeId, trimestre]);

  const createEvaluation = async () => {
    if (!selectedMatiereId || !classeId) return;
    
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: prof } = await supabase.from('profiles').select('ecole_id').eq('user_id', user?.id).single();

      const { data, error } = await supabase
        .from('evaluations')
        .insert({
          ecole_id: prof?.ecole_id,
          classe_id: classeId,
          matiere_id: selectedMatiereId,
          trimestre: trimestre,
          type: newEval.type,
          date: newEval.date,
          coef: 1, // Fixé à 1 selon la nouvelle règle sénégalaise
          bareme: newEval.bareme,
        })
        .select()
        .single();

      if (!error && data) {
        setShowNewEvalModal(false);
        // Recharger les évaluations
        const { data: updatedEvals } = await supabase
          .from('evaluations')
          .select('*')
          .eq('classe_id', classeId)
          .eq('trimestre', trimestre)
          .order('date', { ascending: true });
        setEvaluations(updatedEvals || []);
      }
    } finally {
      setSaving(false);
    }
  };

  const deleteEvaluation = async (evalId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette évaluation ainsi que toutes les notes associées ?')) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('evaluations')
        .delete()
        .eq('id', evalId);

      if (!error) {
        setEvaluations(prev => prev.filter(ev => ev.id !== evalId));
        setNotes(prev => prev.filter(n => n.evaluation_id !== evalId));
      }
    } finally {
      setLoading(false);
    }
  };

  const updateEvaluation = async (ev: Evaluation) => {
    const newBareme = prompt('Nouveau Barème (ex: 20)?', ev.bareme.toString());
    if (newBareme === null || isNaN(Number(newBareme))) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('evaluations')
        .update({ bareme: Number(newBareme) })
        .eq('id', ev.id);

      if (!error) {
        setEvaluations(prev => prev.map(e => e.id === ev.id ? { ...e, bareme: Number(newBareme) } : e));
      }
    } finally {
      setSaving(false);
    }
  };

  // Charger les élèves de la classe
  const [eleves, setEleves] = useState<any[]>([]);
  useEffect(() => {
    const loadEleves = async () => {
      const { data, error } = await supabase
        .from('eleves')
        .select('*')
        .eq('classe_id', classeId)
        .order('nom', { ascending: true });

      if (error) {
        console.error('Erreur lors du chargement des élèves:', error);
        return;
      }

      setEleves(data || []);
      setLoading(false);
    };

    loadEleves();
  }, [classeId]);

  // Charger les notes existantes
  useEffect(() => {
    const loadNotes = async () => {
      if (evaluations.length === 0) return;
      
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .in('evaluation_id', evaluations.map(e => e.id));

      if (error) {
        console.error('Erreur lors du chargement des notes:', error);
        return;
      }

      setNotes(data || []);
    };

    loadNotes();
  }, [evaluations]);

  // Gérer la saisie d'une note
  const handleNoteChange = async (eleveId: string, evaluationId: string, value: string) => {
    // Si la valeur est vide, on peut soit laisser tel quel soit traiter comme null
    if (value === '') return;
    
    const noteValue = parseFloat(value.replace(',', '.'));
    
    const evaluation = evaluations.find(ev => ev.id === evaluationId);
    if (!evaluation) return;

    // Validation : la note doit être entre 0 et le barème
    if (isNaN(noteValue) || noteValue < 0 || noteValue > evaluation.bareme) {
      // Optionnellement afficher un toast ici
      return;
    }

    // Mettre à jour l'état local immédiatement (Optimistic Update)
    const tempNote = {
      id: `temp-${Date.now()}`,
      evaluation_id: evaluationId,
      eleve_id: eleveId,
      note: noteValue
    };

    setNotes(prev => {
      const existingIndex = prev.findIndex(
        n => n.evaluation_id === evaluationId && n.eleve_id === eleveId
      );
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = tempNote;
        return updated;
      }
      return [...prev, tempNote];
    });

    // Upsert de la note
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('notes')
      .upsert({
        eleve_id: eleveId,
        evaluation_id: evaluationId,
        note: noteValue,
        professeur_id: user?.id
      }, {
        onConflict: 'eleve_id,evaluation_id'
      });

    if (error) {
      console.error('Erreur de sauvegarde (Réseau ou BDD):', error);
      // PWA Mode Offline : Sauvegarde locale
      const offlineKey = `offline_note_${eleveId}_${evaluationId}`;
      const offlineData = {
        eleve_id: eleveId,
        evaluation_id: evaluationId,
        note: noteValue,
        professeur_id: user?.id,
        saved_at: new Date().toISOString()
      };
      localStorage.setItem(offlineKey, JSON.stringify(offlineData));
      alert(`⚠️ Connexion perdue. La note (${noteValue}) a été sauvegardée localement (Brouillon PWA) et sera synchronisée au retour du réseau.`);
    } else {
      localStorage.removeItem(`offline_note_${eleveId}_${evaluationId}`);
    }
  };

  // Obtenir la note d'un élève pour une évaluation
  const getNote = (eleveId: string, evaluationId: string): number | null => {
    const note = notes.find(n => n.eleve_id === eleveId && n.evaluation_id === evaluationId);
    return note ? note.note : null;
  };

  // Calculer la moyenne d'un élève pour une matière
  const calculerMoyenneMatiere = (eleveId: string, matiereId: string): number => {
    const matiereEvals = evaluations.filter(ev => ev.matiere_id === matiereId);
    
    if (matiereEvals.length === 0) return 0;

    let sommePonderee = 0;
    let sommeCoefficients = 0;

    matiereEvals.forEach(ev => {
      const note = getNote(eleveId, ev.id);
      if (note !== null) {
        sommePonderee += note * (ev.coef || 1);
        sommeCoefficients += (ev.coef || 1);
      }
    });

    return sommeCoefficients > 0 ? sommePonderee / sommeCoefficients : 0;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-20">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-10 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600/10 flex items-center justify-center">
              <FileText className="w-5 h-5 text-emerald-600" />
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none">Saisie des Notes</h1>
          </div>
          <p className="text-sm text-slate-500 font-medium max-w-2xl tracking-tight">
            {niveau?.nom} {serie?.code && `(${serie.code})`} • Trimestre {trimestre}
          </p>
        </div>
      </div>

      {/* Recap Table */}
      <div className="bg-white rounded-[2.5rem] border border-slate-200/60 shadow-sm overflow-hidden transition-all hover:shadow-xl hover:shadow-emerald-900/5">
        <div className="px-10 py-6 border-b border-slate-100 bg-slate-50/30 flex items-center justify-between">
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Récapitulatif des Moyennes</h2>
          <div className="flex items-center gap-2">
             <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
             <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Calcul automatique</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/10">
                <th className="px-10 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Élève</th>
                {matieres.map(matiere => (
                  <th key={matiere.id} className="px-6 py-5 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {matiere.nom}
                    <div className="text-[9px] opacity-60">Coef: {matiere.coefficient}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {eleves.map(eleve => (
                <tr key={eleve.id} className="group hover:bg-slate-50/50 transition-colors">
                  <td className="px-10 py-5">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center font-black text-slate-400 text-xs">
                        {eleve.nom[0]}{eleve.prenom[0]}
                      </div>
                      <div>
                        <div className="font-black text-slate-900 uppercase">{eleve.nom} {eleve.prenom}</div>
                        <div className="text-[10px] text-slate-400 font-black tracking-widest">{eleve.matricule}</div>
                      </div>
                    </div>
                  </td>
                  {matieres.map(matiere => {
                    const moyenne = calculerMoyenneMatiere(eleve.id, matiere.id);
                    const cycle = niveau?.cycle || 'moyen';
                    const max = cycle === 'primaire' ? 10 : 20;
                    return (
                      <td key={matiere.id} className="px-6 py-5 text-center">
                        <div className={`text-base font-black tracking-tighter ${moyenne >= (max/2) ? 'text-emerald-600' : 'text-red-500'}`}>
                          {moyenne.toFixed(2)}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Details Sections */}
      <div className="space-y-8">
        <h3 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-3">
           <div className="w-2 h-8 bg-amber-400 rounded-full" />
           Saisie par Évaluation
        </h3>
        
        <div className="grid grid-cols-1 gap-8">
          {matieres.map(matiere => (
            <div key={matiere.id} className="bg-white rounded-[2.5rem] border border-slate-200/60 shadow-sm overflow-hidden group hover:border-emerald-200 transition-all">
              <div className="px-10 py-6 border-b border-slate-100 bg-slate-50/30 flex items-center justify-between">
                <h4 className="font-black text-slate-900 uppercase tracking-tight">{matiere.nom}</h4>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setSelectedMatiereId(matiere.id);
                      setNewEval(prev => ({ ...prev, bareme: niveau?.cycle === 'primaire' ? 10 : 20 }));
                      setShowNewEvalModal(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20 transition-all"
                  >
                    <Plus className="w-3 h-3" />
                    Nouvelle Évaluation
                  </button>
                  <div className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-widest shadow-sm">
                    Coefficient: {matiere.coefficient}
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="px-10 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Élève</th>
                      {evaluations
                        .filter(ev => ev.matiere_id === matiere.id)
                        .map(ev => (
                          <th key={ev.id} className="px-6 py-5 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest relative group/header">
                            <div className="text-slate-900 flex items-center justify-center gap-1">
                              {ev.type.toUpperCase()}
                              <div className="flex items-center opacity-0 group-hover/header:opacity-100 transition-opacity">
                                <button onClick={() => updateEvaluation(ev)} className="p-1 hover:text-blue-600"><Edit2 className="w-3 h-3" /></button>
                                <button onClick={() => deleteEvaluation(ev.id)} className="p-1 hover:text-red-600"><Trash2 className="w-3 h-3" /></button>
                              </div>
                            </div>
                            <div className="text-[9px] opacity-60">Barème: /{ev.bareme}</div>
                          </th>
                        ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {eleves.map(eleve => (
                      <tr key={eleve.id} className="hover:bg-slate-50/30 transition-colors">
                        <td className="px-10 py-4 font-bold text-slate-700 uppercase text-xs">{eleve.nom} {eleve.prenom}</td>
                        {evaluations
                          .filter(ev => ev.matiere_id === matiere.id)
                          .map(ev => {
                            const val = getNote(eleve.id, ev.id);
                            return (
                              <td key={ev.id} className="px-6 py-4 text-center">
                                <input
                                  type="text"
                                  placeholder="--"
                                  value={val !== null ? val.toString() : ''}
                                  onChange={(e) => handleNoteChange(eleve.id, ev.id, e.target.value)}
                                  className={`w-16 h-10 bg-slate-50 border-none rounded-xl text-center text-sm font-black transition-all focus:ring-4 focus:ring-emerald-500/10 focus:bg-white ${val !== null ? (val >= (ev.bareme/2) ? 'text-emerald-700' : 'text-red-600') : 'text-slate-400'}`}
                                />
                              </td>
                            );
                          })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {evaluations.filter(ev => ev.matiere_id === matiere.id).length === 0 && (
                <div className="p-10 text-center">
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Aucune évaluation programmée pour cette matière</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {showNewEvalModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[2.5rem] p-10 w-full max-w-lg shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full -mr-16 -mt-16" />
            <div className="relative z-10 text-left">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 rounded-2xl bg-emerald-600/10 flex items-center justify-center text-emerald-600">
                  <Plus className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">Nouvelle Évaluation</h3>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">
                    {matieres.find(m => m.id === selectedMatiereId)?.nom} — Trimestre {trimestre}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">Nature de l&apos;épreuve</label>
                  <select
                    value={newEval.type}
                    onChange={(e) => setNewEval(prev => ({ ...prev, type: e.target.value as any }))}
                    className="w-full bg-slate-50 border-none rounded-xl px-4 py-3.5 text-sm font-bold text-slate-700 focus:ring-4 focus:ring-emerald-500/10 focus:bg-white transition-all shadow-sm"
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
  );
}