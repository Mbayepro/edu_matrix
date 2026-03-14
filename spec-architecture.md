## Architecture technique d’EduMatrix

### 1. Vue d’ensemble

- **Frontend** : Next.js 14 (App Router) déployé sur Vercel.
- **Backend/API** : accès direct à Supabase (PostgreSQL + Auth + Storage) via `@supabase/supabase-js` côté client.
- **Base de données** : PostgreSQL géré par Supabase, avec RLS pour l’isolation multi‑école.
- **Auth** : Supabase Auth (email + mot de passe), avec identifiants courts transformés en email valide côté frontend.
- **Stockage de fichiers** : Supabase Storage (photos élèves, éventuellement cartes/bulletins).

### 2. Schéma BDD (rappel simplifié)

- Tables principales :
  - `ecoles` (informations établissement).
  - `profiles` (liaison utilisateur ↔ école + rôle).
  - `classes`, `eleves`, `notes`, `presences`.
  - (Optionnel/phase suivante) `frais_scolaires`, `eleves_frais`, `paiements`.
- Helpers :
  - `matricule_sequences` pour les matricules `EM-YY-XXXX`.
- Fonctions :
  - `get_my_ecole_id()`, `get_my_role()` (SECURITY DEFINER).
  - `calculate_moyenne_ponderee(p_eleve_id, p_trimestre)`.
- Fichiers SQL :
  - `schema.sql` : tables + index.
  - `triggers.sql` : triggers matricule + création profil + fonctions helpers.
  - `rls polices.sql` : toutes les politiques RLS.

### 3. Intégration Vercel / Supabase

- Variables d’environnement :
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Le client Supabase est créé dans `src/lib/supabase.ts` en mode browser.
- Vercel :
  - Build Next.js via `npm run build`.
  - Déploiement automatique sur push (si Git est configuré).

### 4. Authentification et identifiants courts

- Côté frontend :
  - Un champ unique « identifiant » sur l’écran de login.
  - Si l’utilisateur saisit un texte sans `@` :
    - On le transforme en `identifiant@edumatrix.local` avant l’appel à `supabase.auth.signInWithPassword`.
  - Si l’utilisateur saisit un email complet, on l’utilise tel quel.

### 5. Sécurité et sauvegardes

- **RLS** :
  - Activé sur toutes les tables métiers.
  - Règles basées sur `get_my_ecole_id()` et `get_my_role()`.
- **Permissions** :
  - Seul le rôle `superadmin` a un accès complet à toutes les écoles.
  - Le directeur ne voit que son école.
  - L’enseignant ne voit que son école (et ses classes côté UI).
- **Sauvegardes** :
  - Supabase fournit des backups automatiques (selon le plan).
  - Recommandation : exporter régulièrement les données critiques (élèves, notes, présences, paiements) au format CSV pour archivage local.

### 6. Logging et monitoring

- Logs d’application :
  - Next.js sur Vercel (logs runtime).
- Logs base de données :
  - Logs Supabase pour les requêtes lentes ou en erreur.
- (Optionnel) Table `audit_logs` pour tracer les actions sensibles (modification notes, suppression élève…).

