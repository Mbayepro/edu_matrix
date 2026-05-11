import { supabase } from './supabase'
import type { Eleve, Niveau, Serie, Matiere, CoefficientMatiere } from './supabase'

export interface MoyenneMatiere {
  matiere_id: string
  matiere_nom: string
  coefficient: number
  moyenne: number // Note brute sur le barème (10 ou 20)
  total_points: number // moyenne * coefficient (NON ARRONDI pour le calcul MG)
  bareme: number
  appreciation?: string
  nombre_evaluations: number
  is_bonus?: boolean
  points_bonus?: number
  moyenne_controles?: number // Moyenne des devoirs (CC)
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
      .from('coefficients_matieres')
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
    let coefficients: any[] = data || []
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
   * MÉTHODE PURE DE CALCUL (Sénégal - École Actuelle)
   * Règle : (Moyenne des Devoirs + Composition) / 2
   * Arrondi : 2 décimales.
   */
  static calculerMoyenneMatiereBase(
    notesCC: number[], // Notes déjà normalisées sur 20
    noteComp: number | null, // Note déjà normalisée sur 20
    methode: 'BLOCKS' | 'WEIGHTED', // Inutilisé ici pour forcer la règle école
    isPrimaire: boolean
  ): { moyenne: number; moyenne_controles: number } {
    let moyCC20 = 0
    if (notesCC.length > 0) {
      moyCC20 = notesCC.reduce((acc: number, n: number) => acc + n, 0) / notesCC.length
    }

    const comp20 = noteComp ?? 0
    let moyenneBrute20 = 0

    // Force la règle demandée : (Moyenne CC + Comp) / 2
    // Sauf si pas de composition du tout, on prend la moyenne des CC
    if (noteComp === null) {
      moyenneBrute20 = moyCC20
    } else {
      moyenneBrute20 = (moyCC20 + comp20) / 2
    }

    const scaleFactor = isPrimaire ? 2 : 1
    
    // Arrondi à 2 décimales dès le calcul par matière
    const finalMoyenne = Math.round((moyenneBrute20 / scaleFactor) * 100) / 100
    const finalMoyCC = Math.round((moyCC20 / scaleFactor) * 100) / 100

    return {
      moyenne: finalMoyenne,
      moyenne_controles: finalMoyCC
    }
  }

