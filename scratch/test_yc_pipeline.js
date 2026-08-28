async function main() {
  try {
    const filter = "recent";
    const ycIndustry = "";
    
    console.log("Fetching all.json...");
    const res = await fetch("https://yc-oss.github.io/api/companies/all.json");
    const allCompanies = await res.json();
    console.log("Total companies loaded:", allCompanies.length);
    
    // Filter
    let filtered = allCompanies;
    if (filter === "recent") {
      const recentBatches = ["Winter 2024", "Summer 2024", "Winter 2023", "Summer 2023", "W24", "S24", "W23", "S23"];
      filtered = allCompanies.filter(co => recentBatches.some(b => co.batch && co.batch.includes(b)));
    } else if (filter === "top") {
      filtered = allCompanies.filter(co => co.top_company === true);
    } else if (filter === "b2b") {
      filtered = allCompanies.filter(co => 
        (co.industry && co.industry.toLowerCase().includes("b2b")) ||
        (co.subindustry && co.subindustry.toLowerCase().includes("b2b")) ||
        (co.tags && co.tags.some(t => t.toLowerCase().includes("b2b")))
      );
    } else if (filter === "saas") {
      filtered = allCompanies.filter(co => 
        (co.subindustry && co.subindustry.toLowerCase().includes("saas")) ||
        (co.tags && co.tags.some(t => t.toLowerCase().includes("saas")))
      );
    }
    
    if (ycIndustry) {
      const indLower = ycIndustry.toLowerCase();
      filtered = filtered.filter(co => 
        (co.industry && co.industry.toLowerCase().includes(indLower)) ||
        (co.subindustry && co.subindustry.toLowerCase().includes(indLower)) ||
        (co.tags && co.tags.some(t => t.toLowerCase().includes(indLower)))
      );
    }
    
    // Sort by ID or launched_at descending to get the newest
    filtered.sort((a, b) => (b.id || 0) - (a.id || 0));
    
    console.log("Filtered companies count:", filtered.length);
    const selected = filtered.slice(0, 3);
    console.log("Selected companies:", selected.map(s => `${s.name} (${s.batch})`));
    
    // Fetch details for the first one
    const co = selected[0];
    if (co) {
      const coUrl = `https://www.ycombinator.com/companies/${co.slug}`;
      console.log("Fetching details from:", coUrl);
      const detailRes = await fetch(coUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
      });
      const html = await detailRes.text();
      const dataPageMatch = html.match(/data-page="([^"]+)"/) || html.match(/data-page='([^']+)'/);
      if (dataPageMatch) {
        const decodedJson = dataPageMatch[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
        const pageData = JSON.parse(decodedJson);
        const company = pageData.props?.company || {};
        console.log("Success! Company:", company.name);
        console.log("Website:", company.website);
        console.log("Founders count:", company.founders?.length);
        console.log("Founders:", (company.founders || []).map(f => f.full_name).join(", "));
      } else {
        console.log("Failed to match data-page on individual company profile page.");
      }
    }
  } catch (e) {
    console.error(e);
  }
}
main();
