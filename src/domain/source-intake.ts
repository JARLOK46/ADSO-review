export type SourceKind = "file" | "url";

export type RegisterSourceRequest = {
  workspaceId: string;
  projectId: string;
  actorId: string;
  kind: SourceKind;
  name: string;
  byteSize: number;
  sha256: string;
  url?: string;
};

export type RegisteredSource = {
  id: string;
  workspaceId: string;
  projectId: string;
  actorId: string;
  kind: SourceKind;
  name: string;
  byteSize: number;
  sha256: string;
  url?: string;
  createdAt: string;
};

export type RegisterSourceError =
  | "workspace_id_required"
  | "project_id_required"
  | "actor_id_required"
  | "kind_invalid"
  | "name_required"
  | "byte_size_invalid"
  | "sha256_invalid"
  | "url_required"
  | "url_https_required";

export type RegisterSourceResult =
  | { ok: true; value: RegisteredSource }
  | { ok: false; error: RegisterSourceError };

export type SourceIntakeDependencies = {
  idFactory: () => string;
  clock: () => Date;
};

const isNonEmpty = (value: string): boolean => value.trim().length > 0;

export function registerSource(
  request: RegisterSourceRequest,
  dependencies: SourceIntakeDependencies,
): RegisterSourceResult {
  if (!isNonEmpty(request.workspaceId)) {
    return { ok: false, error: "workspace_id_required" };
  }
  if (!isNonEmpty(request.projectId)) {
    return { ok: false, error: "project_id_required" };
  }
  if (!isNonEmpty(request.actorId)) {
    return { ok: false, error: "actor_id_required" };
  }
  if (request.kind !== "file" && request.kind !== "url") {
    return { ok: false, error: "kind_invalid" };
  }
  if (!isNonEmpty(request.name)) {
    return { ok: false, error: "name_required" };
  }
  if (!Number.isFinite(request.byteSize) || request.byteSize <= 0) {
    return { ok: false, error: "byte_size_invalid" };
  }
  if (!/^[0-9a-f]{64}$/.test(request.sha256)) {
    return { ok: false, error: "sha256_invalid" };
  }

  let url: string | undefined;
  if (request.kind === "url") {
    if (!request.url) {
      return { ok: false, error: "url_required" };
    }

    try {
      const parsedUrl = new URL(request.url);
      if (parsedUrl.protocol !== "https:") {
        return { ok: false, error: "url_https_required" };
      }
    } catch {
      return { ok: false, error: "url_https_required" };
    }
    url = request.url;
  }

  const value: RegisteredSource = {
    id: dependencies.idFactory(),
    workspaceId: request.workspaceId,
    projectId: request.projectId,
    actorId: request.actorId,
    kind: request.kind,
    name: request.name,
    byteSize: request.byteSize,
    sha256: request.sha256,
    createdAt: dependencies.clock().toISOString(),
  };

  if (url !== undefined) {
    value.url = url;
  }

  return { ok: true, value };
}
