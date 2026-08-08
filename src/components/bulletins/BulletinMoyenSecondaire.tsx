import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';

export interface MatiereDetails {
  id: string;
  nom: string;
  coefficient: number;
  moyenne: number;
  nombre_evaluations: number;
  mcc?: number;
  composition_note?: number;
  moyenne_controles?: number; // Pour compatibilité lib
  note_examen?: number;        // Pour compatibilité lib
  est_bonus?: boolean;
  domaine?: string;
  total_points?: number;
  points_bonus?: number;
}

export interface BulletinData {
  eleve: {
    id: string;
    nom: string;
    prenom: string;
    matricule: string;
    pin_parent?: string | null;
  };
  classe: {
    id: string;
    nom_classe: string;
    niveau_code: string;
    niveau_nom: string;
    cycle: string;
    serie_code?: string;
    serie_nom?: string;
  };
  ecole: {
    nom: string;
    logo_url?: string;
    tampon_url?: string;
    signature_url?: string;
  };
  trimestre: number;
  matieres: MatiereDetails[];
  moyenne_generale: number;
  mention: string;
  total_coefficients: number;
  nombre_matieres: number;
  decision_conseil?: string;
  annee_scolaire?: string;
  total_eleves?: number;
}

export default function BulletinMoyenSecondaire({ data }: { data: BulletinData }) {
  const matieresCalculated = data.matieres.map((m: any) => {
    const mcc = m.moyenne_controles ?? null;
    const compo = m.note_examen ?? null;
    const moyenne = m.moyenne;
    const isBonus = m.is_bonus === true;
    const total = m.total_points ?? (moyenne !== null ? moyenne * m.coefficient : null);

    return {
      ...m,
      mccDisplay: mcc !== null ? mcc.toFixed(2) : '-',
      compoDisplay: compo !== null ? compo.toFixed(2) : '-',
      moyenneDisplay: moyenne !== null ? moyenne.toFixed(2) : 'Non Évalué',
      totalDisplay: (isBonus && m.points_bonus !== undefined) 
        ? m.points_bonus.toFixed(2) 
        : (isBonus ? '-' : (total !== null ? total.toFixed(2) : '-')),
      isBonus,
      total: total || 0,
      moyenneNum: moyenne
    };
  });

  const sumTotal = matieresCalculated.reduce((acc, curr) => acc + curr.total, 0);
  const sumCoeff = matieresCalculated.filter(m => !m.isBonus && m.moyenneNum !== null).reduce((acc, curr) => acc + curr.coefficient, 0);
  const mgRecomp = sumCoeff > 0 ? (sumTotal / sumCoeff) : null;
  
  const getAppreciation = (moy: number | null) => {
    if (moy === null) return 'Non Évalué';
    if (moy < 10) return 'Insuffisant';
    if (moy < 12) return 'Passable';
    if (moy < 14) return 'Assez Bien';
    if (moy < 16) return 'Bien';
    return 'Très Bien';
  };

  // Préparation des données pour le graphique Radar (Top 6 matières par coefficient)
  const radarData = matieresCalculated
    .filter(m => m.moyenneNum !== null && !m.isBonus)
    .sort((a, b) => b.coefficient - a.coefficient)
    .slice(0, 6)
    .map(m => ({
      subject: m.nom.length > 5 ? m.nom.substring(0, 5).toUpperCase() + '.' : m.nom.toUpperCase(),
      note: m.moyenneNum,
      fullMark: 20,
    }));

  return (
    <div className="w-[210mm] min-h-[297mm] mx-auto bg-white p-8 relative print:p-0 print:w-full font-serif text-sm">
      {/* Watermark Logo */}
      {data.ecole.logo_url && (
         <div 
           className="absolute inset-0 opacity-[0.05] pointer-events-none z-0" 
           style={{
             backgroundImage: `url(${data.ecole.logo_url})`, 
             backgroundPosition: 'center', 
             backgroundSize: '80%', 
             backgroundRepeat: 'no-repeat'
           }}
         />
      )}

      {/* En-tête institutionnelle */}
      <div className="flex justify-between items-start mb-6 z-10 relative border-b-2 border-slate-800 pb-4">
        <div className="w-1/3 text-center text-xs">
          <p className="font-bold text-sm">MINISTÈRE DE L'ÉDUCATION NATIONALE</p>
          <p>**********</p>
          <p className="font-bold uppercase">{data.ecole.nom}</p>
        </div>
        
        <div className="w-1/3 flex flex-col items-center justify-center">
          {data.ecole.logo_url ? (
            <img src={data.ecole.logo_url} alt="Logo de l'école" className="h-20 object-contain" />
          ) : (
            <div className="h-20 w-20 bg-slate-200 rounded-full flex items-center justify-center text-slate-400">Logo</div>
          )}
        </div>

        <div className="w-1/3 text-center text-xs">
          <p className="font-bold text-sm">RÉPUBLIQUE DU SÉNÉGAL</p>
          <p className="italic">Un Peuple - Un But - Une Foi</p>
          <p>**********</p>
          <p className="font-bold">Année Scolaire : {data.annee_scolaire || '2026 - 2027'}</p>
        </div>
      </div>

      {/* Titre */}
      <div className="text-center mb-6 z-10 relative">
        <h1 className="text-2xl font-black uppercase tracking-widest border-2 border-slate-800 inline-block px-8 py-2 bg-slate-100/50">
          BULLETIN DE NOTES
        </h1>
        <p className="text-lg font-bold mt-2">TRIMESTRE {data.trimestre}</p>
        {data.classe.cycle === 'secondaire' && (
          <p className="text-sm font-semibold uppercase text-slate-700">CYCLES SECONDAIRES - SÉRIE {data.classe.serie_code}</p>
        )}
      </div>

      {/* Infos Élève */}
      <div className="flex justify-between border-2 border-slate-800 p-4 mb-6 rounded-sm z-10 relative bg-slate-50">
        <div className="w-2/3">
          <p className="mb-1"><span className="font-bold inline-block w-24">Prénom(s) :</span> <span className="font-bold text-lg uppercase">{data.eleve.prenom}</span></p>
          <p className="mb-1"><span className="font-bold inline-block w-24">Nom :</span> <span className="font-bold text-lg uppercase">{data.eleve.nom}</span></p>
          <p><span className="font-bold inline-block w-24">Matricule :</span> {data.eleve.matricule}</p>
        </div>
        <div className="w-1/3 text-right">
          <p className="mb-1"><span className="font-bold">Classe :</span> {data.classe.nom_classe}</p>
          <p><span className="font-bold">Effectif :</span> {data.total_eleves || 'N/A'}</p>
        </div>
      </div>

      {/* Tableau des notes */}
      <div className="mb-6 z-10 relative">
        <table className="w-full border-collapse border-2 border-slate-800 text-sm">
          <thead className="bg-slate-200">
            <tr>
              <th className="border border-slate-800 p-2 text-left w-1/4">Matières</th>
              <th className="border border-slate-800 p-2 text-center font-bold">Coef</th>
              <th className="border border-slate-800 p-2 text-center text-xs">MOY. DEV.</th>
              <th className="border border-slate-800 p-2 text-center text-xs">Compo</th>
              <th className="border border-slate-800 p-2 text-center font-bold bg-slate-300">MOYENNE (/20)</th>
              <th className="border border-slate-800 p-2 text-center font-bold bg-amber-50">TOTAL POINTS</th>
              <th className="border border-slate-800 p-2 text-left w-1/4">Appréciation</th>
            </tr>
          </thead>
          <tbody>
            {matieresCalculated.map((m) => (
              <tr key={m.id} className="hover:bg-slate-50">
                <td className="border border-slate-800 p-2 font-semibold">
                  {m.nom} {m.isBonus && <span className="text-xs text-slate-500 italic">(Bonus)</span>}
                </td>
                <td className="border border-slate-800 p-2 text-center">{!m.isBonus ? m.coefficient : '-'}</td>
                <td className="border border-slate-800 p-2 text-center">{m.mccDisplay}</td>
                <td className="border border-slate-800 p-2 text-center">{m.compoDisplay}</td>
                <td className="border border-slate-800 p-2 text-center font-bold bg-slate-50">{m.moyenneDisplay}</td>
                <td className="border border-slate-800 p-2 text-center font-bold bg-amber-50/30">{m.totalDisplay}</td>
                <td className="border border-slate-800 p-2 text-xs italic">
                  {m.moyenneNum ? getAppreciation(m.moyenneNum) : ''}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-200 border-2 border-slate-800">
            <tr>
              <td colSpan={1} className="border border-slate-800 p-2 text-right font-bold uppercase text-xs">
                TOTAUX :
              </td>
              <td className="border border-slate-800 p-2 text-center font-black text-lg">
                {sumCoeff}
              </td>
              <td colSpan={3} className="border border-slate-800 p-2 bg-slate-100"></td>
              <td className="border border-slate-800 p-2 text-center font-black text-lg bg-amber-100">
                {sumTotal.toFixed(2)}
              </td>
              <td className="border border-slate-800 p-2 bg-slate-300"></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Résultats Globaux */}
      <div className="flex border-2 border-slate-800 p-2 mb-6 z-10 relative bg-slate-50 gap-4 justify-between items-center rounded-sm">
        <div className="flex flex-col items-center justify-center pl-6">
             <span className="text-sm font-bold uppercase text-slate-600">Moyenne Générale</span>
             <span className="text-3xl font-black text-slate-900 border-b-4 border-double border-slate-800 px-4 mt-2 mb-4">
                 {mgRecomp !== null ? `${mgRecomp.toFixed(2)} / 20` : 'Non Évalué'}
             </span>
             <span className="text-sm font-bold uppercase text-slate-600">Mention</span>
             <span className="text-xl font-bold italic">{data.mention || getAppreciation(mgRecomp)}</span>
        </div>
        
        {/* Graphique Radar Pédagogique */}
        <div className="w-1/2 h-[160px]">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
              <PolarGrid stroke="#cbd5e1" />
              <PolarAngleAxis dataKey="subject" tick={{ fill: '#475569', fontSize: 10, fontWeight: 'bold' }} />
              <PolarRadiusAxis angle={30} domain={[0, 20]} tick={false} axisLine={false} />
              <Radar name="Élève" dataKey="note" stroke="#0f172a" strokeWidth={2} fill="#3b82f6" fillOpacity={0.15} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Cadre de décision et signature */}
      <div className="grid grid-cols-2 gap-4 z-10 relative min-h-[160px]">
        {/* Décision du conseil */}
        <div className="border-2 border-slate-800 p-3 rounded-sm">
           <p className="font-bold underline text-sm mb-2 uppercase text-center bg-slate-200 py-1">Décision du conseil de classe</p>
           <p className="italic text-base whitespace-pre-line text-center mt-4">
             {data.decision_conseil || "En attente de la décision du conseil."}
           </p>
        </div>
        
        {/* Signature Chef */}
        <div className="border-2 border-slate-800 p-3 rounded-sm relative flex flex-col justify-start">
           <p className="font-bold underline text-sm mb-2 uppercase text-center bg-slate-200 py-1">Le Chef d'Établissement</p>
           
           {/* Section Images pour signature et tampon superposés */}
           <div className="relative mt-2 flex-grow min-h-[100px] flex items-center justify-center">
              {data.ecole.tampon_url && (
                <img 
                  src={data.ecole.tampon_url} 
                  alt="Tampon" 
                  className="absolute opacity-60 h-24 right-4 rotate-[-15deg] object-contain mix-blend-multiply drop-shadow-md z-1"
                />
              )}
              {data.ecole.signature_url && (
                <img 
                  src={data.ecole.signature_url} 
                  alt="Signature" 
                  className="absolute h-16 right-10 mix-blend-multiply drop-shadow-sm z-10"
                />
              )}
           </div>
        </div>
      </div>
      
      {/* Footer Text & Transparency Message */}
      <div className="absolute bottom-4 left-0 right-0 z-10 flex justify-between items-end px-8">
        <div className="space-y-1 text-left w-3/4">
          <p className="text-[10px] font-bold text-slate-800 uppercase tracking-tight">
            💡 La méthode de calcul des moyennes est définie par l’établissement dans les paramètres pédagogiques.
          </p>
          <p className="text-[9px] text-slate-500 italic">
            Généré le {new Date().toLocaleDateString('fr-FR')} par EduMatrix - Bulletin Scolaire Officiel • Système de calcul standardisé
          </p>
        </div>
        <div className="flex flex-col items-center">
          <QRCodeSVG 
            value={`EduMatrix - AUTH: ${data.eleve.matricule} - ${data.eleve.nom} - TRIM: ${data.trimestre} - MG: ${mgRecomp?.toFixed(2)}`} 
            size={45} 
            level="L"
          />
          <span className="text-[6px] uppercase font-bold text-slate-500 mt-1">Authentique</span>
        </div>
      </div>
    </div>
  );
}
