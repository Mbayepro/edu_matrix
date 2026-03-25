import { supabase } from './supabase'
import type { Eleve, Niveau, Serie, Matiere, CoefficientMatiere } from './supabase'

export interface MoyenneMatiere {
  matiere_id: string
  matiere_nom: string
  coefficient: number
  moyenne: number // Moyenne générale de la matière sur 20
  bareme: number
  appreciation?: string
  nombre_evaluations: number
  is_bonus?: boolean
  points_bonus?: number
  moyenne_controles?: number // Moyenne des devoirs
  note_examen?: number        // Note de la composition
  devoir1?: number
  devoir2?: number
  devoir3?: number
}

export interface AttendanceData {
  absences: number
  retards: number
}

export interface BulletinData {
  eleve: Eleve
  niveau: Niveau
  serie?: Serie
  trimestre: number
  annee_scolaire: string
  matieres: MoyenneMatiere[]
  moyenne_generale: number
  mention: string
  rang?: number
  total_eleves?: number
  attendance?: AttendanceData
}

export class CalculateurMoyennes {
  /**
   * Récupère les coefficients dynamiques selon le niveau et la série
   */
  static async getCoefficientsMatieres(
    ecole_id: string,
    niveau_code: string,
    serie_id?: string
  ): Promise<CoefficientMatiere[]> {
    let query = supabase
      .from('coefficients_niveaux')
      .select(`
        *,
        matiere:matieres(id, nom, code_matiere, cycle, est_bonus),
        serie:series(id, code, nom)
      `)
      .eq('ecole_id', ecole_id)
      .ilike('niveau', niveau_code)

    if (serie_id) {
       query = query.or(`serie_id.eq.${serie_id},serie_id.is.null`)
    } else {
       query = query.is('serie_id', null)
    }

    const { data, error } = await query

    if (error) throw error
    
    // Si aucun coefficient spécifique n'est défini pour ce niveau, 
    // on utilise les coefficients par défaut de la table matieres
    let coefficients = data || []
    if (coefficients.length === 0) {
      const { data: matieresDefault } = await supabase
        .from('matieres')
        .select('*')
        .eq('ecole_id', ecole_id)
        .eq('is_active', true)
        
      if (matieresDefault && matieresDefault.length > 0) {
        coefficients = matieresDefault.map((m: any) => ({
          id: m.id,
          ecole_id: ecole_id,
          matiere_id: m.id,
          niveau_id: niveau_code,
          serie_id: serie_id || null,
          coefficient: m.coefficient || 1,
          is_obligatoire: true,
          created_at: m.created_at,
          matiere: {
            id: m.id,
            nom: m.nom,
            code_matiere: m.code,
            cycle: m.cycle || 'moyen',
            est_bonus: m.est_bonus || false
          }
        }))
      }
    }

    // Sort on client-side to avoid PostgREST limitations with Aliases in order
    return coefficients.sort((a: any, b: any) => 
      (a.matiere?.nom || '').localeCompare(b.matiere?.nom || '')
    )
  }

