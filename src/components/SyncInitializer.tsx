'use client'

// src/components/SyncInitializer.tsx
// Composant invisible qui déclenche le pull initial Supabase → Dexie
// au chargement du dashboard si le réseau est disponible
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect } from 'react'
import { syncFromSupabase } from '@/lib/syncService'
import { supabase } from '@/lib/supabase'

export default function SyncInitializer() {
  useEffect(() => {
    async function initSync() {
      if (!navigator.onLine) return

      // Récupère l'école de l'utilisateur courant
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await (supabase
        .from('profiles')
        .select('ecole_id')
        .eq('user_id', user.id)
        .single() as any)

      if (!profile?.ecole_id) return

      // Pull en arrière-plan — ne bloque pas le rendu
      syncFromSupabase(profile.ecole_id).catch(console.error)
    }

    initSync()
  }, [])

  // Ce composant ne rend rien — il gère uniquement le cycle de vie
  return null
}
