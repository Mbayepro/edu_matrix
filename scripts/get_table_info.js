const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Manually parse env variables
const envFile = path.join(__dirname, '.env.local');
const envText = fs.readFileSync(envFile, 'utf8');
const envConfig = {};
envText.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    const key = match[1];
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1);
    }
    envConfig[key] = value;
  }
});

const supabase = createClient(
  envConfig.NEXT_PUBLIC_SUPABASE_URL,
  envConfig.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  console.log("Checking if column 'niveau' exists in coefficients_matieres...");
  const { error } = await supabase.from('coefficients_matieres').select('niveau').limit(1);
  console.log("Column coefficients_matieres.niveau:", error ? `FAILED (${error.message})` : 'OK');
}

run();
