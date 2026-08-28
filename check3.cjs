const fs = require('fs');
const env = fs.readFileSync('.env', 'utf-8');
const url = env.match(/VITE_SUPABASE_URL=([^\n\r]+)/)[1].replace(/['\`\"]/g, '');
const key = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY=([^\n\r]+)/)[1].replace(/['\`\"]/g, '');

fetch(url + '/rest/v1/kuro_pipeline_view?select=company,is_contacted,stage', {
  headers: {
    'apikey': key,
    'Authorization': 'Bearer ' + key
  }
}).then(r => r.json()).then(data => {
  const kwsm = data.find(d => d.company.includes('KWSM'));
  console.log('KWSM Status:', kwsm);
}).catch(console.error);
