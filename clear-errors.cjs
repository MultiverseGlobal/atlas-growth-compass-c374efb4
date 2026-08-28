const fs = require('fs');
const env = fs.readFileSync('.env', 'utf-8');
const url = env.match(/VITE_SUPABASE_URL=([^\n\r]+)/)[1].replace(/['\`\"]/g, '');
const key = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY=([^\n\r]+)/)[1].replace(/['\`\"]/g, '');

async function run() {
  try {
    const res = await fetch(`${url}/rest/v1/kuro_pipeline_view?outreach_draft=ilike.%25error%25`, {
      headers: {
        "apikey": key,
        "Authorization": `Bearer ${key}`
      }
    });
    const data = await res.json();
    if (data && data.length > 0) {
      for (const lead of data) {
        await fetch(`${url}/rest/v1/kuro_pipeline_view?id=eq.${lead.id}`, {
          method: "PATCH",
          headers: {
            "apikey": key,
            "Authorization": `Bearer ${key}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ outreach_draft: null })
        });
        console.log('Cleared error draft for', lead.company);
      }
    } else {
      console.log('No error drafts found using ilike');
    }
  } catch (e) {
    console.error(e);
  }
}
run();