  private static processStudentBulletin(
    eleve: any,
    studentNotes: any[],
    studentPresences: any[],
    coefficients: any[],
    isPrimaire: boolean,
    trimestre: number,
    annee_scolaire: string,
    niveau: any,
    serie: any,
    getEvalFromNote: (note: any) => any
  ): BulletinData {
    const baremeMatiere = isPrimaire ? 10 : 20
    let totalPointsEleve = 0
    let totalCoefficientsEleve = 0
    const matieresCalculated: MoyenneMatiere[] = []

    for (const coeff of coefficients) {
      const matiereNotes = studentNotes.filter((n: any) => getEvalFromNote(n)?.matiere_id === coeff.matiere_id)
      if (matiereNotes.length === 0) continue

      const isBonus = (coeff.matiere as any)?.est_bonus || false

      const getEffectiveCoef = (n: any) => {
        const ev = getEvalFromNote(n)
        return (ev?.coef && ev.coef > 0) ? Number(ev.coef) : Number(coeff.coefficient)
      }

      const normaliser = (n: any) => {
        const ev = getEvalFromNote(n)
        return (Number(n.note) / Number(ev?.bareme || 20)) * 20
      }

      const notesCC = matiereNotes.filter((n: any) => getEvalFromNote(n)?.type !== 'composition')
      const noteComp = matiereNotes.find((n: any) => getEvalFromNote(n)?.type === 'composition')

      let sumCCPoints = 0
      let sumCCCoefs  = 0
      notesCC.forEach(n => {
        const c = getEffectiveCoef(n)
        sumCCPoints += (normaliser(n) * c)
        sumCCCoefs  += c
      })
      const moyCC20 = sumCCCoefs > 0 ? (sumCCPoints / sumCCCoefs) : 0

      const comp20 = noteComp ? normaliser(noteComp) : null
      
      let finalMoyenne20 = 0
      if (comp20 === null) {
        finalMoyenne20 = moyCC20
      } else {
        finalMoyenne20 = (moyCC20 + comp20) / 2
      }

      const scaleFactor = isPrimaire ? 2 : 1
      const finalMoyenneMatiere = Math.round((finalMoyenne20 / scaleFactor) * 100) / 100
      const finalMoyCC = Math.round((moyCC20 / scaleFactor) * 100) / 100
      const finalComp = noteComp ? (normaliser(noteComp) / scaleFactor) : undefined
      
      const mainSubjectCoef = (matiereNotes.length > 0) ? getEffectiveCoef(matiereNotes[0]) : Number(coeff.coefficient)
      const totalPointsMatiere = Math.round(finalMoyenneMatiere * mainSubjectCoef * 100) / 100

      const devoirsSorted = [...notesCC].sort((a: any, b: any) => {
         const evA = getEvalFromNote(a)
         const evB = getEvalFromNote(b)
         return new Date(evA.date).getTime() - new Date(evB.date).getTime()
      })

      const matiereResult: MoyenneMatiere = {
        matiere_id: coeff.matiere_id,
        matiere_nom: coeff.matiere!.nom,
        coefficient: mainSubjectCoef,
        moyenne: finalMoyenneMatiere,
        total_points: totalPointsMatiere,
        bareme: baremeMatiere,
        appreciation: this.genererAppreciation(isPrimaire ? finalMoyenneMatiere * 2 : finalMoyenneMatiere),
        nombre_evaluations: matiereNotes.length,
        is_bonus: isBonus,
        moyenne_controles: finalMoyCC,
        note_examen: finalComp ? Math.round(finalComp * 100) / 100 : undefined,
        devoir1: devoirsSorted[0] ? Math.round((normaliser(devoirsSorted[0]) / scaleFactor) * 100) / 100 : undefined,
        devoir2: devoirsSorted[1] ? Math.round((normaliser(devoirsSorted[1]) / scaleFactor) * 100) / 100 : undefined,
        devoir3: devoirsSorted[2] ? Math.round((normaliser(devoirsSorted[2]) / scaleFactor) * 100) / 100 : undefined,
      }

      if (isBonus) {
        const pivot = isPrimaire ? 5 : 10
        matiereResult.points_bonus = Math.max(0, finalMoyenneMatiere - pivot) * mainSubjectCoef
        totalPointsEleve += matiereResult.points_bonus
      } else {
        totalPointsEleve += totalPointsMatiere
        totalCoefficientsEleve += mainSubjectCoef
      }

      matieresCalculated.push(matiereResult)
    }

    const mg = totalCoefficientsEleve > 0 ? totalPointsEleve / totalCoefficientsEleve : 0
    
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
      mention: this.determinerMention(isPrimaire ? mg * 2 : mg, niveau.cycle),
      attendance: { absences, retards }
    }
  }

  /**
   * Traitement pur des données brutes (Indépendant du réseau)
   */
  static evaluerBulletins(
    eleves: Eleve[],
    notes: any[],
    evaluations: any[],
    presences: any[],
    coefficients: any[],
    trimestre: number,
    annee_scolaire: string,
    isPrimaire: boolean
  ): BulletinData[] {
    const evalsMap = new Map(evaluations.map(e => [e.id, e]))
    
    const bulletins: BulletinData[] = eleves.map(eleve => {
      const studentNotes = notes.filter(n => n.eleve_id === eleve.id)
      const studentPresences = presences.filter(p => p.eleve_id === eleve.id)
      
      const niveauMock = { cycle: isPrimaire ? 'primaire' : 'moyen' }

      return this.processStudentBulletin(
        eleve,
        studentNotes,
        studentPresences,
        coefficients,
        isPrimaire,
        trimestre,
        annee_scolaire,
        niveauMock,
        undefined, // serie
        (n) => evalsMap.get(n.evaluation_id)
      )
    })

    return this.calculerRangs(bulletins)
  }

  /**
   * GÉNÉRATION OPTIMISÉE POUR UNE CLASSE ENTIÈRE
   * Réduit les appels DB et centralise le calcul selon les normes sénégalaises.
   */
  static async genererBulletinsClasse(
    classe_id: string,
    trimestre: number,
    annee_scolaire: string = '2024-2025'
  ): Promise<BulletinData[]> {
    // 1. Déterminer l'école pour charger ses paramètres
    const { data: classeRaw } = await supabase.from('classes').select('ecole_id').eq('id', classe_id).single() as { data: { ecole_id: string } | null; error: unknown }
    if (!classeRaw) throw new Error("Classe introuvable.")
    const ecoleId = classeRaw.ecole_id

    // 2. Charger tout le nécessaire en parallèle
    const [
      { data: classeData, error: clErr },
      { data: ecoleData, error: ecErr },
      { data: eleves, error: elErr },
      { data: allNotes, error: ntErr },
      { data: allPresences, error: prErr }
    ] = await Promise.all([
      supabase.from('classes').select('*, serie:series(*)').eq('id', classe_id).single(),
      supabase.from('ecoles').select('*').eq('id', ecoleId).single(),
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

    if (clErr || ecErr || elErr || ntErr || prErr) throw new Error("Erreur lors de la récupération groupée des données.")
    if (!eleves || eleves.length === 0) return []

    const classe = classeData as any
    const serie = classe.serie
    const ecole = ecoleData as any
    const calculationMethod = ecole.calculation_method || 'BLOCKS' // 'BLOCKS' | 'WEIGHTED'

    // 3. Charger le niveau avec plus de souplesse
    let { data: niveau } = await supabase
      .from('niveaux')
      .select('*')
      .ilike('code', classe.niveau)
      .eq('ecole_id', ecoleId)
      .maybeSingle() as { data: import('@/lib/supabase').Niveau | null; error: unknown }
    
    if (!niveau) {
      console.warn(`Niveau ${classe.niveau} introuvable pour l'école ${ecoleId}.`)
      niveau = {
        code: classe.niveau,
        nom: classe.niveau,
        cycle: (classe.niveau.includes('CM') || classe.niveau.includes('CE') || classe.niveau.includes('CP') || classe.niveau.includes('CI')) ? 'primaire' : 'moyen',
        ecole_id: ecoleId
      } as any
    }

    const isPrimaire = (niveau!.cycle === 'primaire' || (niveau!.cycle as string) === 'elementaire')
    const baremeMatiere = isPrimaire ? 10 : 20

    // 4. Charger les coefficients une seule fois
    const coefficients = await this.getCoefficientsMatieres(ecoleId, classe.niveau, serie?.id)

    // 5. Calculer les bulletins élève par élève
    const bulletins: BulletinData[] = eleves.map((eleve: any) => {
      const studentNotes = (allNotes || []).filter((n: any) => n.eleve_id === eleve.id)

      // Calculer l'assiduité par trimestre
      const studentPresences = (allPresences || []).filter((p: any) => {
        if (p.eleve_id !== eleve.id) return false
        const date = new Date(p.date)
        const month = date.getMonth() + 1
        if (trimestre === 1) return month >= 10 || month <= 12
        if (trimestre === 2) return month >= 1 && month <= 3
        if (trimestre === 3) return month >= 4 && month <= 7
        return true
      })

      return this.processStudentBulletin(
        eleve,
        studentNotes,
        studentPresences,
        coefficients,
        isPrimaire,
        trimestre,
        annee_scolaire,
        niveau!,
        serie,
        (n) => n.evaluation
      )
    })

    // 6. Calculer les rangs sur l'ensemble des bulletins
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
    const { data: eleve } = await supabase.from('eleves').select('classe_id').eq('id', eleve_id).single() as { data: { classe_id: string } | null; error: unknown }
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
