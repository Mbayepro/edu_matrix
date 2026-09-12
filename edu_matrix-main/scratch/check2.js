const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://opvokylugwjgxbwygxgi.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9wdm9reWx1Z3dqZ3hid3lneGdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzMTU4ODgsImV4cCI6MjA4ODg5MTg4OH0.PDb3ao15BF4GTnxlkJtqopdXfQOkKAcwFrByhG-glGw'
);

async function run() {
  const { data: matieres } = await supabase.from('matieres').select('id, nom');
  console.log("All Matieres:", matieres);

  const ecoleId = matieres[0].ecole_id; // Just get some ecole

  const { data: evaluations } = await supabase.from('evaluations').select('*');
  console.log("Total evaluations:", evaluations?.length);
  console.log("Evaluations sample:", evaluations?.slice(0, 3));

  const { data: notes } = await supabase.from('notes').select('*');
  console.log("Total notes:", notes?.length);
  console.log("Notes sample:", notes?.slice(0, 3));
  
  const { data: coeff } = await supabase.from('coefficients_matieres').select('*');
  console.log("Total coeffs:", coeff?.length);
  console.log("Coeffs sample:", coeff?.slice(0, 3));
}

run().catch(console.error);
