import { mkdir, readFile, lstat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp } from "node:fs/promises";
import { PassThrough } from "node:stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Stats } from "node:fs";
import { addSkills, formatProgressLine, main } from "../src/index.js";
import { selectSkillFolders } from "../src/ui.js";

const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  process.exitCode = undefined;
});

afterEach(() => {
  vi.useRealTimers();
  globalThis.fetch = originalFetch;
  process.env = { ...originalEnv };
  vi.restoreAllMocks();
});

describe("addSkills", () => {
  it("instala una carpeta que contiene varios skills y crea el link de .cloude", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "gq-skills-"));
    mockGithub({
      "packs/backend": [
        { type: "dir", name: "dotnet", path: "packs/backend/dotnet", download_url: null },
        { type: "dir", name: "node", path: "packs/backend/node", download_url: null }
      ],
      "packs/backend/dotnet": [
        { type: "file", name: "SKILL.md", path: "packs/backend/dotnet/SKILL.md", download_url: "https://download/dotnet" }
      ],
      "packs/backend/node": [
        { type: "file", name: "SKILL.md", path: "packs/backend/node/SKILL.md", download_url: "https://download/node" }
      ]
    }, {
      "https://download/dotnet": "# dotnet",
      "https://download/node": "# node"
    });

    await addSkills({
      folder: "packs/backend",
      repo: "owner/repo",
      ref: "main",
      cwd,
      agentsDir: ".agents",
      cloudeDir: ".cloude",
      dryRun: false,
      interactive: true
    });

    await expect(readFile(join(cwd, ".agents", "skills", "dotnet", "SKILL.md"), "utf8")).resolves.toBe("# dotnet");
    await expect(readFile(join(cwd, ".agents", "skills", "node", "SKILL.md"), "utf8")).resolves.toBe("# node");
    await expect(lstat(join(cwd, ".cloude", "skills"))).resolves.toSatisfy((stats) => (stats as Stats).isSymbolicLink());
    expect(console.log).toHaveBeenCalledWith("Encontrados 2 skills en 2 archivos.");
  });

  it("permite elegir que carpetas descargar antes de instalar", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "gq-skills-"));
    const selectFolders = vi.fn(async () => ["node"]);

    mockGithub({
      "packs/backend": [
        { type: "dir", name: "dotnet", path: "packs/backend/dotnet", download_url: null },
        { type: "dir", name: "node", path: "packs/backend/node", download_url: null }
      ],
      "packs/backend/dotnet": [
        { type: "file", name: "SKILL.md", path: "packs/backend/dotnet/SKILL.md", download_url: "https://download/dotnet" }
      ],
      "packs/backend/node": [
        { type: "file", name: "SKILL.md", path: "packs/backend/node/SKILL.md", download_url: "https://download/node" }
      ]
    }, {
      "https://download/dotnet": "# dotnet",
      "https://download/node": "# node"
    });

    await addSkills({
      folder: "packs/backend",
      repo: "owner/repo",
      ref: "main",
      cwd,
      agentsDir: ".agents",
      cloudeDir: ".cloude",
      dryRun: false,
      interactive: true
    }, {
      selectFolders
    });

    expect(selectFolders).toHaveBeenCalledWith([
      { id: "dotnet", displayName: "dotnet", fileCount: 1 },
      { id: "node", displayName: "node", fileCount: 1 }
    ]);
    await expect(readFile(join(cwd, ".agents", "skills", "node", "SKILL.md"), "utf8")).resolves.toBe("# node");
    await expect(readFile(join(cwd, ".agents", "skills", "dotnet", "SKILL.md"), "utf8")).rejects.toThrow();
  });

  it("cancela la instalacion si el selector interactivo aborta", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "gq-skills-"));

    mockGithub({
      "packs/backend": [
        { type: "dir", name: "dotnet", path: "packs/backend/dotnet", download_url: null },
        { type: "dir", name: "node", path: "packs/backend/node", download_url: null }
      ],
      "packs/backend/dotnet": [
        { type: "file", name: "SKILL.md", path: "packs/backend/dotnet/SKILL.md", download_url: "https://download/dotnet" }
      ],
      "packs/backend/node": [
        { type: "file", name: "SKILL.md", path: "packs/backend/node/SKILL.md", download_url: "https://download/node" }
      ]
    }, {
      "https://download/dotnet": "# dotnet",
      "https://download/node": "# node"
    });

    await expect(addSkills({
      folder: "packs/backend",
      repo: "owner/repo",
      ref: "main",
      cwd,
      agentsDir: ".agents",
      cloudeDir: ".cloude",
      dryRun: false,
      interactive: true
    }, {
      selectFolders: async () => null
    })).rejects.toThrow("Proceso cancelado por el usuario.");
  });

  it("omite el selector cuando interactive es false", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "gq-skills-"));
    const selectFolders = vi.fn(async () => ["node"]);

    mockGithub({
      "packs/backend": [
        { type: "dir", name: "dotnet", path: "packs/backend/dotnet", download_url: null },
        { type: "dir", name: "node", path: "packs/backend/node", download_url: null }
      ],
      "packs/backend/dotnet": [
        { type: "file", name: "SKILL.md", path: "packs/backend/dotnet/SKILL.md", download_url: "https://download/dotnet" }
      ],
      "packs/backend/node": [
        { type: "file", name: "SKILL.md", path: "packs/backend/node/SKILL.md", download_url: "https://download/node" }
      ]
    }, {
      "https://download/dotnet": "# dotnet",
      "https://download/node": "# node"
    });

    await addSkills({
      folder: "packs/backend",
      repo: "owner/repo",
      ref: "main",
      cwd,
      agentsDir: ".agents",
      cloudeDir: ".cloude",
      dryRun: false,
      interactive: false
    }, {
      selectFolders
    });

    expect(selectFolders).not.toHaveBeenCalled();
    await expect(readFile(join(cwd, ".agents", "skills", "node", "SKILL.md"), "utf8")).resolves.toBe("# node");
    await expect(readFile(join(cwd, ".agents", "skills", "dotnet", "SKILL.md"), "utf8")).resolves.toBe("# dotnet");
  });

  it("instala una carpeta que es un skill individual dentro de .agents/skills", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "gq-skills-"));
    mockGithub({
      "skills/angular": [
        { type: "file", name: "SKILL.md", path: "skills/angular/SKILL.md", download_url: "https://download/angular" }
      ]
    }, {
      "https://download/angular": "# angular"
    });

    await addSkills({
      folder: "skills/angular",
      repo: "owner/repo",
      ref: "main",
      cwd,
      agentsDir: ".agents",
      cloudeDir: ".cloude",
      dryRun: false,
      interactive: true
    });

    await expect(readFile(join(cwd, ".agents", "skills", "angular", "SKILL.md"), "utf8")).resolves.toBe("# angular");
  });

  it("falla si .cloude/skills ya existe y no es link", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "gq-skills-"));
    await mkdir(join(cwd, ".cloude", "skills"), { recursive: true });
    mockGithub({
      "skills/angular": [
        { type: "file", name: "SKILL.md", path: "skills/angular/SKILL.md", download_url: "https://download/angular" }
      ]
    }, {
      "https://download/angular": "# angular"
    });

    await expect(addSkills({
      folder: "skills/angular",
      repo: "owner/repo",
      ref: "main",
      cwd,
      agentsDir: ".agents",
      cloudeDir: ".cloude",
      dryRun: false,
      interactive: true
    })).rejects.toThrow("no es un link");
  });

  it("falla si la carpeta remota no existe", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "gq-skills-"));
    mockGithub({}, {});

    await expect(addSkills({
      folder: "skills/missing",
      repo: "owner/repo",
      ref: "main",
      cwd,
      agentsDir: ".agents",
      cloudeDir: ".cloude",
      dryRun: false,
      interactive: true,
      token: "token"
    })).rejects.toThrow("No existe la carpeta skills/missing en owner/repo@main. Revisa que el token tenga permisos para ese repo.");
  });

  it("sugiere login si la carpeta remota no existe sin token", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "gq-skills-"));
    mockGithub({}, {});

    await expect(addSkills({
      folder: "skills/missing",
      repo: "owner/repo",
      ref: "main",
      cwd,
      agentsDir: ".agents",
      cloudeDir: ".cloude",
      dryRun: false,
      interactive: true
    })).rejects.toThrow("Si el repo es privado, ejecuta gq-skills login o define GITHUB_TOKEN.");
  });

  it("explica como resolver un 403 por rate limit al listar GitHub sin token", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "gq-skills-"));

    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({
      message: "API rate limit exceeded for 186.138.177.70. Authenticated requests get a higher rate limit.",
      documentation_url: "https://docs.github.com/rest/overview/resources-in-the-rest-api#rate-limiting"
    }), {
      status: 403,
      headers: { "Content-Type": "application/json" }
    })) as typeof fetch;

    await expect(addSkills({
      folder: "skills/documents",
      repo: "owner/repo",
      ref: "main",
      cwd,
      agentsDir: ".agents",
      cloudeDir: ".cloude",
      dryRun: false,
      interactive: true
    })).rejects.toThrow("GitHub bloqueo la consulta por rate limit al leer skills/documents en owner/repo@main. Ejecuta gq-skills login o define GITHUB_TOKEN para usar el limite autenticado, que es mas alto.");
  });

  it("falla si la ruta remota apunta a un archivo", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "gq-skills-"));
    mockGithub({
      "README.md": { type: "file", name: "README.md", path: "README.md", download_url: "https://download/readme" }
    }, {
      "https://download/readme": "# readme"
    });

    await expect(addSkills({
      folder: "README.md",
      repo: "owner/repo",
      ref: "main",
      cwd,
      agentsDir: ".agents",
      cloudeDir: ".cloude",
      dryRun: false,
      interactive: true
    })).rejects.toThrow("La ruta README.md en owner/repo@main no es una carpeta.");
  });

  it("formatea la barra de progreso con el archivo relativo", () => {
    expect(formatProgressLine(1, 2, "dotnet/SKILL.md")).toBe("Descargando [############------------] 1/2 dotnet/SKILL.md");
  });

  it("permite navegar y confirmar la seleccion interactiva con teclado", async () => {
    const { input, output } = createInteractiveStreams();

    const selectionPromise = selectSkillFolders([
      { id: "dotnet", displayName: "dotnet", fileCount: 3 },
      { id: "node", displayName: "node", fileCount: 2 }
    ], {
      input: input as unknown as NodeJS.ReadStream,
      output: output as unknown as NodeJS.WriteStream
    });

    input.write(" ");
    input.write("\u001B[B");
    input.write("\r");

    await expect(selectionPromise).resolves.toEqual(["node"]);
  });

  it("devuelve null cuando se pulsa escape en el selector interactivo", async () => {
    const { input, output } = createInteractiveStreams();

    const selectionPromise = selectSkillFolders([
      { id: "dotnet", displayName: "dotnet", fileCount: 3 },
      { id: "node", displayName: "node", fileCount: 2 }
    ], {
      input: input as unknown as NodeJS.ReadStream,
      output: output as unknown as NodeJS.WriteStream
    });

    input.write("\u001B");

    await expect(selectionPromise).resolves.toBeNull();
  });

  it("usa el token guardado al ejecutar add desde main", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "gq-skills-"));
    const configHome = await mkdtemp(join(tmpdir(), "gq-skills-config-"));
    process.env.GQ_SKILLS_CONFIG_HOME = configHome;
    await mkdir(join(configHome, "gq-skills"), { recursive: true });
    await writeFile(join(configHome, "gq-skills", "config.json"), JSON.stringify({ githubToken: "stored-token" }));

    globalThis.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const urlString = String(url);
      const authorization = new Headers(init?.headers).get("Authorization");

      if (urlString.startsWith("https://api.github.com/repos/owner/repo/contents/")) {
        expect(authorization).toBe("Bearer stored-token");
        return jsonResponse([
          { type: "file", name: "SKILL.md", path: "skills/angular/SKILL.md", download_url: "https://download/angular" }
        ]);
      }

      if (urlString === "https://download/angular") {
        expect(authorization).toBe("Bearer stored-token");
        return new Response("# angular", { status: 200 });
      }

      return new Response("not found", { status: 404 });
    }) as typeof fetch;

    await main(["add", "skills/angular", "--repo", "owner/repo", "--target", cwd]);

    await expect(readFile(join(cwd, ".agents", "skills", "angular", "SKILL.md"), "utf8")).resolves.toBe("# angular");
  });

  it("usa skills como carpeta base por defecto al ejecutar add desde main", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "gq-skills-"));

    globalThis.fetch = vi.fn(async (url: string | URL | Request) => {
      const urlString = String(url);

      if (urlString.startsWith("https://api.github.com/repos/owner/repo/contents/")) {
        expect(urlString).toContain("/contents/skills/documents?");
        return jsonResponse([
          { type: "file", name: "SKILL.md", path: "skills/documents/SKILL.md", download_url: "https://download/documents" }
        ]);
      }

      if (urlString === "https://download/documents") {
        return new Response("# documents", { status: 200 });
      }

      return new Response("not found", { status: 404 });
    }) as typeof fetch;

    await main(["add", "documents", "--repo", "owner/repo", "--target", cwd]);

    await expect(readFile(join(cwd, ".agents", "skills", "documents", "SKILL.md"), "utf8")).resolves.toBe("# documents");
  });

  it("usa la ruta exacta cuando add recibe un path absoluto de repo con slash inicial", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "gq-skills-"));

    globalThis.fetch = vi.fn(async (url: string | URL | Request) => {
      const urlString = String(url);

      if (urlString.startsWith("https://api.github.com/repos/owner/repo/contents/")) {
        expect(urlString).toContain("/contents/otra/documents?");
        return jsonResponse([
          { type: "file", name: "SKILL.md", path: "otra/documents/SKILL.md", download_url: "https://download/otra-documents" }
        ]);
      }

      if (urlString === "https://download/otra-documents") {
        return new Response("# otra documents", { status: 200 });
      }

      return new Response("not found", { status: 404 });
    }) as typeof fetch;

    await main(["add", "/otra/documents", "--repo", "owner/repo", "--target", cwd]);

    await expect(readFile(join(cwd, ".agents", "skills", "documents", "SKILL.md"), "utf8")).resolves.toBe("# otra documents");
  });

  it("acepta --no-interactive desde main", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "gq-skills-"));

    globalThis.fetch = vi.fn(async (url: string | URL | Request) => {
      const urlString = String(url);

      if (urlString.startsWith("https://api.github.com/repos/owner/repo/contents/")) {
        if (urlString.includes("/contents/packs/backend?")) {
          return jsonResponse([
            { type: "dir", name: "dotnet", path: "packs/backend/dotnet", download_url: null },
            { type: "dir", name: "node", path: "packs/backend/node", download_url: null }
          ]);
        }

        if (urlString.includes("/contents/packs/backend/dotnet?")) {
          return jsonResponse([
            { type: "file", name: "SKILL.md", path: "packs/backend/dotnet/SKILL.md", download_url: "https://download/dotnet" }
          ]);
        }

        if (urlString.includes("/contents/packs/backend/node?")) {
          return jsonResponse([
            { type: "file", name: "SKILL.md", path: "packs/backend/node/SKILL.md", download_url: "https://download/node" }
          ]);
        }
      }

      if (urlString === "https://download/dotnet") {
        return new Response("# dotnet", { status: 200 });
      }

      if (urlString === "https://download/node") {
        return new Response("# node", { status: 200 });
      }

      return new Response("not found", { status: 404 });
    }) as typeof fetch;

    await main(["add", "/packs/backend", "--repo", "owner/repo", "--target", cwd, "--no-interactive"]);

    await expect(readFile(join(cwd, ".agents", "skills", "dotnet", "SKILL.md"), "utf8")).resolves.toBe("# dotnet");
    await expect(readFile(join(cwd, ".agents", "skills", "node", "SKILL.md"), "utf8")).resolves.toBe("# node");
  });
});

