import type { ProgressReporter } from "./types.js";

type ColorName = "red" | "green" | "cyan" | "yellow";

const colors: Record<ColorName, string> = {
  red: "31",
  green: "32",
  cyan: "36",
  yellow: "33"
};

export function printWelcome(): void {
  info(colorize("Bienvenido a gq-skills", "cyan"));
}

export function info(message: string): void {
  console.log(message);
}

export function success(message: string): void {
  console.log(colorize(message, "green"));
}

export function warning(message: string): void {
  console.log(colorize(message, "yellow"));
}

export function error(message: string): void {
  console.error(colorize(message, "red", process.stderr));
}

export function formatFoundSummary(skillCount: number, fileCount: number): string {
  return `Encontrados ${skillCount} ${plural(skillCount, "skill", "skills")} en ${fileCount} ${plural(fileCount, "archivo", "archivos")}.`;
}

export function createProgressReporter(total: number): ProgressReporter {
  if (!process.stderr.isTTY || total === 0) {
    return {
      file: () => undefined,
      done: () => undefined
    };
  }

  let wroteProgress = false;

  return {
    file: (progress) => {
      wroteProgress = true;
      process.stderr.write(`\r${formatProgressLine(progress.index, progress.total, progress.relativePath)}`);
    },
    done: () => {
      if (wroteProgress) {
        process.stderr.write("\n");
      }
    }
  };
}

export function formatProgressLine(index: number, total: number, relativePath: string): string {
  const width = 24;
  const completed = Math.max(0, Math.min(width, Math.round((index / total) * width)));
  const bar = `${"#".repeat(completed)}${"-".repeat(width - completed)}`;
  return `Descargando [${bar}] ${index}/${total} ${relativePath}`;
}

export function printHelp(): void {
  info(`gq-skills

Uso:
  gq-skills login [opciones]
  gq-skills add <folder> [opciones]

Opciones:
  --client-id <id>         Client ID de OAuth App para gq-skills login.
  --scope <scope>          Permisos de GitHub para login. Default: repo.
  --repo <owner/repo>       Repo GitHub origen. Tambien GQ_SKILLS_REPO.
  --ref <branch|tag|sha>    Rama, tag o commit. Default: main.
  --target <path>           Carpeta del proyecto donde instalar. Default: cwd.
  --agents-dir <path>       Carpeta destino. Default: .agents.
  --cloude-dir <path>       Carpeta enlazada. Default: .cloude.
  --dry-run                 Muestra cambios sin escribir archivos.

Ejemplo:
  gq-skills login --client-id <github-oauth-client-id>
  npx gq-skills add backend --repo tu-org/gq-skills
`);
}

function plural(count: number, singular: string, pluralText: string): string {
  return count === 1 ? singular : pluralText;
}

function colorize(message: string, color: ColorName, stream: NodeJS.WriteStream = process.stdout): string {
  if (!supportsColor(stream)) {
    return message;
  }

  return `\u001B[${colors[color]}m${message}\u001B[0m`;
}

function supportsColor(stream: NodeJS.WriteStream): boolean {
  if (process.env.NO_COLOR) {
    return false;
  }

  return process.env.FORCE_COLOR !== undefined || Boolean(stream.isTTY);
}