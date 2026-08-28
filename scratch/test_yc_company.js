async function main() {
  try {
    const res = await fetch("https://www.ycombinator.com/companies/circuithub", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });
    console.log("Status:", res.status);
    const text = await res.text();
    console.log("Length:", text.length);
    // Let's search for "Founders" or "founder" or some names like "Andrew" or "CircuitHub"
    console.log("Does it contain Andrew?", text.includes("Andrew"));
    console.log("Does it contain Founders?", text.toLowerCase().includes("founder"));
    
    // Find all links or text that could represent founders
    const dataPageMatch = text.match(/data-page="([^"]+)"/) || text.match(/data-page='([^']+)'/);
    if (dataPageMatch) {
      const decodedJson = dataPageMatch[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
      const data = JSON.parse(decodedJson);
      console.log("Inertia props keys:", Object.keys(data.props || {}));
      if (data.props && data.props.company) {
        console.log("Company keys:", Object.keys(data.props.company));
        console.log("Company founders:", JSON.stringify(data.props.company.founders, null, 2));
      }
    }
  } catch (e) {
    console.error(e);
  }
}
main();
