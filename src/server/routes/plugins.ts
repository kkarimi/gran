import { granolaPluginPath, granolaTransportPaths } from "../../transport.ts";
import { readJsonBody, sendJson, type GranolaServerRouteContext } from "../http-utils.ts";

export async function handlePluginRoute(context: GranolaServerRouteContext): Promise<boolean> {
  const { app, method, originHeaders, path, request, response } = context;

  if (method === "GET" && path === granolaTransportPaths.plugins) {
    sendJson(response, await app.listPlugins(), { headers: originHeaders });
    return true;
  }

  if (method === "POST" && path.startsWith(`${granolaTransportPaths.plugins}/`)) {
    const body = await readJsonBody(request);
    if (typeof body.enabled !== "boolean") {
      throw new Error("plugin enabled flag is required");
    }

    const pluginId = decodeURIComponent(path.slice(`${granolaTransportPaths.plugins}/`.length));
    if (!pluginId || path !== granolaPluginPath(pluginId)) {
      throw new Error("plugin not found");
    }

    sendJson(response, await app.setPluginEnabled(pluginId, body.enabled), {
      headers: originHeaders,
    });
    return true;
  }

  return false;
}
