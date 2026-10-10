import { describe, expect, it } from "vitest";
import {
  registerSource,
  type RegisterSourceRequest,
} from "../src/domain/source-intake.js";

const validRequest: RegisterSourceRequest = {
  workspaceId: "workspace-1",
  projectId: "project-1",
  actorId: "user-1",
  kind: "file",
  name: "requirements.pdf",
  byteSize: 2048,
  sha256: "a".repeat(64),
};

const deterministic = {
  idFactory: () => "source-version-1",
  clock: () => new Date("2026-01-01T00:00:00.000Z"),
};

describe("registerSource", () => {
  it("registers a valid file source with deterministic identity and time", () => {
    const result = registerSource(validRequest, deterministic);

    expect(result).toEqual({
      ok: true,
      value: {
        id: "source-version-1",
        workspaceId: "workspace-1",
        projectId: "project-1",
        actorId: "user-1",
        kind: "file",
        name: "requirements.pdf",
        byteSize: 2048,
        sha256: "a".repeat(64),
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    });
  });

  it("registers a valid public URL source", () => {
    const result = registerSource(
      {
        ...validRequest,
        kind: "url",
        name: "Project Notion",
        url: "https://www.notion.so/example",
      },
      deterministic,
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.url).toBe("https://www.notion.so/example");
  });

  it.each([
    ["workspaceId", { workspaceId: "" }],
    ["byteSize", { byteSize: 0 }],
    ["sha256", { sha256: "not-a-hash" }],
    ["kind", { kind: "image" as never }],
    ["url protocol", { kind: "url" as const, url: "ftp://example.com" }],
  ])("rejects invalid %s", (_caseName, override) => {
    const result = registerSource(
      { ...validRequest, ...override },
      deterministic,
    );

    expect(result.ok).toBe(false);
  });

  it("requires a URL for URL sources", () => {
    const result = registerSource(
      { ...validRequest, kind: "url" },
      deterministic,
    );

    expect(result).toEqual({ ok: false, error: "url_required" });
  });
});
