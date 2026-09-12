// src/lib/dateUtils.ts

/**
 * Retourne la date du jour au format YYYY-MM-DD (Standard utilisé pour la base de données).
 * Utilise l'heure UTC pour garantir la cohérence avec le scanner de présences et Supabase.
 */
export function getTodayDate(): string {
  return new Date().toISOString().split('T')[0]
}

/**
 * Formate une date (chaîne ISO ou objet Date) en format français court (ex: 17/04/2026).
 */
export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '—'
  try {
    return new Date(date).toLocaleDateString('fr-FR')
  } catch (e) {
    return '—'
  }
}

/**
 * Formate une date en format français long (ex: vendredi 17 avril 2026).
 */
export function formatDateLong(date: string | Date | null | undefined): string {
  if (!date) return '—'
  try {
    return new Date(date).toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  } catch (e) {
    return '—'
  }
}

/**
 * Formate une date en mois et année (ex: avril 2026).
 */
export function formatMonthYear(date: string | Date | null | undefined): string {
  if (!date) return '—'
  try {
    return new Date(date).toLocaleDateString('fr-FR', {
      month: 'long',
      year: 'numeric'
    })
  } catch (e) {
    return '—'
  }
}

/**
 * Formate une date avec l'heure en format français (ex: 17/04/2026 à 14:30).
 */
export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return '—'
  try {
    const d = new Date(date)
    return `${d.toLocaleDateString('fr-FR')} à ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
  } catch (e) {
    return '—'
  }
}
