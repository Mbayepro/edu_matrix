import { supabase } from './supabase'
import type { Eleve, Niveau, Serie, Matiere, CoefficientMatiere } from './supabase'

export interface MoyenneMatiere {
  matiere_id: string
  matiere_nom: string
  coefficient: number
  moyenne: number
  bareme: number
  appreciation?: string
  nombre_evaluations: number
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
    const { data, error } = await supabase
      .from('coefficients_matieres')
      .select(`
        *,
        matiere:matieres(id, nom, code_matiere, cycle),
        niveau:niveaux(id, code, nom, cycle),
        serie:series(id, code, nom)
      `)
      .eq('ecole_id', ecole_id)
      .eq('niveau_id', niveau_id)
      .eq('is_obligatoire', true)
      .or(`serie_id.eq.${serie_id || ''},serie_id.is.null`)
      .order('matiere.nom')

    if (error) throw error
    return data || []
  }

  /**
   * Calcule la moyenne par matière pour un élève et un trimestre
   */
  static async calculerMoyenneMatiere(
    eleve_id: string,
    matiere_id: string,
    trimestre: number
  ): Promise<{ moyenne: number; bareme: number; nombre_evaluations: number }> {
    const { data: notes, error } = await supabase
      .from('v_moyennes_matieres')
      .select('moyenne_matiere, nombre_evaluations, bareme_moyen') // On suppose que la vue renvoie le barème moyen ou on le calcule
      .eq('eleve_id', eleve_id)
      .eq('matiere_id', matiere_id)
      .eq('trimestre', trimestre)
      .single()

    if (error || !notes) {
      return { moyenne: 0, bareme: 20, nombre_evaluations: 0 }
    }

    return {
      moyenne: Number(notes.moyenne_matiere),
      bareme: Number(notes.bareme_moyen || 20),
      nombre_evaluations: notes.nombre_evaluations
    }
  }

  /**
   * Génère le bulletin complet d'un élève pour un trimestre
   */
  static async genererBulletin(
    eleve_id: string,
    trimestre: number,
    annee_scolaire: string = '2024-2025'
  ): Promise<BulletinData> {
    // Récupérer les informations de l'élève avec sa classe
    const { data: eleveData, error: eleveError } = await supabase
      .from('eleves')
      .select(`
        *,
        classe:classes(
          *,
          niveau_info:niveaux(*),
          serie_info:series(*)
        )
      `)
      .eq('id', eleve_id)
      .single()

    if (eleveError || !eleveData) {
      throw new Error('Élève non trouvé')
    }

    const eleve = eleveData
    const classe = eleve.classe!
    const niveau = classe.niveau_info!
    const serie = classe.serie_info

    // Récupérer les coefficients pour ce niveau/série
    const coefficients = await this.getCoefficientsMatieres(
      eleve.ecole_id,
      niveau.id,
      serie?.id
    )

    // Calculer les moyennes par matière
    const matieres: MoyenneMatiere[] = []
    let totalPoints = 0
    let totalCoefficients = 0

    for (const coeff of coefficients) {
      const { moyenne, bareme, nombre_evaluations } = await this.calculerMoyenneMatiere(
        eleve_id,
        coeff.matiere_id,
        trimestre
      )

      // Générer l'appréciation (normalisée sur 20 pour la mention)
      const moyenneNormalisee = (moyenne / bareme) * 20
      const appreciation = this.genererAppreciation(moyenneNormalisee)

      const moyenneMatiere: MoyenneMatiere = {
        matiere_id: coeff.matiere_id,
        matiere_nom: coeff.matiere!.nom,
        coefficient: coeff.coefficient,
        moyenne,
        bareme,
        appreciation,
        nombre_evaluations
      }

      matieres.push(moyenneMatiere)

      // Ajouter au calcul de la moyenne générale (pondérée et normalisée sur 20)
      if (nombre_evaluations > 0) {
        totalPoints += moyenneNormalisee * coeff.coefficient
        totalCoefficients += coeff.coefficient
      }
    }

    // Calculer la moyenne générale
    const moyenne_generale = totalCoefficients > 0 ? totalPoints / totalCoefficients : 0

    // Déterminer la mention selon le barème sénégalais
    const mention = this.determinerMention(moyenne_generale)

    return {
      eleve,
      niveau,
      serie,
      trimestre,
      annee_scolaire,
      matieres,
      moyenne_generale: Math.round(moyenne_generale * 100) / 100,
      mention
    }
  }

  /**
   * Génère les bulletins pour tous les élèves d'une classe
   */
  static async genererBulletinsClasse(
    classe_id: string,
    trimestre: number,
    annee_scolaire: string = '2024-2025'
  ): Promise<BulletinData[]> {
    // Récupérer tous les élèves de la classe
    const { data: eleves, error } = await supabase
      .from('eleves')
      .select('id')
      .eq('classe_id', classe_id)
      .order('nom, prenom')

    if (error || !eleves) {
      throw new Error('Impossible de récupérer les élèves de la classe')
    }

    // Générer les bulletins en parallèle
    const bulletins = await Promise.all(
      eleves.map((eleve: any) => 
        this.genererBulletin(eleve.id, trimestre, annee_scolaire)
      )
    )

    // Calculer les rangs
    const bulletinsAvecRangs = this.calculerRangs(bulletins)

    return bulletinsAvecRangs
  }

  /**
   * Calcule les rangs des élèves dans une classe
   */
  private static calculerRangs(bulletins: BulletinData[]): BulletinData[] {
    // Trier par moyenne générale décroissante
    const sorted = [...bulletins].sort((a, b) => b.moyenne_generale - a.moyenne_generale)
    
    // Assigner les rangs
    sorted.forEach((bulletin, index) => {
      bulletin.rang = index + 1
    })

    // Retourner avec le total d'élèves
    return sorted.map(bulletin => ({
      ...bulletin,
      total_eleves: bulletins.length
    }))
  }

  /**
   * Détermine la mention selon le barème sénégalais
   */
  private static determinerMention(moyenne: number): string {
    if (moyenne < 10) return 'Insuffisant'
    if (moyenne < 12) return 'Passable'
    if (moyenne < 14) return 'Assez bien'
    if (moyenne < 16) return 'Bien'
    return 'Très bien'
  }

  /**
   * Génère l'appréciation selon la note
   */
  private static genererAppreciation(note: number): string {
    if (note >= 16) return 'Excellent'
    if (note >= 14) return 'Très bon'
    if (note >= 12) return 'Bon'
    if (note >= 10) return 'Passable'
    if (note >= 8) return 'Insuffisant'
    return 'Très insuffisant'
  }

  /**
   * Valide une note (entre 0 et 20)
   */
  static validerNote(note: number): boolean {
    return note >= 0 && note <= 20
  }

  /**
   * Arrondit une note selon les règles sénégalaises
   */
  static arrondirNote(note: number): number {
    return Math.round(note * 100) / 100
  }

  /**
   * Vérifie si une matière est obligatoire pour un niveau/série
   */
  static async isMatiereObligatoire(
    matiere_id: string,
    niveau_id: string,
    serie_id?: string
  ): Promise<boolean> {
    const { data, error } = await supabase
      .from('coefficients_matieres')
      .select('is_obligatoire')
      .eq('matiere_id', matiere_id)
      .eq('niveau_id', niveau_id)
      .eq('is_obligatoire', true)
      .or(`serie_id.eq.${serie_id || ''},serie_id.is.null`)
      .single()

    if (error || !data) return false
    return data.is_obligatoire
  }

  /**
   * Récupère les matières disponibles pour un niveau/série
   */
  static async getMatieresDisponibles(
    ecole_id: string,
    niveau_id: string,
    serie_id?: string
  ): Promise<Matiere[]> {
    const { data, error } = await supabase
      .from('coefficients_matieres')
      .select(`
        matiere:matieres(*)
      `)
      .eq('ecole_id', ecole_id)
      .eq('niveau_id', niveau_id)
      .eq('is_obligatoire', true)
      .or(`serie_id.eq.${serie_id || ''},serie_id.is.null`)

    if (error) throw error
    
    return data?.map((cm: any) => cm.matiere).filter(Boolean) as Matiere[]
  }
}
