import * as fs from 'fs';

const url = "https://www.ycombinator.com/companies?batch=W24";
async function main() {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      }
    });
    const text = await res.text();
    fs.writeFileSync('C:\\Users\\SUDO\\Documents\\Atlas io\\scratch\\yc_page.html', text);
    console.log("Saved HTML to scratch/yc_page.html");
    
    // Find script tags
    const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
    let m;
    let count = 0;
    while ((m = scriptRegex.exec(text)) !== null) {
      count++;
      console.log(`Script ${count}:`, m[0].slice(0, 100) + "...");
    }
  } catch (e) {
    console.error(e);
  }
}
main();
