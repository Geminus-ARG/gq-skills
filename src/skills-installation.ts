import { mkdir, lstat, rm, symlink, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { basenameGithubPath, validateSafeRelativePath } from "./path-utils.js";
import { countSkills, downloadGithubFiles, listGithubFolder } from "./skills-search.js";
import type { AddOptions } from "./types.js";
import { createProgressReporter, formatFoundSummary, info, success } from "./ui.js";

/**
 * Descarga una carpeta de skills desde GitHub, la copia a .agents/skills y deja
 * listo el link .cloude/skills para que otras herramientas encuentren el contenido.
 */
export async function addSkills(options: AddOptions): Promise<void> {
  validateSafeRelativePath(options.folder, "folder");
  validateSafeRelativePath(options.agentsDir, "agentsDir");
  validateSafeRelativePath(options.cloudeDir, "cloudeDir");

  info(`Buscando ${options.folder} en ${options.repo}@${options.ref}...`);

  const files = await listGithubFolder(options);
  if (files.length === 0) {
    throw new Error(`No se encontraron archivos en ${options.repo}/${options.folder}@${options.ref}.`);
  }

  // installRoot es la carpeta real donde se escriben los archivos descargados.
  const installRoot = resolve(options.cwd, options.agentsDir, "skills");
  const mappedFiles = mapSkillFiles(options.folder, files, installRoot);
  const skillCount = countSkills(files);

  info(formatFoundSummary(skillCount, mappedFiles.length));

  if (options.dryRun) {
    for (const file of mappedFiles) {
      info(`dry-run: ${file.sourcePath} -> ${file.targetPath}`);
    }
    info(`dry-run: link ${join(options.cloudeDir, "skills")} -> ${join(options.agentsDir, "skills")}`);
    return;
  }

  const downloadedFiles = await downloadGithubFiles(mappedFiles, options, createProgressReporter(mappedFiles.length));

  for (const file of downloadedFiles) {
    await mkdir(dirname(file.targetPath), { recursive: true });
    await writeFile(file.targetPath, file.content);
  }

  await ensureCloudeSkillsLink(options.cwd, options.agentsDir, options.cloudeDir);

  success(`Instalados ${mappedFiles.length} archivo(s) en ${relative(options.cwd, installRoot) || installRoot}.`);
  success(`Link listo: ${join(options.cloudeDir, "skills")} -> ${join(options.agentsDir, "skills")}`);
}

// Cuando la carpeta origen ya contiene un SKILL.md en la raiz, se conserva su nombre como subcarpeta destino.
function mapSkillFiles<T extends { relativePath: string }>(sourceFolder: string, files: T[], installRoot: string): Array<T & { targetPath: string }> {
  const sourceContainsSkill = files.some((file) => file.relativePath === "SKILL.md");
  const targetPrefix = sourceContainsSkill ? basenameGithubPath(sourceFolder) : "";

  return files.map((file) => {
    validateSafeRelativePath(file.relativePath, "relativePath");
    // relativeTarget normaliza separadores de GitHub a la plataforma local.
    const relativeTarget = targetPrefix ? join(targetPrefix, file.relativePath) : file.relativePath.split("/").join(sep);
    return {
      ...file,
      targetPath: resolve(installRoot, relativeTarget)
    };
  });
}

/**
 * Garantiza que .cloude/skills apunte a .agents/skills.
 * En Windows usa junctions; en Unix crea un symlink relativo.
 */
async function ensureCloudeSkillsLink(cwd: string, agentsDir: string, cloudeDir: string): Promise<void> {
  const agentsSkills = resolve(cwd, agentsDir, "skills");
  const cloudeRoot = resolve(cwd, cloudeDir);
  const linkPath = resolve(cloudeRoot, "skills");

  await mkdir(agentsSkills, { recursive: true });
  await mkdir(cloudeRoot, { recursive: true });

  try {
    const existing = await lstat(linkPath);
    if (existing.isSymbolicLink()) {
      await rm(linkPath);
    } else {
      throw new Error(`Ya existe ${relative(cwd, linkPath)} y no es un link. Movelo o borralo antes de continuar.`);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  // Windows resuelve mejor un path absoluto para junctions; Unix prefiere links relativos portables.
  const target = process.platform === "win32" ? agentsSkills : relative(dirname(linkPath), agentsSkills) || ".";
  await symlink(target, linkPath, process.platform === "win32" ? "junction" : "dir");
}