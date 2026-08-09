// src/lib/supabase.ts
import { createBrowserClient } from '@supabase/ssr'

// ─────────────────────────────────────────
// Database type definitions
// ─────────────────────────────────────────
export type Role = 'superadmin' | 'director' | 'teacher'
export type StatutPaiement = 'payé' | 'impayé' | 'partiel'
export type StatutPresence = 'présent' | 'absent' | 'retard'

export type StatutEcole = 'en_attente' | 'actif' | 'suspendu'

export interface Ecole {
  id: string
  nom: string
  ville: string
  telephone: string | null
  adresse: string | null
  logo_url: string | null
  tampon_url: string | null
  signature_url: string | null
  calculation_method?: 'BLOCKS' | 'WEIGHTED'
  type_periode?: 'trimestre' | 'semestre'
  heure_limite_retard?: string
  statut: StatutEcole
  cycles_couverts?: string[]
  seuil_passage_secondaire?: number
  seuil_redoublement_secondaire?: number
  seuil_passage_primaire?: number
  seuil_redoublement_primaire?: number
  seuil_alerte_chute?: number
  seuil_alerte_absences?: number
  created_at: string
  updated_at?: string
  deleted_at?: string | null
}

export interface Profile {
  id: string
  user_id: string
  ecole_id: string | null
  role: Role
  nom: string
  prenom: string
  created_at: string
  updated_at?: string
  deleted_at?: string | null
}


export interface Eleve {
  id: string
  ecole_id: string
  classe_id: string
  matricule: string | null
  prenom: string
  nom: string
  date_naissance: string | null
  photo_url: string | null
  statut_paiement: StatutPaiement
  telephone_parent: string | null
  pin_parent?: string | null
  created_at: string
  // Joined fields
  classe?: Classe
}

export interface Niveau {
  id: string
  ecole_id: string
  code: string // CI, CP, CE1, CE2, CM1, CM2, 6eme, 5eme, 4eme, 3eme, 2nde, 1ere, Tle
  nom: string // Cours Initial, Cours Préparatoire, etc.
  cycle: 'primaire' | 'moyen' | 'secondaire'
  ordre: number
  is_active: boolean
  created_at: string
  updated_at?: string
  deleted_at?: string | null
}

export interface Serie {
  id: string
  ecole_id: string
  code: string // S1, S2, L1, L2, G, T
  nom: string // Scientifique 1, Littéraire 1, etc.
  description: string | null
  is_active: boolean
  created_at: string
  updated_at?: string
  deleted_at?: string | null
}

export interface CoefficientMatiere {
  id: string
  ecole_id: string
  matiere_id: string
  niveau_id: string
  serie_id: string | null
  coefficient: number
  is_obligatoire: boolean
  created_at: string
  // Joined fields
  matiere?: Matiere
  niveau?: Niveau
  serie?: Serie
}

export interface Matiere {
  id: string
  ecole_id: string
  nom: string
  code: string | null
  niveau: string | null // Ancien champ, à migrer
  coefficient: number // Ancien champ, à migrer vers coefficients_matieres
  is_active: boolean
  created_at: string
  // Nouveaux champs
  cycle?: 'primaire' | 'moyen' | 'secondaire'
  code_matiere?: string // Code officiel du ministère
  est_bonus?: boolean
  // Joined fields
  coefficients?: CoefficientMatiere[]
}

export interface Classe {
  id: string
  ecole_id: string
  nom_classe: string
  niveau: string // Ancien champ, à migrer
  created_at: string
  // Nouveaux champs
  niveau_id?: string
  serie_id?: string | null
  // Joined fields
  niveau_info?: Niveau
  serie_info?: Serie
}

export interface Evaluation {
  id: string
  ecole_id: string
  classe_id: string
  matiere_id: string
  trimestre: 1 | 2 | 3
  type: 'controle' | 'devoir' | 'composition'
  date: string
  coef: number
  bareme: number
  annee_scolaire?: string
  created_at: string
  // Joined fields
  matiere?: Matiere
  classe?: Classe
}

export interface Note {
  id: string
  ecole_id: string
  eleve_id: string
  evaluation_id: string
  note: number
  created_at: string
  // Champs dénormalisés / joints (utilisés dans StudentCard)
  coefficient: number
  matiere: string
  trimestre: 1 | 2 | 3
  // Joined fields
  eleve?: Eleve
  evaluation?: Evaluation
}

export interface Presence {
  id: string
  ecole_id: string
  eleve_id: string
  classe_id: string
  date: string
  heure: string
  statut: StatutPresence
  annee_scolaire?: string
  eleve?: Eleve
}

export interface Emargement {
  id: string
  prof_id: string
  classe_id: string
  matiere_id: string
  date_heure: string
  sujet_cours: string
  ecole_id: string
  annee_scolaire?: string
}

export interface FraisScolaire {
  id: string
  ecole_id: string
  libelle: string
  montant: number
  frequence: 'unique' | 'mensuel' | 'trimestriel'
  niveau: string | null
  is_active: boolean
  created_at: string
  updated_at?: string
  deleted_at?: string | null
  annee_scolaire?: string
}

export interface EleveFrais {
  id: string
  ecole_id: string
  eleve_id: string
  frais_id: string
  montant_du: number
  montant_remise: number
  montant_a_payer: number
  derniere_relance_le?: string | null
  annee_scolaire?: string
}

