export async function syncProspectToAttio(prospect: any) {
  const apiKey = import.meta.env.VITE_ATTIO_API_KEY;
  if (!apiKey) {
    console.warn("ATTIO_API_KEY is missing. Skipping CRM sync.");
    return;
  }

  try {
    const response = await fetch("https://api.attio.com/v2/objects/companies/records", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: {
          values: {
            name: [{ value: prospect.companyName }],
            domains: [{ value: prospect.domain }],
            description: [{ value: prospect.painHypothesis }]
          }
        }
      })
    });
    
    if (!response.ok) {
      throw new Error(`Attio API Error: ${response.statusText}`);
    }
    
    console.log("Successfully synced prospect to Attio:", prospect.companyName);
    return await response.json();
  } catch (error) {
    console.error("Failed to sync prospect to Attio:", error);
    throw error;
  }
}

