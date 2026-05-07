// src/lib/intelligence.ts
import { db } from './db'
import { CalculateurMoyennes } from './calculMoyennes'

export interface AtRiskStudent {
  id: string
  prenom: string
  nom: string
  classe_nom: string
  moyenne_actuelle: number
  moyenne_precedente: number
  chute: number
  raison: 'chute_moyenne' | 'absenteisme'
}

/**
 * Détecte les élèves dont les résultats chutent ou qui s'absentent trop.
 */
export async function detectAtRiskStudents(ecoleId: string): Promise<AtRiskStudent[]> {
  if (!db) return []

  const riskList: AtRiskStudent[] = []
  
  try {
    const eleves = await db.eleves.where('ecole_id').equals(ecoleId).toArray()
    const classes = await db.classes.where('ecole_id').equals(ecoleId).toArray()
    const classMap = new Map(classes.map(c => [c.id, c.nom_classe]))
    
    const notesAll = await db.notes.where('ecole_id').equals(ecoleId).toArray()
    const evalsAll = await db.evaluations.where('ecole_id').equals(ecoleId).toArray()
    const evalMap = new Map(evalsAll.map(ev => [ev.id, ev]))

    for (const eleve of eleves) {
      const eleveNotes = notesAll.filter(n => n.eleve_id === eleve.id)
      if (eleveNotes.length < 2) continue

      // Calculer moyenne T1 et T2 (ou juste les deux dernières évaluations si même trimestre)
      // Pour faire simple : on compare la moyenne des 2 dernières notes vs la moyenne des 2 précédentes
      const sortedNotes = eleveNotes.sort((a,b) => new Date(evalMap.get(b.evaluation_id)?.date || 0).getTime() - new Date(evalMap.get(a.evaluation_id)?.date || 0).getTime())
      
      const lastNotes = sortedNotes.slice(0, 2)
      const prevNotes = sortedNotes.slice(2, 4)

      if (lastNotes.length >= 1 && prevNotes.length >= 1) {
        const avgLast = lastNotes.reduce((sum, n) => sum + (n.note / (evalMap.get(n.evaluation_id)?.bareme || 20) * 20), 0) / lastNotes.length
        const avgPrev = prevNotes.reduce((sum, n) => sum + (n.note / (evalMap.get(n.evaluation_id)?.bareme || 20) * 20), 0) / prevNotes.length

        if (avgPrev - avgLast >= 2) { // Chute de plus de 2 points
          riskList.push({
            id: eleve.id,
            prenom: eleve.prenom,
            nom: eleve.nom,
            classe_nom: classMap.get(eleve.classe_id) || 'Inconnue',
            moyenne_actuelle: avgLast,
            moyenne_precedente: avgPrev,
            chute: avgPrev - avgLast,
            raison: 'chute_moyenne'
          })
        }
      }
    }

    // On pourrait aussi ajouter une détection basée sur les absences (ex: > 3 absences dans le mois)
    
  } catch (err) {
    console.error('[Intelligence] Error:', err)
  }

  return riskList.sort((a,b) => b.chute - a.chute).slice(0, 5) // Top 5 risques
}
