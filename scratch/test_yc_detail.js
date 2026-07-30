async function main() {
  try {
    const res = await fetch("https://yc-oss.github.io/api/batches/winter-2012/circuithub.json");
    console.log("Status:", res.status);
    const data = await res.json();
    console.log("Keys of detail page:", Object.keys(data));
    console.log("Founders:", JSON.stringify(data.founders, null, 2));
  } catch (e) {
    console.error(e);
  }
}
main();
