# gq-skills: compilacion y despliegue

Este documento esta orientado a quienes mantienen el repositorio y necesitan
compilar el CLI, probar el paquete localmente y publicarlo en npm. Para uso e
instalacion del paquete publicado, consulta [README.md](README.md).

## Contenido

- [Requisitos](#requisitos)
- [Desarrollo](#desarrollo)
- [Compilar y probar localmente](#compilar-y-probar-localmente)
- [Empaquetado](#empaquetado)
- [Versionado](#versionado)
- [Publicacion en npm](#publicacion-en-npm)
- [Estructura del proyecto](#estructura-del-proyecto)

## Requisitos

- Node.js 20 o superior.
- Corepack habilitado.
- pnpm fijado por [package.json](package.json).

```bash
node --version
corepack enable
corepack pnpm --version
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

Flujo recomendado antes de abrir un PR o publicar:

```bash
pnpm install
pnpm run typecheck
pnpm run build
pnpm test
```

pnpm 11 bloquea build scripts de dependencias por seguridad. Este repositorio
aprueba el build de `esbuild` en [pnpm-workspace.yaml](pnpm-workspace.yaml),
porque Vitest lo necesita para funcionar correctamente.

Si pnpm bloquea un build script de una dependencia nueva:

```bash
pnpm approve-builds
```

## Compilar y probar localmente

La compilacion genera el binario en `dist/index.js`:

```bash
pnpm run build
```

Probar el CLI compilado:

```bash
node dist/index.js --version
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

## Empaquetado

Crear un paquete `.tgz` local:

```bash
pnpm pack
```

Instalar el paquete generado:

```bash
npm install --global ./geminus-qhom-gq-skills-0.1.0.tgz
gq-skills --help
```

El script `prepack` compila automaticamente antes de empaquetar:

```json
"prepack": "tsc -p tsconfig.build.json"
```

## Versionado

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

Probar el resultado empaquetado:

```bash
pnpm pack
npm install --global ./geminus-qhom-gq-skills-<version>.tgz
gq-skills --version
```

## Publicacion en npm

Flujo recomendado para publicar:

```bash
pnpm run typecheck
pnpm run build
pnpm test
pnpm pack
npm publish --access public
```

Para publicar una version beta o de prueba:

```bash
npm publish --tag beta --access public
```

Despues de publicar, valida desde npm:

```bash
npx @geminus-qhom/gq-skills --version
npx @geminus-qhom/gq-skills add packs/backend --repo tu-org/gq-skills
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