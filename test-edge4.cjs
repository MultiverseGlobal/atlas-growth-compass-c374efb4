const fs = require('fs');
const env = fs.readFileSync('.env', 'utf-8');
const url = env.match(/VITE_SUPABASE_URL=([^\n\r]+)/)[1].replace(/['\`\"]/g, '');
const key = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY=([^\n\r]+)/)[1].replace(/['\`\"]/g, '');

async function test() {
  fetch(url + '/rest/v1/kuro_pipeline_view?select=id,company&limit=1', {
    headers: {
      'apikey': key,
      'Authorization': 'Bearer ' + key
    }
  }).then(r => r.json()).then(data => {
    if (data && data.length > 0) {
      const lead_id = data[0].id;
      console.log("Found lead:", lead_id, data[0].company);
      fetch(url + '/functions/v1/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + key
        },
        body: JSON.stringify({ lead_id })
      }).then(r => r.json()).then(console.log).catch(console.error);
    } else {
      console.log("No leads found");
    }
  });
}
test();
