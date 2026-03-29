'use client'

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Loader2, FileText, Plus, X, Trash2, Edit2 } from 'lucide-react';
import { useProfile } from '@/hooks/useProfile';


interface Matiere {
  id: string;
  nom: string;
  coefficient: number;
  is_obligatoire: boolean;
}

interface Evaluation {
  id: string;
  type: 'controle' | 'devoir' | 'composition';
  date: string;
  coef: number;
  bareme: number;
  matiere_id: string;
  libelle?: string;
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
  const [eleves, setEleves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showNewEvalModal, setShowNewEvalModal] = useState(false);
  const { profile } = useProfile();
  const ecoleId = profile?.ecole_id;
  const [selectedMatiereId, setSelectedMatiereId] = useState<string>('');

  const [mobileEvalId, setMobileEvalId] = useState<string | null>(null);

  const [newEval, setNewEval] = useState({
    type: 'controle' as 'controle' | 'devoir' | 'composition',
    date: new Date().toISOString().split('T')[0],
    coef: 1,
    bareme: 20,
    libelle: '',
  });

  const [niveau, setNiveau] = useState<any>(null);
  const [serie, setSerie] = useState<any>(null);

  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const updatePending = () => {
      const e = JSON.parse(localStorage.getItem('edumatrix_offline_evals') || '[]').length;
      const n = JSON.parse(localStorage.getItem('edumatrix_offline_notes') || '[]').length;
      setPendingCount(e + n);
    };
    updatePending();

