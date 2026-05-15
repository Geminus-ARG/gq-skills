import { githubHeaders } from "./config.js";
import { encodeGithubPath, relativeGithubPath } from "./path-utils.js";
import type { AddOptions, DownloadedFile, GithubDirectoryItem, GithubFile, ProgressReporter } from "./types.js";

export async function listGithubFolder(options: AddOptions, rootFolder = options.folder): Promise<GithubFile[]> {
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