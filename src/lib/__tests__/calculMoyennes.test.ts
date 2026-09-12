// src/lib/__tests__/calculMoyennes.test.ts
// Tests unitaires pour le calculateur de moyennes

import { CalculateurMoyennes } from '../calculMoyennes'

describe('CalculateurMoyennes', () => {
  describe('calculerMoyenneMatiereBase', () => {
    it('devrait calculer la moyenne avec CC uniquement', () => {
      const notesCC = [12, 14, 16]
      const noteComp = null
      const result = CalculateurMoyennes.calculerMoyenneMatiereBase(notesCC, noteComp, 'BLOCKS', false)
      
      expect(result.moyenne).toBe(14) // (12+14+16)/3 = 14
      expect(result.moyenne_controles).toBe(14)
    })

    it('devrait calculer la moyenne avec CC et composition', () => {
      const notesCC = [12, 14]
      const noteComp = 16
      const result = CalculateurMoyennes.calculerMoyenneMatiereBase(notesCC, noteComp, 'BLOCKS', false)
      
      // (13 + 16) / 2 = 14.5
      expect(result.moyenne).toBe(14.5)
      expect(result.moyenne_controles).toBe(13) // (12+14)/2 = 13
    })

    it('devrait calculer la moyenne primaire (sur 10)', () => {
      const notesCC = [8, 9]
      const noteComp = 10
      const result = CalculateurMoyennes.calculerMoyenneMatiereBase(notesCC, noteComp, 'BLOCKS', true)
      
      // ((8.5 + 10) / 2) / 2 = 4.625 -> arrondi à 4.63
      expect(result.moyenne).toBe(4.63)
      expect(result.moyenne_controles).toBe(4.25) // 8.5 / 2 = 4.25
    })

    it('devrait gérer les notes vides', () => {
      const notesCC: number[] = []
      const noteComp = null
      const result = CalculateurMoyennes.calculerMoyenneMatiereBase(notesCC, noteComp, 'BLOCKS', false)
      
      expect(result.moyenne).toBe(0)
      expect(result.moyenne_controles).toBe(0)
    })
  })

  describe('determinerMention', () => {
    it('devrait retourner Excellent pour >= 18', () => {
      const mention = CalculateurMoyennes['determinerMention'](18, 'moyen')
      expect(mention).toBe('Excellent')
    })

    it('devrait retourner Très bien pour >= 16', () => {
      const mention = CalculateurMoyennes['determinerMention'](16, 'moyen')
      expect(mention).toBe('Très bien')
    })

    it('devrait retourner Bien pour >= 14', () => {
      const mention = CalculateurMoyennes['determinerMention'](14, 'moyen')
      expect(mention).toBe('Bien')
    })

    it('devrait retourner Assez bien pour >= 12', () => {
      const mention = CalculateurMoyennes['determinerMention'](12, 'moyen')
      expect(mention).toBe('Assez bien')
    })

    it('devrait retourner Passable pour >= 10', () => {
      const mention = CalculateurMoyennes['determinerMention'](10, 'moyen')
      expect(mention).toBe('Passable')
    })

    it('devrait retourner Insuffisant pour < 10', () => {
      const mention = CalculateurMoyennes['determinerMention'](8, 'moyen')
      expect(mention).toBe('Insuffisant')
    })

    it('devrait calculer les mentions primaires correctement', () => {
      const mention1 = CalculateurMoyennes['determinerMention'](9, 'primaire') // 9/20 = 4.5/10
      expect(mention1).toBe('Très bien')
      
      const mention2 = CalculateurMoyennes['determinerMention'](14, 'primaire') // 14/20 = 7/10
      expect(mention2).toBe('Excellent')
    })
  })

  describe('determinerDecisionAnnuelle', () => {
    it('devrait retourner Passage pour moyenne >= 10 (moyen)', () => {
      const decision = CalculateurMoyennes['determinerDecisionAnnuelle'](12, false)
      expect(decision).toBe('Passage')
    })

    it('devrait retourner Redoublement pour moyenne entre 8.5 et 10 (moyen)', () => {
      const decision = CalculateurMoyennes['determinerDecisionAnnuelle'](9, false)
      expect(decision).toBe('Redoublement')
    })

    it('devrait retourner Exclusion pour moyenne < 8.5 (moyen)', () => {
      const decision = CalculateurMoyennes['determinerDecisionAnnuelle'](7, false)
      expect(decision).toBe('Exclusion')
    })

    it('devrait retourner Passage pour moyenne >= 5 (primaire)', () => {
      const decision = CalculateurMoyennes['determinerDecisionAnnuelle'](6, true)
      expect(decision).toBe('Passage')
    })

    it('devrait retourner Redoublement pour moyenne entre 4 et 5 (primaire)', () => {
      const decision = CalculateurMoyennes['determinerDecisionAnnuelle'](4.5, true)
      expect(decision).toBe('Redoublement')
    })

    it('devrait retourner Exclusion pour moyenne < 4 (primaire)', () => {
      const decision = CalculateurMoyennes['determinerDecisionAnnuelle'](3, true)
      expect(decision).toBe('Exclusion')
    })
  })

  describe('genererAppreciation', () => {
    it('devrait retourner Excellent pour >= 16', () => {
      const appreciation = CalculateurMoyennes['genererAppreciation'](16)
      expect(appreciation).toBe('Excellent')
    })

    it('devrait retourner Très bon pour >= 14', () => {
      const appreciation = CalculateurMoyennes['genererAppreciation'](14)
      expect(appreciation).toBe('Très bon')
    })

    it('devrait retourner Bon pour >= 12', () => {
      const appreciation = CalculateurMoyennes['genererAppreciation'](12)
      expect(appreciation).toBe('Bon')
    })

    it('devrait retourner Passable pour >= 10', () => {
      const appreciation = CalculateurMoyennes['genererAppreciation'](10)
      expect(appreciation).toBe('Passable')
    })

    it('devrait retourner Insuffisant pour >= 8', () => {
      const appreciation = CalculateurMoyennes['genererAppreciation'](8)
      expect(appreciation).toBe('Insuffisant')
    })

    it('devrait retourner Très insuffisant pour < 8', () => {
      const appreciation = CalculateurMoyennes['genererAppreciation'](6)
      expect(appreciation).toBe('Très insuffisant')
    })
  })

  describe('arrondirNote', () => {
    it('devrait arrondir à 2 décimales', () => {
      const arrondi = CalculateurMoyennes.arrondirNote(14.5678)
      expect(arrondi).toBe(14.57)
    })

    it('devrait garder les valeurs exactes si moins de 2 décimales', () => {
      const arrondi = CalculateurMoyennes.arrondirNote(14.5)
      expect(arrondi).toBe(14.5)
    })

    it('devrait arrondir correctement', () => {
      const arrondi = CalculateurMoyennes.arrondirNote(14.555)
      expect(arrondi).toBe(14.56)
    })
  })
})
