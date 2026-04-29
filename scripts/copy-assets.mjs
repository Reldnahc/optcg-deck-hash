import { cpSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const source = resolve(import.meta.dirname, "..", "src", "data", "dictionary.json");
const targetDir = resolve(import.meta.dirname, "..", "dist", "data");
const target = resolve(targetDir, "dictionary.json");

mkdirSync(targetDir, { recursive: true });
cpSync(source, target, { force: true });

