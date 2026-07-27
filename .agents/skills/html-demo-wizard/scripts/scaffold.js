#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

// Get output file argument
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error(
    "Error: Please specify the target file path.\nUsage: node scaffold.js <output-path.html>",
  );
  process.exit(1);
}

const targetPath = path.resolve(process.cwd(), args[0]);

// Paths within the skill folder
const templatePath = path.join(__dirname, "..", "resources", "template.html");

if (!fs.existsSync(templatePath)) {
  console.error(`Error: Resource template not found at: ${templatePath}`);
  process.exit(1);
}

// Read template
let templateContent = "";
try {
  templateContent = fs.readFileSync(templatePath, "utf8");
} catch (err) {
  console.error(`Error reading template: ${err.message}`);
  process.exit(1);
}

// Ensure target directory exists
const targetDir = path.dirname(targetPath);
if (!fs.existsSync(targetDir)) {
  try {
    fs.mkdirSync(targetDir, { recursive: true });
  } catch (err) {
    console.error(`Error creating directory ${targetDir}: ${err.message}`);
    process.exit(1);
  }
}

// Write file
try {
  fs.writeFileSync(targetPath, templateContent, "utf8");
  console.log(
    `\x1b[32m✔ Scaffolded HTML Demo successfully at: ${targetPath}\x1b[0m`,
  );
  console.log(
    `Run local dev server or open it in browser to customize pages and timeline steps.`,
  );
} catch (err) {
  console.error(`Error writing scaffolded file: ${err.message}`);
  process.exit(1);
}
