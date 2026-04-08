import { granolaTransportPaths } from "../../transport.ts";
import {
  folderIdFromBody,
  noteFormatFromBody,
  parseInteger,
  readJsonBody,
  sendJson,
  transcriptFormatFromBody,
  type GranolaServerRouteContext,
} from "../http-utils.ts";

export async function handleExportRoute(context: GranolaServerRouteContext): Promise<boolean> {
  const { app, method, originHeaders, path, request, response, url } = context;

  if (method === "POST" && path === granolaTransportPaths.exportNotes) {
    const body = await readJsonBody(request);
    const result = await app.exportNotes(noteFormatFromBody(body.format), {
      folderId: folderIdFromBody(body.folderId),
      targetId: typeof body.targetId === "string" ? body.targetId : undefined,
    });
    sendJson(response, result, { headers: originHeaders, status: 202 });
    return true;
  }

  if (method === "GET" && path === granolaTransportPaths.exportJobs) {
    const limit = parseInteger(url.searchParams.get("limit"));
    const result = await app.listExportJobs({ limit });
    sendJson(response, result, { headers: originHeaders });
    return true;
  }

  if (method === "GET" && path === granolaTransportPaths.exportTargets) {
    const result = await app.listExportTargets();
    sendJson(response, result, { headers: originHeaders });
    return true;
  }

  if (method === "PUT" && path === granolaTransportPaths.exportTargets) {
    const body = await readJsonBody(request);
    const result = await app.saveExportTargets(Array.isArray(body.targets) ? body.targets : []);
    sendJson(response, result, { headers: originHeaders });
    return true;
  }

  if (
    method === "POST" &&
    path.startsWith(`${granolaTransportPaths.exportJobs}/`) &&
    path.endsWith("/rerun")
  ) {
    const id = decodeURIComponent(
      path.slice(`${granolaTransportPaths.exportJobs}/`.length, -"/rerun".length),
    );
    if (!id) {
      throw new Error("export job id is required");
    }

    const result = await app.rerunExportJob(id);
    sendJson(response, result, { headers: originHeaders, status: 202 });
    return true;
  }

  if (method === "POST" && path === granolaTransportPaths.exportTranscripts) {
    const body = await readJsonBody(request);
    const result = await app.exportTranscripts(transcriptFormatFromBody(body.format), {
      folderId: folderIdFromBody(body.folderId),
      targetId: typeof body.targetId === "string" ? body.targetId : undefined,
    });
    sendJson(response, result, { headers: originHeaders, status: 202 });
    return true;
  }

  return false;
}
