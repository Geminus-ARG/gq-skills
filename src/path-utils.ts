// Valida el formato owner/repo esperado por la API de GitHub.
export function validateRepo(repo: string): void {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) {
    throw new Error(`Repo invalido: ${repo}. Usa el formato owner/repo.`);
  }
}

// Bloquea rutas absolutas o con escapadas fuera del directorio de trabajo.
export function validateSafeRelativePath(path: string, label: string): void {
  if (!path || path.startsWith("/") || path.startsWith("\\") || path.includes("..") || /^[a-z]:/i.test(path)) {
    throw new Error(`${label} debe ser una ruta relativa segura.`);
  }
}

// GitHub siempre opera con '/', asi que se normalizan separadores y bordes del path.
export function normalizeGithubPath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
}

export function encodeGithubPath(path: string): string {
  return normalizeGithubPath(path).split("/").map(encodeURIComponent).join("/");
}

// Si filePath cuelga de root, devuelve la parte relativa; si no, se queda con el basename util.
export function relativeGithubPath(root: string, filePath: string): string {
  const normalizedRoot = `${normalizeGithubPath(root)}/`;
  return normalizeGithubPath(filePath).startsWith(normalizedRoot)
    ? normalizeGithubPath(filePath).slice(normalizedRoot.length)
    : basenameGithubPath(filePath);
}

export function basenameGithubPath(path: string): string {
  return normalizeGithubPath(path).split("/").filter(Boolean).at(-1) ?? "skill";
}