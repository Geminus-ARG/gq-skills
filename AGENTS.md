# AGENTS.md

Instrucciones para agentes de coding que trabajen en este repositorio.

## Contexto del proyecto

`gq-skills` es un CLI Node.js escrito en TypeScript. El binario `gq-skills`
descarga carpetas de skills desde GitHub, las instala en `.agents/skills` y
crea un link `.cloude/skills` hacia esa carpeta.

Lee [README.md](README.md) para uso e instalacion desde npm, y
[README.dev.md](README.dev.md) para compilacion, empaquetado, publicacion y
versionado.

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

- [src/index.ts](src/index.ts): entrypoint ejecutable y reexports publicos.
- [src/cli.ts](src/cli.ts): parsing de argumentos, routing a `add` y `login`,
  mezcla de flags, entorno y defaults persistidos.
- [src/skills-installation.ts](src/skills-installation.ts): filtrado de
  skills, descarga, escritura local y creacion del link `.cloude/skills`.
- [src/skills-search.ts](src/skills-search.ts): acceso a GitHub API,
  manifiestos `gq-skills.json`, recursion de carpetas y descarga de archivos.
- [src/skills-manifest.ts](src/skills-manifest.ts): generacion local de
  manifiestos `gq-skills.json` para acelerar discovery remoto.
- [src/ui.ts](src/ui.ts): mensajes, barra de progreso y selector interactivo
  de carpetas con teclado.
- [src/path-utils.ts](src/path-utils.ts): normalizacion y validaciones de
  rutas seguras para GitHub y filesystem.
- [src/github-auth.ts](src/github-auth.ts): login GitHub via Device Flow y
  lectura del token persistido.
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
- `add <folder>` busca por defecto dentro de `skills/`; si el usuario pasa una
  ruta con slash inicial, usa la ruta exacta del repo remoto.
- El discovery de skills depende de `SKILL.md`: una carpeta con `SKILL.md` en
  raiz se instala como skill individual; varias subcarpetas con `SKILL.md`
  disparan seleccion por carpeta antes de descargar.
- Cuando hay varias carpetas encontradas y el modo interactivo esta activo, el
  selector usa flechas arriba/abajo para navegar, espacio para marcar,
  enter para aceptar y escape o Ctrl+C para cancelar. Al cerrar el selector,
  debe devolver stdin en un estado que permita terminar el proceso sin dejar la
  terminal retenida.
- `--no-interactive` debe mantener un flujo apto para scripts y CI: omite el
  selector y descarga todas las carpetas encontradas.
- Si existe `gq-skills.json` en la carpeta remota pedida, `add` debe preferir
  ese manifiesto antes de caer al recorrido recursivo por GitHub Contents API.
- `manifest [folder]` genera esos `gq-skills.json` desde el arbol local. Si se
  modifica ese comando o el formato del manifiesto, actualiza tambien README y
  tests.
- `--dry-run` solo informa el plan de escritura y el link final; no debe crear
  archivos ni modificar links.
- Los comandos deben seguir funcionando desde `npx @geminus-qhom/gq-skills ...`,
  `pnpm dlx @geminus-qhom/gq-skills ...`, `gq-skills ...` y
  `node dist/index.js ...`.
- Si agregas comportamiento del CLI, agrega o actualiza tests en
  [test/index.test.ts](test/index.test.ts).

## Flags y entorno

- `--repo` o `GQ_SKILLS_REPO`: repo GitHub origen.
- `--ref` o `GQ_SKILLS_REF`: branch, tag o sha. Default: `main`.
- `--agents-dir` o `GQ_SKILLS_AGENTS_DIR`: carpeta local real donde se
  escriben los skills. Default: `.agents`.
- `--cloude-dir` o `GQ_SKILLS_CLOUDE_DIR`: carpeta donde vive el link
  `.cloude/skills`. Default: `.cloude`.
- `--target`: cambia el directorio del proyecto destino. No tiene variable de
  entorno asociada.
- `--no-interactive`: desactiva la seleccion interactiva aunque haya TTY.
- `manifest [folder]`: genera manifiestos locales `gq-skills.json`; usa
  `skills/` cuando no se pasa carpeta.
- `GITHUB_TOKEN` o `GH_TOKEN`: autenticacion GitHub para repos privados o rate
  limits.
- `GQ_SKILLS_CONFIG_HOME`: override del directorio donde se guarda o lee la
  config local del CLI.

## Pitfalls del repo

- pnpm 11 bloquea build scripts por defecto. `esbuild` esta aprobado en
  [pnpm-workspace.yaml](pnpm-workspace.yaml); no elimines esa configuracion sin
  validar `pnpm install` y `pnpm test`.
- `.cloude/skills` es un symlink o junction generado. No lo edites a mano ni lo
  trates como carpeta normal; si ya existe como directorio real, `add` falla
  hasta que el usuario lo mueva o elimine.
- `.agents/`, `.cline/` y `skills-lock.json` pueden ser generados por tooling de
  autoskills. No los modifiques ni los elimines salvo que la tarea lo pida
  explicitamente.
- `dist/` es salida generada por `pnpm run build`; no edites archivos compilados
  a mano. Si pruebas con `node dist/index.js`, recompila primero.
- Para repos GitHub privados o rate limits, el CLI usa `GITHUB_TOKEN` o
  `GH_TOKEN`.
- Las validaciones de [src/path-utils.ts](src/path-utils.ts) bloquean rutas
  absolutas, `..` y escapes del directorio de trabajo. Son restricciones de
  seguridad, no ruido a relajar.
- Los mensajes de error del acceso a GitHub ya distinguen varios casos utiles:
  404 sin token sugiere login o `GITHUB_TOKEN`; 404 con token sugiere revisar
  permisos; ruta de archivo vs carpeta tambien se reporta de forma explicita.

## Documentacion

Mantener la documentacion separada por audiencia:
- [README.md](README.md) para uso e instalacion del paquete publicado.
- [README.dev.md](README.dev.md) para build, pack, versionado y publicacion.