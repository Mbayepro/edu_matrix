const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://opvokylugwjgxbwygxgi.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9wdm9reWx1Z3dqZ3hid3lneGdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzMTU4ODgsImV4cCI6MjA4ODg5MTg4OH0.PDb3ao15BF4GTnxlkJtqopdXfQOkKAcwFrByhG-glGw'
);

async function run() {
  console.log("Fetching matieres...");
  const { data: matieres } = await supabase.from('matieres').select('id, nom').ilike('nom', '%anglais%');
  console.log("Matieres Anglais:", matieres);

  if (!matieres || matieres.length === 0) return;
  const anglaisId = matieres[0].id;

  console.log("Fetching evaluations...");
  const { data: evaluations } = await supabase.from('evaluations').select('*').eq('matiere_id', anglaisId);
  console.log("Evaluations:", evaluations);

  if (!evaluations || evaluations.length === 0) return;

  const evalIds = evaluations.map(e => e.id);
  
  console.log("Fetching notes...");
  const { data: notes } = await supabase.from('notes').select('*').in('evaluation_id', evalIds);
  console.log("Notes count:", notes?.length);
  console.log("Notes:", notes);

  console.log("Fetching coefficients for Anglais...");
  const { data: coeffs } = await supabase.from('coefficients_matieres').select('*').eq('matiere_id', anglaisId);
  console.log("Coefficients:", coeffs);
}

run().catch(console.error);
