import * as fs from 'fs';

async function main() {
  try {
    const html = fs.readFileSync('C:\\Users\\SUDO\\Documents\\Atlas io\\scratch\\yc_page.html', 'utf8');
    
    // Find all script src links
    const srcRegex = /<script[^>]+src="([^"]+)"/gi;
    let m;
    const urls = [];
    while ((m = srcRegex.exec(html)) !== null) {
      urls.push(m[1]);
    }
    
    console.log("Found script URLs:", urls);
    
    for (const jsUrl of urls) {
      console.log("Fetching:", jsUrl);
      const res = await fetch(jsUrl);
      const text = await res.text();
      
      // Look for Algolia keys or patterns
      // App ID is typically 10 uppercase chars, key is typically 32 hex chars
      const algoliaMatches = text.match(/algolia/gi);
      if (algoliaMatches) {
        console.log(`  Found ${algoliaMatches.length} occurrences of "algolia" in ${jsUrl}`);
        
        // Search for app id & api key patterns
        const appIdMatch = text.match(/[A-Z0-9]{10}/g); // 10 chars uppercase alphanumeric
        const apiKeyMatch = text.match(/[a-f0-9]{32}/g); // 32 hex chars
        
        // Let's print snippets around "algolia"
        let pos = 0;
        while ((pos = text.indexOf("algolia", pos)) !== -1) {
          console.log("  Snippet:", text.slice(Math.max(0, pos - 150), Math.min(text.length, pos + 150)));
          pos += 7;
        }
      }
    }
  } catch (e) {
    console.error(e);
  }
}
main();
