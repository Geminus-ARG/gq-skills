#!/usr/bin/env node

import { mkdir, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

type GithubDirectoryItem = {
  type: "file" | "dir" | "symlink" | "submodule";
  name: string;
  path: string;
  download_url: string | null;
};

type AddOptions = {
  folder: string;
  repo: string;
  ref: string;
  cwd: string;
  agentsDir: string;
  cloudeDir: string;
  dryRun: boolean;
  token?: string;
};

type DownloadedFile = {
  sourcePath: string;
  relativePath: string;
  content: Uint8Array;
};

const DEFAULT_REF = "main";
const DEFAULT_AGENTS_DIR = ".agents";
const DEFAULT_CLOUDE_DIR = ".cloude";

export async function main(argv = process.argv.slice(2)): Promise<void> {
  try {
    const command = argv[0];

    if (!command || command === "--help" || command === "-h") {
      printHelp();
      return;
    }

    if (command === "--version" || command === "-v") {
      console.log(await readPackageVersion());
      return;
    }

    if (command !== "add") {
      throw new Error(`Comando desconocido: ${command}`);
    }

    const options = await parseAddOptions(argv.slice(1));
    await addSkills(options);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

export async function addSkills(options: AddOptions): Promise<void> {
  validateSafeRelativePath(options.folder, "folder");
  validateSafeRelativePath(options.agentsDir, "agentsDir");
  validateSafeRelativePath(options.cloudeDir, "cloudeDir");

  const files = await downloadGithubFolder(options);
  if (files.length === 0) {
    throw new Error(`No se encontraron archivos en ${options.repo}/${options.folder}@${options.ref}.`);
  }

  const installRoot = resolve(options.cwd, options.agentsDir, "skills");
  const mappedFiles = mapSkillFiles(options.folder, files, installRoot);

  if (options.dryRun) {
    for (const file of mappedFiles) {
      console.log(`dry-run: ${file.sourcePath} -> ${file.targetPath}`);
    }
    console.log(`dry-run: link ${join(options.cloudeDir, "skills")} -> ${join(options.agentsDir, "skills")}`);
    return;
  }

  for (const file of mappedFiles) {
    await mkdir(dirname(file.targetPath), { recursive: true });
    await writeFile(file.targetPath, file.content);
  }

  await ensureCloudeSkillsLink(options.cwd, options.agentsDir, options.cloudeDir);

  console.log(`Instalados ${mappedFiles.length} archivo(s) en ${relative(options.cwd, installRoot) || installRoot}.`);
  console.log(`Link listo: ${join(options.cloudeDir, "skills")} -> ${join(options.agentsDir, "skills")}`);
}

async function parseAddOptions(args: string[]): Promise<AddOptions> {
  const folder = args[0];
  if (!folder || folder.startsWith("-")) {
    throw new Error("Uso: gq-skills add <folder> [--repo owner/repo] [--ref branch]");
  }

  const options: AddOptions = {
    folder: normalizeGithubPath(folder),
    repo: process.env.GQ_SKILLS_REPO ?? await readDefaultRepo(),
    ref: process.env.GQ_SKILLS_REF ?? DEFAULT_REF,
    cwd: process.cwd(),
    agentsDir: process.env.GQ_SKILLS_AGENTS_DIR ?? DEFAULT_AGENTS_DIR,
    cloudeDir: process.env.GQ_SKILLS_CLOUDE_DIR ?? DEFAULT_CLOUDE_DIR,
    dryRun: false,
    token: process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN
  };

  for (let index = 1; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    const [flag, inlineValue] = arg.split("=", 2);
    const value = inlineValue ?? args[index + 1];

    if (["--repo", "--ref", "--target", "--agents-dir", "--cloude-dir"].includes(flag) && !value) {
      throw new Error(`Falta valor para ${flag}.`);
    }

    switch (flag) {
      case "--repo":
        options.repo = value;
        break;
      case "--ref":
        options.ref = value;
        break;
      case "--target":
        options.cwd = resolve(value);
        break;
      case "--agents-dir":
        options.agentsDir = value;
        break;
      case "--cloude-dir":
        options.cloudeDir = value;
        break;
      default:
        throw new Error(`Opcion desconocida: ${arg}`);
    }

    if (inlineValue === undefined) {
      index += 1;
    }
  }

  validateRepo(options.repo);
  return options;
}

async function downloadGithubFolder(options: AddOptions, rootFolder = options.folder): Promise<DownloadedFile[]> {
  const apiUrl = `https://api.github.com/repos/${options.repo}/contents/${encodeGithubPath(options.folder)}?ref=${encodeURIComponent(options.ref)}`;
  const response = await fetch(apiUrl, {
    headers: githubHeaders(options.token)
  });

  if (response.status === 404) {
    throw new Error(`No existe la carpeta ${options.folder} en ${options.repo}@${options.ref}.`);
  }

  if (!response.ok) {
    throw new Error(`GitHub respondio ${response.status}: ${await response.text()}`);
  }

  const payload = await response.json() as GithubDirectoryItem | GithubDirectoryItem[];
  const items = Array.isArray(payload) ? payload : [payload];
  const files: DownloadedFile[] = [];

  for (const item of items) {
    if (item.type === "dir") {
      files.push(...await downloadGithubFolder({ ...options, folder: item.path }, rootFolder));
      continue;
    }

    if (item.type !== "file" || !item.download_url) {
      continue;
    }

    const fileResponse = await fetch(item.download_url, {
      headers: githubHeaders(options.token)
    });

    if (!fileResponse.ok) {
      throw new Error(`No se pudo descargar ${item.path}: HTTP ${fileResponse.status}.`);
    }

    files.push({
      sourcePath: item.path,
      relativePath: relativeGithubPath(rootFolder, item.path),
      content: new Uint8Array(await fileResponse.arrayBuffer())
    });
  }

  return files;
}

function mapSkillFiles(sourceFolder: string, files: DownloadedFile[], installRoot: string): Array<DownloadedFile & { targetPath: string }> {
  const sourceContainsSkill = files.some((file) => file.relativePath === "SKILL.md");
  const targetPrefix = sourceContainsSkill ? basenameGithubPath(sourceFolder) : "";

  return files.map((file) => {
    validateSafeRelativePath(file.relativePath, "relativePath");
    const relativeTarget = targetPrefix ? join(targetPrefix, file.relativePath) : file.relativePath.split("/").join(sep);
    return {
      ...file,
      targetPath: resolve(installRoot, relativeTarget)
    };
  });
}

async function ensureCloudeSkillsLink(cwd: string, agentsDir: string, cloudeDir: string): Promise<void> {
  const agentsSkills = resolve(cwd, agentsDir, "skills");
  const cloudeRoot = resolve(cwd, cloudeDir);
  const linkPath = resolve(cloudeRoot, "skills");

  await mkdir(agentsSkills, { recursive: true });
  await mkdir(cloudeRoot, { recursive: true });

  try {
    const existing = await stat(linkPath);
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

  const target = process.platform === "win32" ? agentsSkills : relative(dirname(linkPath), agentsSkills) || ".";
  await symlink(target, linkPath, process.platform === "win32" ? "junction" : "dir");
}

function githubHeaders(token?: string): HeadersInit {
  return {
    "Accept": "application/vnd.github+json",
    "User-Agent": "gq-skills",
    ...(token ? { "Authorization": `Bearer ${token}` } : {})
  };
}

async function readDefaultRepo(): Promise<string> {
  const packageJson = JSON.parse(await readFile(packageJsonPath(), "utf8")) as { repository?: string | { url?: string } };
  const repository = typeof packageJson.repository === "string" ? packageJson.repository : packageJson.repository?.url;
  const match = repository?.match(/github\.com[:/](?<owner>[^/]+)\/(?<repo>[^/.]+)(?:\.git)?/i);
  return match?.groups ? `${match.groups.owner}/${match.groups.repo}` : "gq-skills/gq-skills";
}

async function readPackageVersion(): Promise<string> {
  const packageJson = JSON.parse(await readFile(packageJsonPath(), "utf8")) as { version?: string };
  return packageJson.version ?? "0.0.0";
}

function packageJsonPath(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), "..", "package.json");
}

function validateRepo(repo: string): void {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) {
    throw new Error(`Repo invalido: ${repo}. Usa el formato owner/repo.`);
  }
}

function validateSafeRelativePath(path: string, label: string): void {
  if (!path || path.startsWith("/") || path.startsWith("\\") || path.includes("..") || /^[a-z]:/i.test(path)) {
    throw new Error(`${label} debe ser una ruta relativa segura.`);
  }
}

function normalizeGithubPath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
}

