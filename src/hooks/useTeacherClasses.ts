import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export interface TeacherAssignation {
  classe_id: string
  matiere_id: string | null
}

interface UseTeacherClassesResult {
  assignations: TeacherAssignation[]
  classeIds: string[]
  /** Returns the list of matiere_ids assigned to a given classe, or null = all */
  getMatiereIdsForClasse: (classeId: string) => string[] | null
  loading: boolean
}

/**
 * Hook to load only the classes & subjects assigned to a teacher.
 * Returns an empty list if profileId is null (not a teacher).
 */
export function useTeacherClasses(
  profileId: string | null | undefined
): UseTeacherClassesResult {
  const [assignations, setAssignations] = useState<TeacherAssignation[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!profileId) {
      setAssignations([])
      return
    }
    let cancelled = false
    setLoading(true)

    supabase
      .from('enseignants_classes')
      .select('classe_id, matiere_id')
      .eq('enseignant_id', profileId)
      .then(({ data, error }: { data: TeacherAssignation[] | null; error: { message: string } | null }) => {
        if (cancelled) return
        if (error) {
          console.error('[useTeacherClasses] error:', error)
          setAssignations([])
        } else {
          setAssignations((data ?? []) as TeacherAssignation[])
        }
        setLoading(false)
      })

    return () => { cancelled = true }
  }, [profileId])

  const classeIds = Array.from(new Set(assignations.map((a) => a.classe_id)))

  function getMatiereIdsForClasse(classeId: string): string[] | null {
    const matieres = assignations
      .filter((a) => a.classe_id === classeId && a.matiere_id)
      .map((a) => a.matiere_id as string)
    return matieres.length > 0 ? matieres : null
  }

  return { assignations, classeIds, getMatiereIdsForClasse, loading }
}
