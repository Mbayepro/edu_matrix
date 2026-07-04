import { supabase } from './supabase'
import type { Eleve, Niveau, Serie, Matiere, CoefficientMatiere } from './supabase'

export interface MoyenneMatiere {
  matiere_id: string
  matiere_nom: string
  coefficient: number
  moyenne: number | null // Note brute sur le barème (10 ou 20)
  total_points: number | null // moyenne * coefficient (NON ARRONDI pour le calcul MG)
  bareme: number
  appreciation?: string
  nombre_evaluations: number
  is_bonus?: boolean
  points_bonus?: number
  moyenne_controles?: number | null // Moyenne des devoirs (CC)
  note_examen?: number | null        // Note de la composition
  devoir1?: number
  devoir2?: number
  devoir3?: number
}

export interface AttendanceData {
  absences: number
  retards: number
}

export interface AnnualData {
  moyenne_annuelle: number
  mention_annuelle: string
  moyennes_trimestrielles: (number | null)[] // [T1, T2, T3]
  progression: number | null // MG_courante - MG_precedente
  decision?: 'Passage' | 'Redoublement' | 'Exclusion' | 'En attente'
}

export interface BulletinData {
  eleve: Eleve
  niveau: Niveau
  serie?: Serie
  trimestre: number
  annee_scolaire: string
  matieres: MoyenneMatiere[]
  moyenne_generale: number | null
  mention: string
  rang?: number
  total_eleves?: number
  attendance?: AttendanceData
  annual?: AnnualData
  classe?: any
  ecole?: any
}

