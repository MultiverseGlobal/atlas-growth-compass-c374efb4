const fs = require('fs');
const env = fs.readFileSync('.env', 'utf-8');
const url = env.match(/VITE_SUPABASE_URL=([^\n\r]+)/)[1].replace(/['\`\"]/g, '');
const key = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY=([^\n\r]+)/)[1].replace(/['\`\"]/g, '');

fetch(url + '/functions/v1/send-email', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + key
  },
  body: JSON.stringify({ lead_id: 'dummy' })
}).then(r => r.text()).then(console.log).catch(console.error);
