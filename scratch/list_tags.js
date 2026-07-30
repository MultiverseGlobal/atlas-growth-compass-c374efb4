import * as fs from 'fs';

const html = fs.readFileSync('C:\\Users\\SUDO\\Documents\\Atlas io\\scratch\\yc_page.html', 'utf8');

// Find all tags: script, link, etc.
const tagRegex = /<(script|link)[^>]+>/gi;
let m;
while ((m = tagRegex.exec(html)) !== null) {
  console.log(m[0]);
}
