'use client';

import React, { useState, useEffect } from 'react';
import { X, Sparkles, Loader2, CheckCircle2, TrendingUp, TrendingDown, Minus, Save } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { db } from '@/lib/db';
import { useNetwork } from '@/hooks/useNetwork';
import { addToSyncQueue } from '@/lib/syncService';
import { CalculateurMoyennes, type BulletinData, type MoyenneMatiere } from '@/lib/calculMoyennes';
import { useGenerateAppreciation } from '@/hooks/useGenerateAppreciation';

interface AppreciationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  classeId: string;
  matiereId: string;
  trimestre: number;
  anneeScolaire: string;
  ecoleId: string;
}

interface StudentAppreciationItem {
  eleveId: string;
  prenom: string;
  nom: string;
  moyenne: number;
  moyennePrecedente: number | null;
  rang: number;
  effectif: number;
  mention: string;
  appreciation: string;
  isCustom: boolean; // true si généré/édité, false si default "Excellent", "Passable"
}

export default function AppreciationsModal({ isOpen, onClose, classeId, matiereId, trimestre, anneeScolaire, ecoleId }: AppreciationsModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [studentsData, setStudentsData] = useState<StudentAppreciationItem[]>([]);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const { isOnline } = useNetwork();
  const { generer } = useGenerateAppreciation();
  const [matiereName, setMatiereName] = useState('');

  useEffect(() => {
    if (isOpen && classeId && matiereId) {
      loadData();
    }
  }, [isOpen, classeId, matiereId, trimestre, anneeScolaire]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Récupérer le nom de la matière
      const matiere = await db?.matieres.get(matiereId);
      if (matiere) setMatiereName(matiere.nom);

      // Calculer les bulletins (actuel et précédent pour la progression)
      // On utilise la fonction de classe pour avoir les rangs et les moyennes exactes
      let currentBulletins: BulletinData[] = [];
      let prevBulletins: BulletinData[] = [];
      
      if (navigator.onLine) {
        currentBulletins = await CalculateurMoyennes.genererBulletinsClasse(classeId, trimestre, anneeScolaire);
        if (trimestre > 1) {
          prevBulletins = await CalculateurMoyennes.genererBulletinsClasse(classeId, trimestre - 1, anneeScolaire);
        }
      } else {
        currentBulletins = await db!.getBulletinsCalculés(classeId, trimestre, anneeScolaire);
        if (trimestre > 1) {
          prevBulletins = await db!.getBulletinsCalculés(classeId, trimestre - 1, anneeScolaire);
        }
      }

      // Charger les appréciations enregistrées (protection si fast-refresh a fait rater la maj de Dexie)
      const savedAppreciations = db?.appreciations 
        ? await db.appreciations
            .where('trimestre').equals(trimestre)
            .and(a => a.matiere_id === matiereId && a.annee_scolaire === anneeScolaire)
            .toArray()
        : [];

      const effectif = currentBulletins.length;

      // Classer les élèves par moyenne pour calculer leur rang dans la matière
      const sortedBySubjectAvg = [...currentBulletins].sort((a, b) => {
        const matA = a.matieres.find(m => m.matiere_id === matiereId)?.moyenne ?? -1;
        const matB = b.matieres.find(m => m.matiere_id === matiereId)?.moyenne ?? -1;
        return matB - matA;
      });

      let currentRank = 0;
      let actualPosition = 0;
      let lastMoyenne = -1;

      const parsedData: StudentAppreciationItem[] = sortedBySubjectAvg.map((bulletin, index) => {
        const subjectData = bulletin.matieres.find(m => m.matiere_id === matiereId);
        const currentMoyenne = subjectData?.moyenne ?? 0;
        
        actualPosition++;
        if (currentMoyenne !== lastMoyenne) {
          currentRank = actualPosition;
          lastMoyenne = currentMoyenne;
        }

        const rangMatiere = currentRank;

        const prevBulletin = prevBulletins.find(b => b.eleve.id === bulletin.eleve.id);
        const prevSubjectData = prevBulletin?.matieres.find(m => m.matiere_id === matiereId);

        const savedRecord = savedAppreciations.find(a => a.eleve_id === bulletin.eleve.id);

        return {
          eleveId: bulletin.eleve.id,
          prenom: bulletin.eleve.prenom,
          nom: bulletin.eleve.nom,
          moyenne: subjectData?.moyenne ?? 0,
          moyennePrecedente: prevSubjectData?.moyenne ?? null,
          rang: rangMatiere,
          effectif: effectif,
          mention: subjectData?.appreciation || 'Non Évalué',
          appreciation: savedRecord?.appreciation || subjectData?.appreciation || '',
          isCustom: !!savedRecord
        };
      })

      // Remettre dans l'ordre alphabétique
      parsedData.sort((a, b) => (a.nom + a.prenom).localeCompare(b.nom + b.prenom));

      setStudentsData(parsedData);
    } catch (e: any) {
      console.error(e);
      alert("Erreur lors du chargement des données: " + (e?.message || JSON.stringify(e)));
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateAI = async (item: StudentAppreciationItem) => {
    if (!isOnline) {
      alert("Vous devez être connecté à internet pour utiliser l'IA.");
      return;
    }

    setGeneratingId(item.eleveId);
    try {
      const generatedText = await generer({
        prenom: item.prenom,
        nom: item.nom,
        matiere: matiereName,
        moyenne: item.moyenne,
        moyennePrecedente: item.moyennePrecedente,
        rang: item.rang,
        effectif: item.effectif,
        mention: item.mention
      });

      setStudentsData(prev => prev.map(s => 
        s.eleveId === item.eleveId 
          ? { ...s, appreciation: generatedText, isCustom: true }
          : s
      ));
    } catch (e) {
      console.error(e);
      alert("Erreur lors de la génération IA.");
    } finally {
      setGeneratingId(null);
    }
  };

  const handleChange = (eleveId: string, text: string) => {
    setStudentsData(prev => prev.map(s => 
      s.eleveId === eleveId 
        ? { ...s, appreciation: text, isCustom: true }
        : s
    ));
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      const customs = studentsData.filter(s => s.isCustom);
      
      for (const item of customs) {
        const record = {
          id: crypto.randomUUID(),
          ecole_id: ecoleId,
          eleve_id: item.eleveId,
          matiere_id: matiereId,
          trimestre: trimestre,
          annee_scolaire: anneeScolaire,
          appreciation: item.appreciation,
          updated_at: new Date().toISOString()
        };

        // Sauvegarde locale (protection Dexie fast refresh)
        if (db?.appreciations) {
          await db.appreciations.put(record as any);
        }

        // File d'attente / Sauvegarde distante
        if (isOnline) {
          await (supabase.from('appreciations_trimestrielles' as any) as any).upsert({
            ...record,
            created_at: new Date().toISOString()
          }, { onConflict: 'eleve_id,matiere_id,trimestre,annee_scolaire' });
        } else {
          await addToSyncQueue('appreciations_trimestrielles' as any, 'INSERT', record, ecoleId);
        }
      }
      
      alert("Appréciations sauvegardées avec succès !");
      onClose();
    } catch (e) {
      console.error(e);
      alert("Erreur lors de la sauvegarde.");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-6 py-5 flex items-center justify-between text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
              <Sparkles className="w-6 h-6 text-yellow-300" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight">Appréciations IA</h2>
              <p className="text-blue-100 text-xs mt-0.5">Matière : {matiereName} • Trimestre {trimestre}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-40 gap-3">
              <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
              <p className="text-sm text-slate-500 font-medium">Analyse des moyennes en cours...</p>
            </div>
          ) : studentsData.length === 0 ? (
            <div className="text-center text-slate-500 py-10">
              Aucune note saisie pour cette matière à ce trimestre.
            </div>
          ) : (
            <div className="space-y-4">
              {studentsData.map(student => {
                const isProgression = student.moyennePrecedente !== null && student.moyenne > student.moyennePrecedente;
                const isBaisse = student.moyennePrecedente !== null && student.moyenne < student.moyennePrecedente;

                return (
                  <div key={student.eleveId} className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm flex flex-col md:flex-row gap-5 hover:border-indigo-100 transition-colors">
                    
                    {/* Infos élève */}
                    <div className="w-full md:w-1/3 flex flex-col gap-3">
                      <div>
                        <h3 className="font-bold text-slate-800 text-sm">{student.prenom} {student.nom}</h3>
                        <p className="text-xs text-slate-500 uppercase font-semibold mt-0.5">Rang : {student.rang}/{student.effectif}</p>
                      </div>
                      
                      <div className="flex items-end gap-3 mt-auto">
                        <div>
                          <p className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">Moyenne</p>
                          <p className={`text-xl font-black ${student.moyenne >= 10 ? 'text-emerald-600' : 'text-red-500'}`}>
                            {student.moyenne.toFixed(2)}<span className="text-xs text-slate-400 font-bold">/20</span>
                          </p>
                        </div>
                        {student.moyennePrecedente !== null && (
                          <div className="flex flex-col pb-1">
                            <div className="flex items-center gap-1">
                              {isProgression && <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />}
                              {isBaisse && <TrendingDown className="w-3.5 h-3.5 text-red-500" />}
                              {!isProgression && !isBaisse && <Minus className="w-3.5 h-3.5 text-slate-400" />}
                              <span className={`text-[10px] font-bold ${isProgression ? 'text-emerald-600' : isBaisse ? 'text-red-500' : 'text-slate-500'}`}>
                                {isProgression ? '+' : isBaisse ? '' : ''}{(student.moyenne - student.moyennePrecedente).toFixed(1)} pts
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Zone Saisie & IA */}
                    <div className="w-full md:w-2/3 flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
                          Appréciation {student.isCustom && <span className="text-indigo-500">(Personnalisée)</span>}
                        </label>
                        <button
                          onClick={() => handleGenerateAI(student)}
                          disabled={generatingId === student.eleveId}
                          className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-full font-bold transition-all disabled:opacity-50"
                        >
                          {generatingId === student.eleveId ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Sparkles className="w-3.5 h-3.5" />
                          )}
                          IA
                        </button>
                      </div>
                      
                      <textarea
                        value={student.appreciation}
                        onChange={(e) => handleChange(student.eleveId, e.target.value)}
                        placeholder="Ex: Excellent travail ce trimestre..."
                        className={`w-full min-h-[80px] text-sm p-3 rounded-xl border focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all resize-none
                          ${student.isCustom ? 'bg-indigo-50/30 border-indigo-200 text-indigo-900' : 'bg-slate-50 border-slate-200 text-slate-600'}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-white border-t border-slate-100 px-6 py-4 flex justify-between items-center shrink-0">
          <p className="text-xs font-medium text-slate-400">
            {!isOnline && "⚠️ Hors-ligne : Les appréciations seront synchronisées plus tard."}
          </p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={handleSaveAll}
              disabled={saving || loading || studentsData.length === 0}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl shadow-lg shadow-indigo-200 transition-all flex items-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Enregistrement...' : 'Enregistrer tout'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
