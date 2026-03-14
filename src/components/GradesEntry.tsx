import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface Matiere {
  id: string;
  nom: string;
  coefficient: number;
  is_obligatoire: boolean;
}

interface Niveau {
  id: string;
  code: string;
  nom: string;
  cycle: 'primaire' | 'moyen' | 'secondaire';
}

interface Serie {
  id: string;
  code: string;
  nom: string;
}

interface Evaluation {
  id: string;
  type: 'controle' | 'devoir' | 'composition';
  date: string;
  coef: number;
  bareme: number;
  matiere_id: string;
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
  const [loading, setLoading] = useState(true);
  const [niveau, setNiveau] = useState<Niveau | null>(null);
  const [serie, setSerie] = useState<Serie | null>(null);

  // Charger les informations de la classe (niveau et série)
  useEffect(() => {
    const loadClasseInfo = async () => {
      const { data: classe, error } = await supabase
        .from('classes')
        .select(`
          niveau_id,
          serie_id,
          niveaux(id, code, nom, cycle),
          series(id, code, nom)
        `)
        .eq('id', classeId)
        .single();

      if (error) {
        console.error('Erreur lors du chargement de la classe:', error);
        return;
      }

      setNiveau(classe.niveaux);
      setSerie(classe.series);
    };

    loadClasseInfo();
  }, [classeId]);

  // Charger les matières avec coefficients dynamiques selon le niveau et la série
  useEffect(() => {
    const loadMatieres = async () => {
      if (!niveau) return;

      let query = supabase
        .from('coefficients_matieres')
        .select(`
          coefficient,
          is_obligatoire,
          matieres(id, nom, cycle)
        `)
        .eq('niveau_id', niveau.id);

      // Pour le secondaire, filtrer par série si elle existe
      if (niveau.cycle === 'secondaire' && serie) {
        query = query.or(`serie_id.eq.${serie.id},serie_id.is.null`);
      } else {
        query = query.is('serie_id', null);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Erreur lors du chargement des matières:', error);
        return;
      }

      const matieresFormatees: Matiere[] = data?.map((item: { coefficient: string; is_obligatoire: boolean; matieres: { id: string; nom: string } }) => ({
        id: item.matieres.id,
        nom: item.matieres.nom,
        coefficient: parseFloat(item.coefficient),
        is_obligatoire: item.is_obligatoire
      })) || [];

      setMatieres(matieresFormatees);
    };

    loadMatieres();
  }, [niveau, serie]);

  // Charger les évaluations de la classe pour le trimestre
  useEffect(() => {
    const loadEvaluations = async () => {
      const { data, error } = await supabase
        .from('evaluations')
        .select('*')
        .eq('classe_id', classeId)
        .eq('trimestre', trimestre)
        .order('date', { ascending: true });

      if (error) {
        console.error('Erreur lors du chargement des évaluations:', error);
        return;
      }

      setEvaluations(data || []);
    };

    loadEvaluations();
  }, [classeId, trimestre]);

  // Charger les élèves de la classe
  const [eleves, setEleves] = useState<any[]>([]);
  useEffect(() => {
    const loadEleves = async () => {
      const { data, error } = await supabase
        .from('eleves')
        .select('*')
        .eq('classe_id', classeId)
        .order('nom', { ascending: true });

      if (error) {
        console.error('Erreur lors du chargement des élèves:', error);
        return;
      }

      setEleves(data || []);
      setLoading(false);
    };

    loadEleves();
  }, [classeId]);

