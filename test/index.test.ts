import { mkdir, readFile, lstat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp } from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Stats } from "node:fs";
import { addSkills, formatProgressLine, main } from "../src/index.js";

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
      dryRun: false
    });

    await expect(readFile(join(cwd, ".agents", "skills", "dotnet", "SKILL.md"), "utf8")).resolves.toBe("# dotnet");
    await expect(readFile(join(cwd, ".agents", "skills", "node", "SKILL.md"), "utf8")).resolves.toBe("# node");
    await expect(lstat(join(cwd, ".cloude", "skills"))).resolves.toSatisfy((stats) => (stats as Stats).isSymbolicLink());
    expect(console.log).toHaveBeenCalledWith("Encontrados 2 skills en 2 archivos.");
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
      dryRun: false
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
      dryRun: false
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
      dryRun: false
    })).rejects.toThrow("Si el repo es privado, ejecuta gq-skills login o define GITHUB_TOKEN.");
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
      dryRun: false
    })).rejects.toThrow("La ruta README.md en owner/repo@main no es una carpeta.");
  });

  it("formatea la barra de progreso con el archivo relativo", () => {
    expect(formatProgressLine(1, 2, "dotnet/SKILL.md")).toBe("Descargando [############------------] 1/2 dotnet/SKILL.md");
  });

  it("hace login con device flow y guarda el token", async () => {
    const configHome = await mkdtemp(join(tmpdir(), "gq-skills-config-"));
    process.env.GQ_SKILLS_CONFIG_HOME = configHome;
    vi.useFakeTimers();

    globalThis.fetch = vi.fn(async (url: string | URL | Request) => {
      const urlString = String(url);

      if (urlString === "https://github.com/login/device/code") {
        return jsonResponse({
          device_code: "device-code",
          user_code: "USER-CODE",
          verification_uri: "https://github.com/login/device",
          expires_in: 900,
          interval: 1
        });
      }

      if (urlString === "https://github.com/login/oauth/access_token") {
        return jsonResponse({ access_token: "stored-token" });
      }

      return new Response("not found", { status: 404 });
    }) as typeof fetch;

    const login = main(["login", "--client-id", "client-id", "--no-open"]);
    await vi.advanceTimersByTimeAsync(1000);
    await login;

    await expect(readFile(join(configHome, "gq-skills", "config.json"), "utf8")).resolves.toContain("stored-token");
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