  /**
   * GÉNÉRATION OPTIMISÉE POUR UNE CLASSE ENTIÈRE
   * Réduit les appels DB de 600 à environ 4 requêtes globales.
   */
  static async genererBulletinsClasse(
    classe_id: string,
    trimestre: number,
    annee_scolaire: string = '2025-2026'
  ): Promise<BulletinData[]> {
    // 1. Charger tout le nécessaire en parallèle
    const [
      { data: classeData, error: clErr },
      { data: eleves, error: elErr },
      { data: allNotes, error: ntErr },
      { data: allPresences, error: prErr }
    ] = await Promise.all([
      supabase.from('classes').select('*, serie:series(*)').eq('id', classe_id).single(),
      supabase.from('eleves').select('*, classe:classes(*)').eq('classe_id', classe_id).order('nom, prenom'),
      supabase.from('notes')
        .select('*, evaluation:evaluations!inner(*)')
        .eq('evaluation.classe_id', classe_id)
        .eq('evaluation.trimestre', trimestre)
        .eq('evaluation.annee_scolaire', annee_scolaire),
      supabase.from('presences')
        .select('*')
        .eq('classe_id', classe_id)
    ])

    if (clErr || elErr || ntErr || prErr) throw new Error("Erreur lors de la récupération groupée des données.")
    if (!eleves || eleves.length === 0) return []

    const classe = classeData as any
    const serie = classe.serie

    // 2. Charger le niveau avec plus de souplesse
    let { data: niveau } = await supabase
      .from('niveaux')
      .select('*')
      .ilike('code', classe.niveau)
      .eq('ecole_id', classe.ecole_id)
      .maybeSingle()
    
    // Fallback: Si pas trouvé par code exact, on crée un objet niveau par défaut basé sur le cycle estimé
    if (!niveau) {
      console.warn(`Niveau ${classe.niveau} introuvable pour l'école ${classe.ecole_id}. Utilisation d'un profil par défaut.`)
      niveau = {
        code: classe.niveau,
        nom: classe.niveau,
        cycle: (classe.niveau.includes('CM') || classe.niveau.includes('CE') || classe.niveau.includes('CP') || classe.niveau.includes('CI')) ? 'primaire' : 'moyen',
        ecole_id: classe.ecole_id
      } as any
    }

    // 2. Charger les coefficients une seule fois
    const coefficients = await this.getCoefficientsMatieres(classe.ecole_id, classe.niveau, serie?.id)

    // 3. Calculer les bulletins élève par élève
    const bulletins: BulletinData[] = eleves.map((eleve: any) => {
      const studentNotes = (allNotes || []).filter((n: any) => n.eleve_id === eleve.id)
      
      let totalPoints = 0
      let totalCoefficients = 0
      const matieresCalculated: MoyenneMatiere[] = []

      for (const coeff of coefficients) {
        const matiereNotes = studentNotes.filter((n: any) => n.evaluation.matiere_id === coeff.matiere_id)
        if (matiereNotes.length === 0) {
          continue 
        }

        const isBonus = (coeff.matiere as any)?.est_bonus || false
        const cycle = niveau.cycle

        // --- CALCUL SÉNÉGALAIS (MCC + 2*COMP) / 3 ---
        const normaliser = (n: any) => (Number(n.note) / Number(n.evaluation.bareme || 20)) * 20
        const notesCC = matiereNotes.filter((n: any) => n.evaluation.type !== 'composition')
        const noteComp = matiereNotes.find((n: any) => n.evaluation.type === 'composition')

        // --- EXTRACTION INDIVIDUELLE DES DEVOIRS ---
        const devoirsSorted = [...notesCC].sort((a: any, b: any) => 
          new Date(a.evaluation.date).getTime() - new Date(b.evaluation.date).getTime()
        )

        let moyenneMatiere = 0
        let mcc = 0
        let comp = noteComp ? normaliser(noteComp) : null

        if (notesCC.length > 0) {
          const sumCC = notesCC.reduce((acc: number, n: any) => acc + (normaliser(n) * Number(n.evaluation.coef || 1)), 0)
          const sumCoeffCC = notesCC.reduce((acc: number, n: any) => acc + Number(n.evaluation.coef || 1), 0)
          mcc = sumCC / sumCoeffCC
        }

        if (cycle === 'primaire') {
          // Primaire : Simple moyenne
          moyenneMatiere = matiereNotes.reduce((acc: number, n: any) => acc + normaliser(n), 0) / matiereNotes.length
        } else {
          // Moyen/Secondaire/Supérieur : (MCC + 2*Comp) / 3
          if (notesCC.length > 0 && comp !== null) {
            moyenneMatiere = (mcc + (2 * comp)) / 3
          } else if (notesCC.length > 0) {
            moyenneMatiere = mcc
          } else if (comp !== null) {
            moyenneMatiere = comp
          }
        }

        const appPath = this.genererAppreciation(moyenneMatiere)
        const matiereResult: MoyenneMatiere = {
          matiere_id: coeff.matiere_id,
          matiere_nom: coeff.matiere!.nom,
          coefficient: Number(coeff.coefficient),
          moyenne: Math.round(moyenneMatiere * 100) / 100,
          bareme: 20,
          appreciation: appPath,
          nombre_evaluations: matiereNotes.length,
          is_bonus: isBonus,
          moyenne_controles: Math.round(mcc * 100) / 100,
          note_examen: comp !== null ? Math.round(comp * 100) / 100 : undefined,
          devoir1: devoirsSorted[0] ? Math.round(normaliser(devoirsSorted[0]) * 100) / 100 : undefined,
          devoir2: devoirsSorted[1] ? Math.round(normaliser(devoirsSorted[1]) * 100) / 100 : undefined,
          devoir3: devoirsSorted[2] ? Math.round(normaliser(devoirsSorted[2]) * 100) / 100 : undefined,
        }

        if (isBonus) {
          matiereResult.points_bonus = Math.max(0, moyenneMatiere - 10) * Number(coeff.coefficient)
          totalPoints += matiereResult.points_bonus
        } else {
          totalPoints += moyenneMatiere * Number(coeff.coefficient)
          totalCoefficients += Number(coeff.coefficient)
        }

        matieresCalculated.push(matiereResult)
      }

      const mg = totalCoefficients > 0 ? totalPoints / totalCoefficients : 0

      // Calculer l'assiduité par trimestre
      const studentPresences = (allPresences || []).filter((p: any) => {
        if (p.eleve_id !== eleve.id) return false
        const date = new Date(p.date)
        const month = date.getMonth() + 1 // 1-12
        // T1: 10, 11, 12
        // T2: 1, 2, 3
        // T3: 4, 5, 6 (ou reste)
        if (trimestre === 1) return month >= 10 || month <= 12
        if (trimestre === 2) return month >= 1 && month <= 3
        if (trimestre === 3) return month >= 4 && month <= 7
        return true
      })
      const absences = studentPresences.filter((p: any) => p.statut === 'absent').length
      const retards = studentPresences.filter((p: any) => p.statut === 'retard').length

      return {
        eleve,
        niveau,
        serie,
        trimestre,
        annee_scolaire,
        matieres: matieresCalculated,
        moyenne_generale: Math.round(mg * 100) / 100,
        mention: this.determinerMention(mg, niveau.cycle),
        attendance: { absences, retards }
      }
    })

    // 4. Calculer les rangs sur l'ensemble des bulletins
    return this.calculerRangs(bulletins)
  }

