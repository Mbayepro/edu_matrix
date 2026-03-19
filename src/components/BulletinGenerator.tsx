import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import jsPDF from 'jspdf';

interface BulletinData {
  eleve: {
    id: string;
    nom: string;
    prenom: string;
    matricule: string;
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
  trimestre: number;
  matieres: Array<{
    id: string;
    nom: string;
    coefficient: number;
    moyenne: number;
    nombre_evaluations: number;
  }>;
  moyenne_generale: number;
  mention: string;
  total_coefficients: number;
  nombre_matieres: number;
}

interface BulletinGeneratorProps {
  eleveId: string;
  classeId: string;
  trimestre: number;
}

export default function BulletinGenerator({ eleveId, classeId, trimestre }: BulletinGeneratorProps) {
  const [bulletinData, setBulletinData] = useState<BulletinData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingPDF, setGeneratingPDF] = useState(false);

  useEffect(() => {
    const loadBulletinData = async () => {
      try {
        // Récupérer les données du bulletin via la vue SQL
        const { data: bulletin, error } = await supabase
          .from('v_bulletins_complets')
          .select('*')
          .eq('eleve_id', eleveId)
          .eq('trimestre', trimestre)
          .single();

        if (error) {
          console.error('Erreur lors du chargement du bulletin:', error);
          return;
        }

        // Parser les détails des matières
        const matieresDetails = bulletin.matieres_details ? 
          bulletin.matieres_details.map((detail: string) => {
            const [id, nom, coefficient, moyenne, nombre_evaluations] = detail.replace(/[()]/g, '').split(',');
            return {
              id: id.trim(),
              nom: nom.trim(),
              coefficient: parseFloat(coefficient),
              moyenne: parseFloat(moyenne),
              nombre_evaluations: parseInt(nombre_evaluations)
            };
          }) : [];

        setBulletinData({
          eleve: {
            id: bulletin.eleve_id,
            nom: bulletin.nom,
            prenom: bulletin.prenom,
            matricule: bulletin.matricule
          },
          classe: {
            id: bulletin.classe_id,
            nom_classe: bulletin.nom_classe,
            niveau_code: bulletin.niveau_code,
            niveau_nom: bulletin.niveau_nom,
            cycle: bulletin.cycle,
            serie_code: bulletin.serie_code,
            serie_nom: bulletin.serie_nom
          },
          trimestre: bulletin.trimestre,
          matieres: matieresDetails,
          moyenne_generale: bulletin.moyenne_generale,
          mention: bulletin.mention,
          total_coefficients: bulletin.total_coefficients,
          nombre_matieres: bulletin.nombre_matieres
        });

      } catch (error) {
        console.error('Erreur:', error);
      } finally {
        setLoading(false);
      }
    };

    loadBulletinData();
  }, [eleveId, classeId, trimestre]);

