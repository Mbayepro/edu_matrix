'use client'

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Loader2, FileText, Plus, X, Trash2, Edit2 } from 'lucide-react';
import { useProfile } from '@/hooks/useProfile';


import { getTodayDate } from '@/lib/dateUtils';
import { useNetwork } from '@/hooks/useNetwork';
import { db } from '@/lib/db';
import { addToSyncQueue, syncFromSupabase } from '@/lib/syncService';

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
  ecole_id?: string;
  classe_id?: string;
  trimestre?: number;
  annee_scolaire?: string;
  created_at?: string;
}

interface Note {
  id: string;
  evaluation_id: string;
  eleve_id: string;
  note: number;
  professeur_id?: string;
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
    date: getTodayDate(),
    coef: 1,
    bareme: 20,
    libelle: ''
  });

  const [niveau, setNiveau] = useState<any>(null);
  const [serie, setSerie] = useState<any>(null);
  const [toastMessage, setToastMessage] = useState<{title: string, type: 'success' | 'error'} | null>(null);

  const showToast = (title: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ title, type });
    setTimeout(() => setToastMessage(null), 3000);
  };

  const { isOnline, pendingCount } = useNetwork();

  useEffect(() => {
    if (classeId) loadData();
  }, [classeId, trimestre]);

  async function loadData() {
    if (!classeId) return;
    setLoading(true);
    try {
      // 1. Lire depuis le cache local (Dexie) d'abord
      if (db) {
        const cachedEleves = await db.eleves.where('classe_id').equals(classeId).toArray();
        const cachedEvals = await db.evaluations
          .where('classe_id').equals(classeId)
          .and(e => e.trimestre === trimestre)
          .toArray();
        const cachedNotes = await db.notes
          .where('evaluation_id').anyOf(cachedEvals.map(e => e.id))
          .toArray();
        
        if (cachedEleves.length > 0) {
          setEleves(cachedEleves);
          setEvaluations(cachedEvals as unknown as Evaluation[]);
          setNotes(cachedNotes as unknown as Note[]);
          // Si on a des données locales, on peut déjà arrêter le loader pour une UI réactive
          setLoading(false);
        }

        // Charger classe / niveau / série depuis Dexie
        const classe = await db.classes.get(classeId);
        if (classe) {
          const niv = classe.niveau_id ? await db.niveaux.get(classe.niveau_id) : null;
          const ser = classe.serie_id ? await db.series.get(classe.serie_id) : null;
          setNiveau(niv);
          setSerie(ser);
        }

        // Charger matières depuis Dexie
        if (classe && ecoleId) {
          const fetchedMatieres = await db.matieres.where('ecole_id').equals(ecoleId).toArray();
          setMatieres(fetchedMatieres as unknown as Matiere[]);
        }
      }

      // 2. Si on est en ligne, rafraîchir depuis Supabase
      if (navigator.onLine && ecoleId) {
        // Déclencher un Sync de fond
        await syncFromSupabase(ecoleId);
        
        // Recharger les données fraîches depuis Dexie (vu que syncFromSupabase les a mis à jour)
        if (db) {
          const freshEleves = await db.eleves.where('classe_id').equals(classeId).toArray();
          const freshEvals = await db.evaluations
            .where('classe_id').equals(classeId)
            .and(e => e.trimestre === trimestre)
            .toArray();
          const freshNotes = await db.notes
            .where('evaluation_id').anyOf(freshEvals.map(ev => ev.id))
            .toArray();
          
          setEleves(freshEleves);
          setEvaluations(freshEvals as unknown as Evaluation[]);
          setNotes(freshNotes as unknown as Note[]);
        }
      }
    } catch (e) {
      console.warn('[GradesEntry] Erreur loadData:', e);
    } finally {
      setLoading(false);
    }
  }

  const handleCreateEval = async () => {
    if (!selectedMatiereId || !ecoleId) return;
    setSaving(true);
    
    const today = new Date();
    const year = today.getFullYear();
    const currentAnneeScolaire = today.getMonth() >= 8 ? `${year}-${year + 1}` : `${year - 1}-${year}`;

    const evalData: Evaluation = {
      id: crypto.randomUUID(),
      ecole_id: ecoleId,
      classe_id: classeId,
      matiere_id: selectedMatiereId,
      trimestre,
      type: newEval.type,
      libelle: newEval.libelle,
      date: newEval.date,
      coef: 1,
      bareme: newEval.bareme,
      annee_scolaire: currentAnneeScolaire,
      created_at: new Date().toISOString()
    };

    try {
      // 1. Sauvegarde locale immédiate (Optimistic UI)
      if (db) {
        await db.evaluations.put(evalData as any);
        setEvaluations(prev => [...prev, evalData]);
      }

      // 2. Enregistrement dans la file de synchronisation (Sync Queue)
      if (ecoleId) {
        await addToSyncQueue('evaluations', 'INSERT', evalData as any, ecoleId);
      }
      showToast("Évaluation créée avec succès !");
      
    } catch (e) {
      console.error('Erreur create eval:', e);
    } finally {
      setSaving(false);
      setShowNewEvalModal(false);
      setNewEval({ type: 'controle', date: getTodayDate(), coef: 1, bareme: 20, libelle: '' });
    }
  };

  const handleDeleteEval = async (id: string) => {
    if (!confirm('Supprimer cette évaluation ?')) return;
    try {
      // 1. Local
      if (db) {
        await db.evaluations.delete(id);
        await db.notes.where('evaluation_id').equals(id).delete();
        setEvaluations(prev => prev.filter(e => e.id !== id));
        setNotes(prev => prev.filter(n => n.evaluation_id !== id));
      }

      // 2. Queue
      if (ecoleId) {
        await addToSyncQueue('evaluations', 'DELETE', { id } as any, ecoleId);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleNoteChange = async (eleveId: string, evalId: string, val: string) => {
    const trimmed = val.trim();
    // Permettre la suppression (val vide)
    if (trimmed === '') {
      const existing = notes.find(n => n.eleve_id === eleveId && n.evaluation_id === evalId);
      if (existing) {
        setNotes(prev => prev.filter(n => n.id !== existing.id));
        if (db) {
          await db.notes.delete(existing.id);
        }
        if (ecoleId) {
          await addToSyncQueue('notes', 'DELETE', { id: existing.id } as any, ecoleId);
        }
      }
      return;
    }
    const num = parseFloat(trimmed.replace(',', '.'));
    if (isNaN(num)) return;

    const existingNote = notes.find(n => n.eleve_id === eleveId && n.evaluation_id === evalId);
    const noteId = existingNote?.id || crypto.randomUUID();

    const today = new Date();
    const year = today.getFullYear();
    const currentAnneeScolaire = today.getMonth() >= 8 ? `${year}-${year + 1}` : `${year - 1}-${year}`;

    const noteData: Note = { 
      id: noteId, 
      ecole_id: ecoleId!,
      eleve_id: eleveId, 
      evaluation_id: evalId, 
      note: num,
      professeur_id: profile?.id,
      annee_scolaire: currentAnneeScolaire
    } as any;

    try {
      // 1. Optimistic & Local
      if (db) {
        await db.notes.put(noteData as any);
        setNotes(prev => {
          const filtered = prev.filter(n => n.id !== noteId);
          return [...filtered, noteData];
        });
      }

      // 2. Queue
      if (ecoleId) {
        const action = existingNote ? 'UPDATE' : 'INSERT';
        await addToSyncQueue('notes', action, noteData as any, ecoleId);
      }
      showToast("Note enregistrée avec succès !");
      
    } catch (e) {
      console.error('Erreur note change:', e);
    }
  };

  // Handler pour mise à jour locale immédiate (input onChange)
  const handleNoteInputChange = (eleveId: string, evalId: string, val: string) => {
    const trimmed = val.trim();
    if (trimmed === '') {
      setNotes(prev => prev.filter(n => !(n.eleve_id === eleveId && n.evaluation_id === evalId)));
      return;
    }
    const num = parseFloat(trimmed.replace(',', '.'));
    if (isNaN(num)) return;
    
    const existingNote = notes.find(n => n.eleve_id === eleveId && n.evaluation_id === evalId);
    const noteId = existingNote?.id || crypto.randomUUID();

    const today = new Date();
    const year = today.getFullYear();
    const currentAnneeScolaire = today.getMonth() >= 8 ? `${year}-${year + 1}` : `${year - 1}-${year}`;

    const noteData: Note = { 
      id: noteId, 
      ecole_id: ecoleId!,
      eleve_id: eleveId, 
      evaluation_id: evalId, 
      note: num, 
      professeur_id: profile?.id,
      annee_scolaire: currentAnneeScolaire 
    } as any;
    setNotes(prev => {
      const filtered = prev.filter(n => n.id !== noteId);
      return [...filtered, noteData];
    });
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
          <div className="flex flex-col items-center bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-3 py-1.5 rounded-xl shadow-sm">
            <span className="text-[10px] uppercase font-black tracking-widest leading-none">Synchro. en attente</span>
            <span className="text-xl font-black mt-1">{pendingCount}</span>
          </div>
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
                            value={val?.toString() ?? ''}
                            onChange={(e) => handleNoteInputChange(eleve.id, ev.id, e.target.value)}
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
                        value={val?.toString() ?? ''}
                        onChange={(e) => handleNoteInputChange(eleve.id, selectedEval.id, e.target.value)}
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

            <div className="absolute bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t border-slate-100 pb-safe flex gap-2">
              <button 
                onClick={() => setMobileEvalId(null)} 
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-emerald-600/20 transition-all active:scale-[0.98]">
                ✓ Terminer la saisie
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className={`fixed bottom-4 right-4 z-[200] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl animate-in slide-in-from-bottom-5 fade-in duration-300 ${toastMessage.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
            {toastMessage.type === 'success' ? '✓' : '✕'}
          </div>
          <p className="font-bold text-sm">{toastMessage.title}</p>
        </div>
      )}
    </div>
  );
}