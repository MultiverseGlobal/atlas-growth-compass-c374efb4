const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env', 'utf-8');
const url = env.match(/VITE_SUPABASE_URL=([^\n\r]+)/)[1].replace(/['\`\"]/g, '');
const key = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY=([^\n\r]+)/)[1].replace(/['\`\"]/g, '');

const supabase = createClient(url, key);

async function check() {
  const { data, error } = await supabase.from('acquisition_runs').select('status, current_stage, current_lead_id');
  console.log("RUNS:", data);
  
  const { data: leads } = await supabase.from('kuro_pipeline_view').select('company, is_contacted, stage');
  console.log("LEADS:", leads);
}
check();