  /**
   * Calcule le bulletin individuel (réutilise la méthode de classe pour assurer la cohérence)
   */
  static async genererBulletin(
    eleve_id: string,
    trimestre: number,
    annee_scolaire: string = '2024-2025'
  ): Promise<BulletinData> {
    const { data: eleve } = await supabase.from('eleves').select('classe_id').eq('id', eleve_id).single()
    if (!eleve) throw new Error("Élève introuvable")
    
    const allInClass = await this.genererBulletinsClasse(eleve.classe_id, trimestre, annee_scolaire)
    const result = allInClass.find(b => b.eleve.id === eleve_id)
    if (!result) throw new Error("Calcul échoué")
    return result
  }

  private static calculerRangs(bulletins: BulletinData[]): BulletinData[] {
    const sorted = [...bulletins].sort((a, b) => b.moyenne_generale - a.moyenne_generale)
    
    // Gérer les ex-æquo proprement
    let rank = 1
    for (let i = 0; i < sorted.length; i++) {
      if (i > 0 && sorted[i].moyenne_generale < sorted[i-1].moyenne_generale) {
        rank = i + 1
      }
      sorted[i].rang = rank
      sorted[i].total_eleves = bulletins.length
    }

    return sorted
  }

  private static determinerMention(moyenneSur20: number, cycle?: string): string {
    const moyenne = cycle === 'primaire' ? moyenneSur20 / 2 : moyenneSur20
    const thresholdBase = cycle === 'primaire' ? 5 : 10

    if (cycle === 'primaire') {
      if (moyenne < 4.5) return 'Médiocre'
      if (moyenne < 5) return 'Insuffisant'
      if (moyenne < 6) return 'Passable'
      if (moyenne < 7) return 'Assez bien'
      if (moyenne < 8) return 'Bien'
      if (moyenne < 9) return 'Très bien'
      return 'Excellent'
    }

    if (moyenne < 8) return 'Médiocre'
    if (moyenne < 10) return 'Insuffisant'
    if (moyenne < 12) return 'Passable'
    if (moyenne < 14) return 'Assez bien'
    if (moyenne < 16) return 'Bien'
    if (moyenne < 18) return 'Très bien'
    return 'Excellent'
  }

  private static genererAppreciation(noteSur20: number): string {
    if (noteSur20 >= 16) return 'Excellent'
    if (noteSur20 >= 14) return 'Très bon'
    if (noteSur20 >= 12) return 'Bon'
    if (noteSur20 >= 10) return 'Passable'
    if (noteSur20 >= 8) return 'Insuffisant'
    return 'Très insuffisant'
  }

  static arrondirNote(note: number): number {
    return Math.round(note * 100) / 100
  }
}
