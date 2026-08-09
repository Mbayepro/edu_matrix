'use client';

import React, { useState } from 'react';
import { Sparkles, Loader2, CheckCircle2, User, BookOpen, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface Eleve {
  id: string;
  prenom: string;
  nom: string;
  matiere: string;
  moyenne: number;
  moyennePrecedente: number | null;
  rang: number;
  effectif: number;
  mention: string;
  appreciation: string;
}

const mockEleves: Eleve[] = [
  {
    id: '1',
    prenom: 'Aminata',
    nom: 'Diop',
    matiere: 'Mathématiques',
    moyenne: 15.5,
    moyennePrecedente: 13.0,
    rang: 3,
    effectif: 42,
    mention: 'Bien',
    appreciation: '',
  },
  {
    id: '2',
    prenom: 'Moussa',
    nom: 'Ndiaye',
    matiere: 'Français',
    moyenne: 9.5,
    moyennePrecedente: 11.5,
    rang: 28,
    effectif: 42,
    mention: 'Passable',
    appreciation: '',
  },
  {
    id: '3',
    prenom: 'Fatou',
    nom: 'Sow',
    matiere: 'Physique-Chimie',
    moyenne: 18.0,
    moyennePrecedente: 18.0,
    rang: 1,
    effectif: 42,
    mention: 'Excellent',
    appreciation: '',
  },
];

// Faux retours de l'IA pour la démo
const mockIaResponses: Record<string, string> = {
  '1': "Excellent trimestre Aminata ! Très belle progression de +2.5 points, continuez vos efforts pour viser l'excellence.",
  '2': "Trimestre moyen en baisse de 2 points. Moussa doit redoubler d'efforts en classe et revoir ses règles de grammaire pour remonter la pente.",
  '3': "Résultats parfaits et maintien de votre première place. Félicitations Fatou pour votre rigueur exemplaire !",
};

export default function DemoIAPage() {
  const [eleves, setEleves] = useState<Eleve[]>(mockEleves);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleGenerate = (id: string) => {
    setLoadingId(id);
    // Simuler un délai réseau (comme un appel à Supabase / Claude)
    setTimeout(() => {
      setEleves((prev) =>
        prev.map((e) =>
          e.id === id ? { ...e, appreciation: mockIaResponses[id] } : e
        )
      );
      setLoadingId(null);
    }, 1500);
  };

  const handleUpdateAppreciation = (id: string, text: string) => {
    setEleves((prev) =>
      prev.map((e) => (e.id === id ? { ...e, appreciation: text } : e))
    );
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
      
      {/* En-tête accrocheur */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-8 text-white shadow-xl">
        <div className="flex items-center gap-4 mb-4">
          <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
            <Sparkles className="w-8 h-8 text-yellow-300" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Générateur d'Appréciations IA</h1>
            <p className="text-blue-100 mt-1">Démonstration du module intelligent pour les professeurs</p>
          </div>
        </div>
        <p className="text-sm text-blue-50/80 max-w-2xl leading-relaxed">
          Cette fonctionnalité révolutionnaire permet de générer des appréciations sur-mesure pour chaque élève en un clic, 
          en tenant compte de sa moyenne, de son rang et de son évolution. Le professeur garde toujours le contrôle total et peut modifier le texte avant validation.
        </p>
      </div>

      {/* Liste des élèves */}
      <div className="grid gap-6">
        {eleves.map((eleve) => {
          const isProgression = eleve.moyennePrecedente !== null && eleve.moyenne > eleve.moyennePrecedente;
          const isBaisse = eleve.moyennePrecedente !== null && eleve.moyenne < eleve.moyennePrecedente;
          
          return (
            <div key={eleve.id} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="flex flex-col lg:flex-row gap-6">
                
                {/* Infos Élève */}
                <div className="w-full lg:w-1/3 space-y-4">
                  <div className="flex items-center gap-3 border-b border-gray-50 pb-4">
                    <div className="w-10 h-10 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 font-bold">
                      {eleve.prenom[0]}{eleve.nom[0]}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{eleve.prenom} {eleve.nom}</h3>
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">{eleve.matiere}</span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex flex-col">
                      <span className="text-gray-500 text-xs flex items-center gap-1"><BookOpen className="w-3 h-3"/> Moyenne</span>
                      <span className="font-bold text-lg text-gray-900">{eleve.moyenne}/20</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-gray-500 text-xs flex items-center gap-1"><User className="w-3 h-3"/> Rang</span>
                      <span className="font-medium text-gray-700">{eleve.rang}/{eleve.effectif}</span>
                    </div>
                    <div className="col-span-2 flex flex-col">
                      <span className="text-gray-500 text-xs mb-1">Évolution</span>
                      <div className="flex items-center gap-2">
                        {isProgression && <TrendingUp className="w-4 h-4 text-green-500" />}
                        {isBaisse && <TrendingDown className="w-4 h-4 text-red-500" />}
                        {!isProgression && !isBaisse && <Minus className="w-4 h-4 text-gray-400" />}
                        <span className={`font-medium ${isProgression ? 'text-green-600' : isBaisse ? 'text-red-600' : 'text-gray-600'}`}>
                          {eleve.moyennePrecedente ? `${eleve.moyennePrecedente}/20 ➔ ${eleve.moyenne}/20` : 'Pas de notes'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Saisie Appréciation */}
                <div className="w-full lg:w-2/3 flex flex-col gap-3 border-t lg:border-t-0 lg:border-l lg:pl-6 border-gray-100 pt-4 lg:pt-0">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold text-gray-700">Appréciation du professeur</label>
                    <button
                      onClick={() => handleGenerate(eleve.id)}
                      disabled={loadingId === eleve.id}
                      className="group flex items-center gap-2 text-sm px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-full font-medium transition-all"
                    >
                      {loadingId === eleve.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4 group-hover:text-indigo-600" />
                      )}
                      {loadingId === eleve.id ? 'Analyse par l\'IA...' : 'Générer avec l\'IA'}
                    </button>
                  </div>
                  
                  <div className="relative">
                    <textarea
                      value={eleve.appreciation}
                      onChange={(e) => handleUpdateAppreciation(eleve.id, e.target.value)}
                      placeholder="Saisissez l'appréciation ou laissez l'IA vous proposer une base de travail..."
                      className="w-full min-h-[100px] resize-none rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent p-4 text-sm text-gray-800 transition-all shadow-inner"
                    />
                    {eleve.appreciation && (
                      <div className="absolute bottom-3 right-3 flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded-md font-medium border border-green-100 animate-in fade-in slide-in-from-bottom-2">
                        <CheckCircle2 className="w-3 h-3" />
                        Prêt à valider
                      </div>
                    )}
                  </div>
                  <p className="text-[10px] text-gray-400 text-right">
                    Le professeur peut librement modifier le texte généré par l'IA avant d'enregistrer.
                  </p>
                </div>
                
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Bouton de validation final (fake) */}
      <div className="flex justify-end pt-4 border-t border-gray-200">
        <button className="px-6 py-3 bg-gray-900 hover:bg-gray-800 text-white font-medium rounded-xl shadow-lg transition-colors flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5" />
          Enregistrer les bulletins
        </button>
      </div>

    </div>
  );
}
