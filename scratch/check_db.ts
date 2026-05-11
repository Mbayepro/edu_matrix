import { supabase } from './src/lib/supabase'

async function check() {
  const { data: levels } = await supabase.from('niveaux').select('*')
  console.log('Levels:', levels)
  
  const { data: coeffs } = await supabase.from('coefficients_matieres').select('*')
  console.log('Coefficients:', coeffs)
}

check()
