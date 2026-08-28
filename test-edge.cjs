const fs = require('fs');
const env = fs.readFileSync('.env', 'utf-8');
const anonKey = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY="(.*)"/)[1];
const url = env.match(/VITE_SUPABASE_URL="(.*)"/)[1];
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(url, anonKey);
(async () => {
  const { data: runs } = await supabase.from('acquisition_runs').select('*').eq('status', 'running').order('created_at', { ascending: false }).limit(1);
  if (!runs || runs.length === 0) { console.log('No running acquisition runs'); return; }
  console.log('Invoking step-acquisition for run:', runs[0].id);
  const res = await supabase.functions.invoke('step-acquisition', { body: { run_id: runs[0].id } });
  console.log(JSON.stringify(res, null, 2));
})();