  // Gérer la saisie d'une note
  const handleNoteChange = async (eleveId: string, evaluationId: string, value: string) => {
    const noteValue = parseFloat(value);
    
    // Validation : la note doit être entre 0 et 20
    if (isNaN(noteValue) || noteValue < 0 || noteValue > 20) {
      return;
    }

    const evaluation = evaluations.find(ev => ev.id === evaluationId);
    if (!evaluation) return;

    // Vérifier que la note ne dépasse pas le barème
    const noteFinale = Math.min(noteValue, evaluation.bareme);

    // Upsert de la note
    const { error } = await supabase
      .from('notes')
      .upsert({
        eleve_id: eleveId,
        evaluation_id: evaluationId,
        note: noteFinale,
        professeur_id: (await supabase.auth.getUser()).data.user?.id // ID du professeur connecté
      }, {
        onConflict: 'eleve_id,evaluation_id'
      });

    if (error) {
      console.error('Erreur lors de la sauvegarde de la note:', error);
      return;
    }

    // Mettre à jour l'état local
    setNotes(prev => {
      const existingIndex = prev.findIndex(
        n => n.evaluation_id === evaluationId && n.eleve_id === eleveId
      );
      
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          note: noteFinale
        };
        return updated;
      } else {
        return [...prev, {
          id: Date.now().toString(),
          evaluation_id: evaluationId,
          eleve_id: eleveId,
          note: noteFinale
        }];
      }
    });
  };

  // Obtenir la note d'un élève pour une évaluation
  const getNote = (eleveId: string, evaluationId: string): number => {
    const note = notes.find(n => n.eleve_id === eleveId && n.evaluation_id === evaluationId);
    return note?.note || 0;
  };

  // Calculer la moyenne d'un élève pour une matière
  const calculerMoyenneMatiere = (eleveId: string, matiereId: string): number => {
    const matiereEvals = evaluations.filter(ev => 
      matieres.find(m => m.id === matiereId)?.nom === ev.matiere_id
    );
    
    if (matiereEvals.length === 0) return 0;

    let sommePonderee = 0;
    let sommeCoefficients = 0;

    matiereEvals.forEach(ev => {
      const note = getNote(eleveId, ev.id);
      if (note > 0) {
        sommePonderee += note * ev.coef;
        sommeCoefficients += ev.coef;
      }
    });

    return sommeCoefficients > 0 ? Math.round((sommePonderee / sommeCoefficients) * 100) / 100 : 0;
  };

  if (loading) {
    return <div>Chargement...</div>;
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold">
          Saisie des Notes - {niveau?.nom} {serie?.code && `(${serie.code})`}
        </h2>
        <p className="text-gray-600">Trimestre {trimestre}</p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-300">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 border-b text-left">Élève</th>
              {matieres.map(matiere => (
                <th key={matiere.id} className="px-4 py-2 border-b text-center">
                  <div>
                    <div className="font-semibold">{matiere.nom}</div>
                    <div className="text-xs text-gray-500">Coef: {matiere.coefficient}</div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {eleves.map(eleve => (
              <tr key={eleve.id} className="hover:bg-gray-50">
                <td className="px-4 py-2 border-b">
                  <div className="font-medium">{eleve.nom} {eleve.prenom}</div>
                  <div className="text-xs text-gray-500">{eleve.matricule}</div>
                </td>
                {matieres.map(matiere => {
                  const moyenne = calculerMoyenneMatiere(eleve.id, matiere.id);
                  return (
                    <td key={matiere.id} className="px-4 py-2 border-b text-center">
                      <div className="text-sm font-medium text-blue-600">
                        {moyenne.toFixed(2)}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6">
        <h3 className="text-lg font-semibold mb-4">Détail des évaluations</h3>
        <div className="space-y-4">
          {matieres.map(matiere => (
            <div key={matiere.id} className="border rounded-lg p-4">
              <h4 className="font-medium mb-2">{matiere.nom} (Coef: {matiere.coefficient})</h4>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-1">Élève</th>
                      {evaluations
                        .filter(ev => ev.matiere_id === matiere.id)
                        .map(ev => (
                          <th key={ev.id} className="px-2 py-1 text-center">
                            <div>{ev.type}</div>
                            <div className="text-xs text-gray-500">/{ev.bareme}</div>
                          </th>
                        ))}
                    </tr>
                  </thead>
                  <tbody>
                    {eleves.map(eleve => (
                      <tr key={eleve.id} className="border-b">
                        <td className="py-1">{eleve.nom} {eleve.prenom}</td>
                        {evaluations
                          .filter(ev => ev.matiere_id === matiere.id)
                          .map(ev => (
                            <td key={ev.id} className="px-2 py-1 text-center">
                              <input
                                type="number"
                                min="0"
                                max={ev.bareme}
                                step="0.25"
                                value={getNote(eleve.id, ev.id) || ''}
                                onChange={(e) => handleNoteChange(eleve.id, ev.id, e.target.value)}
                                className="w-16 px-1 py-0.5 text-center border rounded"
                              />
                            </td>
                          ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}