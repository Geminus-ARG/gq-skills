# gq-skills

CLI para instalar skills propios desde carpetas de un repositorio GitHub.

El comando principal es:

```bash
npx @geminus-qhom/gq-skills add <folder>
```

Por defecto, `add <folder>` resuelve la ruta remota dentro de `skills/`.
Por ejemplo, `add documents` busca `skills/documents`. Si quieres apuntar a
otra carpeta del repositorio, usa un slash inicial: `add /packs/backend`.

El CLI descarga recursivamente la carpeta indicada desde GitHub, copia los
skills a `.agents/skills` y crea un link `.cloude/skills` que apunta a
`.agents/skills`.

El paquete publicado en npm es `@geminus-qhom/gq-skills`, pero el binario que
queda disponible al instalarlo es `gq-skills`.

Si necesitas compilar el proyecto, empaquetarlo o publicarlo en npm, consulta
[README.dev.md](README.dev.md).

## Inicio rapido

Instalar los skills del repositorio oficial sin instalar el CLI globalmente:

```bash
npx @geminus-qhom/gq-skills add documents --repo Geminus-ARG/gq-skills
```

Instalar el CLI globalmente y reutilizarlo despues:

```bash
npm install --global @geminus-qhom/gq-skills
gq-skills add documents --repo Geminus-ARG/gq-skills
```

## Contenido

- [Requisitos](#requisitos)
- [Uso rapido](#uso-rapido)
- [Que instala](#que-instala)
- [Convenciones de carpetas](#convenciones-de-carpetas)
- [Opciones del CLI](#opciones-del-cli)
- [Instalar el CLI](#instalar-el-cli)
- [Troubleshooting](#troubleshooting)

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

Para usuarios del equipo, la forma mas simple es ejecutar el paquete publicado
sin instalarlo globalmente:

```bash
npx @geminus-qhom/gq-skills add documents --repo Geminus-ARG/gq-skills
```

Si lo van a usar seguido, conviene instalarlo una sola vez:

```bash
npm install --global @geminus-qhom/gq-skills
gq-skills add documents --repo Geminus-ARG/gq-skills
```

Con pnpm:

```bash
pnpm add --global @geminus-qhom/gq-skills
gq-skills add documents --repo Geminus-ARG/gq-skills
```

Instalar skills desde una carpeta del repo configurado por defecto:

```bash
npx @geminus-qhom/gq-skills add documents
```

Instalar desde una carpeta fuera de `skills/`:

```bash
npx @geminus-qhom/gq-skills add /packs/backend --repo tu-org/gq-skills
```

Instalar desde una rama, tag o commit especifico:

```bash
npx @geminus-qhom/gq-skills add /packs/backend --repo tu-org/gq-skills --ref main
```

Ver que haria el comando sin escribir archivos:

```bash
npx @geminus-qhom/gq-skills add /packs/backend --repo tu-org/gq-skills --dry-run
```

Antes de descargar, el CLI informa cuantos skills y archivos encontro. Durante
la descarga muestra una barra de progreso con el archivo relativo que esta
bajando:

```text
Buscando skills/documents en tu-org/gq-skills@main...
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

Cuando usas `add <folder>` sin slash inicial, el CLI busca dentro de `skills/`.
Cuando usas `add /ruta`, toma la ruta exacta desde la raiz del repositorio.

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

<folder>                  Busca `skills/<folder>` por defecto. Usa `/ruta` para una ruta exacta del repo.
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

El paquete publicado en npm se puede ejecutar directamente:

```bash
npx @geminus-qhom/gq-skills add documents --repo tu-org/gq-skills
```

Tambien se puede usar pnpm:

```bash
pnpm dlx @geminus-qhom/gq-skills add documents --repo tu-org/gq-skills
```

### Instalar globalmente

Con npm:

```bash
npm install --global @geminus-qhom/gq-skills
gq-skills add documents --repo tu-org/gq-skills
```

Con pnpm:

```bash
pnpm add --global @geminus-qhom/gq-skills
gq-skills add documents --repo tu-org/gq-skills
```

### Instalar para todo el equipo

Pasos minimos para cualquier desarrollador:

```bash
node --version
npx @geminus-qhom/gq-skills add documents --repo Geminus-ARG/gq-skills
```

El nombre del paquete para instalar es `@geminus-qhom/gq-skills`. El comando
que se ejecuta despues de instalarlo sigue siendo `gq-skills`.

Si quieren dejar el CLI instalado en su maquina:

```bash
npm install --global @geminus-qhom/gq-skills
gq-skills add documents --repo Geminus-ARG/gq-skills
```

O con pnpm:

```bash
pnpm add --global @geminus-qhom/gq-skills
gq-skills add documents --repo Geminus-ARG/gq-skills
```

Si el repo origen es privado, pueden usar un token temporal:

En PowerShell:

```powershell
$env:GITHUB_TOKEN="<token>"
npx @geminus-qhom/gq-skills add documents --repo Geminus-ARG/gq-skills
```

En cmd.exe:

```bat
set GITHUB_TOKEN=<token>
npx @geminus-qhom/gq-skills add documents --repo Geminus-ARG/gq-skills
```

En macOS o Linux:

```bash
GITHUB_TOKEN=<token> npx @geminus-qhom/gq-skills add documents --repo Geminus-ARG/gq-skills
```

O guardar un token con el login del CLI:

```bash
gq-skills login --client-id <oauth-app-client-id>
gq-skills add documents --repo Geminus-ARG/gq-skills
```

## Troubleshooting

Si `pnpm install` usa una version inesperada, confirma Corepack:

```bash
corepack enable
corepack pnpm --version
```

Si `pnpm add --global @geminus-qhom/gq-skills` o `npm install --global @geminus-qhom/gq-skills`
devuelve `404`, revisa que estes usando exactamente el scope publicado.
`@geminus/gq-skills` y `@geminus-qhom/gq-skills` son paquetes distintos.

Si el link `.cloude/skills` ya existe y no es un link, el CLI se detiene para
no sobrescribir contenido manual. Mueve o borra esa carpeta antes de volver a
ejecutar el comando.