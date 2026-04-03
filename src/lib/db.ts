// src/lib/db.ts
// Base de données locale IndexedDB via Dexie.js
// Miroir des tables Supabase essentielles pour le mode hors-ligne

import Dexie, { type Table } from 'dexie'
import { CalculateurMoyennes, type BulletinData } from './calculMoyennes'
import type {
  Eleve,
  Classe,
  Matiere,
  Note,
  Presence,
  Evaluation,
  Niveau,
  Serie,
  Profile,
  Emargement,
  FraisScolaire,
  EleveFrais,
  Paiement,
} from './supabase'

// ─── Types locaux ─────────────────────────────────────────────────────────────

export interface LocalEleve extends Eleve {}
export interface LocalClasse extends Classe {}
export interface LocalMatiere extends Matiere {}
export interface LocalNote extends Note {}
export interface LocalEvaluation extends Evaluation {}
export interface LocalPresence extends Presence {}
export interface LocalNiveau extends Niveau {}
export interface LocalSerie extends Serie {}
export interface LocalProfile extends Profile {}
export interface LocalEmargement extends Emargement {}
export interface LocalFraisScolaire extends FraisScolaire {}
export interface LocalEleveFrais extends EleveFrais {}
export interface LocalPaiement extends Paiement {}

/**
 * Une action en attente de synchronisation vers Supabase.
 * Stockée dans sync_queue quand l'utilisateur est hors-ligne.
 */
export interface SyncAction {
  id?: number                              // auto-incrément Dexie
  table: string                            // 'notes' | 'presences' | 'eleves' | ...
  action: 'INSERT' | 'UPDATE' | 'DELETE'
  payload: Record<string, unknown>        // données à envoyer
  ecole_id?: string
  createdAt: number                        // Date.now()
  attempts: number                         // nb de tentatives échouées
  lastError?: string
}

// ─── Classe de la base de données ─────────────────────────────────────────────

export class EduMatrixDB extends Dexie {
  eleves!:      Table<LocalEleve,      string>
  classes!:     Table<LocalClasse,     string>
  matieres!:    Table<LocalMatiere,    string>
  notes!:       Table<LocalNote,       string>
  evaluations!: Table<LocalEvaluation, string>
  presences!:   Table<LocalPresence,   string>
  niveaux!:     Table<LocalNiveau,     string>
  series!:      Table<LocalSerie,      string>
  profiles!:    Table<LocalProfile,    string>
  emargements!: Table<LocalEmargement, string>
  frais_scolaires!: Table<LocalFraisScolaire, string>
  eleves_frais!: Table<LocalEleveFrais, string>
  paiements!:   Table<LocalPaiement,   string>
  sync_queue!:  Table<SyncAction,      number>

  constructor() {
    super('EduMatrixDB')

    this.version(3).stores({
      eleves:      'id, ecole_id, classe_id',
      classes:     'id, ecole_id',
      matieres:    'id, ecole_id',
      notes:       'id, eleve_id, evaluation_id, ecole_id',
      evaluations: 'id, ecole_id, classe_id, matiere_id',
      presences:   'id, eleve_id, date, classe_id, ecole_id',
      niveaux:     'id, ecole_id',
      series:      'id, ecole_id',
      profiles:    'id, ecole_id, role',
      emargements: 'id, prof_id, classe_id, matiere_id, ecole_id',
      frais_scolaires: 'id, ecole_id',
      eleves_frais: 'id, eleve_id, ecole_id',
      paiements:   'id, eleve_id, ecole_id',
      sync_queue:  '++id, table, action, createdAt, attempts',
    })

    this.version(4).stores({
      eleves:      'id, ecole_id, classe_id, telephone_parent',
      eleves_frais: 'id, eleve_id, ecole_id, derniere_relance_le',
    })
  }

  // ─── Helpers Métier ────────────────────────────────────────────────────────
  
  async getBulletinsCalculés(
    classeId: string,
    trimestre: number,
    anneeScolaire: string = '2025-2026'
  ): Promise<BulletinData[]> {
    const classe = await this.classes.get(classeId)
    if (!classe) throw new Error('Classe introuvable en local.')

    const ecoleId = classe.ecole_id
    const [eleves, notes, evaluations, presences, coeffs] = await Promise.all([
      this.eleves.where('classe_id').equals(classeId).toArray(),
      this.notes.where('ecole_id').equals(ecoleId).toArray(),
      this.evaluations.where('classe_id').equals(classeId).and(e => e.trimestre === trimestre).toArray(),
      this.presences.where('classe_id').equals(classeId).toArray(),
      // For coefficients, we'll try to find them or use defaults
      this.matieres.where('ecole_id').equals(ecoleId).toArray(),
    ])

    // Mapper matieres en format "coefficients" attendu par le moteur
    const coefficients = coeffs.map(m => ({
      matiere_id: m.id,
      coefficient: m.coefficient || 1,
      matiere: m
    }))

    const isPrimaire = (classe.niveau?.includes('CM') || classe.niveau?.includes('CE') || classe.niveau?.includes('CP') || classe.niveau?.includes('CI'))
    
    const bulletins = CalculateurMoyennes.evaluerBulletins(
      eleves as any,
      notes as any,
      evaluations as any,
      presences as any,
      coefficients as any,
      trimestre,
      anneeScolaire,
      isPrimaire
    )

    // Fill missing Niveau/Serie info
    bulletins.forEach(b => {
      b.niveau = { cycle: isPrimaire ? 'primaire' : 'moyen', code: classe.niveau } as any
    })

    return bulletins
  }
}

// ─── Singleton ─────────────────────────────────────────────────────────────────

// Guard SSR : Dexie requiert IndexedDB, disponible uniquement côté client
let _db: EduMatrixDB | null = null

export function getDb(): EduMatrixDB {
  if (typeof window === 'undefined') {
    throw new Error('[EduMatrix DB] IndexedDB is only available in the browser.')
  }
  if (!_db) {
    _db = new EduMatrixDB()
  }
  return _db
}

// Export par défaut du getter pour faciliter l'import
export const db = typeof window !== 'undefined' ? new EduMatrixDB() : null as unknown as EduMatrixDB