export class CalculateurMoyennes {
  /**
   * Récupère les coefficients dynamiques selon le niveau et la série
   */
  static async getCoefficientsMatieres(
    ecole_id: string,
    niveau_id: string,
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
      .eq('niveau_id', niveau_id)

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
          niveau_id: niveau_id,
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
      const getEffectiveCoef = (n: any) => {
        const ev = getEvalFromNote(n)
        return (ev?.coef && ev.coef > 0) ? Number(ev.coef) : Number(coeff.coefficient)
      }

      const matiereNotes = studentNotes.filter((n: any) => getEvalFromNote(n)?.matiere_id === coeff.matiere_id)
      
      const mainSubjectCoef = (matiereNotes.length > 0) ? getEffectiveCoef(matiereNotes[0]) : Number(coeff.coefficient)
      const isBonus = (coeff.matiere as any)?.est_bonus || false

      if (matiereNotes.length === 0) {
        matieresCalculated.push({
          matiere_id: coeff.matiere_id,
          matiere_nom: coeff.matiere?.nom || 'Matière Inconnue',
          coefficient: mainSubjectCoef,
          moyenne: null,
          total_points: null,
          bareme: baremeMatiere,
          appreciation: 'Non Évalué',
          nombre_evaluations: 0,
          is_bonus: isBonus,
          moyenne_controles: null,
          note_examen: null
        });
        continue;
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
      const moyCC20 = sumCCCoefs > 0 ? (sumCCPoints / sumCCCoefs) : null

      const comp20 = noteComp ? normaliser(noteComp) : null
      
      let finalMoyenne20: number | null = null
      if (comp20 === null && moyCC20 === null) {
        finalMoyenne20 = null
      } else if (comp20 === null) {
        finalMoyenne20 = moyCC20
      } else if (moyCC20 === null) {
        finalMoyenne20 = comp20
      } else {
        finalMoyenne20 = (moyCC20 + comp20) / 2
      }

      const scaleFactor = isPrimaire ? 2 : 1
      const finalMoyenneMatiere = finalMoyenne20 !== null ? Math.round((finalMoyenne20 / scaleFactor) * 100) / 100 : null
      const finalMoyCC = moyCC20 !== null ? Math.round((moyCC20 / scaleFactor) * 100) / 100 : null
      const finalComp = noteComp ? (normaliser(noteComp) / scaleFactor) : null
      
      const totalPointsMatiere = finalMoyenneMatiere !== null ? Math.round(finalMoyenneMatiere * mainSubjectCoef * 100) / 100 : null

      const devoirsSorted = [...notesCC].sort((a: any, b: any) => {
         const evA = getEvalFromNote(a)
         const evB = getEvalFromNote(b)
         return new Date(evA.date).getTime() - new Date(evB.date).getTime()
      })

      const matiereResult: MoyenneMatiere = {
        matiere_id: coeff.matiere_id,
        matiere_nom: coeff.matiere?.nom || 'Matière Inconnue',
        coefficient: mainSubjectCoef,
        moyenne: finalMoyenneMatiere,
        total_points: totalPointsMatiere,
        bareme: baremeMatiere,
        appreciation: finalMoyenneMatiere !== null ? this.genererAppreciation(isPrimaire ? finalMoyenneMatiere * 2 : finalMoyenneMatiere) : 'Non Évalué',
        nombre_evaluations: matiereNotes.length,
        is_bonus: isBonus,
        moyenne_controles: finalMoyCC,
        note_examen: finalComp !== null ? Math.round(finalComp * 100) / 100 : null,
        devoir1: devoirsSorted[0] ? Math.round((normaliser(devoirsSorted[0]) / scaleFactor) * 100) / 100 : undefined,
        devoir2: devoirsSorted[1] ? Math.round((normaliser(devoirsSorted[1]) / scaleFactor) * 100) / 100 : undefined,
        devoir3: devoirsSorted[2] ? Math.round((normaliser(devoirsSorted[2]) / scaleFactor) * 100) / 100 : undefined,
      }

      if (finalMoyenneMatiere !== null) {
        if (isBonus) {
          const pivot = isPrimaire ? 5 : 10
          matiereResult.points_bonus = Math.max(0, finalMoyenneMatiere - pivot) * mainSubjectCoef
          totalPointsEleve += matiereResult.points_bonus
        } else {
          totalPointsEleve += totalPointsMatiere!
          totalCoefficientsEleve += mainSubjectCoef
        }
      }

      matieresCalculated.push(matiereResult)
    }

    const mg = totalCoefficientsEleve > 0 ? totalPointsEleve / totalCoefficientsEleve : null
    
    const absences = studentPresences.filter((p: any) => p.statut === 'absent').length
    const retards = studentPresences.filter((p: any) => p.statut === 'retard').length

    return {
      eleve,
      classe: eleve.classe,
      ecole: null, // Will be hydrated later if needed, or we pass it
      niveau,
      serie,
      trimestre,
      annee_scolaire,
      matieres: matieresCalculated,
      moyenne_generale: mg !== null ? Math.round(mg * 100) / 100 : null,
      mention: mg !== null ? this.determinerMention(isPrimaire ? mg * 2 : mg, niveau.cycle) : 'Non Évalué',
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
    annee_scolaire?: string
  ): Promise<BulletinData[]> {
    // We will compute annee_scolaire after loading evaluations if not provided.

    // 1. Déterminer l'école pour charger ses paramètres
    const { data: classeRaw } = await supabase.from('classes').select('ecole_id').eq('id', classe_id).single() as { data: { ecole_id: string } | null; error: unknown }
    if (!classeRaw) throw new Error("Classe introuvable.")
    const ecoleId = classeRaw.ecole_id

    // 2. Charger les évaluations correspondantes
    // On charge TOUTES les évaluations de l'année pour la classe pour calculer l'historique annuel sans utiliser la vue SQL
    const { data: evaluations, error: evErr } = await supabase
      .from('evaluations')
      .select('*')
      .eq('classe_id', classe_id);

    if (evErr) throw new Error("Erreur de chargement des évaluations.");

    const evalIds = ((evaluations as any[]) || []).map(ev => ev.id);

    // Determine annee_scolaire if not provided
    if (!annee_scolaire) {
      if (evaluations && evaluations.length > 0) {
        // Find the most recently created evaluation
        const sortedEv = [...(evaluations as any[])].sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
        annee_scolaire = sortedEv[0].annee_scolaire;
      }
      
      if (!annee_scolaire) {
        const today = new Date();
        annee_scolaire = today.getMonth() >= 8 ? `${today.getFullYear()}-${today.getFullYear() + 1}` : `${today.getFullYear() - 1}-${today.getFullYear()}`;
      }
    }

    // Charger les autres données en parallèle
    const [
      { data: classeData, error: clErr },
      { data: ecoleData, error: ecErr },
      { data: eleves, error: elErr },
      { data: rawNotes, error: ntErr },
      { data: allPresences, error: prErr }
    ] = await Promise.all([
      supabase.from('classes' as any).select('*, serie:series(*)').eq('id', classe_id).single() as any,
      supabase.from('ecoles' as any).select('*').eq('id', ecoleId).single() as any,
      supabase.from('eleves' as any).select('*, classe:classes(*)').eq('classe_id', classe_id).order('nom, prenom') as any,
      evalIds.length > 0
        ? supabase.from('notes' as any).select('*').in('evaluation_id', evalIds) as any
        : Promise.resolve({ data: [], error: null }),
      supabase.from('presences' as any).select('*').eq('classe_id', classe_id) as any
    ]);

    if (clErr || ecErr || elErr || prErr || ntErr) throw new Error("Erreur lors de la récupération groupée des données.")
    
    // Reconstruire l'objet notes avec son évaluation liée
    const evaluationsMap = new Map(((evaluations as any[]) || []).map(e => [e.id, e]));
    let processedNotes = (rawNotes || []).map((note: any) => ({
      ...note,
      evaluations: evaluationsMap.get(note.evaluation_id)
    }));

    // Filtrage de annee_scolaire en post-traitement pour éviter l'erreur si la colonne n'existe pas
    if (processedNotes.length > 0 && processedNotes[0]?.evaluations?.annee_scolaire !== undefined) {
      // La colonne existe : on filtre
      processedNotes = processedNotes.filter((n: any) => {
        const ev = n.evaluations
        return !ev?.annee_scolaire || ev.annee_scolaire === annee_scolaire
      })
    }

    const classe = classeData as any
    const serie = classe.serie
    const ecole = ecoleData as any
    const calculationMethod = ecole.calculation_method || 'BLOCKS' // 'BLOCKS' | 'WEIGHTED'
    const typePeriode = ecole.type_periode || 'trimestre'

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
        id: '',
        code: classe.niveau,
        nom: classe.niveau,
        cycle: (classe.niveau.includes('CM') || classe.niveau.includes('CE') || classe.niveau.includes('CP') || classe.niveau.includes('CI')) ? 'primaire' : 'moyen',
        ecole_id: ecoleId
      } as any
    }

