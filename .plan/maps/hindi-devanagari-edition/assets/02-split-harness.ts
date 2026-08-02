// Local, no-API: strip the static blocks out of a stored lesson so an agent
// converts only the human-readable document, exactly as swapOutStatic would.
import { readFileSync, writeFileSync } from "node:fs";
import { swapOutStatic } from "../../convex/translate";
const [, , inPath, outPath] = process.argv;
const { stripped, blocks } = swapOutStatic(readFileSync(inPath, "utf8"));
writeFileSync(outPath, stripped);
writeFileSync(`${outPath}.blocks.json`, JSON.stringify(blocks));
console.log(`stripped ${stripped.length} chars, ${blocks.length} static blocks -> ${outPath}`);
