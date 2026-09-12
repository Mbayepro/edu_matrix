# Base de données EduMatrix

Structure organisée des fichiers SQL pour le projet EduMatrix.

## 📁 Structure des dossiers

```
database/
├── migrations/     # Scripts de migration du schéma (chronologique)
├── fixes/          # Corrections de bugs et problèmes
├── triggers/       # Triggers PostgreSQL
├── views/          # Vues pour les rapports et interfaces
├── rpc/            # Fonctions RPC (Remote Procedure Calls)
├── seeds/          # Données initiales et scripts de promotion
└── README.md       # Ce fichier
```

## 📋 Ordre d'exécution recommandé

### 1. Schéma initial
```bash
# Exécuter en premier pour créer la structure de base
psql -f database/migrations/001_initial_schema.sql
```

### 2. Migrations (dans l'ordre chronologique)
```bash
# Exécuter les migrations dans l'ordre numérique
psql -f database/migrations/migration_add_domaines.sql
psql -f database/migrations/migration_add_annee_scolaire_notes.sql
psql -f database/migrations/migration_add_ecole_statut.sql
psql -f database/migrations/migration_add_ecole_id_presences.sql
psql -f database/migrations/migration_add_mois_paiements.sql
psql -f database/migrations/migration_bulletins_v2.sql
psql -f database/migrations/migration_bulletins_v3.sql
psql -f database/migrations/migration_bulletins_v4.sql
psql -f database/migrations/migration_phase2.sql
psql -f database/migrations/migration_stabilisation_sync.sql
```

### 3. Coefficients
```bash
# Configuration des coefficients par matière
psql -f database/migrations/coeficients.sql
```

### 4. Fixes
```bash
# Appliquer les corrections si nécessaire
psql -f database/fixes/fix_*.sql
```

### 5. Triggers
```bash
# Activer les triggers
psql -f database/triggers/triggers.sql
```

### 6. Views et RPC
```bash
# Créer les vues et fonctions RPC
psql -f database/views/espace_parent_views.sql
psql -f database/views/espace_parent_rpc.sql
psql -f database/views/espace_parent.sql
```

### 7. Seeds
```bash
# Données initiales (optionnel)
psql -f database/seeds/promote_superadmin.sql
```

## 🔧 Scripts utilitaires

Les scripts JavaScript utilitaires sont maintenant dans le dossier `scripts/` à la racine du projet.

## 📝 Historique des migrations

| Date | Fichier | Description |
|------|---------|-------------|
| Initial | 001_initial_schema.sql | Schéma de base du projet |
| Phase 1 | migration_add_domaines.sql | Ajout des domaines de matières |
| Phase 1 | migration_add_annee_scolaire_notes.sql | Intégration année scolaire dans les notes |
| Phase 1 | migration_add_ecole_statut.sql | Statut des écoles (actif/suspendu/en_attente) |
| Phase 1 | migration_add_ecole_id_presences.sql | École_id dans les présences |
| Phase 1 | migration_add_mois_paiements.sql | Mois de paiement |
| Phase 2 | migration_bulletins_v2.sql | Refonte bulletins v2 |
| Phase 2 | migration_bulletins_v3.sql | Refonte bulletins v3 |
| Phase 2 | migration_bulletins_v4.sql | Refonte bulletins v4 |
| Phase 2 | migration_phase2.sql | Migration phase 2 |
| Phase 2 | migration_stabilisation_sync.sql | Stabilisation synchronisation |

## ⚠️ Notes importantes

- **Toujours tester** les migrations sur un environnement de développement avant production
- **Backup** la base de données avant d'appliquer une migration
- **Documenter** toute modification manuelle dans ce fichier
- Les fichiers `fix_*.sql` sont des correctifs ponctuels et ne doivent pas être utilisés comme migrations standard

## 🚀 Déploiement

Pour déployer en production :
1. Backup de la base de données
2. Appliquer les migrations en attente
3. Tester les fonctionnalités critiques
4. Monitorer les logs d'erreurs
