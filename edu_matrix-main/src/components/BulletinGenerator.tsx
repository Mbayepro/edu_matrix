"use client";

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Database } from '../types/supabase';
import BulletinMoyenSecondaire, { BulletinData } from './bulletins/BulletinMoyenSecondaire';
import BulletinPrimaire from './bulletins/BulletinPrimaire';
import { CalculateurMoyennes } from '../lib/calculMoyennes';

type BulletinRow = Database['public']['Views']['v_bulletins_complets']['Row'];

interface GenerateurProps {
  eleveId?: string; // Optionnel : si null, on imprime tous les élèves de la classe!
  classeId: string;
  trimestre: number;
  pinCode?: string; // Optionnel : pour l'accès parent public
}

export default function BulletinGenerator({ eleveId, classeId, trimestre, pinCode }: GenerateurProps) {
  const [dataArray, setDataArray] = useState<BulletinData[]>([]);
  const [loading, setLoading] = useState(true);

  // Fonction pour charger les données (soit 1 élève, soit la classe)
  useEffect(() => {
    async function chargerDonnees() {
      try {
        setLoading(true);

        let bulletins: any[] = [];
        let bulletinsT1: any[] = [];
        let bulletinsT2: any[] = [];

        const fetchT1T2 = async (eId?: string, cId?: string, tp?: string) => {
          const isFinal = (tp === 'semestre' && trimestre === 2) || (tp === 'trimestre' && trimestre === 3) || (!tp && trimestre === 3);
          if (!isFinal) return;
          try {
            if (eId) {
              const resT1 = await CalculateurMoyennes.genererBulletin(eId, 1).catch(() => null);
              if (resT1) bulletinsT1 = [resT1];
              if (tp !== 'semestre') {
                const resT2 = await CalculateurMoyennes.genererBulletin(eId, 2).catch(() => null);
                if (resT2) bulletinsT2 = [resT2];
              }
            } else if (cId) {
              if (tp === 'semestre') {
                const resT1 = await CalculateurMoyennes.genererBulletinsClasse(cId, 1).catch(() => []);
                bulletinsT1 = resT1 || [];
              } else {
                const [resT1, resT2] = await Promise.all([
                  CalculateurMoyennes.genererBulletinsClasse(cId, 1).catch(() => []),
                  CalculateurMoyennes.genererBulletinsClasse(cId, 2).catch(() => [])
                ]);
                bulletinsT1 = resT1 || [];
                bulletinsT2 = resT2 || [];
              }
            }
          } catch (err) {
            console.warn('Erreur lors du chargement de l\'historique T1/T2:', err);
          }
        };

        if (pinCode) {
          // Utilisation de l'accès public sécurisé
          const { data, error } = await supabase.from('eleves').select('id, classe_id').eq('pin_parent', pinCode).single() as { data: { id: string, classe_id: string } | null, error: any };
          if (error || !data) throw new Error("PIN invalide");
          
          const bulletin = await CalculateurMoyennes.genererBulletin(data.id, trimestre);
          bulletins = [bulletin];
          await fetchT1T2(data.id, undefined, bulletin.ecole?.type_periode);
        } else {
          if (eleveId) {
            const bulletin = await CalculateurMoyennes.genererBulletin(eleveId, trimestre);
            bulletins = [bulletin];
            await fetchT1T2(eleveId, undefined, bulletin.ecole?.type_periode);
          } else {
            bulletins = await CalculateurMoyennes.genererBulletinsClasse(classeId, trimestre);
            await fetchT1T2(undefined, classeId, bulletins[0]?.ecole?.type_periode);
          }
        }

        if (!bulletins || bulletins.length === 0) {
          console.error('Aucun résultat trouvé');
          setLoading(false);
          return;
        }

        const mapT1 = new Map(bulletinsT1.map(b => [b.eleve.id, b]));
        const mapT2 = new Map(bulletinsT2.map(b => [b.eleve.id, b]));

        const formattedArray = bulletins.map((b: any) => {
          const out = {
            ...b,
            nombre_matieres: b.matieres.length,
            total_coefficients: b.matieres.reduce((sum: number, m: any) => sum + m.coefficient, 0),
            decision_conseil: b.annual?.decision || "Passe en classe supérieure."
          } as BulletinData;

          const typePeriode = b.ecole?.type_periode || 'trimestre';
          const isFinal = (typePeriode === 'semestre' && trimestre === 2) || (typePeriode === 'trimestre' && trimestre === 3);

          if (isFinal) {
            const bT1 = mapT1.get(b.eleve.id);
            const bT2 = mapT2.get(b.eleve.id);
            
            if (typePeriode === 'semestre') {
              out.historiqueTrimesters = [
                {
                  trimestre: 1,
                  moyenne_generale: bT1?.moyenne_generale ?? null,
                  mention: bT1?.mention ?? ''
                },
                {
                  trimestre: 2,
                  moyenne_generale: b.moyenne_generale ?? null,
                  mention: b.mention ?? ''
                }
              ];
            } else {
              out.historiqueTrimesters = [
                {
                  trimestre: 1,
                  moyenne_generale: bT1?.moyenne_generale ?? null,
                  mention: bT1?.mention ?? ''
                },
                {
                  trimestre: 2,
                  moyenne_generale: bT2?.moyenne_generale ?? null,
                  mention: bT2?.mention ?? ''
                },
                {
                  trimestre: 3,
                  moyenne_generale: b.moyenne_generale ?? null,
                  mention: b.mention ?? ''
                }
              ];
            }
          }

          return out;
        });

        setDataArray(formattedArray);
      } catch (e) {
        console.error("Crash during load", e);
      } finally {
        setLoading(false);
      }
    }
    chargerDonnees();
  }, [eleveId, classeId, trimestre, pinCode]);

  if (loading) return <div>Chargement du bulletin en cours...</div>;
  if (!dataArray || dataArray.length === 0) return <div>Le bulletin est introuvable ou aucune note n'est saisie.</div>;

  const handlePrint = () => {
    window.print();
  };

  // On prend le cycle du premier élève pour le titre global (une classe = même cycle)
  const estPrimaire = dataArray[0].classe?.cycle === 'primaire';

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
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-5 py-2 rounded shadow transition"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
          Imprimer (PDF)
        </button>
      </div>

      <div className="flex flex-col gap-8 print:gap-0">
        {dataArray.map((bulletin, index) => {
          const isPrim = bulletin.classe?.cycle === 'primaire';
          const matieresManquantes = bulletin.matieres.filter(m => m.moyenne === null).map(m => (m as any).matiere_nom || m.nom || 'Inconnue');
          return (
            <div key={bulletin.eleve.id} className="shadow-2xl print:shadow-none bg-white w-fit mx-auto ring-1 ring-gray-200 print:ring-0 mb-8 print:mb-0 print:break-after-page">
              {matieresManquantes.length > 0 && (
                <div className="bg-amber-100 border-l-4 border-amber-500 text-amber-700 p-4 mb-4 max-w-[210mm] mx-auto print:hidden font-sans">
                  <p className="font-bold flex items-center gap-2">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                    Alerte : Matières non évaluées
                  </p>
                  <p className="text-sm mt-1">L'élève n'a pas de note dans : <strong>{matieresManquantes.join(', ')}</strong></p>
                </div>
              )}
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
