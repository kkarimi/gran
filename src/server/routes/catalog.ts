import { granolaTransportPaths } from "../../transport.ts";
import {
  parseInteger,
  parseMeetingSort,
  sendJson,
  type GranolaServerRouteContext,
} from "../http-utils.ts";

export async function handleCatalogRoute(context: GranolaServerRouteContext): Promise<boolean> {
  const { app, method, originHeaders, path, response, url } = context;

  if (method === "GET" && path === granolaTransportPaths.meetings) {
    const folderId = url.searchParams.get("folderId")?.trim() || undefined;
    const limit = parseInteger(url.searchParams.get("limit"));
    const refresh = url.searchParams.get("refresh") === "true";
    const search = url.searchParams.get("search")?.trim() || undefined;
    const sort = parseMeetingSort(url.searchParams.get("sort"));
    const updatedFrom = url.searchParams.get("updatedFrom")?.trim() || undefined;
    const updatedTo = url.searchParams.get("updatedTo")?.trim() || undefined;
    const result = await app.listMeetings({
      folderId,
      forceRefresh: refresh,
      limit,
      search,
      sort,
      updatedFrom,
      updatedTo,
    });
    sendJson(
      response,
      {
        folderId,
        meetings: result.meetings,
        refresh,
        search,
        source: result.source,
        sort,
        updatedFrom,
        updatedTo,
      },
      { headers: originHeaders },
    );
    return true;
  }

  if (method === "GET" && path === granolaTransportPaths.folders) {
    const limit = parseInteger(url.searchParams.get("limit"));
    const refresh = url.searchParams.get("refresh") === "true";
    const search = url.searchParams.get("search")?.trim() || undefined;
    const result = await app.listFolders({
      forceRefresh: refresh,
      limit,
      search,
    });
    sendJson(
      response,
      {
        folders: result.folders,
        refresh,
        search,
      },
      { headers: originHeaders },
    );
    return true;
  }

  if (method === "GET" && path === granolaTransportPaths.folderResolve) {
    const query = url.searchParams.get("q")?.trim();
    if (!query) {
      throw new Error("folder query is required");
    }

    const folder = await app.findFolder(query);
    sendJson(response, folder, { headers: originHeaders });
    return true;
  }

  if (method === "GET" && path === granolaTransportPaths.meetingResolve) {
    const query = url.searchParams.get("q")?.trim();
    if (!query) {
      throw new Error("meeting query is required");
    }

    const meeting = await app.findMeeting(query, {
      requireCache: url.searchParams.get("includeTranscript") === "true",
    });
    sendJson(response, meeting, { headers: originHeaders });
    return true;
  }

  if (
    method === "GET" &&
    path.startsWith(`${granolaTransportPaths.folders}/`) &&
    path !== granolaTransportPaths.folderResolve
  ) {
    const id = decodeURIComponent(path.slice(`${granolaTransportPaths.folders}/`.length));
    if (!id) {
      throw new Error("folder id is required");
    }

    const folder = await app.getFolder(id);
    sendJson(response, folder, { headers: originHeaders });
    return true;
  }

  if (
    method === "GET" &&
    path.startsWith(`${granolaTransportPaths.meetings}/`) &&
    path !== granolaTransportPaths.meetingResolve
  ) {
    const id = decodeURIComponent(path.slice(`${granolaTransportPaths.meetings}/`.length));
    if (!id) {
      throw new Error("meeting id is required");
    }

    const meeting = await app.getMeeting(id, {
      requireCache: url.searchParams.get("includeTranscript") === "true",
    });
    sendJson(response, meeting, { headers: originHeaders });
    return true;
  }

  return false;
}
