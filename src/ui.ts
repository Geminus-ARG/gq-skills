import { clearScreenDown, cursorTo, emitKeypressEvents, moveCursor } from "node:readline";
import type { ProgressReporter, SkillFolderChoice } from "./types.js";

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

export async function selectSkillFolders(
  choices: SkillFolderChoice[],
  streams: {
    input?: NodeJS.ReadStream;
    output?: NodeJS.WriteStream;
  } = {}
): Promise<string[] | null> {
  if (choices.length <= 1) {
    return choices.map((choice) => choice.id);
  }

  const input = streams.input ?? process.stdin;
  const output = streams.output ?? process.stderr;

  if (!input.isTTY || !output.isTTY || typeof input.setRawMode !== "function") {
    warning("Entorno no interactivo: se descargaran todas las carpetas encontradas.");
    return choices.map((choice) => choice.id);
  }

  emitKeypressEvents(input);

  const selected = new Set(choices.map((choice) => choice.id));
  let currentIndex = 0;
  let renderedLines = 0;
  const restoreRawMode = input.isRaw;

  const render = (): void => {
    if (renderedLines > 0) {
      moveCursor(output, 0, -renderedLines);
      cursorTo(output, 0);
      clearScreenDown(output);
    }

    const lines = [
      "Selecciona las carpetas a descargar.",
      "Usa flechas arriba/abajo para moverte, espacio para seleccionar, enter para continuar y escape para cancelar.",
      ""
    ];

    for (const [index, choice] of choices.entries()) {
      const pointer = index === currentIndex ? ">" : " ";
      const marker = selected.has(choice.id) ? "[x]" : "[ ]";
      lines.push(`${pointer} ${marker} ${choice.displayName} (${choice.fileCount} ${plural(choice.fileCount, "archivo", "archivos")})`);
    }

    output.write(`${lines.join("\n")}\n`);
    renderedLines = lines.length;
  };

  const cleanup = (): void => {
    input.off("keypress", onKeypress);
    input.setRawMode(restoreRawMode);
    if (renderedLines > 0) {
      moveCursor(output, 0, -renderedLines);
      cursorTo(output, 0);
      clearScreenDown(output);
    }
  };

  const onKeypress = (_value: string, key: { name?: string; ctrl?: boolean }): void => {
    if (key.ctrl && key.name === "c") {
      cleanup();
      rejectSelection(null);
      return;
    }

    switch (key.name) {
      case "up":
        currentIndex = currentIndex === 0 ? choices.length - 1 : currentIndex - 1;
        render();
        return;
      case "down":
        currentIndex = currentIndex === choices.length - 1 ? 0 : currentIndex + 1;
        render();
        return;
      case "space": {
        const currentChoice = choices[currentIndex];
        if (selected.has(currentChoice.id)) {
          selected.delete(currentChoice.id);
        } else {
          selected.add(currentChoice.id);
        }
        render();
        return;
      }
      case "return":
      case "enter":
        cleanup();
        rejectSelection([...selected]);
        return;
      case "escape":
        cleanup();
        rejectSelection(null);
        return;
      default:
        return;
    }
  };

  let rejectSelection: (value: string[] | null) => void = () => undefined;

  return await new Promise<string[] | null>((resolve) => {
    rejectSelection = resolve;
    input.setRawMode(true);
    input.on("keypress", onKeypress);
    render();
  });
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
  gq-skills manifest [folder] [opciones]

'add <folder>' busca por defecto dentro de 'skills/'.
Usa '/ruta' para apuntar a otra carpeta del repo.

Opciones:
  --client-id <id>         Client ID de OAuth App para gq-skills login.
  --scope <scope>          Permisos de GitHub para login. Default: repo.
  --repo <owner/repo>       Repo GitHub origen. Tambien GQ_SKILLS_REPO.
  --ref <branch|tag|sha>    Rama, tag o commit. Default: main.
  --target <path>           Carpeta del proyecto donde instalar. Default: cwd.
  --agents-dir <path>       Carpeta destino. Default: .agents.
  --cloude-dir <path>       Carpeta enlazada. Default: .cloude.
  --dry-run                 Muestra cambios sin escribir archivos.
  --no-interactive          Omite el selector y descarga todas las carpetas encontradas.

Manifest:
  'manifest' genera archivos 'gq-skills.json' para acelerar el discovery.
  Si no se pasa carpeta, usa 'skills'.

Seleccion interactiva:
  Si se encuentran varias carpetas de skills, el CLI muestra una lista con todas
  seleccionadas por defecto. Usa flechas arriba/abajo para moverte, espacio para
  marcar o desmarcar, enter para continuar y escape para cancelar.

Ejemplo:
  gq-skills login --client-id <github-oauth-client-id>
  npx @geminus-qhom/gq-skills add documents --repo tu-org/gq-skills
  npx @geminus-qhom/gq-skills add /packs/backend --repo tu-org/gq-skills
  gq-skills manifest
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