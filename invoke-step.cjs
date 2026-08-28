const fs = require('fs');
const env = fs.readFileSync('.env', 'utf-8');
const key = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY=([^\n\r]+)/)[1].replace(/['\`\"]/g, '');

async function run() {
  try {
    const res = await fetch("https://sqthvliapkauoxieiwfb.supabase.co/functions/v1/step-acquisition", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ run_id: "c53045e6-214f-456c-99f0-ddc7358342cc" })
    });
    console.log("STATUS:", res.status);
    const text = await res.text();
    console.log("RESULT:", text);
  } catch (e) {
    console.error(e);
  }
}
run();
