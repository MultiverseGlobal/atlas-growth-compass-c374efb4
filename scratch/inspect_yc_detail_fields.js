async function main() {
  try {
    const res = await fetch("https://yc-oss.github.io/api/batches/winter-2012/circuithub.json");
    const data = await res.json();
    for (const key of Object.keys(data)) {
      console.log(`${key}:`, typeof data[key] === 'object' ? JSON.stringify(data[key]).slice(0, 100) : data[key]);
    }
  } catch (e) {
    console.error(e);
  }
}
main();
