import { granolaTransportPaths } from "../../transport.ts";
import { granolaWebAssetForPath } from "../../web/assets.ts";
import { renderGranolaWebPage } from "../web.ts";
import {
  passwordCookieHeader,
  readJsonBody,
  sendHtml,
  sendJson,
  type GranolaServerRouteContext,
} from "../http-utils.ts";

export async function handlePublicRoute(context: GranolaServerRouteContext): Promise<boolean> {
  const { enableWebClient, method, originHeaders, path, response, securityPassword } = context;

  if (method === "GET" && path === granolaTransportPaths.root && enableWebClient) {
    sendHtml(
      response,
      renderGranolaWebPage({
        serverPasswordRequired: Boolean(securityPassword),
      }),
      200,
      originHeaders,
    );
    return true;
  }

  if (method === "GET" && enableWebClient) {
    const asset = granolaWebAssetForPath(path);
    if (asset) {
      response.writeHead(200, {
        "content-length": Buffer.byteLength(asset.body),
        "content-type": asset.contentType,
        ...originHeaders,
      });
      response.end(asset.body);
      return true;
    }
  }

  if (method === "GET" && path === granolaTransportPaths.health) {
    sendJson(
      response,
      {
        ok: true,
        service: "gran",
        version: context.app.config ? undefined : undefined,
      },
      { headers: originHeaders },
    );
    return true;
  }

  if (method === "GET" && path === granolaTransportPaths.serverInfo) {
    sendJson(response, context.serverInfo, { headers: originHeaders });
    return true;
  }

  if (method === "POST" && path === granolaTransportPaths.authUnlock) {
    if (!securityPassword) {
      sendJson(response, { ok: true, passwordRequired: false }, { headers: originHeaders });
      return true;
    }

    const body = await readJsonBody(context.request);
    const password =
      typeof body.password === "string" && body.password.trim() ? body.password : undefined;
    if (!password || password !== securityPassword) {
      sendJson(
        response,
        {
          authRequired: true,
          error: "invalid server password",
        },
        { headers: originHeaders, status: 401 },
      );
      return true;
    }

    sendJson(
      response,
      {
        ok: true,
        passwordRequired: true,
      },
      {
        headers: {
          ...originHeaders,
          "set-cookie": passwordCookieHeader(securityPassword),
        },
      },
    );
    return true;
  }

  return false;
}