    const isPrimaire = (niveau!.cycle === 'primaire' || (niveau!.cycle as string) === 'elementaire')
    const baremeMatiere = isPrimaire ? 10 : 20

    // 4. Charger les coefficients une seule fois
    const coefficients = await this.getCoefficientsMatieres(ecoleId, niveau!.id, serie?.id)

    // 5. Calculer les bulletins élève par élève
    if (!eleves || eleves.length === 0) return []
    const bulletins: BulletinData[] = eleves.map((eleve: any) => {
      const studentNotes = processedNotes.filter((n: any) => n.eleve_id === eleve.id)

      // Calculer l'assiduité par trimestre
      const studentPresences = (allPresences || []).filter((p: any) => {
        if (p.eleve_id !== eleve.id) return false
        const date = new Date(p.date)
        const month = date.getMonth() + 1
        if (trimestre === 1) return month >= 9 && month <= 12  // Septembre à Décembre
        if (trimestre === 2) return month >= 1 && month <= 3   // Janvier à Mars
        if (trimestre === 3) return month >= 4 && month <= 8   // Avril à Août
        return true
      })

      const bulletin = this.processStudentBulletin(
        eleve,
        studentNotes,
        studentPresences,
        coefficients,
        isPrimaire,
        trimestre,
        annee_scolaire!,
        niveau!,
        serie,
        (n) => n.evaluations || n.evaluation
      )

      bulletin.classe = {
        id: classe.id,
        nom_classe: classe.nom_classe,
        niveau_code: niveau?.code || '',
        niveau_nom: niveau?.nom || '',
        cycle: niveau?.cycle || 'primaire',
        serie_code: serie?.code,
        serie_nom: serie?.nom
      };

      bulletin.ecole = {
        nom: ecole.nom,
        logo_url: ecole.logo_url,
        tampon_url: ecole.tampon_url,
        signature_url: ecole.signature_url
      };

      // Calcul de l'historique trimestriel sans utiliser la vue SQL
      const trimAverages = [null, null, null] as (number | null)[]
      for (let t = 1; t <= 3; t++) {
        if (t === trimestre) {
          trimAverages[t - 1] = bulletin.moyenne_generale;
          continue;
        }
        const studentNotesPast = processedNotes.filter((n: any) => n.eleve_id === eleve.id && n.evaluations?.trimestre === t)
        if (studentNotesPast.length > 0) {
          const pastBulletin = this.processStudentBulletin(
            eleve, studentNotesPast, studentPresences, coefficients,
            isPrimaire, t, annee_scolaire!, niveau!, serie, (n) => n.evaluations || n.evaluation
          )
          trimAverages[t - 1] = pastBulletin.moyenne_generale
        }
      }

      // Injecter les données annuelles et la progression
      const currentMG = bulletin.moyenne_generale
      const prevMG = trimAverages[trimestre - 2]
      
      bulletin.annual = {
        moyenne_annuelle: 0,
        mention_annuelle: '',
        moyennes_trimestrielles: trimAverages,
        progression: prevMG !== undefined && prevMG !== null && currentMG !== null ? currentMG - prevMG : null
      }

      const validAverages = trimAverages.filter(v => v !== null) as number[]
      if (validAverages.length > 0) {
        const annualAvg = validAverages.reduce((a, b) => a + b, 0) / validAverages.length
        bulletin.annual.moyenne_annuelle = Math.round(annualAvg * 100) / 100
        bulletin.annual.mention_annuelle = this.determinerMention(bulletin.annual.moyenne_annuelle * (isPrimaire ? 2 : 1), isPrimaire ? 'primaire' : 'moyen')
        
        // Décision si c'est le dernier trimestre (T3 ou S2)
        const isFinal = (typePeriode === 'semestre' && trimestre === 2) || (typePeriode === 'trimestre' && trimestre === 3)
        if (isFinal && validAverages.length >= (typePeriode === 'semestre' ? 2 : 2)) { // On attend au moins 2 notes pour décider
          bulletin.annual.decision = this.determinerDecisionAnnuelle(bulletin.annual.moyenne_annuelle, isPrimaire)
        } else {
          bulletin.annual.decision = 'En attente'
        }
      }

      return bulletin
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
    annee_scolaire?: string
  ): Promise<BulletinData> {
    const { data: eleve } = await supabase.from('eleves').select('classe_id').eq('id', eleve_id).single() as { data: { classe_id: string } | null; error: unknown }
    if (!eleve) throw new Error("Élève introuvable")
    
    const allInClass = await this.genererBulletinsClasse(eleve.classe_id, trimestre, annee_scolaire)
    const result = allInClass.find(b => b.eleve.id === eleve_id)
    if (!result) throw new Error("Calcul échoué")
    return result
  }

  private static calculerRangs(bulletins: BulletinData[]): BulletinData[] {
    const sorted = [...bulletins].sort((a, b) => (b.moyenne_generale ?? -1) - (a.moyenne_generale ?? -1))
    
    // Gérer les ex-æquo proprement
    let rank = 1
    for (let i = 0; i < sorted.length; i++) {
      if (i > 0 && (sorted[i].moyenne_generale ?? -1) < (sorted[i-1].moyenne_generale ?? -1)) {
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

  private static determinerDecisionAnnuelle(moyenne: number, isPrimaire: boolean): 'Passage' | 'Redoublement' | 'Exclusion' {
    const thresholdPassage = isPrimaire ? 5 : 10
    const thresholdRedoublement = isPrimaire ? 4 : 8.5

    if (moyenne >= thresholdPassage) return 'Passage'
    if (moyenne >= thresholdRedoublement) return 'Redoublement'
    return 'Exclusion'
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
