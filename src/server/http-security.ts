import type { IncomingMessage } from "node:http";

import { granolaTransportPaths } from "../transport.ts";
import { granolaWebAssetForPath } from "../web/assets.ts";
import { parseCookies } from "./http-utils.ts";

export function allowedOriginHeaders(origin: string): Record<string, string> {
  return {
    "access-control-allow-credentials": "true",
    "access-control-allow-headers": "content-type, x-granola-password",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-origin": origin,
    vary: "Origin",
  };
}

export function isTrustedOrigin(
  origin: string | undefined,
  request: IncomingMessage,
  trustedOrigins: string[],
): boolean {
  if (!origin) {
    return true;
  }

  try {
    const parsed = new URL(origin);
    const host = request.headers.host;
    if (host && parsed.host === host) {
      return true;
    }
  } catch {
    return false;
  }

  return trustedOrigins.includes(origin);
}

export function isPasswordAuthenticated(
  request: IncomingMessage,
  password: string,
  cookieName: string,
): boolean {
  const headerPassword = request.headers["x-granola-password"];
  if (typeof headerPassword === "string" && headerPassword === password) {
    return true;
  }

  const authorization = request.headers.authorization;
  if (authorization?.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length) === password;
  }

  return parseCookies(request)[cookieName] === password;
}

export function publicRoute(path: string, enableWebClient: boolean): boolean {
  return (
    path === granolaTransportPaths.health ||
    path === granolaTransportPaths.serverInfo ||
    path === granolaTransportPaths.authUnlock ||
    (enableWebClient &&
      (path === granolaTransportPaths.root || Boolean(granolaWebAssetForPath(path))))
  );
}
