import React from 'react';
import { BulletinData } from './BulletinMoyenSecondaire'; // À refactoriser avec les types autogénérés plus tard

export default function BulletinPrimaire({ data }: { data: BulletinData }) {
  // 1. Adaptation sur 10.
  // Au primaire (Sénégal), les notes sont sur 10.
  const matieresAvecDomaines = data.matieres.map(m => {
    const moyenneSur10 = m.moyenne / 2;
    const observation = moyenneSur10 >= 7 ? 'Acquis (A)' : 
                        moyenneSur10 >= 4 ? 'En cours d\'acquisition (ECA)' :
                        'Non Acquis (NA)';

    return {
      ...m,
      // Fallback sémantique juste pour les anciennes matières non migrées
      domaine: m.domaine || 'Activités Diverses',
      moyenneSur10,
      observation
    };
  });

  // 2. Groupement par domaines
  const domaines = matieresAvecDomaines.reduce((acc, current) => {
    if (!acc[current.domaine]) {
      acc[current.domaine] = {
        nom: current.domaine,
        activites: [],
        coefficientDomaine: 1 // À configurer via DB si nécessaire un jour
      };
    }
    acc[current.domaine].activites.push(current);
    return acc;
  }, {} as Record<string, any>);

  // Calculs par domaines
  Object.values(domaines).forEach(d => {
    const sumMoyennes = d.activites.reduce((sum: number, act: any) => sum + act.moyenneSur10, 0);
    const moyenneDomaine = sumMoyennes / d.activites.length;
    d.moyenne = moyenneDomaine;
    d.total = moyenneDomaine * d.coefficientDomaine;
  });

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

      {/* En-tête institutionnelle - MÊME DESIGN QUE SECONDAIRE */}
      <div className="flex justify-between items-start mb-4 z-10 relative border-b-2 border-slate-800 pb-2">
        <div className="w-1/3 text-center text-xs">
          <p className="font-bold text-sm">MINISTÈRE DE L'ÉDUCATION NATIONALE</p>
          <p>**********</p>
          <p className="font-bold uppercase">{data.ecole.nom}</p>
        </div>
        
        <div className="w-1/3 flex flex-col items-center justify-center">
          {data.ecole.logo_url ? (
            <img src={data.ecole.logo_url} alt="Logo de l'école" className="h-20 object-contain" />
          ) : (
            <div className="h-20 w-20 border-2 border-dashed border-slate-300 rounded-full flex items-center justify-center text-slate-400">Logo</div>
          )}
        </div>

        <div className="w-1/3 text-center text-xs">
          <p className="font-bold text-sm">RÉPUBLIQUE DU SÉNÉGAL</p>
          <p className="italic">Un Peuple - Un But - Une Foi</p>
          <p>**********</p>
          <p className="font-bold text-xs uppercase underline">Inspection de l'Éducation et de la Formation</p>
        </div>
      </div>

      {/* Titre */}
      <div className="text-center mb-6 z-10 relative">
        <h1 className="text-xl font-black uppercase tracking-wider border-2 border-slate-800 inline-block px-6 py-2 bg-slate-100">
          BULLETIN DE COMPOSITION
        </h1>
        <p className="text-lg font-bold mt-1 uppercase">Trimestre {data.trimestre} - Année de base : 2024</p>
        <p className="text-sm font-semibold uppercase text-slate-700 bg-slate-200 inline-block px-3 py-1 mt-1 rounded-sm shadow-sm">
          CYCLE ÉLÉMENTAIRE
        </p>
      </div>

      {/* Infos Élève */}
      <div className="flex justify-between items-center border border-slate-800 p-3 mb-6 z-10 relative bg-slate-50">
        <div>
          <p className="mb-1"><span className="font-bold text-xs uppercase text-slate-500 w-20 inline-block">Prénom(s) :</span> <span className="font-bold text-lg uppercase">{data.eleve.prenom}</span></p>
          <p className="mb-1"><span className="font-bold text-xs uppercase text-slate-500 w-20 inline-block">Nom :</span> <span className="font-bold text-lg uppercase">{data.eleve.nom}</span></p>
        </div>
        <div className="text-right border-l px-4 border-slate-300">
          <p className="mb-1"><span className="font-bold text-xs">Classe :</span> <span className="font-bold text-md">{data.classe.nom_classe}</span></p>
          <p><span className="font-bold text-xs">Matricule :</span> {data.eleve.matricule}</p>
        </div>
      </div>

      {/* Tableau des Domaines (Primaire) */}
      <div className="mb-6 z-10 relative">
        {Object.values(domaines).map((domaine: any, idx) => (
          <table key={domaine.nom} className="w-full border-collapse border border-slate-800 text-sm mb-4">
            <thead className="bg-slate-200">
              <tr>
                <th colSpan={3} className="border border-slate-800 p-2 text-left font-black uppercase text-sm bg-slate-300">
                  DOMAINE : {domaine.nom}
                </th>
              </tr>
              <tr>
                <th className="border border-slate-800 p-1 text-left w-1/2 bg-slate-100 font-semibold text-xs italic">Activité / Sous-compétence</th>
                <th className="border border-slate-800 p-1 text-center w-1/4 bg-slate-100 font-semibold text-xs italic">Note / 10</th>
                <th className="border border-slate-800 p-1 text-left w-1/4 bg-slate-100 font-semibold text-xs italic">Observation</th>
              </tr>
            </thead>
            <tbody>
              {domaine.activites.map((act: any) => (
                <tr key={act.id} className="hover:bg-slate-50">
                  <td className="border border-slate-800 p-2 capitalize pl-6">• {act.nom}</td>
                  <td className="border border-slate-800 p-2 text-center font-bold bg-slate-50">{act.moyenneSur10.toFixed(2)}</td>
                  <td className="border border-slate-800 p-2 text-left text-xs italic text-slate-700">{act.observation}</td>
                </tr>
              ))}
            </tbody>
            {/* Ligne de synthèse du domaine */}
            <tfoot className="border-t-[3px] border-slate-800 bg-slate-100">
              <tr>
                <td className="border border-slate-800 p-2 flex justify-between uppercase text-xs font-bold text-slate-700">
                  <span>Moyenne du domaine (/10) : <strong className="text-black ml-1 text-sm">{domaine.moyenne.toFixed(2)}</strong></span>
                  <span>Coef : <strong className="text-black ml-1 text-sm">{domaine.coefficientDomaine}</strong></span>
                </td>
                <td colSpan={2} className="border border-slate-800 p-2 text-center text-xs font-bold bg-slate-200 uppercase">
                  Total Domaine : <span className="text-lg font-black ml-2">{domaine.total.toFixed(2)}</span>
                </td>
              </tr>
            </tfoot>
          </table>
        ))}
      </div>

      {/* Cadre de décision et signature */}
      <div className="grid grid-cols-2 gap-4 z-10 relative">
        {/* Décision du conseil */}
        <div className="border border-slate-800 p-3 flex flex-col justify-between">
           <div>
             <p className="font-bold text-xs mb-2 uppercase text-center bg-slate-200 py-1">Avis du Maître / de la Maîtresse</p>
             <p className="italic text-sm text-center mt-2 text-slate-600">
               Observations qualitatives sur le travail global de l'élève.
             </p>
           </div>
           
           <div className="border-t border-slate-800 pt-2 mt-4 text-center">
             <p className="font-bold text-sm mb-1 uppercase text-slate-900 border-b border-dashed inline-block">Décision du Conseil de Classe</p>
             <p className="italic text-sm mt-1">
               {data.decision_conseil || "Admis(e) en classe supérieure."}
             </p>
           </div>
        </div>
        
        {/* Signature Chef */}
        <div className="border border-slate-800 p-3 min-h-[140px] flex flex-col relative overflow-hidden">
           <p className="font-bold text-xs uppercase text-center bg-slate-200 py-1">Le Directeur / La Directrice</p>
           
           {/* Section Images pour signature et tampon superposés */}
           <div className="relative mt-2 flex-grow flex items-center justify-center">
              {data.ecole.tampon_url && (
                <img 
                  src={data.ecole.tampon_url} 
                  alt="Tampon" 
                  className="absolute opacity-80 h-28 right-0 rotate-[-10deg] object-contain mix-blend-multiply flex-shrink-0"
                />
              )}
              {data.ecole.signature_url && (
                <img 
                  src={data.ecole.signature_url} 
                  alt="Signature" 
                  className="absolute h-14 right-10 mix-blend-multiply z-10 bottom-4"
                />
              )}
           </div>
        </div>
      </div>
      
      {/* Footer Text */}
      <div className="absolute bottom-4 left-0 right-0 text-center text-xs text-slate-500 z-10 print:text-slate-400">
        Conforme au Cadre d'Orientation du Curriculum (Sénégal) • Généré par EduMatrix
      </div>
    </div>
  );
}
