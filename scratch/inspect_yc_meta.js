async function main() {
  try {
    const res = await fetch("https://yc-oss.github.io/api/meta.json");
    console.log("Status:", res.status);
    const data = await res.json();
    console.log("Meta data keys:", Object.keys(data));
    console.log("Batches list:", data.batches);
    console.log("Industries list:", data.industries);
  } catch (e) {
    console.error(e);
  }
}
main();
