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
  Ecole,
  Emargement,
  FraisScolaire,
  EleveFrais,
  Paiement,
} from './supabase'

// ─── Types locaux ─────────────────────────────────────────────────────────────

export interface LocalEleve extends Eleve {
  points_merite?: number
}
export interface LocalClasse extends Classe {}
export interface LocalMatiere extends Matiere {}
export interface LocalNote extends Note {}
export interface LocalEvaluation extends Evaluation {}
export interface LocalPresence extends Presence {
  observation?: string
}
export interface LocalNiveau extends Niveau {}
export interface LocalSerie extends Serie {}
export interface LocalProfile extends Profile {}
export interface LocalEmargement extends Emargement {}
export interface LocalFraisScolaire extends FraisScolaire {}
export interface LocalEleveFrais extends EleveFrais {}
export interface LocalPaiement extends Paiement {
  mois?: string | null
}

export interface LocalRapportJournalier {
  id: string
  ecole_id: string
  date: string
  stats: any
  created_at: string
}

import type { Database } from '../types/supabase'

/**
 * Une action en attente de synchronisation vers Supabase.
 * Stockée dans sync_queue quand l'utilisateur est hors-ligne.
 */
export interface SyncAction {
  id?: number                              // auto-incrément Dexie
  table: keyof Database['public']['Tables']                            // 'notes' | 'presences' | 'eleves' | ...
  action: 'INSERT' | 'UPDATE' | 'DELETE'
  payload: Record<string, unknown>        // données à envoyer
  ecole_id?: string
  createdAt: number                        // Date.now()
  attempts: number                         // nb de tentatives échouées
  lastError?: string
}

// ─── Classe de la base de données ─────────────────────────────────────────────

export class EduMatrixDB extends Dexie {
  ecoles!:      Table<Ecole,           string>
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
  sync_metadata!: Table<{ id: string, table_name: string, last_synced_at: string, ecole_id: string }, string>
  rapports_journaliers!: Table<LocalRapportJournalier, string>

  constructor() {
    super('EduMatrixDB')

    this.version(16).stores({
      ecoles:      'id, updated_at',
      eleves:      'id, ecole_id, classe_id, matricule, telephone_parent, updated_at, [ecole_id+statut_paiement]',
      classes:     'id, ecole_id, updated_at',
      matieres:    'id, ecole_id, updated_at',
      notes:       'id, eleve_id, evaluation_id, ecole_id, updated_at',
      evaluations: 'id, ecole_id, classe_id, matiere_id, trimestre, updated_at',
      presences:   'id, eleve_id, date, classe_id, ecole_id, updated_at, [ecole_id+date]',
      niveaux:     'id, ecole_id, updated_at',
      series:      'id, ecole_id, updated_at',
      profiles:    'id, ecole_id, role, updated_at',
      emargements: 'id, prof_id, classe_id, matiere_id, ecole_id, updated_at',
      frais_scolaires: 'id, ecole_id, updated_at',
      eleves_frais: 'id, eleve_id, ecole_id, updated_at',
      paiements:   'id, eleve_id, ecole_id, date_paiement, mois, updated_at',
      sync_queue:  '++id, table, ecole_id, createdAt',
      sync_metadata: 'id, table_name, ecole_id',
      rapports_journaliers: 'id, date, ecole_id'
    })

    // Explicit table assignments to ensure properties are ALWAYS defined on the instance
    this.ecoles      = this.table('ecoles')
    this.eleves      = this.table('eleves')
    this.classes     = this.table('classes')
    this.matieres    = this.table('matieres')
    this.notes       = this.table('notes')
    this.evaluations = this.table('evaluations')
    this.presences   = this.table('presences')
    this.niveaux     = this.table('niveaux')
    this.series      = this.table('series')
    this.profiles    = this.table('profiles')
    this.emargements = this.table('emargements')
    this.frais_scolaires = this.table('frais_scolaires')
    this.eleves_frais    = this.table('eleves_frais')
    this.paiements       = this.table('paiements')
    this.sync_queue      = this.table('sync_queue')
    this.sync_metadata   = this.table('sync_metadata')
    this.rapports_journaliers = this.table('rapports_journaliers')
  }

