import { readdir, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { normalizeGithubPath, validateSafeRelativePath } from "./path-utils.js";
import { SKILLS_MANIFEST_FILE } from "./skills-search.js";
import type { GenerateManifestOptions, SkillsManifest, SkillsManifestFile } from "./types.js";
import { info, success } from "./ui.js";

type ScanResult = {
  containsSkill: boolean;
  targets: string[];
};

export async function generateSkillManifests(options: GenerateManifestOptions): Promise<void> {
  validateSafeRelativePath(options.folder, "folder");

  const rootDirectory = resolve(options.cwd, options.folder);
  const scan = await scanManifestTargets(rootDirectory);

  if (!scan.containsSkill) {
    throw new Error(`No se encontro ningun SKILL.md dentro de ${options.folder}.`);
  }

  const targets = [...new Set(scan.targets)].sort((left, right) => left.localeCompare(right));

  for (const directory of targets) {
    const manifest = await buildManifest(options.cwd, directory);
    const manifestPath = resolve(directory, SKILLS_MANIFEST_FILE);
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    info(`Manifest generado: ${normalizeGithubPath(relative(options.cwd, manifestPath))}`);
  }

  success(`Generados ${targets.length} manifiesto(s) en ${options.folder}.`);
}

async function buildManifest(cwd: string, directory: string): Promise<SkillsManifest> {
  const files = await collectManifestFiles(cwd, directory, directory);
  return {
    version: 1,
    folder: normalizeGithubPath(relative(cwd, directory)),
    files
  };
}

async function collectManifestFiles(cwd: string, directory: string, rootDirectory: string): Promise<SkillsManifestFile[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: SkillsManifestFile[] = [];

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    if (entry.name === SKILLS_MANIFEST_FILE) {
      continue;
    }

    const entryPath = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectManifestFiles(cwd, entryPath, rootDirectory));
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    files.push({
      sourcePath: normalizeGithubPath(relative(cwd, entryPath)),
      relativePath: normalizeGithubPath(relative(rootDirectory, entryPath))
    });
  }

  return files;
}

async function scanManifestTargets(directory: string): Promise<ScanResult> {
  const entries = await readdir(directory, { withFileTypes: true });
  const directSkill = entries.some((entry) => entry.isFile() && entry.name === "SKILL.md");
  const targets: string[] = [];
  let containsSkill = directSkill;

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const childPath = resolve(directory, entry.name);
    const childScan = await scanManifestTargets(childPath);
    if (childScan.containsSkill) {
      containsSkill = true;
    }
    targets.push(...childScan.targets);
  }

  if (containsSkill) {
    targets.push(directory);
  }

  return { containsSkill, targets };
}