import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const DEFAULT_REF = "main";
export const DEFAULT_AGENTS_DIR = ".agents";
export const DEFAULT_CLOUDE_DIR = ".cloude";
export const DEFAULT_AUTH_SCOPE = "repo";

export function githubHeaders(token?: string): HeadersInit {
  return {
    "Accept": "application/vnd.github+json",
    "User-Agent": "gq-skills",
    ...(token ? { "Authorization": `Bearer ${token}` } : {})
  };
}

export async function readDefaultRepo(): Promise<string> {
  const packageJson = JSON.parse(await readFile(packageJsonPath(), "utf8")) as { repository?: string | { url?: string } };
  const repository = typeof packageJson.repository === "string" ? packageJson.repository : packageJson.repository?.url;
  const match = repository?.match(/github\.com[:/](?<owner>[^/]+)\/(?<repo>[^/.]+)(?:\.git)?/i);
  return match?.groups ? `${match.groups.owner}/${match.groups.repo}` : "gq-skills/gq-skills";
}

export async function readPackageVersion(): Promise<string> {
  const packageJson = JSON.parse(await readFile(packageJsonPath(), "utf8")) as { version?: string };
  return packageJson.version ?? "0.0.0";
}

export function githubConfigPath(): string {
  return join(configRoot(), "gq-skills", "config.json");
}

export function packageJsonPath(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), "..", "package.json");
}

function configRoot(): string {
  if (process.env.GQ_SKILLS_CONFIG_HOME) {
    return process.env.GQ_SKILLS_CONFIG_HOME;
  }

  if (process.platform === "win32") {
    return process.env.APPDATA ?? join(homedir(), "AppData", "Roaming");
  }

  if (process.platform === "darwin") {
    return join(homedir(), "Library", "Application Support");
  }

  return process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config");
}