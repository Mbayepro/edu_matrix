## Spécification du module de notes, moyennes et bulletins

### 1. Modèle de données des notes

- **Table `matieres`**
  - Colonnes principales :
    - `id uuid primary key`
    - `ecole_id uuid not null`
    - `nom text not null` (ex. Français, Mathématiques)
    - `code text` (optionnel, ex. FR, MATH)
    - `niveau text` (CI, CP, …, Tle) ou lien vers un niveau si on normalise
    - `coefficient integer not null default 1`
    - `is_active boolean default true`

- **Table `evaluations`** (contrôle, devoir, composition)
  - `id uuid primary key`
  - `ecole_id uuid not null`
  - `classe_id uuid not null`
  - `matiere_id uuid not null`
  - `trimestre integer not null check (trimestre in (1,2,3))`
  - `type text check (type in ('controle', 'devoir', 'composition'))`
  - `date date not null`
  - `coef numeric not null default 1` (poids de l’évaluation dans la moyenne de la matière)
  - `bareme numeric not null default 20`

- **Table `notes`**
  - `id uuid primary key`
  - `ecole_id uuid not null`
  - `eleve_id uuid not null`
  - `evaluation_id uuid not null`
  - `note numeric not null`
  - `created_at timestamptz default now()`
  - Index :
    - `(eleve_id, evaluation_id)` unique pour éviter les doublons.

### 2. Calcul des moyennes (méthode CM2 généralisée)

- **Moyenne par matière pour un élève et un trimestre**
  - Basée sur l’ensemble des `notes` reliées à des `evaluations` de cette matière sur le trimestre.
  - Formule :
    - \[
      Moyenne\_matiere = \frac{\sum (note_i \times coef\_eval_i)}{\sum coef\_eval_i}
      \]

- **Moyenne générale de l’élève (trimestre)**
  - À partir des moyennes par matière et des coefficients de chaque matière (`matieres.coefficient`) :
    - \[
      Moyenne\_generale = \frac{\sum (Moyenne\_matiere\_j \times coef\_matiere\_j)}{\sum coef\_matiere\_j}
      \]

- **Fonction Postgres dédiée**
  - `calculate_moyenne_ponderee(p_eleve_id uuid, p_trimestre int) returns numeric`
    - Implémente la formule ci‑dessus côté base.
    - Utilisée pour les rapports et éventuellement dans le dashboard.

### 3. Mentions automatiques

- **Seuils**
  - `< 10` : Insuffisant (pas de mention sur bulletin, ou « Ajourné » selon contexte local).
  - `10–11,99` : `Passable`.
  - `12–13,99` : `Assez bien`.
  - `14–15,99` : `Bien`.
  - `>= 16` : `Très bien`.

- La mention est calculée à partir de la moyenne générale de l’élève au trimestre.

### 4. Bulletins trimestriels

- **Contenu du bulletin**
  - En‑tête :
    - Logo de l’école, nom, adresse, contacts.
    - Année scolaire, trimestre.
  - Informations élève :
    - Nom, prénom, date de naissance (optionnel).
    - Matricule.
    - Classe et niveau.
  - Tableau des matières :
    - Colonnes : `Matière`, `Coeff`, `Moyenne / 20`, `Appréciation` (optionnelle).
  - Synthèse :
    - Moyenne générale / 20.
    - Mention.
    - Rang dans la classe (phase 2).
  - Bas de page :
    - Logo, tampon et signature du directeur (provenant de la page Paramètres).
    - Date d’édition.

- **Modèle d’export**
  - Génération côté frontend (React) :
    - Mise en page CSS optimisée pour impression A4 (portrait).
    - Bouton « Imprimer / Télécharger en PDF » dans l’interface.

### 5. Écrans de saisie de notes

- **Vue enseignant — Saisie par classe et matière**
  - Sélection :
    - Classe.
    - Matière.
    - Trimestre.
  - Liste des élèves de la classe, avec :
    - Colonnes pour chaque évaluation (ou un écran par évaluation).
    - Champ de saisie de la note pour chaque élève.
  - Boutons :
    - Enregistrer (création/mise à jour des lignes `notes`).
    - Dupliquer les évaluations d’une autre classe (phase ultérieure).

- **Validation par la direction (optionnelle, phase 2)**
  - Le directeur peut verrouiller les notes d’un trimestre une fois les bulletins prêts, pour éviter des modifications a posteriori.

### 6. Rapports et exports

- **Pour le directeur**
  - Liste des moyennes par classe et par trimestre :
    - Moyenne de la classe.
    - Répartition des mentions (`Passable`, `Assez bien`, etc.).
  - Export CSV/Excel :
    - Détail des notes ou seulement les moyennes.

- **Pour l’enseignant**
  - Vue synthétique de ses classes :
    - Moyenne de la classe par matière.
    - Nombre d’élèves en difficulté (moyenne < 10).

