# gq-skills

CLI para instalar skills propios desde carpetas de un repositorio GitHub.

El comando principal es:

```bash
npx @geminus/gq-skills add <folder>
```

El CLI descarga recursivamente la carpeta indicada desde GitHub, copia los
skills a `.agents/skills` y crea un link `.cloude/skills` que apunta a
`.agents/skills`.

## Requisitos

- Node.js 20 o superior.
- Corepack habilitado para usar la version de pnpm fijada por el proyecto.
- Acceso a GitHub desde la terminal.

```bash
node --version
corepack enable
corepack pnpm --version
```

Este proyecto fija pnpm en [package.json](package.json):

```json
"packageManager": "pnpm@11.1.2"
```

## Uso rapido

Instalar skills desde una carpeta del repo configurado por defecto:

```bash
npx @geminus/gq-skills add packs/backend
```

Instalar desde un repo especifico:

```bash
npx @geminus/gq-skills add packs/backend --repo tu-org/gq-skills
```

Instalar desde una rama, tag o commit especifico:

```bash
npx @geminus/gq-skills add packs/backend --repo tu-org/gq-skills --ref main
```

Ver que haria el comando sin escribir archivos:

```bash
npx @geminus/gq-skills add packs/backend --repo tu-org/gq-skills --dry-run
```

Antes de descargar, el CLI informa cuantos skills y archivos encontro. Durante
la descarga muestra una barra de progreso con el archivo relativo que esta
bajando:

```text
Buscando packs/backend en tu-org/gq-skills@main...
Encontrados 2 skills en 4 archivos.
Descargando [############------------] 2/4 node/SKILL.md
```

Si la carpeta remota no existe, o la ruta indicada no es una carpeta, el comando
termina con error sin escribir archivos.

## Que instala

El comando crea o actualiza esta estructura en el proyecto destino:

```text
.agents/
	skills/
		<skill>/
			SKILL.md
.cloude/
	skills -> ../.agents/skills
```

En Windows, el link se crea como junction de directorio. En macOS y Linux, se
crea como symlink relativo.

## Convenciones de carpetas

Si la carpeta remota contiene un `SKILL.md` en la raiz, se trata como un skill
individual y se instala en `.agents/skills/<nombre-de-la-carpeta>`.

Ejemplo remoto:

```text
skills/angular/SKILL.md
```

Resultado local:

```text
.agents/skills/angular/SKILL.md
```

Si la carpeta remota contiene varias carpetas de skills, se conserva esa
estructura dentro de `.agents/skills`.

Ejemplo remoto:

```text
packs/backend/dotnet/SKILL.md
packs/backend/node/SKILL.md
```

Resultado local:

```text
.agents/skills/dotnet/SKILL.md
.agents/skills/node/SKILL.md
```

## Opciones del CLI

```bash
gq-skills add <folder> [opciones]

--repo <owner/repo>       Repo GitHub origen. Tambien se puede usar GQ_SKILLS_REPO.
--ref <branch|tag|sha>    Rama, tag o commit. Default: main.
--target <path>           Carpeta del proyecto donde instalar. Default: cwd.
--agents-dir <path>       Carpeta destino. Default: .agents.
--cloude-dir <path>       Carpeta enlazada. Default: .cloude.
--dry-run                 Muestra cambios sin escribir archivos.
```

Variables de entorno soportadas:

```bash
GQ_SKILLS_REPO=tu-org/gq-skills
GQ_SKILLS_REF=main
GQ_SKILLS_AGENTS_DIR=.agents
GQ_SKILLS_CLOUDE_DIR=.cloude
GQ_SKILLS_GITHUB_CLIENT_ID=<oauth-app-client-id>
GQ_SKILLS_GITHUB_SCOPE=repo
GITHUB_TOKEN=<token>
GH_TOKEN=<token>
```

Para repos privados o limites de rate limit de GitHub, exporta `GITHUB_TOKEN`
o `GH_TOKEN`, o inicia sesion con GitHub desde el CLI.

### Autorizar acceso a repos privados

`gq-skills login` usa GitHub Device Flow: abre el navegador, muestra un codigo
de autorizacion y guarda el token en la configuracion local del usuario. Luego
`gq-skills add` usa ese token automaticamente si no hay `GITHUB_TOKEN` ni
`GH_TOKEN`.

GitHub requiere un Client ID de una OAuth App con Device Flow habilitado. Una
vez creada la app, puedes pasarlo por variable de entorno:

```bash
GQ_SKILLS_GITHUB_CLIENT_ID=<oauth-app-client-id>
gq-skills login
```

