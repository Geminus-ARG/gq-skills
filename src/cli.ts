import { resolve } from "node:path";
import { DEFAULT_AGENTS_DIR, DEFAULT_AUTH_SCOPE, DEFAULT_CLOUDE_DIR, DEFAULT_REF, readDefaultRepo, readPackageVersion } from "./config.js";
import { loginGithub, readStoredGithubToken } from "./github-auth.js";
import { normalizeGithubPath, validateRepo } from "./path-utils.js";
import { addSkills } from "./skills-installation.js";
import type { AddOptions, LoginOptions } from "./types.js";
import { error, printHelp, printWelcome } from "./ui.js";

/**
 * Punto de entrada del CLI. Lee el primer argumento para decidir si debe
 * mostrar ayuda, imprimir la version, autenticar con GitHub o instalar skills.
 */
export async function main(argv = process.argv.slice(2)): Promise<void> {
  try {
    printWelcome();

    const command = argv[0];

    if (!command || command === "--help" || command === "-h") {
      printHelp();
      return;
    }

    if (command === "--version" || command === "-v") {
      console.log(await readPackageVersion());
      return;
    }

    if (command === "login") {
      const options = parseLoginOptions(argv.slice(1));
      await loginGithub(options);
      return;
    }

    if (command !== "add") {
      throw new Error(`Comando desconocido: ${command}`);
    }

    const options = await parseAddOptions(argv.slice(1));
    await addSkills(options);
  } catch (caughtError) {
    error(caughtError instanceof Error ? caughtError.message : String(caughtError));
    process.exitCode = 1;
  }
}

/**
 * Construye las opciones del comando add mezclando argumentos, variables de
 * entorno y valores por defecto del proyecto.
 */
async function parseAddOptions(args: string[]): Promise<AddOptions> {
  const folder = args[0];
  if (!folder || folder.startsWith("-")) {
    throw new Error("Uso: gq-skills add <folder> [--repo owner/repo] [--ref branch]");
  }

  // Estas propiedades concentran toda la configuracion efectiva del comando.
  // Cada valor puede venir del CLI, del entorno o de defaults persistidos.
  const options: AddOptions = {
    folder: resolveRequestedFolder(folder),
    repo: process.env.GQ_SKILLS_REPO ?? await readDefaultRepo(),
    ref: process.env.GQ_SKILLS_REF ?? DEFAULT_REF,
    cwd: process.cwd(),
    agentsDir: process.env.GQ_SKILLS_AGENTS_DIR ?? DEFAULT_AGENTS_DIR,
    cloudeDir: process.env.GQ_SKILLS_CLOUDE_DIR ?? DEFAULT_CLOUDE_DIR,
    dryRun: false,
    token: process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? await readStoredGithubToken()
  };

  for (let index = 1; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    const [flag, inlineValue] = arg.split("=", 2);
    const value = inlineValue ?? args[index + 1];

    // El parser soporta ambas variantes: --flag value y --flag=value.
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

// Si el usuario pasa un path relativo corto, se asume que apunta al arbol skills/ del repositorio remoto.
function resolveRequestedFolder(folder: string): string {
  const normalizedFolder = normalizeGithubPath(folder);

  return folder.startsWith("/")
    ? normalizedFolder
    : normalizeGithubPath(`skills/${normalizedFolder}`);
}

/**
 * Arma las opciones del login GitHub. Usa la configuracion del entorno para el
 * Client ID y el scope, y permite desactivar la apertura automatica del navegador.
 */
function parseLoginOptions(args: string[]): LoginOptions {
  const options: LoginOptions = {
    clientId: process.env.GQ_SKILLS_GITHUB_CLIENT_ID ?? "",
    scope: process.env.GQ_SKILLS_GITHUB_SCOPE ?? DEFAULT_AUTH_SCOPE,
    openBrowser: true
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--no-open") {
      options.openBrowser = false;
      continue;
    }

    const [flag, inlineValue] = arg.split("=", 2);
    const value = inlineValue ?? args[index + 1];

    if (["--client-id", "--scope"].includes(flag) && !value) {
      throw new Error(`Falta valor para ${flag}.`);
    }

    switch (flag) {
      case "--client-id":
        options.clientId = value;
        break;
      case "--scope":
        options.scope = value;
        break;
      default:
        throw new Error(`Opcion desconocida: ${arg}`);
    }

    if (inlineValue === undefined) {
      index += 1;
    }
  }

  if (!options.clientId) {
    throw new Error("Falta GQ_SKILLS_GITHUB_CLIENT_ID o --client-id. Crea una OAuth App de GitHub con Device Flow habilitado.");
  }

  if (options.clientId.includes("@")) {
    throw new Error("--client-id debe ser el Client ID de una OAuth App de GitHub, no un email. Crea una OAuth App con Device Flow habilitado y usa su Client ID.");
  }

  return options;
}