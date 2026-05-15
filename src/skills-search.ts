import { githubHeaders } from "./config.js";
import { encodeGithubPath, relativeGithubPath } from "./path-utils.js";
import type { AddOptions, DownloadedFile, GithubDirectoryItem, GithubFile, ProgressReporter, SkillsManifest } from "./types.js";

export const SKILLS_MANIFEST_FILE = "gq-skills.json";

export async function listGithubFolder(options: AddOptions, rootFolder = options.folder): Promise<GithubFile[]> {
  const manifestFiles = await tryListGithubFolderFromManifest(options, rootFolder);
  if (manifestFiles) {
    return manifestFiles;
  }

  const apiUrl = `https://api.github.com/repos/${options.repo}/contents/${encodeGithubPath(options.folder)}?ref=${encodeURIComponent(options.ref)}`;
  const response = await fetch(apiUrl, {
    headers: githubHeaders(options.token)
  });

  if (response.status === 404) {
    const authHint = options.token
      ? "Revisa que el token tenga permisos para ese repo."
      : "Si el repo es privado, ejecuta gq-skills login o define GITHUB_TOKEN.";
    throw new Error(`No existe la carpeta ${options.folder} en ${options.repo}@${options.ref}. ${authHint}`);
  }

  if (!response.ok) {
    throw new Error(await formatGithubContentsError(response, options));
  }

  const payload = await response.json() as GithubDirectoryItem | GithubDirectoryItem[];
  if (!Array.isArray(payload)) {
    throw new Error(`La ruta ${options.folder} en ${options.repo}@${options.ref} no es una carpeta.`);
  }

  const files: GithubFile[] = [];

  for (const item of payload) {
    if (item.type === "dir") {
      files.push(...await listGithubFolder({ ...options, folder: item.path }, rootFolder));
      continue;
    }

    if (item.type !== "file" || !item.download_url) {
      continue;
    }

    files.push({
      sourcePath: item.path,
      relativePath: relativeGithubPath(rootFolder, item.path),
      downloadUrl: item.download_url
    });
  }

  return files;
}

async function tryListGithubFolderFromManifest(options: AddOptions, rootFolder: string): Promise<GithubFile[] | null> {
  if (options.folder !== rootFolder) {
    return null;
  }

  const manifestUrl = buildGithubRawUrl(options.repo, options.ref, `${options.folder}/${SKILLS_MANIFEST_FILE}`);
  const response = await fetch(manifestUrl, {
    headers: githubHeaders(options.token)
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(await formatGithubManifestError(response, options));
  }

  const manifest = await response.json() as SkillsManifest;
  validateSkillsManifest(manifest, options.folder);

  return manifest.files.map((file) => ({
    sourcePath: file.sourcePath,
    relativePath: file.relativePath,
    downloadUrl: buildGithubRawUrl(options.repo, options.ref, file.sourcePath)
  }));
}

async function formatGithubContentsError(response: Response, options: AddOptions): Promise<string> {
  const body = await response.text();

  if (response.status === 403 && body.toLowerCase().includes("rate limit exceeded")) {
    const authHint = options.token
      ? "Tu token fue aceptado, pero ese limite ya se agoto. Espera a que GitHub lo reponga o usa otro token con cupo disponible."
      : "Ejecuta gq-skills login o define GITHUB_TOKEN para usar el limite autenticado, que es mas alto.";
    return `GitHub bloqueo la consulta por rate limit al leer ${options.folder} en ${options.repo}@${options.ref}. ${authHint}`;
  }

  return `GitHub respondio ${response.status}: ${body}`;
}

async function formatGithubManifestError(response: Response, options: AddOptions): Promise<string> {
  const body = await response.text();

  if (response.status === 403 && body.toLowerCase().includes("rate limit exceeded")) {
    const authHint = options.token
      ? "Tu token fue aceptado, pero ese limite ya se agoto. Espera a que GitHub lo reponga o usa otro token con cupo disponible."
      : "Ejecuta gq-skills login o define GITHUB_TOKEN para usar el limite autenticado, que es mas alto.";
    return `GitHub bloqueo la consulta por rate limit al leer ${options.folder} en ${options.repo}@${options.ref}. ${authHint}`;
  }

  return `No se pudo leer ${options.folder}/${SKILLS_MANIFEST_FILE} en ${options.repo}@${options.ref}: HTTP ${response.status}. ${body}`;
}

function validateSkillsManifest(manifest: SkillsManifest, requestedFolder: string): void {
  if (manifest.version !== 1) {
    throw new Error(`El manifiesto ${requestedFolder}/${SKILLS_MANIFEST_FILE} tiene una version incompatible.`);
  }

  if (!Array.isArray(manifest.files)) {
    throw new Error(`El manifiesto ${requestedFolder}/${SKILLS_MANIFEST_FILE} no contiene una lista valida de archivos.`);
  }

  for (const file of manifest.files) {
    if (!file || typeof file.sourcePath !== "string" || typeof file.relativePath !== "string") {
      throw new Error(`El manifiesto ${requestedFolder}/${SKILLS_MANIFEST_FILE} contiene una entrada de archivo invalida.`);
    }
  }
}

function buildGithubRawUrl(repo: string, ref: string, filePath: string): string {
  return `https://raw.githubusercontent.com/${repo}/${encodeURIComponent(ref)}/${encodeGithubPath(filePath)}`;
}

export async function downloadGithubFiles<T extends GithubFile>(files: T[], options: AddOptions, reporter: ProgressReporter): Promise<Array<T & DownloadedFile>> {
  const downloadedFiles: Array<T & DownloadedFile> = [];

  try {
    for (const [index, file] of files.entries()) {
      reporter.file({
        index: index + 1,
        total: files.length,
        relativePath: file.relativePath
      });

      const fileResponse = await fetch(file.downloadUrl, {
        headers: githubHeaders(options.token)
      });

      if (!fileResponse.ok) {
        throw new Error(`No se pudo descargar ${file.sourcePath}: HTTP ${fileResponse.status}.`);
      }

      downloadedFiles.push({
        ...file,
        content: new Uint8Array(await fileResponse.arrayBuffer())
      });
    }
  } finally {
    reporter.done();
  }

  return downloadedFiles;
}

export function countSkills(files: Array<{ relativePath: string }>): number {
  return files.filter((file) => file.relativePath === "SKILL.md" || file.relativePath.endsWith("/SKILL.md")).length;
}