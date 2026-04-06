import { granolaTransportPaths } from "../../transport.ts";
import {
  formatSseEvent,
  parseInteger,
  readJsonBody,
  sendJson,
  type GranolaServerRouteContext,
} from "../http-utils.ts";

export async function handleSyncRoute(context: GranolaServerRouteContext): Promise<boolean> {
  const { app, method, originHeaders, path, request, response, url } = context;

  if (method === "GET" && path === granolaTransportPaths.state) {
    sendJson(response, app.getState(), { headers: originHeaders });
    return true;
  }

  if (method === "POST" && path === granolaTransportPaths.syncRun) {
    const body = await readJsonBody(request);
    sendJson(
      response,
      await app.sync({
        foreground: typeof body.foreground === "boolean" ? body.foreground : undefined,
        forceRefresh: typeof body.forceRefresh === "boolean" ? body.forceRefresh : undefined,
      }),
      { headers: originHeaders },
    );
    return true;
  }

  if (method === "GET" && path === granolaTransportPaths.syncEvents) {
    sendJson(
      response,
      await app.listSyncEvents({
        limit: parseInteger(url.searchParams.get("limit")) ?? 20,
      }),
      { headers: originHeaders },
    );
    return true;
  }

  if (method === "GET" && path === granolaTransportPaths.events) {
    response.writeHead(200, {
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "content-type": "text/event-stream; charset=utf-8",
      ...originHeaders,
    });
    response.write(
      formatSseEvent({
        state: app.getState(),
        timestamp: new Date().toISOString(),
        type: "state.updated",
      }),
    );
    const unsubscribe = app.subscribe((event) => {
      response.write(formatSseEvent(event));
    });
    request.on("close", () => {
      unsubscribe();
      response.end();
    });
    return true;
  }

  return false;
}
