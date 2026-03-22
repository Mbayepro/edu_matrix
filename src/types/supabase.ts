export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      classes: {
        Row: {
          created_at: string
          ecole_id: string
          id: string
          niveau: string
          niveau_id: string | null
          nom_classe: string
          serie_id: string | null
        }
        Insert: {
          created_at?: string
          ecole_id: string
          id?: string
          niveau: string
          niveau_id?: string | null
          nom_classe: string
          serie_id?: string | null
        }
        Update: {
          created_at?: string
          ecole_id?: string
          id?: string
          niveau?: string
          niveau_id?: string | null
          nom_classe?: string
          serie_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "classes_ecole_id_fkey"
            columns: ["ecole_id"]
            isOneToOne: false
            referencedRelation: "ecoles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_classes_niveau_id"
            columns: ["niveau_id"]
            isOneToOne: false
            referencedRelation: "niveaux"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_classes_serie_id"
            columns: ["serie_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
        ]
      }
      coefficients_niveaux: {
        Row: {
          coefficient: number
          ecole_id: string | null
          id: string
          matiere_id: string | null
          matiere_nom: string
          niveau: string
          serie: string | null
          serie_id: string | null
          updated_at: string | null
        }
        Insert: {
          coefficient?: number
          ecole_id?: string | null
          id?: string
          matiere_id?: string | null
          matiere_nom: string
          niveau: string
          serie?: string | null
          serie_id?: string | null
          updated_at?: string | null
        }
        Update: {
          coefficient?: number
          ecole_id?: string | null
          id?: string
          matiere_id?: string | null
          matiere_nom?: string
          niveau?: string
          serie?: string | null
          serie_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coefficients_niveaux_ecole_id_fkey"
            columns: ["ecole_id"]
            isOneToOne: false
            referencedRelation: "ecoles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coefficients_niveaux_matiere_id_fkey"
            columns: ["matiere_id"]
            isOneToOne: false
            referencedRelation: "matieres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coefficients_niveaux_matiere_id_fkey"
            columns: ["matiere_id"]
            isOneToOne: false
            referencedRelation: "v_moyennes_coefficients"
            referencedColumns: ["matiere_id"]
          },
          {
            foreignKeyName: "coefficients_niveaux_matiere_id_fkey"
            columns: ["matiere_id"]
            isOneToOne: false
            referencedRelation: "v_moyennes_matieres"
            referencedColumns: ["matiere_id"]
          },
          {
            foreignKeyName: "coefficients_niveaux_serie_id_fkey"
            columns: ["serie_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
        ]
      }
      ecoles: {
        Row: {
          adresse: string | null
          created_at: string
          id: string
          logo_url: string | null
          nom: string
          signature_url: string | null
          statut: string | null
          tampon_url: string | null
          telephone: string | null
          ville: string
        }
        Insert: {
          adresse?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          nom: string
          signature_url?: string | null
          statut?: string | null
          tampon_url?: string | null
          telephone?: string | null
          ville: string
        }
        Update: {
          adresse?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          nom?: string
          signature_url?: string | null
          statut?: string | null
          tampon_url?: string | null
          telephone?: string | null
          ville?: string
        }
        Relationships: []
      }
      eleves: {
        Row: {
          appreciation_trimestre: string | null
          classe_id: string
          created_at: string
          date_naissance: string | null
          decision_conseil: string | null
          ecole_id: string
          id: string
          matricule: string | null
          nom: string
          photo_url: string | null
          prenom: string
          statut_paiement: string
        }
        Insert: {
          appreciation_trimestre?: string | null
          classe_id: string
          created_at?: string
          date_naissance?: string | null
          decision_conseil?: string | null
          ecole_id: string
          id?: string
          matricule?: string | null
          nom: string
          photo_url?: string | null
          prenom: string
          statut_paiement?: string
        }
        Update: {
          appreciation_trimestre?: string | null
          classe_id?: string
          created_at?: string
          date_naissance?: string | null
          decision_conseil?: string | null
          ecole_id?: string
          id?: string
          matricule?: string | null
          nom?: string
          photo_url?: string | null
          prenom?: string
          statut_paiement?: string
        }
        Relationships: [
          {
            foreignKeyName: "eleves_classe_id_fkey"
            columns: ["classe_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eleves_classe_id_fkey"
            columns: ["classe_id"]
            isOneToOne: false
            referencedRelation: "v_bulletins_complets"
            referencedColumns: ["classe_id"]
          },
          {
            foreignKeyName: "eleves_classe_id_fkey"
            columns: ["classe_id"]
            isOneToOne: false
            referencedRelation: "v_moyennes_coefficients"
            referencedColumns: ["classe_id"]
          },
          {
            foreignKeyName: "eleves_classe_id_fkey"
            columns: ["classe_id"]
            isOneToOne: false
            referencedRelation: "v_moyennes_generales"
            referencedColumns: ["classe_id"]
          },
          {
            foreignKeyName: "eleves_classe_id_fkey"
            columns: ["classe_id"]
            isOneToOne: false
            referencedRelation: "v_moyennes_matieres"
            referencedColumns: ["classe_id"]
          },
          {
            foreignKeyName: "eleves_ecole_id_fkey"
            columns: ["ecole_id"]
            isOneToOne: false
            referencedRelation: "ecoles"
            referencedColumns: ["id"]
          },
        ]
      }
      eleves_frais: {
        Row: {
          ecole_id: string
          eleve_id: string
          frais_id: string
          id: string
          montant_a_payer: number | null
          montant_du: number
          montant_remise: number
        }
        Insert: {
          ecole_id: string
          eleve_id: string
          frais_id: string
          id?: string
          montant_a_payer?: number | null
          montant_du: number
          montant_remise?: number
        }
        Update: {
          ecole_id?: string
          eleve_id?: string
          frais_id?: string
          id?: string
          montant_a_payer?: number | null
          montant_du?: number
          montant_remise?: number
        }
        Relationships: [
          {
            foreignKeyName: "eleves_frais_ecole_id_fkey"
            columns: ["ecole_id"]
            isOneToOne: false
            referencedRelation: "ecoles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eleves_frais_eleve_id_fkey"
            columns: ["eleve_id"]
            isOneToOne: false
            referencedRelation: "eleves"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eleves_frais_eleve_id_fkey"
            columns: ["eleve_id"]
            isOneToOne: false
            referencedRelation: "v_bulletins_complets"
            referencedColumns: ["eleve_id"]
          },
          {
            foreignKeyName: "eleves_frais_eleve_id_fkey"
            columns: ["eleve_id"]
            isOneToOne: false
            referencedRelation: "v_moyennes_coefficients"
            referencedColumns: ["eleve_id"]
          },
          {
            foreignKeyName: "eleves_frais_eleve_id_fkey"
            columns: ["eleve_id"]
            isOneToOne: false
            referencedRelation: "v_moyennes_generales"
            referencedColumns: ["eleve_id"]
          },
          {
            foreignKeyName: "eleves_frais_eleve_id_fkey"
            columns: ["eleve_id"]
            isOneToOne: false
            referencedRelation: "v_moyennes_matieres"
            referencedColumns: ["eleve_id"]
          },
          {
            foreignKeyName: "eleves_frais_frais_id_fkey"
            columns: ["frais_id"]
            isOneToOne: false
            referencedRelation: "frais_scolaires"
            referencedColumns: ["id"]
          },
        ]
      }
      emploi_du_temps: {
        Row: {
          classe_id: string
          created_at: string
          ecole_id: string
          enseignant_id: string
          heure_debut: string
          heure_fin: string
          id: string
          jour: number
          matiere_id: string | null
          salle: string | null
        }
        Insert: {
          classe_id: string
          created_at?: string
          ecole_id: string
          enseignant_id: string
          heure_debut: string
          heure_fin: string
          id?: string
          jour: number
          matiere_id?: string | null
          salle?: string | null
        }
        Update: {
          classe_id?: string
          created_at?: string
          ecole_id?: string
          enseignant_id?: string
          heure_debut?: string
          heure_fin?: string
          id?: string
          jour?: number
          matiere_id?: string | null
          salle?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "emploi_du_temps_classe_id_fkey"
            columns: ["classe_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emploi_du_temps_classe_id_fkey"
            columns: ["classe_id"]
            isOneToOne: false
            referencedRelation: "v_bulletins_complets"
            referencedColumns: ["classe_id"]
          },
          {
            foreignKeyName: "emploi_du_temps_classe_id_fkey"
            columns: ["classe_id"]
            isOneToOne: false
            referencedRelation: "v_moyennes_coefficients"
            referencedColumns: ["classe_id"]
          },
          {
            foreignKeyName: "emploi_du_temps_classe_id_fkey"
            columns: ["classe_id"]
            isOneToOne: false
            referencedRelation: "v_moyennes_generales"
            referencedColumns: ["classe_id"]
          },
          {
            foreignKeyName: "emploi_du_temps_classe_id_fkey"
            columns: ["classe_id"]
            isOneToOne: false
            referencedRelation: "v_moyennes_matieres"
            referencedColumns: ["classe_id"]
          },
          {
            foreignKeyName: "emploi_du_temps_ecole_id_fkey"
            columns: ["ecole_id"]
            isOneToOne: false
            referencedRelation: "ecoles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emploi_du_temps_enseignant_id_fkey"
            columns: ["enseignant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emploi_du_temps_matiere_id_fkey"
            columns: ["matiere_id"]
            isOneToOne: false
            referencedRelation: "matieres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emploi_du_temps_matiere_id_fkey"
            columns: ["matiere_id"]
            isOneToOne: false
            referencedRelation: "v_moyennes_coefficients"
            referencedColumns: ["matiere_id"]
          },
          {
            foreignKeyName: "emploi_du_temps_matiere_id_fkey"
            columns: ["matiere_id"]
            isOneToOne: false
            referencedRelation: "v_moyennes_matieres"
            referencedColumns: ["matiere_id"]
          },
        ]
      }
      enseignants_classes: {
        Row: {
          classe_id: string
          created_at: string
          ecole_id: string
          enseignant_id: string
          id: string
          matiere_id: string | null
        }
        Insert: {
          classe_id: string
          created_at?: string
          ecole_id: string
          enseignant_id: string
          id?: string
          matiere_id?: string | null
        }
        Update: {
          classe_id?: string
          created_at?: string
          ecole_id?: string
          enseignant_id?: string
          id?: string
          matiere_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enseignants_classes_classe_id_fkey"
            columns: ["classe_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enseignants_classes_classe_id_fkey"
            columns: ["classe_id"]
            isOneToOne: false
            referencedRelation: "v_bulletins_complets"
            referencedColumns: ["classe_id"]
          },
          {
            foreignKeyName: "enseignants_classes_classe_id_fkey"
            columns: ["classe_id"]
            isOneToOne: false
            referencedRelation: "v_moyennes_coefficients"
            referencedColumns: ["classe_id"]
          },
          {
            foreignKeyName: "enseignants_classes_classe_id_fkey"
            columns: ["classe_id"]
            isOneToOne: false
            referencedRelation: "v_moyennes_generales"
            referencedColumns: ["classe_id"]
          },
          {
            foreignKeyName: "enseignants_classes_classe_id_fkey"
            columns: ["classe_id"]
            isOneToOne: false
            referencedRelation: "v_moyennes_matieres"
            referencedColumns: ["classe_id"]
          },
          {
            foreignKeyName: "enseignants_classes_ecole_id_fkey"
            columns: ["ecole_id"]
            isOneToOne: false
            referencedRelation: "ecoles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enseignants_classes_enseignant_id_fkey"
            columns: ["enseignant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enseignants_classes_matiere_id_fkey"
            columns: ["matiere_id"]
            isOneToOne: false
            referencedRelation: "matieres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enseignants_classes_matiere_id_fkey"
            columns: ["matiere_id"]
            isOneToOne: false
            referencedRelation: "v_moyennes_coefficients"
            referencedColumns: ["matiere_id"]
          },
          {
            foreignKeyName: "enseignants_classes_matiere_id_fkey"
            columns: ["matiere_id"]
            isOneToOne: false
            referencedRelation: "v_moyennes_matieres"
            referencedColumns: ["matiere_id"]
          },
        ]
      }
      evaluations: {
        Row: {
          annee_scolaire: string | null
          bareme: number
          classe_id: string
          coef: number
          created_at: string
          date: string
          ecole_id: string
          id: string
          matiere_id: string
          trimestre: number
          type: string
        }
        Insert: {
          annee_scolaire?: string | null
          bareme?: number
          classe_id: string
          coef?: number
          created_at?: string
          date: string
          ecole_id: string
          id?: string
          matiere_id: string
          trimestre: number
          type: string
        }
        Update: {
          annee_scolaire?: string | null
          bareme?: number
          classe_id?: string
          coef?: number
          created_at?: string
          date?: string
          ecole_id?: string
          id?: string
          matiere_id?: string
          trimestre?: number
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "evaluations_classe_id_fkey"
            columns: ["classe_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluations_classe_id_fkey"
            columns: ["classe_id"]
            isOneToOne: false
            referencedRelation: "v_bulletins_complets"
            referencedColumns: ["classe_id"]
          },
          {
            foreignKeyName: "evaluations_classe_id_fkey"
            columns: ["classe_id"]
            isOneToOne: false
            referencedRelation: "v_moyennes_coefficients"
            referencedColumns: ["classe_id"]
          },
          {
            foreignKeyName: "evaluations_classe_id_fkey"
            columns: ["classe_id"]
            isOneToOne: false
            referencedRelation: "v_moyennes_generales"
            referencedColumns: ["classe_id"]
          },
          {
            foreignKeyName: "evaluations_classe_id_fkey"
            columns: ["classe_id"]
            isOneToOne: false
            referencedRelation: "v_moyennes_matieres"
            referencedColumns: ["classe_id"]
          },
          {
            foreignKeyName: "evaluations_ecole_id_fkey"
            columns: ["ecole_id"]
            isOneToOne: false
            referencedRelation: "ecoles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluations_matiere_id_fkey"
            columns: ["matiere_id"]
            isOneToOne: false
            referencedRelation: "matieres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluations_matiere_id_fkey"
            columns: ["matiere_id"]
            isOneToOne: false
            referencedRelation: "v_moyennes_coefficients"
            referencedColumns: ["matiere_id"]
          },
          {
            foreignKeyName: "evaluations_matiere_id_fkey"
            columns: ["matiere_id"]
            isOneToOne: false
            referencedRelation: "v_moyennes_matieres"
            referencedColumns: ["matiere_id"]
          },
        ]
      }
      frais_scolaires: {
        Row: {
          created_at: string
          ecole_id: string
          frequence: string
          id: string
          is_active: boolean
          libelle: string
          montant: number
          niveau: string | null
        }
        Insert: {
          created_at?: string
          ecole_id: string
          frequence?: string
          id?: string
          is_active?: boolean
          libelle: string
          montant: number
          niveau?: string | null
        }
        Update: {
          created_at?: string
          ecole_id?: string
          frequence?: string
          id?: string
          is_active?: boolean
          libelle?: string
          montant?: number
          niveau?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "frais_scolaires_ecole_id_fkey"
            columns: ["ecole_id"]
            isOneToOne: false
            referencedRelation: "ecoles"
            referencedColumns: ["id"]
          },
        ]
      }
      matieres: {
        Row: {
          code: string | null
          code_matiere: string | null
          coefficient: number
          created_at: string
          cycle: string | null
          domaine: string | null
          ecole_id: string
          est_bonus: boolean | null
          id: string
          is_active: boolean
          niveau: string | null
          nom: string
          updated_at: string | null
        }
        Insert: {
          code?: string | null
          code_matiere?: string | null
          coefficient?: number
          created_at?: string
          cycle?: string | null
          domaine?: string | null
          ecole_id: string
          est_bonus?: boolean | null
          id?: string
          is_active?: boolean
          niveau?: string | null
          nom: string
          updated_at?: string | null
        }
        Update: {
          code?: string | null
          code_matiere?: string | null
          coefficient?: number
          created_at?: string
          cycle?: string | null
          domaine?: string | null
          ecole_id?: string
          est_bonus?: boolean | null
          id?: string
          is_active?: boolean
          niveau?: string | null
          nom?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matieres_ecole_id_fkey"
            columns: ["ecole_id"]
            isOneToOne: false
            referencedRelation: "ecoles"
            referencedColumns: ["id"]
          },
        ]
      }
      matricule_sequences: {
        Row: {
          annee: number
          compteur: number
        }
        Insert: {
          annee: number
          compteur?: number
        }
        Update: {
          annee?: number
          compteur?: number
        }
        Relationships: []
      }
      niveaux: {
        Row: {
          code: string
          created_at: string
          cycle: string
          ecole_id: string
          id: string
          is_active: boolean
          nom: string
          ordre: number
          updated_at: string | null
        }
        Insert: {
          code: string
          created_at?: string
          cycle: string
          ecole_id: string
          id?: string
          is_active?: boolean
          nom: string
          ordre: number
          updated_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          cycle?: string
          ecole_id?: string
          id?: string
          is_active?: boolean
          nom?: string
          ordre?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "niveaux_ecole_id_fkey"
            columns: ["ecole_id"]
            isOneToOne: false
            referencedRelation: "ecoles"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          created_at: string
          ecole_id: string
          eleve_id: string
          evaluation_id: string
          id: string
          note: number
          professeur_id: string | null
        }
        Insert: {
          created_at?: string
          ecole_id: string
          eleve_id: string
          evaluation_id: string
          id?: string
          note: number
          professeur_id?: string | null
        }
        Update: {
          created_at?: string
          ecole_id?: string
          eleve_id?: string
          evaluation_id?: string
          id?: string
          note?: number
          professeur_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notes_ecole_id_fkey"
            columns: ["ecole_id"]
            isOneToOne: false
            referencedRelation: "ecoles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_eleve_id_fkey"
            columns: ["eleve_id"]
            isOneToOne: false
            referencedRelation: "eleves"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_eleve_id_fkey"
            columns: ["eleve_id"]
            isOneToOne: false
            referencedRelation: "v_bulletins_complets"
            referencedColumns: ["eleve_id"]
          },
          {
            foreignKeyName: "notes_eleve_id_fkey"
            columns: ["eleve_id"]
            isOneToOne: false
            referencedRelation: "v_moyennes_coefficients"
            referencedColumns: ["eleve_id"]
          },
          {
            foreignKeyName: "notes_eleve_id_fkey"
            columns: ["eleve_id"]
            isOneToOne: false
            referencedRelation: "v_moyennes_generales"
            referencedColumns: ["eleve_id"]
          },
          {
            foreignKeyName: "notes_eleve_id_fkey"
            columns: ["eleve_id"]
            isOneToOne: false
            referencedRelation: "v_moyennes_matieres"
            referencedColumns: ["eleve_id"]
          },
          {
            foreignKeyName: "notes_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "evaluations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_professeur_id_fkey"
            columns: ["professeur_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      paiements: {
        Row: {
          created_at: string
          date_paiement: string
          ecole_id: string
          eleve_id: string
          frais_id: string
          id: string
          mode: string | null
          montant: number
          reference: string | null
        }
        Insert: {
          created_at?: string
          date_paiement?: string
          ecole_id: string
          eleve_id: string
          frais_id: string
          id?: string
          mode?: string | null
          montant: number
          reference?: string | null
        }
        Update: {
          created_at?: string
          date_paiement?: string
          ecole_id?: string
          eleve_id?: string
          frais_id?: string
          id?: string
          mode?: string | null
          montant?: number
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "paiements_ecole_id_fkey"
            columns: ["ecole_id"]
            isOneToOne: false
            referencedRelation: "ecoles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paiements_eleve_id_fkey"
            columns: ["eleve_id"]
            isOneToOne: false
            referencedRelation: "eleves"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paiements_eleve_id_fkey"
            columns: ["eleve_id"]
            isOneToOne: false
            referencedRelation: "v_bulletins_complets"
            referencedColumns: ["eleve_id"]
          },
          {
            foreignKeyName: "paiements_eleve_id_fkey"
            columns: ["eleve_id"]
            isOneToOne: false
            referencedRelation: "v_moyennes_coefficients"
            referencedColumns: ["eleve_id"]
          },
          {
            foreignKeyName: "paiements_eleve_id_fkey"
            columns: ["eleve_id"]
            isOneToOne: false
            referencedRelation: "v_moyennes_generales"
            referencedColumns: ["eleve_id"]
          },
          {
            foreignKeyName: "paiements_eleve_id_fkey"
            columns: ["eleve_id"]
            isOneToOne: false
            referencedRelation: "v_moyennes_matieres"
            referencedColumns: ["eleve_id"]
          },
          {
            foreignKeyName: "paiements_frais_id_fkey"
            columns: ["frais_id"]
            isOneToOne: false
            referencedRelation: "frais_scolaires"
            referencedColumns: ["id"]
          },
        ]
      }
      presences: {
        Row: {
          classe_id: string
          date: string
          eleve_id: string
          heure: string
          id: string
          statut: string
        }
        Insert: {
          classe_id: string
          date?: string
          eleve_id: string
          heure?: string
          id?: string
          statut?: string
        }
        Update: {
          classe_id?: string
          date?: string
          eleve_id?: string
          heure?: string
          id?: string
          statut?: string
        }
        Relationships: [
          {
            foreignKeyName: "presences_classe_id_fkey"
            columns: ["classe_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presences_classe_id_fkey"
            columns: ["classe_id"]
            isOneToOne: false
            referencedRelation: "v_bulletins_complets"
            referencedColumns: ["classe_id"]
          },
          {
            foreignKeyName: "presences_classe_id_fkey"
            columns: ["classe_id"]
            isOneToOne: false
            referencedRelation: "v_moyennes_coefficients"
            referencedColumns: ["classe_id"]
          },
          {
            foreignKeyName: "presences_classe_id_fkey"
            columns: ["classe_id"]
            isOneToOne: false
            referencedRelation: "v_moyennes_generales"
            referencedColumns: ["classe_id"]
          },
          {
            foreignKeyName: "presences_classe_id_fkey"
            columns: ["classe_id"]
            isOneToOne: false
            referencedRelation: "v_moyennes_matieres"
            referencedColumns: ["classe_id"]
          },
          {
            foreignKeyName: "presences_eleve_id_fkey"
            columns: ["eleve_id"]
            isOneToOne: false
            referencedRelation: "eleves"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presences_eleve_id_fkey"
            columns: ["eleve_id"]
            isOneToOne: false
            referencedRelation: "v_bulletins_complets"
            referencedColumns: ["eleve_id"]
          },
          {
            foreignKeyName: "presences_eleve_id_fkey"
            columns: ["eleve_id"]
            isOneToOne: false
            referencedRelation: "v_moyennes_coefficients"
            referencedColumns: ["eleve_id"]
          },
          {
            foreignKeyName: "presences_eleve_id_fkey"
            columns: ["eleve_id"]
            isOneToOne: false
            referencedRelation: "v_moyennes_generales"
            referencedColumns: ["eleve_id"]
          },
          {
            foreignKeyName: "presences_eleve_id_fkey"
            columns: ["eleve_id"]
            isOneToOne: false
            referencedRelation: "v_moyennes_matieres"
            referencedColumns: ["eleve_id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          ecole_id: string | null
          id: string
          nom: string
          prenom: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          ecole_id?: string | null
          id?: string
          nom: string
          prenom: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          ecole_id?: string | null
          id?: string
          nom?: string
          prenom?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_ecole_id_fkey"
            columns: ["ecole_id"]
            isOneToOne: false
            referencedRelation: "ecoles"
            referencedColumns: ["id"]
          },
        ]
      }
      series: {
        Row: {
          code: string
          created_at: string
          description: string | null
          ecole_id: string
          id: string
          is_active: boolean
          nom: string
          updated_at: string | null
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          ecole_id: string
          id?: string
          is_active?: boolean
          nom: string
          updated_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          ecole_id?: string
          id?: string
          is_active?: boolean
          nom?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "series_ecole_id_fkey"
            columns: ["ecole_id"]
            isOneToOne: false
            referencedRelation: "ecoles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_bulletins_complets: {
        Row: {
          annee_scolaire: string | null
          classe_id: string | null
          cycle: string | null
          ecole_id: string | null
          ecole_logo_url: string | null
          ecole_nom: string | null
          ecole_signature_url: string | null
          ecole_tampon_url: string | null
          eleve_id: string | null
          matieres_details_json: Json | null
          matricule: string | null
          mention: string | null
          moyenne_generale: number | null
          niveau_code: string | null
          niveau_cycle: string | null
          niveau_nom: string | null
          nom: string | null
          nom_classe: string | null
          nombre_matieres: number | null
          prenom: string | null
          total_coefficients: number | null
          total_coefficients_calcules: number | null
          total_points: number | null
          trimestre: number | null
        }
        Relationships: [
          {
            foreignKeyName: "eleves_ecole_id_fkey"
            columns: ["ecole_id"]
            isOneToOne: false
            referencedRelation: "ecoles"
            referencedColumns: ["id"]
          },
        ]
      }
      v_moyennes_coefficients: {
        Row: {
          classe_id: string | null
          coefficient: number | null
          eleve_id: string | null
          eleve_nom: string | null
          eleve_prenom: string | null
          matiere_id: string | null
          matiere_nom: string | null
          moyenne_matiere: number | null
          moyenne_ponderee: number | null
          niveau_classe: string | null
          nom_classe: string | null
          nombre_notes: number | null
          trimestre: number | null
        }
        Relationships: []
      }
      v_moyennes_generales: {
        Row: {
          annee_scolaire: string | null
          classe_id: string | null
          cycle: string | null
          ecole_id: string | null
          eleve_id: string | null
          matricule: string | null
          mention: string | null
          moyenne_generale: number | null
          niveau_code: string | null
          nom: string | null
          nom_classe: string | null
          nombre_matieres: number | null
          prenom: string | null
          total_coefficients: number | null
          total_coefficients_calcules: number | null
          total_points: number | null
          trimestre: number | null
        }
        Relationships: [
          {
            foreignKeyName: "eleves_ecole_id_fkey"
            columns: ["ecole_id"]
            isOneToOne: false
            referencedRelation: "ecoles"
            referencedColumns: ["id"]
          },
        ]
      }
      v_moyennes_matieres: {
        Row: {
          annee_scolaire: string | null
          classe_id: string | null
          coefficient: number | null
          composition_note: number | null
          cycle: string | null
          domaine: string | null
          ecole_id: string | null
          eleve_id: string | null
          est_bonus: boolean | null
          matiere_id: string | null
          matiere_nom: string | null
          matricule: string | null
          mcc: number | null
          moyenne_matiere: number | null
          niveau_code: string | null
          nom: string | null
          nom_classe: string | null
          nombre_evaluations: number | null
          prenom: string | null
          trimestre: number | null
        }
        Relationships: [
          {
            foreignKeyName: "eleves_ecole_id_fkey"
            columns: ["ecole_id"]
            isOneToOne: false
            referencedRelation: "ecoles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      calculate_moyenne_ponderee: {
        Args: { p_eleve_id: string; p_trimestre: number }
        Returns: number
      }
      get_my_ecole_id: { Args: never; Returns: string }
      get_my_role: { Args: never; Returns: string }
      recalculate_statut_paiement: {
        Args: { p_eleve_id: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