  // ─── Helpers Métier ────────────────────────────────────────────────────────
  
  async getBulletinsCalculés(
    classeId: string,
    trimestre: number,
    anneeScolaire?: string
  ): Promise<BulletinData[]> {
    if (!anneeScolaire) {
      const today = new Date();
      anneeScolaire = today.getMonth() >= 8 ? `${today.getFullYear()}-${today.getFullYear() + 1}` : `${today.getFullYear() - 1}-${today.getFullYear()}`;
    }
    const classe = await this.classes.get(classeId)
    if (!classe) throw new Error('Classe introuvable en local.')

    const ecoleId = classe.ecole_id
    const [eleves, notes, evaluations, presences, coeffs] = await Promise.all([
      this.eleves.where('classe_id').equals(classeId).toArray(),
      this.notes.where('ecole_id').equals(ecoleId).toArray(),
      this.evaluations.where('classe_id').equals(classeId).and((e: LocalEvaluation) => e.trimestre === trimestre).toArray(),
      this.presences.where('classe_id').equals(classeId).toArray(),
      // For coefficients, we'll try to find them or use defaults
      this.matieres.where('ecole_id').equals(ecoleId).toArray(),
    ])

    // Mapper matieres en format "coefficients" attendu par le moteur
    const coefficients = coeffs.map((m: LocalMatiere) => ({
      matiere_id: m.id,
      coefficient: m.coefficient || 1,
      matiere: m
    }))

    const isPrimaire = (classe.niveau?.includes('CM') || classe.niveau?.includes('CE') || classe.niveau?.includes('CP') || classe.niveau?.includes('CI'))
    
    const bulletins = CalculateurMoyennes.evaluerBulletins(
      eleves,
      notes,
      evaluations,
      presences,
      coefficients,
      trimestre,
      anneeScolaire,
      isPrimaire
    )

    // Fill missing Niveau/Serie info
    bulletins.forEach((b: BulletinData) => {
      b.niveau = { cycle: isPrimaire ? 'primaire' : 'moyen', code: classe.niveau } as unknown as Niveau
    })

    return bulletins
  }

  async recalculateEleveStatus(eleveId: string): Promise<string> {
    const efTable = this.table('eleves_frais')
    const pTable = this.table('paiements')
    const eTable = this.table('eleves')

    const [efs, paiements] = await Promise.all([
      efTable.where('eleve_id').equals(eleveId).toArray(),
      pTable.where('eleve_id').equals(eleveId).toArray()
    ])

    const totalDu = efs.reduce((sum, ef) => sum + (Number((ef as unknown as {montant_a_payer: number}).montant_a_payer) || (Number(ef.montant_du) - Number(ef.montant_remise))), 0)
    const totalPaye = paiements.reduce((sum, p) => sum + Number(p.montant), 0)

    let statut: 'payé' | 'partiel' | 'impayé' = 'impayé'
    if (totalPaye >= totalDu && totalDu > 0) statut = 'payé'
    else if (totalPaye > 0) statut = 'partiel'

    await eTable.update(eleveId, { statut_paiement: statut })
    return statut
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
    _db.open().catch(err => {
      console.error('[EduMatrix DB] Open failed:', err)
      if (err.name === 'VersionError' || err.name === 'SchemaError') {
        Dexie.delete('EduMatrixDB').then(() => {
          if (typeof window !== 'undefined') window.location.reload()
        })
      }
    })
  }
  return _db
}

// Export par défaut du getter pour faciliter l'import
// Export du singleton pour faciliter l'import
export const db = typeof window !== 'undefined' ? getDb() : null as unknown as EduMatrixDB
