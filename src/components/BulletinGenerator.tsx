"use client";

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Database } from '../types/supabase';
import BulletinMoyenSecondaire, { BulletinData } from './bulletins/BulletinMoyenSecondaire';
import BulletinPrimaire from './bulletins/BulletinPrimaire';

type BulletinRow = Database['public']['Views']['v_bulletins_complets']['Row'];

interface GenerateurProps {
  eleveId?: string; // Optionnel : si null, on imprime tous les élèves de la classe!
  classeId: string;
  trimestre: number;
}

export default function BulletinGenerator({ eleveId, classeId, trimestre }: GenerateurProps) {
  const [dataArray, setDataArray] = useState<BulletinData[]>([]);
  const [loading, setLoading] = useState(true);

  // Fonction pour charger les données (soit 1 élève, soit la classe)
  useEffect(() => {
    async function chargerDonnees() {
      try {
        setLoading(true);

        let query = supabase
          .from('v_bulletins_complets')
          .select('*')
          .eq('classe_id', classeId)
          .eq('trimestre', trimestre);
          
        if (eleveId) {
          query = query.eq('eleve_id', eleveId);
        }

        const { data: rows, error } = await query;

        if (error || !rows || rows.length === 0) {
          console.error('Erreur SQL ou aucun résultat:', error);
          setLoading(false);
          return;
        }

        const formattedArray = rows.map((bulletinRow: BulletinRow) => {
          let parsedMatieres: any[] = [];
          if (bulletinRow.matieres_details_json) {
            parsedMatieres = bulletinRow.matieres_details_json as any[];
          }

          return {
            eleve: {
              id: bulletinRow.eleve_id || '',
              nom: bulletinRow.nom || '',
              prenom: bulletinRow.prenom || '',
              matricule: bulletinRow.matricule || ''
            },
            classe: {
              id: bulletinRow.classe_id || '',
              nom_classe: bulletinRow.nom_classe || '',
              niveau_code: bulletinRow.niveau_code || '',
              niveau_nom: bulletinRow.niveau_nom || '',
              cycle: bulletinRow.niveau_cycle || bulletinRow.cycle || 'primaire'
            },
            ecole: {
              nom: bulletinRow.ecole_nom || 'Établissement Scolaire',
              logo_url: bulletinRow.ecole_logo_url || null,
              tampon_url: bulletinRow.ecole_tampon_url || null,
              signature_url: bulletinRow.ecole_signature_url || null
            },
            trimestre: bulletinRow.trimestre,
            matieres: parsedMatieres,
            moyenne_generale: bulletinRow.moyenne_generale,
            mention: bulletinRow.mention,
            total_coefficients: bulletinRow.total_coefficients,
            nombre_matieres: bulletinRow.nombre_matieres,
            decision_conseil: "Passe en classe supérieure."
          } as BulletinData;
        });

        setDataArray(formattedArray);
      } catch (e) {
        console.error("Crash during load", e);
      } finally {
        setLoading(false);
      }
    }
    chargerDonnees();
  }, [eleveId, classeId, trimestre]);

  if (loading) return <div>Chargement du bulletin en cours...</div>;
  if (!dataArray || dataArray.length === 0) return <div>Le bulletin est introuvable ou aucune note n'est saisie.</div>;

  const handlePrint = () => {
    window.print();
  };

  // On prend le cycle du premier élève pour le titre global (une classe = même cycle)
  const estPrimaire = dataArray[0].classe.cycle === 'primaire';

  return (
    <div className="bg-slate-100 min-h-screen pb-12 print:bg-white print:pb-0">
      {/* Barre d'outils - cachée à l'impression */}
      <div className="max-w-4xl mx-auto py-4 px-6 flex justify-between items-center mb-8 bg-white shadow-sm print:hidden rounded-b-lg border-b border-gray-200">
        <div>
          <h2 className="text-xl font-bold text-gray-800">
            {dataArray.length === 1 ? `Candidat : ${dataArray[0].eleve.prenom} ${dataArray[0].eleve.nom}` : `Impression par lot : ${dataArray.length} Bulletins`}
          </h2>
          <p className="text-sm text-gray-500">Trimestre {dataArray[0].trimestre} - Vue {estPrimaire ? 'Primaire' : 'Moyen/Secondaire'}</p>
        </div>
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2 rounded shadow transition"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
          Imprimer (PDF)
        </button>
      </div>

      <div className="flex flex-col gap-8 print:gap-0">
        {dataArray.map((bulletin, index) => {
          const isPrim = bulletin.classe.cycle === 'primaire';
          return (
            <div key={bulletin.eleve.id} className="shadow-2xl print:shadow-none bg-white w-fit mx-auto ring-1 ring-gray-200 print:ring-0 mb-8 print:mb-0 print:break-after-page">
              {isPrim ? (
                <BulletinPrimaire data={bulletin} />
              ) : (
                <BulletinMoyenSecondaire data={bulletin} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
