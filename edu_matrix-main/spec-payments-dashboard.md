## Spécification du module de paiements et tableau de bord

### 1. Modèle de données des frais et paiements

- **Table `frais_scolaires`**
  - `id uuid primary key`
  - `ecole_id uuid not null`
  - `libelle text not null` (ex. Scolarité annuelle, Frais d’inscription, Transport)
  - `montant numeric(10,2) not null`
  - `frequence text check (frequence in ('unique', 'mensuel', 'trimestriel')) default 'unique'`
  - `niveau text null` (si le frais ne s’applique qu’à certains niveaux)
  - `is_active boolean default true`

- **Table `eleves_frais`**
  - Relie un élève à un frais donné (utile pour remises/bourses).
  - `id uuid primary key`
  - `ecole_id uuid not null`
  - `eleve_id uuid not null`
  - `frais_id uuid not null`
  - `montant_du numeric(10,2) not null`
  - `montant_remise numeric(10,2) not null default 0`
  - `montant_a_payer numeric(10,2) not null` (montant_du - remise)

- **Table `paiements`**
  - `id uuid primary key`
  - `ecole_id uuid not null`
  - `eleve_id uuid not null`
  - `frais_id uuid not null`
  - `montant numeric(10,2) not null`
  - `mode text` (espèces, chèque, virement, mobile money…)
  - `reference text` (numéro de reçu, ref transaction)
  - `date_paiement date not null default current_date`
  - `created_at timestamptz not null default now()`

- **Statut de paiement de l’élève**
  - Champ `statut_paiement` déjà présent sur `eleves` :
    - `payé`, `impayé`, `partiel`.
  - Peut être recalculé en fonction de la somme des `paiements` par rapport au total dû dans `eleves_frais`.

### 2. Écrans de gestion des paiements

- **Vue directeur — Configuration des frais**
  - Page « Paramètres > Frais » :
    - Liste des `frais_scolaires` avec possibilité de créer/éditer/désactiver :
      - Saisir libellé, montant, fréquence, niveau ciblé.
  - Option pour appliquer un frais à tous les élèves d’un niveau/classe (création en masse dans `eleves_frais`).

- **Vue directeur / comptable — Saisie des paiements**
  - Filtrer par :
    - Nom d’élève, classe, statut de paiement.
  - Pour un élève :
    - Voir la liste des frais dus (via `eleves_frais`).
    - Voir l’historique des paiements.
    - Bouton « Enregistrer un paiement » :
      - Choix du frais payé.
      - Montant réglé.
      - Mode de paiement.
      - Référence.

### 3. Indicateurs pour le tableau de bord

- **KPI directeur (par école)**
  - `Nombre total d’élèves` (déjà dans le dashboard actuel).
  - `Nombre d’élèves non à jour de paiement` :
    - Élèves dont la somme des paiements < somme des montants à payer dans `eleves_frais`.
  - `Montant total dû` vs `Montant total encaissé` sur la période (année scolaire ou mois).
  - `Taux de recouvrement` :
    - \[
      Taux\_recouvrement = \frac{Montant\_encaissé}{Montant\_dû} \times 100
      \]

- **Graphiques**
  - Évolution des encaissements par mois (barres ou ligne).
  - Répartition des statuts de paiement :
    - part du nombre d’élèves `payé`, `partiel`, `impayé`.

### 4. Rapports et exports financiers

- **Exports CSV/Excel**
  - Liste des élèves avec :
    - Montant total dû.
    - Montant payé.
    - Reste à payer.
    - Statut.
  - Liste des paiements sur une période donnée :
    - Date, élève, frais, montant, mode, référence.

- **Filtrage par période**
  - Filtrer par :
    - Mois.
    - Trimestre.
    - Année scolaire.

