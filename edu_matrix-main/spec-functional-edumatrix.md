## Périmètre fonctionnel d’EduMatrix

### 1. Profils et rôles d’utilisateurs

- **Superadministrateur**
  - Gère le catalogue d’écoles (création, configuration, suspension).
  - Gère les abonnements (modèle SaaS), le nombre d’utilisateurs/élèves autorisés.
  - Accède à des statistiques agrégées par école (nombre d’élèves, activité, taux de paiement global).
  - Ne voit jamais de données nominatives élève (sauf si un mode « support » explicite est activé pour une école donnée).

- **Directeur / Chef d’établissement**
  - Gère la configuration de son école :
    - Année scolaire active.
    - Niveaux (CI, CP, CE1, CE2, CM1, CM2, 6e, 5e, 4e, 3e, 2nde, 1ère, Tle… selon le type d’école).
    - Classes (ex. CM2 A, CM2 B, 3e1, 3e2).
    - Horaires de début de cours (ex. 8h30), jours travaillés, jours fériés locaux.
  - Gère le personnel :
    - Création/modification/suppression de comptes enseignants.
    - Attribution des classes/matières aux enseignants.
  - Gère les élèves :
    - Inscription, changement de classe, radiation, transfert.
    - Validation des dossiers, pièces justificatives.
  - Suit les paiements :
    - Configure les frais scolaires, remises, bourses.
    - Voit les élèves non à jour de paiement.
  - Consulte les résultats :
    - Moyennes par classe, par matière.
    - Bulletins et rangs.
  - Accède au tableau de bord directeur.

- **Enseignant**
  - Se connecte avec un identifiant court (ex. `diop.fr`).
  - Voit uniquement :
    - Les classes qui lui sont affectées.
    - Les élèves de ces classes.
  - Saisit les notes :
    - Par matière, par devoir, par trimestre.
  - Enregistre les présences :
    - Par scan QR code ou par saisie manuelle.
  - Consulte les moyennes de ses classes (mais pas les informations financières).

- **Parent / Tuteur** (optionnel, phase ultérieure)
  - Accède au dossier de son enfant :
    - Notes, présences, état des paiements.
  - N’a pas d’action d’édition dans le système.

### 2. Niveaux scolaires visés

- **Phase 1 (MVP)** : primaire (CI à CM2), avec focus particulier sur CM2 (notes et moyennes selon la méthode officielle).
- **Phase 2** : extension au collège (6e à 3e).
- **Phase 3** : extension au lycée (2nde à Tle).

Les règles de calcul de moyenne sont communes, mais certains éléments (coefficients, types d’épreuves, bulletins) pourront être spécialisés par cycle.

### 3. Gestion des années scolaires et périodes

- **Année scolaire**
  - Représentée par une entité `annee_scolaire` :
    - Exemple de format : `2025-2026`.
    - Attributs : date de début, date de fin, école, état (`active`, `clôturée`, `brouillon`).
  - Une école a **toujours** au plus une année scolaire active.

- **Périodes / Trimestres**
  - Pour le primaire : 3 trimestres par défaut (`T1`, `T2`, `T3`).
  - Chaque trimestre a :
    - Une date de début / fin.
    - Un lien avec l’année scolaire et l’école.
  - Possibilité d’ajouter un type `semestre` si certaines écoles l’utilisent (collège/lycée), mais MVP centré sur le trimestre.

- **Changements de classe**
  - Un élève possède une relation `historique_classe` :
    - `date_debut`, `date_fin`, `classe`, `annee_scolaire`.
  - Les changements en cours d’année (ex. transfert de CM2 A vers CM2 B) sont tracés dans cet historique.

- **Redoublements et passages**
  - À la fin de l’année scolaire, la direction décide :
    - `redouble` : élève reste dans le même niveau l’année suivante.
    - `passe` : élève monte de niveau.
  - Cette décision est stockée dans une table d’orientation ou dans l’historique scolaire de l’élève.

### 4. Organisation pédagogique (écoles, niveaux, classes, matières)

- **École**
  - Entité de plus haut niveau, isolée des autres écoles.
  - Attributs : nom, ville, région, type (primaire, collège, lycée, mixte), horaires standards, logo, contact.

- **Niveaux**
  - Définissent le niveau scolaire (CI, CP, CE1, …, Tle).
  - Paramétrables par école :
    - Une école primaire ne configure que CI → CM2.
    - Un lycée configure 2nde → Tle.

- **Classes**
  - Exemple : `CM2 A`, `CM2 B`, `3e1`.
  - Lien avec :
    - `ecole`
    - `annee_scolaire`
    - `niveau`
  - Possibilité de définir un titulaire / maître de classe.

- **Matières**
  - Gérées par école et par niveau :
    - Exemple CM2 : Français, Mathématiques, Histoire-Géo, Sciences, Anglais, Éducation civique, etc.
  - Chaque matière a :
    - Un coefficient par niveau (ou par classe).
    - Un type (disciplinaire, comportement/discipline, activité).

### 5. Contraintes spécifiques au contexte sénégalais

- **Méthode CM2**
  - Utilisation systématique de la moyenne pondérée par coefficient.
  - Gestion des différentes catégories d’épreuves (devoirs continus, compositions).
  - Attribution de mentions standard : `Passable`, `Assez bien`, `Bien`, `Très bien`.

- **Réalisme terrain**
  - Interface utilisable sur smartphone par les enseignants.
  - Tolérance aux connexions lentes ou intermittentes : priorité aux écrans simples, peu gourmands en données.
  - Possibilité d’exporter facilement en PDF/Excel pour remise physique (bulletins, listes d’élèves, états de présence).

### 6. Hors périmètre (pour ne pas se disperser au MVP)

- Communication parentale avancée (notifications push, SMS massifs, messagerie interne).
- Gestion complète des examens nationaux (CFEE, BFEM, BAC) avec remontée officielle.
- Intégration poussée avec des systèmes externes (Sama École, systèmes du ministère, etc.).

Ces points pourront être ajoutés dans une roadmap ultérieure, une fois le noyau (présences, notes, paiements, multi‑écoles) stabilisé.

