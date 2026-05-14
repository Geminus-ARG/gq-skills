export function validateRepo(repo: string): void {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) {
    throw new Error(`Repo invalido: ${repo}. Usa el formato owner/repo.`);
  }
}

export function validateSafeRelativePath(path: string, label: string): void {
  if (!path || path.startsWith("/") || path.startsWith("\\") || path.includes("..") || /^[a-z]:/i.test(path)) {
    throw new Error(`${label} debe ser una ruta relativa segura.`);
  }
}

export function normalizeGithubPath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
}

export function encodeGithubPath(path: string): string {
  return normalizeGithubPath(path).split("/").map(encodeURIComponent).join("/");
}

export function relativeGithubPath(root: string, filePath: string): string {
  const normalizedRoot = `${normalizeGithubPath(root)}/`;
  return normalizeGithubPath(filePath).startsWith(normalizedRoot)
    ? normalizeGithubPath(filePath).slice(normalizedRoot.length)
    : basenameGithubPath(filePath);
}

export function basenameGithubPath(path: string): string {
  return normalizeGithubPath(path).split("/").filter(Boolean).at(-1) ?? "skill";
}