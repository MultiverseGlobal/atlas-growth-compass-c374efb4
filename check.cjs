const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env', 'utf-8');
const url = env.match(/VITE_SUPABASE_URL=([^\n\r]+)/)[1].replace(/['\`\"]/g, '');
const key = env.match(/VITE_SUPABASE_ANON_KEY=([^\n\r]+)/)[1].replace(/['\`\"]/g, '');

const supabase = createClient(url, key);

async function check() {
  const { data, error } = await supabase.from('kuro_pipeline_view').select('company, is_contacted, stage').eq('company', 'KWSM Social Media & Content Marketing');
  console.log(data, error);
}
check();