function mockGithub(tree: Record<string, unknown>, downloads: Record<string, string>): void {
  globalThis.fetch = vi.fn(async (url: string | URL | Request) => {
    const urlString = String(url);
    const contentsPrefix = "https://api.github.com/repos/owner/repo/contents/";

    if (urlString.startsWith(contentsPrefix)) {
      const path = decodeURIComponent(urlString.slice(contentsPrefix.length).split("?", 1)[0]);
      return jsonResponse(tree[path]);
    }

    const body = downloads[urlString];
    if (body !== undefined) {
      return new Response(body, { status: 200 });
    }

    return new Response("not found", { status: 404 });
  }) as typeof fetch;
}

function jsonResponse(body: unknown): Response {
  return body === undefined
    ? new Response("not found", { status: 404 })
    : new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
}

function createInteractiveStreams(): {
  input: PassThrough & {
    isTTY: boolean;
    isRaw: boolean;
    setRawMode: (mode: boolean) => void;
  };
  output: PassThrough & {
    isTTY: boolean;
  };
} {
  const input = Object.assign(new PassThrough(), {
    isTTY: true,
    isRaw: false,
    setRawMode: vi.fn(function (this: PassThrough & { isRaw: boolean }, value: boolean) {
      this.isRaw = value;
    })
  });

  const output = Object.assign(new PassThrough(), {
    isTTY: true
  });

  return { input, output };
}