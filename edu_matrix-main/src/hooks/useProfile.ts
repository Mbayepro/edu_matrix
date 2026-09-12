import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Profile, Ecole } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

export function useProfile() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [ecole, setEcole] = useState<Ecole | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const loadProfile = async () => {
    try {
      setLoading(true)
      const { data: { user: supabaseUser }, error: authError } = await supabase.auth.getUser()
      
      if (authError) throw authError
      
      if (!supabaseUser) {
        setLoading(false)
        return
      }

      setUser(supabaseUser)

      const { data: prof, error: profError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', supabaseUser.id)
        .single() as { data: Profile | null; error: any }

      if (profError) throw profError
      if (prof) {
        setProfile(prof as Profile)
        if (prof.ecole_id) {
          const { data: ec, error: ecError } = await supabase
            .from('ecoles')
            .select('*')
            .eq('id', prof.ecole_id)
            .single() as { data: Ecole | null; error: any }
            
          if (ecError) throw ecError
          setEcole(ec as Ecole)
        }
      }
    } catch (err: any) {
      console.error('Error fetching profile:', err)
      setError(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProfile()
  }, [])

  return { user, profile, ecole, loading, error, reload: loadProfile }
}
