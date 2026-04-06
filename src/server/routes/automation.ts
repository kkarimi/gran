import { granolaTransportPaths } from "../../transport.ts";
import {
  evaluationCasesFromBody,
  harnessesFromBody,
  parseAgentProviderKind,
  parseAutomationArtefactKind,
  parseAutomationArtefactStatus,
  parseAutomationRunStatus,
  parseInteger,
  parseProcessingIssueSeverity,
  readJsonBody,
  rulesFromBody,
  sendJson,
  stringArrayFromBody,
  type GranolaServerRouteContext,
} from "../http-utils.ts";

export async function handleAutomationRoute(context: GranolaServerRouteContext): Promise<boolean> {
  const { app, method, originHeaders, path, request, response, url } = context;

  if (method === "GET" && path === granolaTransportPaths.automationHarnesses) {
    sendJson(response, await app.listAgentHarnesses(), { headers: originHeaders });
    return true;
  }

  if (method === "POST" && path === granolaTransportPaths.automationHarnesses) {
    const body = await readJsonBody(request);
    sendJson(response, await app.saveAgentHarnesses(harnessesFromBody(body.harnesses)), {
      headers: originHeaders,
    });
    return true;
  }

  if (method === "GET" && path === granolaTransportPaths.automationHarnessExplain) {
    const meetingId = url.searchParams.get("meetingId")?.trim();
    if (!meetingId) {
      throw new Error("meeting id is required");
    }

    sendJson(response, await app.explainAgentHarnesses(meetingId), { headers: originHeaders });
    return true;
  }

  if (method === "GET" && path === granolaTransportPaths.automationRules) {
    sendJson(response, await app.listAutomationRules(), { headers: originHeaders });
    return true;
  }

  if (method === "POST" && path === granolaTransportPaths.automationRules) {
    const body = await readJsonBody(request);
    sendJson(response, await app.saveAutomationRules(rulesFromBody(body.rules)), {
      headers: originHeaders,
    });
    return true;
  }

  if (method === "GET" && path === granolaTransportPaths.automationMatches) {
    sendJson(
      response,
      await app.listAutomationMatches({
        limit: parseInteger(url.searchParams.get("limit")),
      }),
      { headers: originHeaders },
    );
    return true;
  }

  if (method === "GET" && path === granolaTransportPaths.automationArtefacts) {
    sendJson(
      response,
      await app.listAutomationArtefacts({
        kind: parseAutomationArtefactKind(url.searchParams.get("kind")),
        limit: parseInteger(url.searchParams.get("limit")),
        meetingId: url.searchParams.get("meetingId")?.trim() || undefined,
        status: parseAutomationArtefactStatus(url.searchParams.get("status")),
      }),
      { headers: originHeaders },
    );
    return true;
  }

  if (method === "GET" && path === granolaTransportPaths.processingIssues) {
    sendJson(
      response,
      await app.listProcessingIssues({
        limit: parseInteger(url.searchParams.get("limit")),
        meetingId: url.searchParams.get("meetingId")?.trim() || undefined,
        severity: parseProcessingIssueSeverity(url.searchParams.get("severity")),
      }),
      { headers: originHeaders },
    );
    return true;
  }

  if (method === "POST" && path === granolaTransportPaths.automationEvaluate) {
    const body = await readJsonBody(request);
    const options =
      body.options && typeof body.options === "object" && !Array.isArray(body.options)
        ? (body.options as Record<string, unknown>)
        : {};
    sendJson(
      response,
      await app.evaluateAutomationCases(evaluationCasesFromBody(body.cases), {
        dryRun: typeof options.dryRun === "boolean" ? options.dryRun : undefined,
        harnessIds: stringArrayFromBody(options.harnessIds),
        kind:
          parseAutomationArtefactKind(typeof options.kind === "string" ? options.kind : null) ??
          undefined,
        model:
          typeof options.model === "string" && options.model.trim()
            ? options.model.trim()
            : undefined,
        provider: parseAgentProviderKind(options.provider),
      }),
      { headers: originHeaders },
    );
    return true;
  }

  if (
    method === "POST" &&
    path.endsWith("/update") &&
    path.startsWith(`${granolaTransportPaths.automationArtefacts}/`)
  ) {
    const id = decodeURIComponent(
      path.slice(`${granolaTransportPaths.automationArtefacts}/`.length, -"/update".length),
    );
    const body = await readJsonBody(request);
    sendJson(
      response,
      await app.updateAutomationArtefact(id, {
        markdown: typeof body.markdown === "string" ? body.markdown : undefined,
        note: typeof body.note === "string" ? body.note : undefined,
        summary: typeof body.summary === "string" ? body.summary : undefined,
        title: typeof body.title === "string" ? body.title : undefined,
      }),
      { headers: originHeaders },
    );
    return true;
  }

  if (
    method === "POST" &&
    (path.endsWith("/approve") || path.endsWith("/reject")) &&
    path.startsWith(`${granolaTransportPaths.automationArtefacts}/`)
  ) {
    const decision = path.endsWith("/approve") ? "approve" : "reject";
    const id = decodeURIComponent(
      path.slice(`${granolaTransportPaths.automationArtefacts}/`.length, -`/${decision}`.length),
    );
    const body = await readJsonBody(request);
    sendJson(
      response,
      await app.resolveAutomationArtefact(id, decision, {
        note: typeof body.note === "string" ? body.note : undefined,
      }),
      { headers: originHeaders },
    );
    return true;
  }

  if (method === "GET" && path === granolaTransportPaths.automationRuns) {
    sendJson(
      response,
      await app.listAutomationRuns({
        limit: parseInteger(url.searchParams.get("limit")),
        status: parseAutomationRunStatus(url.searchParams.get("status")),
      }),
      { headers: originHeaders },
    );
    return true;
  }

  if (
    method === "POST" &&
    path.endsWith("/rerun") &&
    path.startsWith(`${granolaTransportPaths.automationArtefacts}/`)
  ) {
    const id = decodeURIComponent(
      path.slice(`${granolaTransportPaths.automationArtefacts}/`.length, -"/rerun".length),
    );
    sendJson(response, await app.rerunAutomationArtefact(id), { headers: originHeaders });
    return true;
  }

  if (
    method === "POST" &&
    path.endsWith("/recover") &&
    path.startsWith(`${granolaTransportPaths.processingIssues}/`)
  ) {
    const id = decodeURIComponent(
      path.slice(`${granolaTransportPaths.processingIssues}/`.length, -"/recover".length),
    );
    sendJson(response, await app.recoverProcessingIssue(id), { headers: originHeaders });
    return true;
  }

  if (
    method === "GET" &&
    path.startsWith(`${granolaTransportPaths.automationArtefacts}/`) &&
    !path.slice(`${granolaTransportPaths.automationArtefacts}/`.length).includes("/")
  ) {
    const id = decodeURIComponent(
      path.slice(`${granolaTransportPaths.automationArtefacts}/`.length),
    );
    sendJson(response, await app.getAutomationArtefact(id), { headers: originHeaders });
    return true;
  }

  if (
    method === "POST" &&
    (path.endsWith("/approve") || path.endsWith("/reject")) &&
    path.startsWith(`${granolaTransportPaths.automationRuns}/`)
  ) {
    const decision = path.endsWith("/approve") ? "approve" : "reject";
    const id = decodeURIComponent(
      path.slice(`${granolaTransportPaths.automationRuns}/`.length, -`/${decision}`.length),
    );
    const body = await readJsonBody(request);
    sendJson(
      response,
      await app.resolveAutomationRun(id, decision, {
        note: typeof body.note === "string" ? body.note : undefined,
      }),
      { headers: originHeaders },
    );
    return true;
  }

  return false;
}
