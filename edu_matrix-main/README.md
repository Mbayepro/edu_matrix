# EduMatrix - Système de Gestion Scolaire pour le Sénégal

Plateforme moderne de gestion scolaire conçue spécifiquement pour le curriculum éducatif sénégalais, couvrant tous les niveaux du CI (Cours Initial) à la Terminale.

## 🎯 Fonctionnalités Principales

### 📊 Gestion des Bulletins Scolaires
- **Calcul automatique des moyennes** avec coefficients dynamiques
- **Support des séries** (S1, S2, L1, L2, G, T) pour le secondaire
- **Mentions selon barème sénégalais** (Insuffisant, Passable, Assez Bien, Bien, Très Bien)
- **Génération PDF** des bulletins adaptés par cycle

### 🏫 Gestion des Établissements
- **Multi-écoles** avec isolation complète des données
- **Gestion des cycles** : Primaire, Moyen, Secondaire
- **Configuration des coefficients** par niveau et série

### 👥 Gestion des Utilisateurs
- **Rôles** : Superadmin, Directeur, Enseignant
- **Sécurité inter-cycles** (un prof de lycée ne peut pas voir les notes du primaire)
- **Row Level Security (RLS)** avec Supabase

### 💰 Gestion Financière
- **Frais scolaires** avec configuration flexible
- **Suivi des paiements** par élève
- **Rapports financiers**

### 📝 Suivi Pédagogique
- **Saisie des notes** avec validation temps réel
- **Évaluations** (contrôles, devoirs, compositions)
- **Présence** et assiduité

## 🛠 Stack Technique

### Frontend
- **Next.js 14** avec App Router
- **TypeScript** pour la sécurité du typage
- **Tailwind CSS** pour le design moderne
- **Lucide React** pour les icônes

### Backend
- **Supabase** (PostgreSQL + Auth + RLS)
- **Base de données optimisée** avec vues SQL
- **Fonctions stockées** pour les calculs complexes

### Développement
- **ESLint + Prettier** pour la qualité du code
- **TypeScript Strict** pour éviter les erreurs
- **Git Hooks** pour la validation automatique

## 📁 Structure du Projet

```
src/
├── app/                    # Next.js App Router
│   ├── dashboard/         # Tableau de bord
│   ├── notes/            # Gestion des notes
│   └── payments/         # Gestion des paiements
├── components/            # Composants React
│   ├── ui/               # Composants réutilisables
│   ├── forms/            # Formulaires
│   └── layout/           # Layouts
├── lib/                  # Utilitaires
│   ├── supabase.ts       # Client Supabase
│   ├── types.ts          # Types TypeScript
│   └── utils.ts          # Fonctions utilitaires
└── hooks/                # Hooks React personnalisés
```

## 🚀 Installation

### Prérequis
- Node.js 18+ 
- npm ou yarn
- Compte Supabase

### Installation locale
```bash
# Cloner le projet
git clone <repository-url>
cd edu-matrix

# Installer les dépendances
npm install

# Configurer les variables d'environnement
cp .env.example .env.local
# Éditer .env.local avec vos clés Supabase

# Lancer le serveur de développement
npm run dev
```

### Configuration Supabase
1. **Créer un projet** sur [supabase.com](https://supabase.com)
2. **Exécuter les scripts SQL** dans l'ordre :
   - `schema.sql` - Structure de la base
   - `coeficients.sql` - Configuration des coefficients
   - `rls polices.sql` - Politiques de sécurité
   - `triggers.sql` - Triggers automatiques
3. **Configurer l'authentification** avec les providers souhaités
4. **Copier les clés** dans `.env.local`

## 📊 Base de Données

### Tables Principales
- `ecoles` - Informations des établissements
- `classes` - Classes et niveaux
- `eleves` - Informations des élèves
- `matieres` - Matières enseignées
- `coefficients_niveaux` - Coefficients par niveau/série
- `notes` - Notes des élèves
- `evaluations` - Évaluations et contrôles

### Vues Optimisées
- `v_moyennes_coefficients` - Calcul des moyennes
- `v_moyennes_generales` - Bulletins complets

## 🔐 Sécurité

### Row Level Security (RLS)
- **Isolation des écoles** : Chaque école ne voit que ses données
- **Contrôle d'accès par rôle** : Permissions granulaires
- **Sécurité inter-cycles** : Protection entre primaire/moyen/secondaire

### Authentification
- **JWT Tokens** avec Supabase Auth
- **Middleware Next.js** pour la protection des routes
- **Sessions sécurisées** avec httpOnly cookies

## 🎨 Design System

### Composants UI
- **Design moderne** avec Tailwind CSS
- **Responsive design** pour mobile/desktop
- **Accessibilité** WCAG 2.1 AA
- **Mode sombre/clair** (optionnel)

### Charts et Visualisations
- **Récharts** pour les graphiques
- **Tableaux interactifs** avec tri/filtrage
- **Export PDF/Excel** des rapports

## 📱 Fonctionnalités par Cycle

### Primaire (CI - CM2)
- **Évaluation fondamentale** (lecture, écriture, calcul)
- **Notes de conduite** et appréciations
- **Bulletins simplifiés** adaptés aux parents

### Moyen (6ème - 3ème)
- **Préparation BFEM** avec coefficients spécifiques
- **Évaluations normalisées**
- **Suivi de l'orientation**

### Secondaire (Seconde - Terminale)
- **Gestion des séries** (S1, S2, L1, L2, G, T)
- **Coefficients dynamiques** par spécialité
- **Préparation Baccalauréat**

## 🚀 Déploiement

### Production (Vercel)
```bash
# Build pour production
npm run build

# Déploiement sur Vercel
vercel --prod
```

### Variables d'environnement
```env
NEXT_PUBLIC_SUPABASE_URL=votre_url_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=votre_cle_anon
SUPABASE_SERVICE_ROLE_KEY=votre_cle_service
```

## 🧪 Tests

### Tests Unitaires
```bash
npm run test
```

### Tests E2E
```bash
npm run test:e2e
```

### Linter
```bash
npm run lint
npm run lint:fix
```

## 📝 Documentation

- **[Architecture du système](./spec-architecture.md)**
- **[Spécifications fonctionnelles](./spec-functional-edumatrix.md)**
- **[Guide des bulletins](./spec-grades-reports.md)**
- **[Documentation paiements](./spec-payments-dashboard.md)**

## 🤝 Contribution

1. Fork le projet
2. Créer une branche `feature/nouvelle-fonctionnalite`
3. Commit les changements
4. Push vers la branche
5. Créer une Pull Request

## 📄 Licence

Ce projet est sous licence MIT - voir le fichier [LICENSE](LICENSE) pour détails.

## 📞 Support

Pour toute question ou support technique :
- **Issues GitHub** : Signaler les bugs
- **Documentation** : Consulter les specs techniques
- **Email** : support@edumatrix.sn

---

**EduMatrix** - Moderniser l'éducation au Sénégal avec la technologie 🇸🇳
