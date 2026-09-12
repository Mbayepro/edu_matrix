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
  console.log("Fetching schools...");
  const { data, error } = await supabase
    .from('ecoles')
    .select('id, nom, ville, statut');
  if (error) {
    console.error("Error:", error);
  } else {
    console.log("Schools list:");
    console.log(JSON.stringify(data, null, 2));
  }
}

run();
