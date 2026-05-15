#!/usr/bin/env node

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { main } from "./cli.js";

export { main } from "./cli.js";
export { addSkills } from "./skills-installation.js";
export { generateSkillManifests } from "./skills-manifest.js";
export { formatProgressLine } from "./ui.js";
export type { AddOptions, GenerateManifestOptions, LoginOptions } from "./types.js";

if (isDirectExecution()) {
  await main();
}

// Permite reutilizar el entrypoint desde tests o imports sin ejecutar el CLI automaticamente.
function isDirectExecution(): boolean {
  return process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}