function encodeGithubPath(path: string): string {
  return normalizeGithubPath(path).split("/").map(encodeURIComponent).join("/");
}

function relativeGithubPath(root: string, filePath: string): string {
  const normalizedRoot = `${normalizeGithubPath(root)}/`;
  return normalizeGithubPath(filePath).startsWith(normalizedRoot)
    ? normalizeGithubPath(filePath).slice(normalizedRoot.length)
    : basenameGithubPath(filePath);
}

function basenameGithubPath(path: string): string {
  return normalizeGithubPath(path).split("/").filter(Boolean).at(-1) ?? "skill";
}

function printHelp(): void {
  console.log(`gq-skills

Uso:
  gq-skills add <folder> [opciones]

Opciones:
  --repo <owner/repo>       Repo GitHub origen. Tambien GQ_SKILLS_REPO.
  --ref <branch|tag|sha>    Rama, tag o commit. Default: main.
  --target <path>           Carpeta del proyecto donde instalar. Default: cwd.
  --agents-dir <path>       Carpeta destino. Default: .agents.
  --cloude-dir <path>       Carpeta enlazada. Default: .cloude.
  --dry-run                 Muestra cambios sin escribir archivos.

Ejemplo:
  npx gq-skills add backend --repo tu-org/gq-skills
`);
}

if (isDirectExecution()) {
  await main();
}

function isDirectExecution(): boolean {
  return process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}