    const handleOnline = () => { setIsOnline(true); syncOfflineQueue(); };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    }
  }, []);

  useEffect(() => {
    if (classeId) loadData();
  }, [classeId, trimestre]);

  async function syncOfflineQueue() {
    if (!navigator.onLine) return;
    const evals = JSON.parse(localStorage.getItem('edumatrix_offline_evals') || '[]');
    const offlineNotes = JSON.parse(localStorage.getItem('edumatrix_offline_notes') || '[]');
    if (!evals.length && !offlineNotes.length) return;

    try {
      for (const ev of evals) {
        await supabase.from('evaluations').upsert(ev, { onConflict: 'id' });
      }
      localStorage.setItem('edumatrix_offline_evals', '[]');

      for (const note of offlineNotes) {
        await supabase.from('notes').upsert({
          eleve_id: note.eleve_id,
          evaluation_id: note.evaluation_id,
          note: note.note,
          professeur_id: note.professeur_id
        }, { onConflict: 'eleve_id,evaluation_id' });
      }
      localStorage.setItem('edumatrix_offline_notes', '[]');
      
      setPendingCount(0);
      loadData();
    } catch (e) {
      console.error('Erreur lors de la synchronisation', e);
    }
  }

  async function loadData() {
    setLoading(true);
    try {
      if (!navigator.onLine) throw new Error('Offline');

      const { data: classe } = await supabase
        .from('classes')
        .select('*, niveaux(*), series(*)')
        .eq('id', classeId)
        .single();
      
      setNiveau(classe?.niveaux);
      setSerie(classe?.series);

      const { data: coefs } = await supabase
        .from('coefficients_matieres')
        .select('*, matieres(*)')
        .eq('niveau_id', classe?.niveau_id);
      
      const filteredCoefs = coefs?.filter((c: any) => 
        !c.serie_id || c.serie_id === classe?.serie_id
      ) || [];

      const fetchedMatieres = filteredCoefs.map((c: any) => ({
        id: c.matieres.id,
        nom: c.matieres.nom,
        coefficient: parseFloat(c.coefficient),
        is_obligatoire: c.is_obligatoire
      }));
      setMatieres(fetchedMatieres);

      const { data: listEleves } = await supabase
        .from('eleves')
        .select('*')
        .eq('classe_id', classeId)
        .order('nom');
      setEleves(listEleves || []);

      const { data: listEvals } = await supabase
        .from('evaluations')
        .select('*')
        .eq('classe_id', classeId)
        .eq('trimestre', trimestre);
      setEvaluations(listEvals || []);

      let fetchedNotes: any[] = [];
      if (listEvals?.length) {
        const { data: listNotes } = await supabase
          .from('notes')
          .select('*')
          .in('evaluation_id', listEvals.map((e: any) => e.id));
        fetchedNotes = listNotes || [];
        setNotes(fetchedNotes);
      } else {
        setNotes([]);
      }

      // Save to cache
      const cacheData = {
        niveau: classe?.niveaux, serie: classe?.series,
        matieres: fetchedMatieres, eleves: listEleves || [],
        evaluations: listEvals || [], notes: fetchedNotes
      };
      localStorage.setItem(`edumatrix_offline_grades_${classeId}`, JSON.stringify(cacheData));

    } catch (e) {
      console.log('Passage en mode hors-ligne pour les notes', e);
      const cached = localStorage.getItem(`edumatrix_offline_grades_${classeId}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        setNiveau(parsed.niveau); setSerie(parsed.serie);
        setMatieres(parsed.matieres); setEleves(parsed.eleves);
        
        // Combine online evals with offline queued evals
        const offlineEvals = JSON.parse(localStorage.getItem('edumatrix_offline_evals') || '[]');
        const combinedEvals = [...parsed.evaluations, ...offlineEvals.filter((ev: any) => ev.classe_id === classeId && ev.trimestre === trimestre)];
        setEvaluations(combinedEvals);

        // Combine online notes with offline
        const offlineNotes = JSON.parse(localStorage.getItem('edumatrix_offline_notes') || '[]');
        let mergedNotes = [...parsed.notes];
        offlineNotes.forEach((onote: any) => {
          mergedNotes = mergedNotes.filter((mn: any) => !(mn.eleve_id === onote.eleve_id && mn.evaluation_id === onote.evaluation_id));
        });
        setNotes([...mergedNotes, ...offlineNotes]);
      }
    } finally {
      setLoading(false);
    }
  }

  const handleCreateEval = async () => {
    if (!selectedMatiereId || !ecoleId) return;
    setSaving(true);
    
    const evalData = {
      id: crypto.randomUUID(), // Temporarily local or final UUID
      ecole_id: ecoleId,
      classe_id: classeId,
      matiere_id: selectedMatiereId,
      trimestre,
      type: newEval.type,
      libelle: newEval.libelle,
      date: newEval.date,
      coef: 1,
      bareme: newEval.bareme
    };

    try {
      if (!navigator.onLine) throw new Error('Offline');
      const { data, error } = await supabase.from('evaluations').insert(evalData).select().single();
      if (error) throw error;
      if (data) {
        setEvaluations(prev => [...prev, data]);
      }
    } catch (e) {
      // Hors-ligne ou erreur, on met en file d'attente
      const offlineEvals = JSON.parse(localStorage.getItem('edumatrix_offline_evals') || '[]');
      offlineEvals.push(evalData);
      localStorage.setItem('edumatrix_offline_evals', JSON.stringify(offlineEvals));
      
      setEvaluations(prev => [...prev, evalData as Evaluation]);
      setPendingCount(prev => prev + 1);
    } finally {
      setSaving(false);
      setShowNewEvalModal(false);
      setNewEval({ type: 'controle', date: new Date().toISOString().split('T')[0], coef: 1, bareme: 20, libelle: '' });
    }
  };

  const handleDeleteEval = async (id: string) => {
    if (!confirm('Supprimer cette évaluation ?')) return;
    const { error } = await supabase.from('evaluations').delete().eq('id', id);
    if (!error) {
      setEvaluations(prev => prev.filter(e => e.id !== id));
      setNotes(prev => prev.filter(n => n.evaluation_id !== id));
    }
  };

  const handleNoteChange = async (eleveId: string, evalId: string, val: string) => {
    const num = parseFloat(val.replace(',', '.'));
    if (isNaN(num)) return;

    const noteData = { 
      id: crypto.randomUUID(), 
      eleve_id: eleveId, 
      evaluation_id: evalId, 
      note: num,
      professeur_id: profile?.id
    };

    // Optimistic update
    setNotes(prev => {
      const filtered = prev.filter(n => !(n.eleve_id === eleveId && n.evaluation_id === evalId));
      return [...filtered, noteData as Note];
    });

    try {
      if (!navigator.onLine) throw new Error('Offline');
      const { error } = await supabase.from('notes').upsert({
        eleve_id: eleveId,
        evaluation_id: evalId,
        note: num,
        professeur_id: profile?.id
      }, { onConflict: 'eleve_id,evaluation_id' });
      if (error) throw error;
    } catch (e) {
      const offlineNotes = JSON.parse(localStorage.getItem('edumatrix_offline_notes') || '[]');
      const filtered = offlineNotes.filter((n: any) => !(n.eleve_id === eleveId && n.evaluation_id === evalId));
      filtered.push(noteData);
      localStorage.setItem('edumatrix_offline_notes', JSON.stringify(filtered));
      setPendingCount(prev => prev + 1);
    }
  };

  const getNote = (eleveId: string, evalId: string) => {
    return notes.find(n => n.eleve_id === eleveId && n.evaluation_id === evalId)?.note ?? null;
  };

  const selectedEval = evaluations.find(ev => ev.id === mobileEvalId);

  if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-emerald-600" /></div>

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">Espace Notes</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
            {niveau?.nom} • Trimestre {trimestre}
          </p>
        </div>
        {pendingCount > 0 && (
          <button onClick={syncOfflineQueue} disabled={!isOnline} className="flex flex-col items-center bg-indigo-50 border border-indigo-100 text-indigo-700 px-3 py-1.5 rounded-xl shadow-sm hover:bg-indigo-100 transition-colors">
            <span className="text-[10px] uppercase font-black tracking-widest leading-none">Synchro. en attente</span>
            <span className="text-xl font-black mt-1">{pendingCount}</span>
          </button>
        )}
      </div>

      {matieres.map(matiere => (
        <div key={matiere.id} className="bg-white rounded-[2rem] border border-slate-200/60 shadow-sm overflow-hidden w-full max-w-full">
          <div className="px-6 py-4 border-b border-slate-50 bg-slate-50/30 flex items-center justify-between gap-4">
            <h3 className="font-black text-slate-900 uppercase tracking-tight text-xs truncate min-w-0">{matiere.nom}</h3>
            <button
              onClick={() => { setSelectedMatiereId(matiere.id); setShowNewEvalModal(true); }}
              className="flex-shrink-0 flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md shadow-emerald-500/20 active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Nouvelle Éval.</span>
            </button>
          </div>

          <div className="overflow-x-auto w-full">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-50/50">
                  <th className="sticky left-0 bg-white z-20 px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest border-r border-slate-100 min-w-[150px]">Élève</th>
                  {evaluations.filter(e => e.matiere_id === matiere.id).map(ev => (
                    <th key={ev.id} className="px-4 py-4 text-center min-w-[100px] border-r border-slate-50 relative group">
                      <div className="text-[10px] font-black text-slate-900 flex items-center justify-center gap-2">
                        {ev.libelle || ev.type.toUpperCase()}
                        <div className="flex items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-all">
                          <button 
                            onClick={() => setMobileEvalId(ev.id)}
                            className="p-1 text-emerald-600 hover:scale-110 sm:hidden"
                          >
                            <Edit2 className="w-2.5 h-2.5" />
                          </button>
                          <button onClick={() => handleDeleteEval(ev.id)} className="p-1 text-red-400">
                            <Trash2 className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      </div>
                      <div className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">/{ev.bareme}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {eleves.map(eleve => (
                  <tr key={eleve.id} className="hover:bg-emerald-50/20 transition-colors group">
                    <td className="sticky left-0 bg-white group-hover:bg-emerald-50/20 z-10 px-6 py-3 font-bold text-slate-700 text-[10px] border-r border-slate-100 uppercase">
                      {eleve.prenom} {eleve.nom}
                    </td>
                    {evaluations.filter(e => e.matiere_id === matiere.id).map(ev => {
                      const val = getNote(eleve.id, ev.id);
                      return (
                        <td key={ev.id} className="px-4 py-3 text-center border-r border-slate-50">
                          <input
                            type="text"
                            inputMode="decimal"
                            defaultValue={val?.toString() || ''}
                            onBlur={(e) => handleNoteChange(eleve.id, ev.id, e.target.value)}
                            placeholder="--"
                            className={`w-12 h-8 bg-slate-50 border border-slate-100 rounded-lg text-center text-xs font-black focus:ring-4 focus:ring-emerald-500/10 focus:bg-white ${val !== null ? (val >= (ev.bareme/2) ? 'text-emerald-700' : 'text-red-600') : 'text-slate-300'}`}
                          />
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {showNewEvalModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[2rem] p-6 w-full max-w-md shadow-2xl relative overflow-hidden">
            <h3 className="text-lg font-black text-slate-900 tracking-tight mb-4">Nouvelle Évaluation</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Nom (ex: 1er Devoir)</label>
                <input
                  type="text"
                  value={newEval.libelle}
                  onChange={e => setNewEval({...newEval, libelle: e.target.value})}
                  placeholder="Devoir 1, Contrôle 2..."
                  className="w-full bg-slate-50 border-none rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Type</label>
                  <select
                    value={newEval.type}
                    onChange={e => setNewEval({...newEval, type: e.target.value as any})}
                    className="w-full bg-slate-50 border-none rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700"
                  >
                    <option value="controle">Contrôle</option>
                    <option value="devoir">Devoir</option>
                    <option value="composition">Composition</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Barème</label>
                  <input
                    type="number"
                    value={newEval.bareme}
                    onChange={e => setNewEval({...newEval, bareme: parseInt(e.target.value)})}
                    className="w-full bg-slate-50 border-none rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700"
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowNewEvalModal(false)} className="flex-1 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Annuler</button>
              <button onClick={handleCreateEval} disabled={saving} className="flex-1 py-3 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg">Créer</button>
            </div>
          </div>
        </div>
      )}

      {mobileEvalId && selectedEval && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex flex-col justify-end animate-in fade-in duration-300">
          <div className="bg-slate-50 h-[90vh] rounded-t-[2.5rem] flex flex-col overflow-hidden shadow-2xl animate-in slide-in-from-bottom duration-300 relative">
            <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-slate-300/50 rounded-full" />
            <div className="bg-white px-6 py-5 flex items-center justify-between border-b border-slate-100 mt-4 rounded-t-[2.5rem]">
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Saisie : {selectedEval.libelle || selectedEval.type}</h3>
                <p className="text-[10px] text-emerald-600 font-black uppercase tracking-widest mt-0.5">Barème : /{selectedEval.bareme}</p>
              </div>
              <button onClick={() => setMobileEvalId(null)} className="p-2.5 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-600 transition-colors"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {eleves.map(eleve => {
                const val = getNote(eleve.id, selectedEval.id);
                return (
                  <div key={eleve.id} className="bg-white p-4 rounded-2xl flex items-center justify-between shadow-sm border border-slate-100">
                    <div className="flex-1 min-w-0 pr-4">
                      <p className="text-xs font-black text-slate-900 uppercase truncate">{eleve.prenom} {eleve.nom}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{eleve.matricule}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <input
                        type="text"
                        inputMode="decimal"
                        defaultValue={val?.toString() || ''}
                        onBlur={(e) => handleNoteChange(eleve.id, selectedEval.id, e.target.value)}
                        placeholder="--"
                        className={`w-16 h-14 bg-slate-50 border-2 rounded-xl text-center text-sm font-black focus:ring-4 focus:ring-emerald-500/20 focus:bg-white transition-all
                          ${val !== null 
                            ? (val >= (selectedEval.bareme/2) ? 'border-emerald-200 text-emerald-700 bg-emerald-50/30' : 'border-red-200 text-red-600 bg-red-50/30') 
                            : 'border-slate-100 text-slate-400 focus:border-emerald-300'}`}
                      />
                      <span className="text-[10px] font-black text-slate-300 w-6">/{selectedEval.bareme}</span>
                    </div>
                  </div>
                )
              })}
              {/* padding for bottom bar */}
              <div className="h-24"></div>
            </div>

            <div className="absolute bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t border-slate-100 pb-safe">
              <button 
                onClick={() => setMobileEvalId(null)} 
                className="w-full py-4 bg-slate-900 active:bg-slate-800 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-slate-900/20 transition-all active:scale-[0.98]">
                Enregistrer & Terminer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}