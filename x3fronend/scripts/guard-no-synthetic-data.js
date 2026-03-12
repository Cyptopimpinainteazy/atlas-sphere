const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const files = [
  path.join(root, "js", "x3-data-api.js"),
  path.join(root, "js", "x3-page-adapters.js"),
  path.join(root, "server.js"),
  path.join(root, "server", "site-services.js"),
];

const forbidden = [/Math\.random/, /Using fallback data/i, /simulated/i];
const failures = [];

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  const content = fs.readFileSync(file, "utf8");
  for (const pattern of forbidden) {
    if (pattern.test(content)) {
      failures.push(`${path.relative(root, file)} matched ${pattern}`);
    }
  }
}

if (failures.length > 0) {
  process.stderr.write(`Synthetic data guard failed:\n${failures.join("\n")}\n`);
  process.exit(1);
}

process.stdout.write("Synthetic data guard passed.\n");