export interface Paiement {
  id: string
  ecole_id: string
  eleve_id: string
  frais_id: string
  montant: number
  mode: string | null
  reference: string | null
  mois?: string | null
  date_paiement: string
  created_at: string
  updated_at?: string
  deleted_at?: string | null
  annee_scolaire?: string
}

export interface EnseignantClasse {
  id: string
  ecole_id: string
  enseignant_id: string
  classe_id: string
  matiere_id: string | null
  created_at: string
  // Joined fields
  enseignant?: Profile
  classe?: Classe
  matiere?: Matiere
}

export type JourSemaine = 1 | 2 | 3 | 4 | 5 | 6

export interface EmploiDuTemps {
  id: string
  ecole_id: string
  enseignant_id: string
  classe_id: string
  matiere_id: string | null
  jour: JourSemaine
  heure_debut: string   // 'HH:MM:SS'
  heure_fin: string     // 'HH:MM:SS'
  salle: string | null
  created_at: string
  // Joined fields
  enseignant?: Profile
  classe?: Classe
  matiere?: Matiere
}

export type Database = {
  public: {
    Tables: {
      ecoles:    { Row: Ecole;    Insert: Omit<Ecole, 'id' | 'created_at'> & { statut?: StatutEcole }; Update: Partial<Omit<Ecole, 'id' | 'created_at'>> }
      profiles:  { Row: Profile;  Insert: Omit<Profile,  'id' | 'created_at'>; Update: Partial<Omit<Profile, 'id' | 'created_at'>> }
      niveaux:   { Row: Niveau;   Insert: Omit<Niveau,   'id' | 'created_at'>; Update: Partial<Omit<Niveau, 'id' | 'created_at'>> }
      series:    { Row: Serie;    Insert: Omit<Serie,    'id' | 'created_at'>; Update: Partial<Omit<Serie, 'id' | 'created_at'>> }
      classes:   { Row: Classe;   Insert: Omit<Classe,   'id' | 'created_at'>; Update: Partial<Omit<Classe, 'id' | 'created_at'>> }
      matieres:  { Row: Matiere;  Insert: Omit<Matiere,  'id' | 'created_at'>; Update: Partial<Omit<Matiere, 'id' | 'created_at'>> }
      coefficients_matieres: { Row: CoefficientMatiere; Insert: Omit<CoefficientMatiere, 'id' | 'created_at'>; Update: Partial<Omit<CoefficientMatiere, 'id' | 'created_at'>> }
      evaluations: { Row: Evaluation; Insert: Omit<Evaluation, 'id' | 'created_at'>; Update: Partial<Omit<Evaluation, 'id' | 'created_at'>> }
      eleves:    { Row: Eleve;    Insert: Omit<Eleve,    'id' | 'created_at' | 'classe'>; Update: Partial<Omit<Eleve, 'id' | 'created_at' | 'classe'>> }
      notes:     { Row: Note;     Insert: Omit<Note,     'id' | 'created_at'>; Update: Partial<Omit<Note, 'id' | 'created_at'>> }
      presences: { Row: Presence; Insert: Omit<Presence, 'id'>; Update: Partial<Omit<Presence, 'id'>> }
      frais_scolaires: { Row: FraisScolaire; Insert: Omit<FraisScolaire, 'id' | 'created_at'>; Update: Partial<Omit<FraisScolaire, 'id' | 'created_at'>> }
      eleves_frais:    { Row: EleveFrais;    Insert: Omit<EleveFrais,    'id'>;               Update: Partial<Omit<EleveFrais, 'id'>> }
      paiements:       { Row: Paiement;      Insert: Omit<Paiement,      'id' | 'created_at'>; Update: Partial<Omit<Paiement, 'id' | 'created_at'>> }
      enseignants_classes: { Row: EnseignantClasse; Insert: Omit<EnseignantClasse, 'id' | 'created_at'>; Update: Partial<Omit<EnseignantClasse, 'id' | 'created_at'>> }
      emploi_du_temps: { Row: EmploiDuTemps; Insert: Omit<EmploiDuTemps, 'id' | 'created_at'>; Update: Partial<Omit<EmploiDuTemps, 'id' | 'created_at'>> }
      emargements:     { Row: Emargement;     Insert: Omit<Emargement,     'id'>; Update: Partial<Omit<Emargement, 'id'>> }
    }
    Views: {
      v_moyennes_matieres: { Row: any; Insert: never; Update: never }
      v_moyennes_generales: { Row: any; Insert: never; Update: never }
    }
    Functions: {
      get_my_ecole_id: { Args: Record<never, never>; Returns: string }
      get_my_role:     { Args: Record<never, never>; Returns: string }
      calculate_moyenne_ponderee: {
        Args: { p_eleve_id: string; p_trimestre: number }
        Returns: number
      }
    }
  }
}

// ─────────────────────────────────────────
// Singleton Supabase client
// ─────────────────────────────────────────
const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables.')
}

export const supabase = createBrowserClient<Database>(supabaseUrl, supabaseAnonKey)

// ─────────────────────────────────────────
// Auth helpers
// ─────────────────────────────────────────
export async function getCurrentProfile(): Promise<Profile | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  return data ?? null
}

export async function signOut() {
  return supabase.auth.signOut()
}