O directamente por argumento:

```bash
gq-skills login --client-id <oauth-app-client-id>
```

El permiso default es `repo`, necesario para leer contenido de repos privados.
Puedes cambiarlo con `--scope` si tu organizacion usa otra politica:

```bash
gq-skills login --client-id <oauth-app-client-id> --scope repo
```

## Instalar el CLI

### Usar sin instalar

Cuando el paquete este publicado en npm, se puede ejecutar directamente:

```bash
npx @geminus/gq-skills add packs/backend --repo tu-org/gq-skills
```

Tambien se puede usar pnpm:

```bash
pnpm dlx @geminus/gq-skills add packs/backend --repo tu-org/gq-skills
```

### Instalar globalmente

Con npm:

```bash
npm install --global @geminus/gq-skills
gq-skills add packs/backend --repo tu-org/gq-skills
```

Con pnpm:

```bash
pnpm add --global @geminus/gq-skills
gq-skills add packs/backend --repo tu-org/gq-skills
```

### Instalar localmente para desarrollo

Desde este repositorio:

```bash
corepack enable
pnpm install
pnpm run build
```

Ejecutar el binario compilado:

```bash
node dist/index.js --help
node dist/index.js add packs/backend --repo tu-org/gq-skills --dry-run
```

Crear un link global de desarrollo:

```bash
pnpm link --global
gq-skills --help
```

Para quitar el link global:

```bash
pnpm remove --global gq-skills
```

## Desarrollo

Instalar dependencias:

```bash
corepack enable
pnpm install
```

Verificar tipos:

```bash
pnpm run typecheck
```

Ejecutar tests:

```bash
pnpm test
```

Compilar:

```bash
pnpm run build
```

Flujo recomendado antes de publicar o abrir un PR:

```bash
pnpm install
pnpm run typecheck
pnpm run build
pnpm test
```

pnpm 11 bloquea build scripts de dependencias por seguridad. Este repositorio
aprueba el build de `esbuild` en [pnpm-workspace.yaml](pnpm-workspace.yaml),
porque Vitest lo necesita para funcionar correctamente.

## Compilar y empaquetar

Compilar el proyecto genera el binario en `dist/index.js`:

```bash
pnpm run build
```

Probar el CLI compilado:

```bash
node dist/index.js --version
node dist/index.js --help
```

Crear un paquete `.tgz` local para probar la instalacion:

```bash
pnpm pack
```

Instalar el paquete generado en otro proyecto:

```bash
npm install --global ./gq-skills-0.1.0.tgz
gq-skills --help
```

El script `prepack` compila automaticamente antes de empaquetar:

```json
"prepack": "tsc -p tsconfig.build.json"
```

## Actualizar version

Antes de cambiar la version, valida el proyecto:

```bash
pnpm install
pnpm run typecheck
pnpm run build
pnpm test
```

Actualizar version patch, minor o major:

```bash
pnpm version patch
pnpm version minor
pnpm version major
```

Tambien se puede fijar una version exacta:

```bash
pnpm version 0.2.0
```

Luego vuelve a empaquetar y prueba el resultado:

```bash
pnpm pack
npm install --global ./gq-skills-<version>.tgz
gq-skills --version
```

Si el paquete se publica en npm, el flujo recomendado es:

```bash
pnpm run typecheck
pnpm run build
pnpm test
pnpm pack
npm publish
```

Para publicar una version beta o de prueba:

```bash
npm publish --tag beta
```

Despues de publicar, se puede ejecutar con:

```bash
npx @geminus/gq-skills --version
npx @geminus/gq-skills add packs/backend --repo tu-org/gq-skills
```

## Estructura del proyecto

```text
src/index.ts           Codigo del CLI.
test/index.test.ts     Tests con Vitest.
dist/                  Salida compilada, generada por pnpm run build.
package.json           Metadata, binario y scripts del paquete.
pnpm-lock.yaml         Lockfile de dependencias.
pnpm-workspace.yaml    Configuracion de pnpm 11 para builds aprobados.
tsconfig.json          Configuracion TypeScript para desarrollo y tests.
tsconfig.build.json    Configuracion TypeScript para compilar src a dist.
```

## Troubleshooting

Si `pnpm install` usa una version inesperada, confirma Corepack:

```bash
corepack enable
corepack pnpm --version
```

Si pnpm bloquea un build script de una dependencia nueva:

```bash
pnpm approve-builds
```

Si el link `.cloude/skills` ya existe y no es un link, el CLI se detiene para
no sobrescribir contenido manual. Mueve o borra esa carpeta antes de volver a
ejecutar el comando.