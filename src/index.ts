#!/usr/bin/env node

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { main } from "./cli.js";

export { main } from "./cli.js";
export { addSkills } from "./skills-installation.js";
export { formatProgressLine } from "./ui.js";
export type { AddOptions, LoginOptions } from "./types.js";

if (isDirectExecution()) {
  await main();
}

function isDirectExecution(): boolean {
  return process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}
