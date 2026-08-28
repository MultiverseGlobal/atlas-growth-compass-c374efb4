import * as fs from 'fs';

const html = fs.readFileSync('C:\\Users\\SUDO\\Documents\\Atlas io\\scratch\\yc_page.html', 'utf8');
const dataPageMatch = html.match(/data-page="([^"]+)"/) || html.match(/data-page='([^']+)'/);
if (dataPageMatch) {
  console.log("Found data-page attribute!");
  const decodedJson = dataPageMatch[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  const data = JSON.parse(decodedJson);
  console.log("Inertia data structure keys:", Object.keys(data));
  if (data.props) {
    console.log("Props keys:", Object.keys(data.props));
    const companyList = data.props.companies || data.props.initialCompanies || [];
    console.log("Companies count:", companyList.length);
    if (data.props.companies) {
      console.log("Sample keys of company:", Object.keys(data.props.companies[0] || {}));
      console.log("Sample company data:", JSON.stringify(data.props.companies[0], null, 2));
    }
  }
} else {
  console.log("No data-page attribute found in the page HTML.");
  // Let's print out the body tag and its immediately surrounding content
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/);
  if (bodyMatch) {
    console.log("Body preview:", bodyMatch[1].slice(0, 1500));
  }
}
