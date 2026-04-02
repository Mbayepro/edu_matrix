// src/lib/db.ts
// Base de données locale IndexedDB via Dexie.js
// Miroir des tables Supabase essentielles pour le mode hors-ligne

import Dexie, { type Table } from 'dexie'
import type {
  Eleve,
  Classe,
  Matiere,
  Note,
  Presence,
  Evaluation,
  Niveau,
  Serie,
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
  sync_queue!:  Table<SyncAction,      number>

  constructor() {
    super('EduMatrixDB')

    this.version(1).stores({
      eleves:      'id, ecole_id, classe_id',
      classes:     'id, ecole_id',
      matieres:    'id, ecole_id',
      notes:       'id, eleve_id, evaluation_id, ecole_id',
      evaluations: 'id, ecole_id, classe_id, matiere_id',
      presences:   'id, eleve_id, date, classe_id',
      niveaux:     'id, ecole_id',
      series:      'id, ecole_id',
      sync_queue:  '++id, table, action, createdAt, attempts',
    })
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
