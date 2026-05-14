import { mkdir, readFile, lstat } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp } from "node:fs/promises";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Stats } from "node:fs";
import { addSkills } from "../src/index.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
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