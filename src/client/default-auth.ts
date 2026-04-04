import { existsSync } from "node:fs";

import type { GranolaSessionMetadata, GranolaSessionMode } from "../app/models.ts";
import type { AppConfig } from "../types.ts";
import { granolaSupabaseCandidates } from "../utils.ts";

import {
  createDefaultSessionStore,
  refreshGranolaSession,
  SupabaseFileSessionSource,
  type GranolaSession,
  type SessionSource,
  type SessionStore,
} from "./auth.ts";

export type DefaultGranolaAuthInfo = GranolaSessionMetadata;

export interface DefaultGranolaAuthController {
  inspect(): Promise<DefaultGranolaAuthInfo>;
  login(options?: { supabasePath?: string }): Promise<DefaultGranolaAuthInfo>;
  logout(): Promise<DefaultGranolaAuthInfo>;
  refresh(): Promise<DefaultGranolaAuthInfo>;
  switchMode(mode: GranolaSessionMode): Promise<DefaultGranolaAuthInfo>;
}

interface DefaultGranolaAuthStateOptions {
  existsSyncImpl?: typeof existsSync;
  lastError?: string;
  preferredMode?: GranolaSessionMode;
  session?: GranolaSession;
}

export interface CreateDefaultGranolaAuthControllerOptions {
  existsSyncImpl?: typeof existsSync;
  fetchImpl?: typeof fetch;
  sessionSourceFactory?: (supabasePath: string) => SessionSource;
  sessionStore?: SessionStore;
}

function hasStoredSession(session: GranolaSession | undefined): session is GranolaSession {
  return Boolean(session?.accessToken.trim());
}

function resolveActiveMode(options: {
  preferredMode?: GranolaSessionMode;
  storedSessionAvailable: boolean;
  supabaseAvailable: boolean;
}): GranolaSessionMode {
  if (options.preferredMode === "stored-session" && options.storedSessionAvailable) {
    return "stored-session";
  }

  if (options.preferredMode === "supabase-file" && options.supabaseAvailable) {
    return "supabase-file";
  }

  if (options.storedSessionAvailable) {
    return "stored-session";
  }

  return "supabase-file";
}

function missingSupabaseError(): Error {
  return new Error(
    `supabase.json not found. Pass --supabase or create .granola.toml. Expected locations include: ${granolaSupabaseCandidates().join(", ")}`,
  );
}

function buildDefaultGranolaAuthInfo(
  config: AppConfig,
  options: DefaultGranolaAuthStateOptions = {},
): DefaultGranolaAuthInfo {
  const existsSyncImpl = options.existsSyncImpl ?? existsSync;
  const session = options.session;
  const storedSessionAvailable = hasStoredSession(session);
  const supabasePath = config.supabase || undefined;
  const supabaseAvailable = Boolean(supabasePath && existsSyncImpl(supabasePath));

  return {
    clientId: session?.clientId,
    lastError: options.lastError,
    mode: resolveActiveMode({
      preferredMode: options.preferredMode,
      storedSessionAvailable,
      supabaseAvailable,
    }),
    refreshAvailable: Boolean(session?.refreshToken?.trim()),
    signInMethod: session?.signInMethod,
    storedSessionAvailable,
    supabaseAvailable,
    supabasePath,
  };
}

export async function inspectDefaultGranolaAuth(
  config: AppConfig,
  options: DefaultGranolaAuthStateOptions & {
    sessionStore?: SessionStore;
  } = {},
): Promise<DefaultGranolaAuthInfo> {
  const sessionStore = options.sessionStore ?? createDefaultSessionStore();
  const session = options.session ?? (await sessionStore.readSession());
  return buildDefaultGranolaAuthInfo(config, {
    existsSyncImpl: options.existsSyncImpl,
    lastError: options.lastError,
    preferredMode: options.preferredMode,
    session,
  });
}

class DefaultAuthController implements DefaultGranolaAuthController {
  #lastError?: string;
  #preferredMode?: GranolaSessionMode;

  constructor(
    private readonly config: AppConfig,
    private readonly options: CreateDefaultGranolaAuthControllerOptions = {},
  ) {}

  private sessionStore(): SessionStore {
    return this.options.sessionStore ?? createDefaultSessionStore();
  }

  private readSession(): Promise<GranolaSession | undefined> {
    return this.sessionStore().readSession();
  }

  private resolveSupabasePath(overridePath?: string): string {
    const supabasePath = overridePath?.trim() || this.config.supabase || "";
    if (!supabasePath) {
      throw missingSupabaseError();
    }

    const existsSyncImpl = this.options.existsSyncImpl ?? existsSync;
    if (!existsSyncImpl(supabasePath)) {
      throw new Error(`supabase.json not found: ${supabasePath}`);
    }

    return supabasePath;
  }

  private sessionSource(supabasePath: string): SessionSource {
    return (
      this.options.sessionSourceFactory?.(supabasePath) ??
      new SupabaseFileSessionSource(supabasePath)
    );
  }

  async inspect(): Promise<DefaultGranolaAuthInfo> {
    const session = await this.readSession();
    return buildDefaultGranolaAuthInfo(this.config, {
      existsSyncImpl: this.options.existsSyncImpl,
      lastError: this.#lastError,
      preferredMode: this.#preferredMode,
      session,
    });
  }

  async login(options: { supabasePath?: string } = {}): Promise<DefaultGranolaAuthInfo> {
    const supabasePath = this.resolveSupabasePath(options.supabasePath);
    const session = await this.sessionSource(supabasePath).loadSession();
    await this.sessionStore().writeSession(session);
    this.#lastError = undefined;
    this.#preferredMode = "stored-session";
    return await this.inspect();
  }

  async logout(): Promise<DefaultGranolaAuthInfo> {
    await this.sessionStore().clearSession();
    this.#lastError = undefined;
    this.#preferredMode = undefined;
    return await this.inspect();
  }

  async refresh(): Promise<DefaultGranolaAuthInfo> {
    const session = await this.readSession();
    if (!hasStoredSession(session)) {
      this.#lastError = "no stored Granola session found";
      throw new Error(this.#lastError);
    }

    try {
      const refreshed = await refreshGranolaSession(session, this.options.fetchImpl);
      await this.sessionStore().writeSession(refreshed);
      this.#lastError = undefined;
      this.#preferredMode = "stored-session";
      return await this.inspect();
    } catch (error) {
      this.#lastError = error instanceof Error ? error.message : String(error);
      throw error;
    }
  }

  async switchMode(mode: GranolaSessionMode): Promise<DefaultGranolaAuthInfo> {
    const state = await this.inspect();
    if (mode === "stored-session" && !state.storedSessionAvailable) {
      this.#lastError = "no stored Granola session found";
      throw new Error(this.#lastError);
    }

    if (mode === "supabase-file") {
      this.resolveSupabasePath();
    }

    this.#lastError = undefined;
    this.#preferredMode = mode;
    return await this.inspect();
  }
}

export function createDefaultGranolaAuthController(
  config: AppConfig,
  options: CreateDefaultGranolaAuthControllerOptions = {},
): DefaultGranolaAuthController {
  return new DefaultAuthController(config, options);
}
