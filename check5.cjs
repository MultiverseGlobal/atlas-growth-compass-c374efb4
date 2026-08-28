const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env', 'utf-8');
const url = env.match(/VITE_SUPABASE_URL=([^\n\r]+)/)[1].replace(/['\`\"]/g, '');
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=([^\n\r]+)/) ? env.match(/SUPABASE_SERVICE_ROLE_KEY=([^\n\r]+)/)[1].replace(/['\`\"]/g, '') : null;

if (!key) {
  console.error("No service role key found in .env");
  process.exit(1);
}

const supabase = createClient(url, key);

async function check() {
  const { data, error } = await supabase.from('kuro_pipeline_view').select('id, company, is_contacted, stage').order('created_at', { ascending: false }).limit(5);
  console.log("Recent leads:", data);
  if (error) console.error(error);
}
check();
