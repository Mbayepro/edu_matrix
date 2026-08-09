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
  nb_absences?: number
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
    
    // Récupérer les seuils configurables
    const ecole = await db.ecoles.get(ecoleId)
    const seuilChute = Number(ecole?.seuil_alerte_chute ?? 2)
    const seuilAbsences = Number(ecole?.seuil_alerte_absences ?? 5)
    
    // --- 1. DÉTECTION CHUTE DE MOYENNE VIA v_moyennes_generales ---
    if (typeof window !== 'undefined' && navigator.onLine) {
      try {
        const { supabase } = await import('./supabase')
        const { data: moyennes, error } = await supabase
          .from('v_moyennes_generales')
          .select('*')
          .eq('ecole_id', ecoleId)
          .order('annee_scolaire', { ascending: false })
          .order('trimestre', { ascending: false })

        if (!error && moyennes) {
          // Grouper par élève
          const mapByEleve = new Map<string, any[]>()
          for (const _row of moyennes) {
            const row = _row as any
            if (!mapByEleve.has(row.eleve_id)) mapByEleve.set(row.eleve_id, [])
            mapByEleve.get(row.eleve_id)!.push(row)
          }

          for (const [eleveId, records] of Array.from(mapByEleve.entries())) {
            // records sont triés du plus récent au plus ancien
            if (records.length >= 2) {
              const last = records[0]
              const prev = records[1]
              
              // On vérifie que ce sont bien des trimestres consécutifs (approximativement, ou au moins l'un après l'autre)
              const avgLast = Number(last.moyenne_generale)
              const avgPrev = Number(prev.moyenne_generale)

              if (avgPrev - avgLast >= seuilChute) {
                const eleve = eleves.find(e => e.id === eleveId)
                if (eleve) {
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
          }
        }
      } catch (err) {
        console.warn('Erreur lors du fetch v_moyennes_generales:', err)
      }
    }

    // --- 2. DÉTECTION ABSENTÉISME (Local Dexie) ---
    // On prend les absences de l'année en cours (simplifié : toutes les absences en base locale)
    const presences = await db.presences.where('ecole_id').equals(ecoleId).toArray()
    const absents = presences.filter(p => p.statut === 'absent')
    
    const absCountMap = new Map<string, number>()
    for (const p of absents) {
      absCountMap.set(p.eleve_id, (absCountMap.get(p.eleve_id) || 0) + 1)
    }

    for (const [eleveId, count] of Array.from(absCountMap.entries())) {
      if (count >= seuilAbsences) {
        // Vérifier si pas déjà dans la liste pour éviter les doublons UI, ou l'ajouter
        const eleve = eleves.find(e => e.id === eleveId)
        if (eleve && !riskList.find(r => r.id === eleveId && r.raison === 'absenteisme')) {
          riskList.push({
            id: eleve.id,
            prenom: eleve.prenom,
            nom: eleve.nom,
            classe_nom: classMap.get(eleve.classe_id) || 'Inconnue',
            moyenne_actuelle: 0,
            moyenne_precedente: 0,
            chute: count, // On utilise 'chute' pour le tri, on affichera nb_absences
            nb_absences: count,
            raison: 'absenteisme'
          })
        }
      }
    }

  } catch (err) {
    console.error('[Intelligence] Error:', err)
  }

  // Trier par criticité : d'abord les plus grandes chutes, puis les plus grands nombres d'absences
  return riskList.sort((a,b) => b.chute - a.chute).slice(0, 8) 
}
