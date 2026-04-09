import {
  buildObsidianOpenFileUri,
  buildObsidianSearchUri,
  createGranolaApp,
  type FolderRecord,
  type GranolaApp,
  type GranolaAppApi,
  type GranolaAppSurface,
  type GranolaExportTarget,
  type GranolaExportTargetKind,
  type GranolaNotesExportResult,
  type GranolaTranscriptsExportResult,
  type NoteOutputFormat,
  type TranscriptOutputFormat,
} from "../../../src/app/index.ts";
import { loadConfig, type FlagValues } from "../../../src/config.ts";
import {
  createDefaultGranolaApiClient,
  createDefaultGranolaAuth,
  createDefaultGranolaAuthController,
  createDefaultGranolaRuntime,
  inspectDefaultGranolaAuth,
  loadOptionalGranolaCache,
  type DefaultGranolaAuthController,
  type DefaultGranolaAuthInfo,
  type DefaultGranolaClient,
  type DefaultGranolaRuntime,
} from "../../../src/client/default.ts";
import {
  connectGranService,
  createGranolaServerClient,
  GranolaServerClient,
  type GranolaServerClientOptions,
} from "./service.ts";
import {
  createGranExportTarget,
  exportGranArchive,
  listGranExportTargetDefinitions,
  removeGranExportTarget,
  saveGranExportTarget,
  type CreateGranExportTargetOptions,
  type GranSdkArchiveExportOptions,
  type GranSdkArchiveExportResult,
} from "./exports.ts";
import type {
  AppConfig,
  GranolaAgentProviderKind,
  GranolaDocument,
  GranolaFolder,
  TranscriptSegment,
} from "../../../src/types.ts";

export interface LoadGranConfigOptions {
  apiKey?: string;
  config?: string;
  debug?: boolean;
  env?: NodeJS.ProcessEnv;
  globalFlags?: FlagValues;
  rules?: string;
  subcommandFlags?: FlagValues;
  supabase?: string;
}

export interface CreateGranSdkOptions extends LoadGranConfigOptions {
  appOptions?: {
    logger?: Pick<Console, "warn">;
    now?: () => Date;
    surface?: GranolaAppSurface;
  };
}

export interface GranSdkContext {
  app: GranolaApp;
  config: AppConfig;
}

function mergeFlags(
  base: Record<string, string | boolean | undefined>,
  extra: FlagValues | undefined,
): FlagValues {
  return {
    ...base,
    ...extra,
  };
}

export async function loadGranConfig(options: LoadGranConfigOptions = {}): Promise<AppConfig> {
  return await loadConfig({
    env: options.env,
    globalFlags: mergeFlags(
      {
        "api-key": options.apiKey,
        config: options.config,
        debug: options.debug,
        rules: options.rules,
        supabase: options.supabase,
      },
      options.globalFlags,
    ),
    subcommandFlags: options.subcommandFlags ?? {},
  });
}

export async function createGranSdk(options: CreateGranSdkOptions = {}): Promise<GranSdkContext> {
  const config = await loadGranConfig(options);
  const app = await createGranolaApp(config, options.appOptions);

  return {
    app,
    config,
  };
}

export async function createGranApp(
  config: AppConfig,
  options: CreateGranSdkOptions["appOptions"] = {},
): Promise<GranolaApp> {
  return await createGranolaApp(config, options);
}

export {
  buildObsidianOpenFileUri,
  buildObsidianSearchUri,
  connectGranService,
  createDefaultGranolaApiClient,
  createDefaultGranolaAuth,
  createDefaultGranolaAuthController,
  createGranExportTarget,
  createGranolaServerClient,
  createDefaultGranolaRuntime,
  exportGranArchive,
  GranolaServerClient,
  inspectDefaultGranolaAuth,
  listGranExportTargetDefinitions,
  loadOptionalGranolaCache,
  removeGranExportTarget,
  saveGranExportTarget,
  type DefaultGranolaAuthController,
  type DefaultGranolaAuthInfo,
  type DefaultGranolaClient,
  type DefaultGranolaRuntime,
  type GranolaServerClientOptions,
  type CreateGranExportTargetOptions,
  type GranSdkArchiveExportOptions,
  type GranSdkArchiveExportResult,
};

export type {
  AppConfig,
  FolderRecord,
  FlagValues,
  GranolaAgentProviderKind,
  GranolaApp,
  GranolaAppApi,
  GranolaAppSurface,
  GranolaDocument,
  GranolaExportTarget,
  GranolaExportTargetKind,
  GranolaFolder,
  GranolaNotesExportResult,
  GranolaTranscriptsExportResult,
  NoteOutputFormat,
  TranscriptSegment,
  TranscriptOutputFormat,
};
