import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { githubConfigPath } from "./config.js";
import type { AccessTokenResponse, DeviceCodeResponse, LoginOptions } from "./types.js";
import { info, success } from "./ui.js";

/**
 * Ejecuta el Device Flow de GitHub y persiste el token para reutilizarlo en
 * descargas posteriores sin volver a pedir autenticacion.
 */
export async function loginGithub(options: LoginOptions): Promise<void> {
  info("Solicitando autorizacion a GitHub...");
  const deviceCode = await requestDeviceCode(options);

  info(`Codigo: ${deviceCode.user_code}`);
  info(`URL: ${deviceCode.verification_uri}`);

  if (options.openBrowser) {
    await openBrowser(deviceCode.verification_uri);
  }

  info("Autoriza el acceso en el navegador. Esperando confirmacion...");

  const token = await pollAccessToken(options.clientId, deviceCode);
  await writeStoredGithubToken(token);
  success(`Login listo. Token guardado en ${githubConfigPath()}.`);
}

// Lee el token local si existe y filtra cualquier valor invalido del archivo JSON.
export async function readStoredGithubToken(): Promise<string | undefined> {
  try {
    const config = JSON.parse(await readFile(githubConfigPath(), "utf8")) as { githubToken?: unknown };
    return typeof config.githubToken === "string" && config.githubToken ? config.githubToken : undefined;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }

    throw error;
  }
}

// Pide a GitHub el codigo temporal que el usuario debe autorizar en el navegador.
async function requestDeviceCode(options: LoginOptions): Promise<DeviceCodeResponse> {
  const response = await fetch("https://github.com/login/device/code", {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "gq-skills"
    },
    body: new URLSearchParams({
      client_id: options.clientId,
      scope: options.scope
    })
  });

  if (response.status === 404) {
    throw new Error("GitHub no encontro una OAuth App para ese --client-id. Verifica que sea el Client ID de una OAuth App con Device Flow habilitado, no un email ni el nombre de usuario.");
  }

  if (!response.ok) {
    throw new Error(`GitHub respondio ${response.status}: ${await response.text()}`);
  }

  const payload = await response.json() as DeviceCodeResponse;
  if (!payload.device_code || !payload.user_code || !payload.verification_uri) {
    throw new Error("GitHub no devolvio un codigo de autorizacion valido.");
  }

  return payload;
}

/**
 * Hace polling hasta recibir un access token o hasta que el codigo expire.
 * interval se ajusta si GitHub pide bajar la frecuencia con slow_down.
 */
async function pollAccessToken(clientId: string, deviceCode: DeviceCodeResponse): Promise<string> {
  let interval = Math.max(deviceCode.interval ?? 5, 1);
  const expiresAt = Date.now() + deviceCode.expires_in * 1000;

  while (Date.now() < expiresAt) {
    await delay(interval * 1000);

    const response = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "gq-skills"
      },
      body: new URLSearchParams({
        client_id: clientId,
        device_code: deviceCode.device_code,
        grant_type: "urn:ietf:params:oauth:grant-type:device_code"
      })
    });

    if (!response.ok) {
      throw new Error(`GitHub respondio ${response.status}: ${await response.text()}`);
    }

    const payload = await response.json() as AccessTokenResponse;
    if (payload.access_token) {
      return payload.access_token;
    }

    switch (payload.error) {
      case "authorization_pending":
        break;
      case "slow_down":
        interval += 5;
        break;
      case "access_denied":
        throw new Error("Autorizacion cancelada en GitHub.");
      case "expired_token":
        throw new Error("El codigo de autorizacion expiro. Ejecuta gq-skills login otra vez.");
      default:
        throw new Error(payload.error_description ?? payload.error ?? "GitHub no devolvio un token de acceso.");
    }
  }

  throw new Error("El codigo de autorizacion expiro. Ejecuta gq-skills login otra vez.");
}

// Guarda el token en un archivo de configuracion local para futuras ejecuciones del CLI.
async function writeStoredGithubToken(token: string): Promise<void> {
  const configPath = githubConfigPath();
  await mkdir(dirname(configPath), { recursive: true });
  await writeFile(configPath, `${JSON.stringify({ githubToken: token }, null, 2)}\n`, { mode: 0o600 });
}

// Intenta abrir el navegador por plataforma, pero no interrumpe el login si falla.
async function openBrowser(url: string): Promise<void> {
  const command = process.platform === "win32" ? "cmd" : process.platform === "darwin" ? "open" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];

  await new Promise<void>((resolve) => {
    const child = spawn(command, args, { detached: true, stdio: "ignore" });
    child.once("error", () => resolve());
    child.unref();
    resolve();
  });
}