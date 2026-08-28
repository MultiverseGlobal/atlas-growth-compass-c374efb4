async function main() {
  try {
    const res = await fetch("https://yc-oss.github.io/api/companies/all.json");
    console.log("Status:", res.status);
    const data = await res.json();
    console.log("Total companies:", data.length);
    console.log("Sample:", JSON.stringify(data.slice(0, 2), null, 2));
  } catch (e) {
    console.error(e);
  }
}
main();