  const generatePDF = async () => {
    if (!bulletinData) return;

    setGeneratingPDF(true);
    
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      let yPosition = 20;

      // En-tête
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      pdf.text('BULLETIN SCOLAIRE', pageWidth / 2, yPosition, { align: 'center' });
      
      yPosition += 15;
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Trimestre ${bulletinData.trimestre}`, pageWidth / 2, yPosition, { align: 'center' });

      // Informations élève
      yPosition += 20;
      pdf.setFontSize(10);
      pdf.text(`Nom: ${bulletinData.eleve.nom}`, 20, yPosition);
      yPosition += 7;
      pdf.text(`Prénom: ${bulletinData.eleve.prenom}`, 20, yPosition);
      yPosition += 7;
      pdf.text(`Matricule: ${bulletinData.eleve.matricule}`, 20, yPosition);
      yPosition += 7;
      pdf.text(`Classe: ${bulletinData.classe.nom_classe}`, 20, yPosition);
      yPosition += 7;
      pdf.text(`Niveau: ${bulletinData.classe.niveau_nom}`, 20, yPosition);
      
      if (bulletinData.classe.serie_code) {
        yPosition += 7;
        pdf.text(`Série: ${bulletinData.classe.serie_code} - ${bulletinData.classe.serie_nom}`, 20, yPosition);
      }

      // Tableau des matières
      yPosition += 20;
      pdf.setFont('helvetica', 'bold');
      pdf.text('MATIÈRES', 20, yPosition);
      yPosition += 10;

      // En-têtes du tableau
      const headers = ['Matière', 'Coefficient', 'Moyenne', 'Nb. Éval.'];
      const columnWidths = [70, 30, 30, 30];
      let xPos = 20;

      pdf.setFont('helvetica', 'bold');
      headers.forEach((header, index) => {
        pdf.text(header, xPos, yPosition);
        xPos += columnWidths[index];
      });

      yPosition += 7;
      pdf.line(20, yPosition, 20 + columnWidths.reduce((a, b) => a + b, 0), yPosition);
      yPosition += 5;

      // Données des matières
      pdf.setFont('helvetica', 'normal');
      bulletinData.matieres.forEach(matiere => {
        if (yPosition > pageHeight - 30) {
          pdf.addPage();
          yPosition = 20;
        }

        xPos = 20;
        pdf.text(matiere.nom.substring(0, 25), xPos, yPosition);
        xPos += columnWidths[0];
        pdf.text(matiere.coefficient.toString(), xPos, yPosition, { align: 'center' });
        xPos += columnWidths[1];
        const displayMatiereMoyenne = bulletinData.classe.cycle === 'primaire' ? matiere.moyenne / 2 : matiere.moyenne;
        pdf.text(displayMatiereMoyenne.toFixed(2), xPos, yPosition, { align: 'center' });
        xPos += columnWidths[2];
        pdf.text(matiere.nombre_evaluations.toString(), xPos, yPosition, { align: 'center' });
        
        yPosition += 7;
      });

      // Ligne de séparation
      yPosition += 5;
      pdf.line(20, yPosition, 20 + columnWidths.reduce((a, b) => a + b, 0), yPosition);
      yPosition += 10;

      // Moyenne générale et mention
      pdf.setFont('helvetica', 'bold');
      const scale = bulletinData.classe.cycle === 'primaire' ? 10 : 20;
      const displayMoyenne = bulletinData.classe.cycle === 'primaire' ? bulletinData.moyenne_generale / 2 : bulletinData.moyenne_generale;
      pdf.text('MOYENNE GÉNÉRALE:', 20, yPosition);
      pdf.text(`${displayMoyenne.toFixed(2)}/${scale}`, 100, yPosition);
      
      yPosition += 10;
      pdf.text('MENTION:', 20, yPosition);
      pdf.text(bulletinData.mention, 100, yPosition);

      // Adaptation spécifique selon le cycle
      yPosition += 20;
      pdf.setFont('helvetica', 'bold');
      pdf.text('OBSERVATIONS:', 20, yPosition);
      yPosition += 10;
      
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      
      if (bulletinData.classe.cycle === 'primaire') {
        pdf.text('• Primaire: Evaluation des compétences fondamentales', 20, yPosition);
        yPosition += 7;
        pdf.text('• Conducte et assiduité à prendre en compte', 20, yPosition);
      } else if (bulletinData.classe.cycle === 'moyen') {
        pdf.text('• Cycle moyen: Préparation au BFEM', 20, yPosition);
        yPosition += 7;
        pdf.text('• Renforcement des matières scientifiques et littéraires', 20, yPosition);
      } else if (bulletinData.classe.cycle === 'secondaire') {
        pdf.text(`• Secondaire: Série ${bulletinData.classe.serie_code}`, 20, yPosition);
        yPosition += 7;
        pdf.text('• Orientation selon les spécialités choisies', 20, yPosition);
      }

      // Pied de page
      pdf.setFontSize(8);
      pdf.text(`Généré par EduMatrix - ${new Date().toLocaleDateString('fr-FR')}`, pageWidth / 2, pageHeight - 10, { align: 'center' });

      // Sauvegarder le PDF
      pdf.save(`Bulletin_${bulletinData.eleve.nom}_${bulletinData.eleve.prenom}_T${bulletinData.trimestre}.pdf`);

    } catch (error) {
      console.error('Erreur lors de la génération du PDF:', error);
    } finally {
      setGeneratingPDF(false);
    }
  };

  if (loading) {
    return <div>Chargement des données du bulletin...</div>;
  }

  if (!bulletinData) {
    return <div>Impossible de charger les données du bulletin.</div>;
  }

  return (
    <div className="p-6 bg-white rounded-lg shadow">
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Bulletin Scolaire</h2>
        <p className="text-gray-600">
          {bulletinData.eleve.nom} {bulletinData.eleve.prenom} - {bulletinData.classe.nom_classe}
        </p>
        <p className="text-gray-600">Trimestre {bulletinData.trimestre}</p>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        <div>
          <h3 className="font-semibold mb-2">Informations Élève</h3>
          <p><strong>Nom:</strong> {bulletinData.eleve.nom}</p>
          <p><strong>Prénom:</strong> {bulletinData.eleve.prenom}</p>
          <p><strong>Matricule:</strong> {bulletinData.eleve.matricule}</p>
          <p><strong>Classe:</strong> {bulletinData.classe.nom_classe}</p>
          <p><strong>Niveau:</strong> {bulletinData.classe.niveau_nom}</p>
          {bulletinData.classe.serie_code && (
            <p><strong>Série:</strong> {bulletinData.classe.serie_code} - {bulletinData.classe.serie_nom}</p>
          )}
        </div>

        <div>
          <h3 className="font-semibold mb-2">Résultats</h3>
          <p><strong>Moyenne Générale:</strong> <span className="text-xl font-bold text-blue-600">{(bulletinData.classe.cycle === 'primaire' ? bulletinData.moyenne_generale / 2 : bulletinData.moyenne_generale).toFixed(2)}/{bulletinData.classe.cycle === 'primaire' ? '10' : '20'}</span></p>
          <p><strong>Mention:</strong> <span className="font-semibold text-green-600">{bulletinData.mention}</span></p>
          <p><strong>Nombre de matières:</strong> {bulletinData.nombre_matieres}</p>
          <p><strong>Total coefficients:</strong> {bulletinData.total_coefficients}</p>
        </div>
      </div>

      <div className="mb-6">
        <h3 className="font-semibold mb-4">Détail des Matières</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full border border-gray-300">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 border-b text-left">Matière</th>
                <th className="px-4 py-2 border-b text-center">Coefficient</th>
                <th className="px-4 py-2 border-b text-center">Moyenne</th>
                <th className="px-4 py-2 border-b text-center">Nb. Évaluations</th>
              </tr>
            </thead>
            <tbody>
              {bulletinData.matieres.map(matiere => (
                <tr key={matiere.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 border-b">{matiere.nom}</td>
                  <td className="px-4 py-2 border-b text-center">{matiere.coefficient}</td>
                  <td className="px-4 py-2 border-b text-center font-semibold">
                    {(bulletinData.classe.cycle === 'primaire' ? matiere.moyenne / 2 : matiere.moyenne).toFixed(2)}
                  </td>
                  <td className="px-4 py-2 border-b text-center">{matiere.nombre_evaluations}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mb-6">
        <h3 className="font-semibold mb-2">Observations</h3>
        <div className="p-4 bg-gray-50 rounded">
          {bulletinData.classe.cycle === 'primaire' && (
            <div>
              <p><strong>Cycle Primaire:</strong></p>
              <ul className="list-disc list-inside text-sm text-gray-700">
                <li>Évaluation des compétences fondamentales (lecture, écriture, calcul)</li>
                <li>La conduite et l'assiduité sont prises en compte dans l'évaluation globale</li>
                <li>Importance accordée aux activités pratiques et à la participation</li>
              </ul>
            </div>
          )}
          {bulletinData.classe.cycle === 'moyen' && (
            <div>
              <p><strong>Cycle Moyen:</strong></p>
              <ul className="list-disc list-inside text-sm text-gray-700">
                <li>Préparation progressive aux épreuves du BFEM</li>
                <li>Renforcement des matières scientifiques et littéraires</li>
                <li>Développement de l'autonomie et de la méthodologie de travail</li>
              </ul>
            </div>
          )}
          {bulletinData.classe.cycle === 'secondaire' && (
            <div>
              <p><strong>Cycle Secondaire - Série {bulletinData.classe.serie_code}:</strong></p>
              <ul className="list-disc list-inside text-sm text-gray-700">
                <li>Spécialisation selon les choix d'orientation</li>
                <li>Préparation aux épreuves du Baccalauréat</li>
                <li>Focus sur les matières dominantes de la série</li>
              </ul>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={generatePDF}
          disabled={generatingPDF}
          className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
        >
          {generatingPDF ? 'Génération en cours...' : 'Générer le PDF'}
        </button>
      </div>
    </div>
  );
}
