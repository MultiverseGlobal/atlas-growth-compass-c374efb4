async function run() {
  const mapId = "ea682ed9-3546-4866-8d83-9fd17f694a28";
  const anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxdGh2bGlhcGthdW94aWVpd2ZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMxNzA5ODgsImV4cCI6MjA5ODc0Njk4OH0.gHFtw1hTFnMaFduW-fmM3E2Vmjl6JeGwPft6uNvgl9Y";
  const url = `https://sqthvliapkauoxieiwfb.supabase.co/functions/v1/sync-github`;

  console.log("Calling sync-github...");
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": anonKey,
        "Authorization": `Bearer ${anonKey}`
      },
      body: JSON.stringify({
        map_id: mapId,
        repo_full_name: "MultiverseGlobal/atlas-growth-compass-c374efb4"
      })
    });

    console.log("Status:", res.status);
    const bodyText = await res.text();
    console.log("Response Body:", bodyText);
  } catch (e) {
    console.error("Fetch failed:", e);
  }
}

run();
