# AGENTS.md

Instrucciones para agentes de coding que trabajen en este repositorio.

## Contexto del proyecto

`gq-skills` es un CLI Node.js escrito en TypeScript. El binario `gq-skills`
descarga carpetas de skills desde GitHub, las instala en `.agents/skills` y
crea un link `.cloude/skills` hacia esa carpeta.

Lee [README.md](README.md) para el uso completo del CLI, instalacion,
compilacion, empaquetado y versionado.

## Stack y comandos

- Runtime: Node.js 20 o superior.
- Package manager: pnpm fijado en [package.json](package.json).
- TypeScript estricto con ESM.
- Tests con Vitest.

Comandos habituales:

```bash
corepack enable
pnpm install
pnpm run typecheck
pnpm run build
pnpm test
```

Antes de entregar cambios de codigo, ejecuta como minimo:

```bash
pnpm run typecheck
pnpm run build
pnpm test
```

## Archivos clave

- [src/index.ts](src/index.ts): entrada del CLI, parsing de argumentos,
  descarga desde GitHub, escritura de archivos y creacion del link.
- [test/index.test.ts](test/index.test.ts): tests Vitest con mocks de GitHub.
- [package.json](package.json): binario, scripts, version y metadata npm.
- [tsconfig.json](tsconfig.json): configuracion TypeScript para desarrollo y
  tests.
- [tsconfig.build.json](tsconfig.build.json): build de `src` hacia `dist`.
- [pnpm-workspace.yaml](pnpm-workspace.yaml): configuracion pnpm 11 para
  permitir el build de `esbuild`, requerido por Vitest.
- [.npmrc](.npmrc): enforce de engine y package manager.

## Convenciones de implementacion

- Mantener el CLI sin dependencias runtime salvo que haya una razon clara.
- Preservar compatibilidad ESM y Node 20+.
- Mantener validaciones de rutas seguras antes de escribir archivos.
- Soportar Windows y Unix al tocar links: Windows usa junctions; macOS/Linux
  usan symlinks relativos.
- El parsing actual acepta `--flag value` y `--flag=value`; no rompas ese
  comportamiento al agregar opciones.
- Los comandos deben seguir funcionando desde `npx gq-skills ...`,
  `pnpm dlx gq-skills ...` y `node dist/index.js ...`.
- Si agregas comportamiento del CLI, agrega o actualiza tests en
  [test/index.test.ts](test/index.test.ts).

## Pitfalls del repo

- pnpm 11 bloquea build scripts por defecto. `esbuild` esta aprobado en
  [pnpm-workspace.yaml](pnpm-workspace.yaml); no elimines esa configuracion sin
  validar `pnpm install` y `pnpm test`.
- `.agents/`, `.cline/` y `skills-lock.json` pueden ser generados por tooling de
  autoskills. No los modifiques ni los elimines salvo que la tarea lo pida
  explicitamente.
- `dist/` es salida generada por `pnpm run build`; no edites archivos compilados
  a mano.
- Para repos GitHub privados o rate limits, el CLI usa `GITHUB_TOKEN` o
  `GH_TOKEN`.

## Documentacion

Evita duplicar instrucciones largas en nuevos archivos. Enlaza a
[README.md](README.md) para uso, instalacion, build, pack, versionado y
troubleshooting.