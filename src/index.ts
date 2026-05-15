#!/usr/bin/env node

import { realpathSync } from "node:fs";
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
  if (process.argv[1] === undefined) {
    return false;
  }

  try {
    return normalizeExecutablePath(process.argv[1]) === normalizeExecutablePath(fileURLToPath(import.meta.url));
  } catch {
    return normalizeExecutablePath(process.argv[1], false) === normalizeExecutablePath(fileURLToPath(import.meta.url), false);
  }
}

function normalizeExecutablePath(path: string, resolveSymlinks = true): string {
  const normalizedPath = resolve(path);
  const finalPath = resolveSymlinks ? realpathSync.native(normalizedPath) : normalizedPath;
  return process.platform === "win32" ? finalPath.toLowerCase() : finalPath;
}
