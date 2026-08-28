const fetch = require("node-fetch");
async function run() {
  try {
    const res = await fetch("https://sqthvliapkauoxieiwfb.supabase.co/functions/v1/db-debug");
    const text = await res.text();
    console.log("RESULT:", text);
  } catch (e) {
    console.error(e);
  }
}
run();
