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

  useEffect(() => {
    if (classeId) loadData();
  }, [classeId, trimestre]);

  async function loadData() {
    setLoading(true);
    try {
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

      setMatieres(filteredCoefs.map((c: any) => ({
        id: c.matieres.id,
        nom: c.matieres.nom,
        coefficient: parseFloat(c.coefficient),
        is_obligatoire: c.is_obligatoire
      })));

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

      if (listEvals?.length) {
        const { data: listNotes } = await supabase
          .from('notes')
          .select('*')
          .in('evaluation_id', listEvals.map((e: any) => e.id));
        setNotes(listNotes || []);
      }
    } finally {
      setLoading(false);
    }
  }

  const handleCreateEval = async () => {
    if (!selectedMatiereId || !ecoleId) return;
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('evaluations')
        .insert({
          ecole_id: ecoleId,
          classe_id: classeId,
          matiere_id: selectedMatiereId,
          trimestre,
          type: newEval.type,
          libelle: newEval.libelle,
          date: newEval.date,
          coef: 1,
          bareme: newEval.bareme
        })
        .select()
        .single();


      if (!error && data) {
        setEvaluations(prev => [...prev, data]);
        setShowNewEvalModal(false);
        setNewEval({ type: 'controle', date: new Date().toISOString().split('T')[0], coef: 1, bareme: 20, libelle: '' });
      }
    } finally {
      setSaving(false);
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

    // Optimistic update
    const newNote = { id: Math.random().toString(), eleve_id: eleveId, evaluation_id: evalId, note: num };
    setNotes(prev => {
      const filtered = prev.filter(n => !(n.eleve_id === eleveId && n.evaluation_id === evalId));
      return [...filtered, newNote as Note];
    });

    await supabase.from('notes').upsert({
      eleve_id: eleveId,
      evaluation_id: evalId,
      note: num,
      professeur_id: profile?.id
    }, { onConflict: 'eleve_id,evaluation_id' });
  };

  const getNote = (eleveId: string, evalId: string) => {
    return notes.find(n => n.eleve_id === eleveId && n.evaluation_id === evalId)?.note ?? null;
  };

  const selectedEval = evaluations.find(ev => ev.id === mobileEvalId);

  if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-emerald-600" /></div>

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">Espace Notes</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
            {niveau?.nom} • Trimestre {trimestre}
          </p>
        </div>
      </div>

      {matieres.map(matiere => (
        <div key={matiere.id} className="bg-white rounded-[2rem] border border-slate-200/60 shadow-sm overflow-hidden w-full max-w-full">
          <div className="px-6 py-4 border-b border-slate-50 bg-slate-50/30 flex items-center justify-between gap-4">
            <h3 className="font-black text-slate-900 uppercase tracking-tight text-xs truncate min-w-0">{matiere.nom}</h3>
            <button
              onClick={() => { setSelectedMatiereId(matiere.id); setShowNewEvalModal(true); }}
              className="flex-shrink-0 flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-sm"
            >
              <Plus className="w-3 h-3" /> <span className="hidden sm:inline">Nouvelle Éval.</span>
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
        <div className="fixed inset-0 bg-slate-950 z-[100] flex flex-col animate-in slide-in-from-bottom duration-300">
          <div className="bg-white px-6 py-4 flex items-center justify-between border-b border-slate-100">
            <div>
              <h3 className="text-xs font-black text-slate-900 uppercase">Saisie : {selectedEval.libelle || selectedEval.type}</h3>
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Barème : /{selectedEval.bareme}</p>
            </div>
            <button onClick={() => setMobileEvalId(null)} className="p-2 bg-slate-100 rounded-full text-slate-600"><X className="w-5 h-5" /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
            {eleves.map(eleve => {
              const val = getNote(eleve.id, selectedEval.id);
              return (
                <div key={eleve.id} className="bg-white p-4 rounded-2xl flex items-center justify-between shadow-sm border border-slate-100">
                  <div className="flex-1 min-w-0 pr-4">
                    <p className="text-[11px] font-black text-slate-900 uppercase truncate">{eleve.prenom} {eleve.nom}</p>
                    <p className="text-[9px] text-slate-400 font-bold">{eleve.matricule}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      inputMode="decimal"
                      defaultValue={val?.toString() || ''}
                      onBlur={(e) => handleNoteChange(eleve.id, selectedEval.id, e.target.value)}
                      placeholder="--"
                      className={`w-16 h-12 bg-slate-100 border-none rounded-xl text-center text-sm font-black focus:ring-4 focus:ring-emerald-500/20 focus:bg-white ${val !== null ? (val >= (selectedEval.bareme/2) ? 'text-emerald-700' : 'text-red-600') : 'text-slate-400'}`}
                    />
                    <span className="text-[10px] font-black text-slate-300">/{selectedEval.bareme}</span>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="p-4 bg-white border-t border-slate-100"><button onClick={() => setMobileEvalId(null)} className="w-full py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest">Terminer</button></div>
        </div>
      )}
    </div>
  );
}