import { env, exports as workerExports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

const ADMIN_TOKEN = "test-admin-token";
const DOWNLOAD_TOKEN = "test-download-token";

describe("Worker and D1 integration", () => {
  it("applies migrations and keeps built-in templates out of D1", async () => {
    const tables = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
    ).all<{ name: string }>();
    expect(tables.results.map((row) => row.name)).toEqual(expect.arrayContaining([
      "app_settings",
      "collections",
      "d1_migrations",
      "download_grants",
      "recycle_bin",
      "sources",
      "templates",
    ]));

    const columns = await env.DB.prepare("PRAGMA table_info(sources)").all<{ name: string }>();
    expect(columns.results.map((row) => row.name)).toContain("meta_json");
    expect(await env.DB.prepare("SELECT COUNT(*) AS count FROM templates").first("count")).toBe(0);
    expect(await env.DB.prepare("SELECT COUNT(*) AS count FROM collections WHERE id = 'daily'").first("count")).toBe(1);
  });

  it("requires admin auth and returns hardened responses", async () => {
    const unauthorized = await workerRequest("/api/env", {}, false);
    expect(unauthorized.status).toBe(401);
    expect(unauthorized.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
    expect(unauthorized.headers.get("referrer-policy")).toBe("no-referrer");
    expect(unauthorized.headers.get("x-content-type-options")).toBe("nosniff");
    expect(unauthorized.headers.get("x-frame-options")).toBe("DENY");

    const authorized = await workerRequest("/api/env");
    expect(authorized.status).toBe(200);
    expect(getPath(await jsonObject(authorized), "status")).toBe("success");
  });

  it("publishes build-time script metadata and executes saved script actions", async () => {
    const scriptsResponse = await workerRequest("/api/scripts");
    expect(scriptsResponse.status).toBe(200);
    const scripts = getPath(await jsonObject(scriptsResponse), "data");
    expect(Array.isArray(scripts) ? scripts.map((script) => getPath(script, "id")) : []).toEqual(
      expect.arrayContaining(["tls-fingerprint", "name-regex-filter"]),
    );

    const create = await workerRequest("/api/sources", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: "scripted-source",
        name: "Scripted Source",
        type: "local",
        content: "trojan://password@example.com:443#Scripted%20Node",
        filters: [{
          type: "script",
          scriptId: "tls-fingerprint",
          scriptKind: "operator",
          arguments: { fingerprint: "safari" },
        }],
      }),
    });
    expect(create.status).toBe(200);

    const download = await workerRequest(`/download/source/scripted-source/json/${DOWNLOAD_TOKEN}`, {}, false);
    expect(download.status).toBe(200);
    expect(await download.text()).toContain('"tls-fingerprint": "safari"');

    const invalid = await workerRequest("/api/sources", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: "missing-script-source",
        name: "Missing Script",
        type: "local",
        content: "trojan://password@example.com:443#Node",
        filters: [{ type: "script", scriptId: "missing-script" }],
      }),
    });
    expect(invalid.status).toBe(400);
    expect(getPath(await jsonObject(invalid), "error", "message")).toContain("Unknown script");
  });

  it("hardens the download-only host boundary", async () => {
    const response = await workerExports.default.fetch(new Request("https://downloads.example.com/"));
    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
    expect(response.headers.get("permissions-policy")).toContain("camera=()");

    const spoofedHost = await workerRequest("/api/env", {
      headers: { "x-forwarded-host": "downloads.example.com" },
    });
    expect(spoofedHost.status).toBe(200);
  });

  it("keeps record ids immutable and preserves omitted fields in partial updates", async () => {
    const sourceCreate = await workerRequest("/api/sources", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: "patch-source",
        name: "Patch Source",
        type: "local",
        content: "trojan://password@example.com:443#Patch%20Node",
        enabled: true,
        meta: { remark: "keep-me" },
      }),
    });
    expect(sourceCreate.status).toBe(200);

    const sourcePatch = await workerRequest("/api/sources/patch-source", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: "renamed-source", name: "Updated Source" }),
    });
    const patchedSource = getPath(await jsonObject(sourcePatch), "data") as Record<string, unknown>;
    expect(sourcePatch.status).toBe(200);
    expect(patchedSource.id).toBe("patch-source");
    expect(patchedSource.name).toBe("Updated Source");
    expect(patchedSource.content).toContain("Patch%20Node");
    expect(getPath(patchedSource, "meta", "remark")).toBe("keep-me");
    expect((await workerRequest("/api/sources/renamed-source")).status).toBe(404);

    const linkResponse = await workerRequest("/api/link/source/patch-source?target=json", {
      headers: { "x-forwarded-host": "attacker.example" },
    });
    expect(getPath(await jsonObject(linkResponse), "data", "url")).toBe(
      `https://downloads.example.com/download/source/patch-source/json?token=${DOWNLOAD_TOKEN}`,
    );

    const collectionCreate = await workerRequest("/api/collections", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: "patch-collection",
        name: "Patch Collection",
        sourceIds: ["patch-source"],
        templateId: "mihomo-basic",
        ignoreFailed: false,
        enabled: true,
      }),
    });
    expect(collectionCreate.status).toBe(200);

    const collectionPatch = await workerRequest("/api/collections/patch-collection", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: "renamed-collection", name: "Updated Collection" }),
    });
    const patchedCollection = getPath(await jsonObject(collectionPatch), "data") as Record<string, unknown>;
    expect(collectionPatch.status).toBe(200);
    expect(patchedCollection.id).toBe("patch-collection");
    expect(patchedCollection.sourceIds).toEqual(["patch-source"]);
    expect(patchedCollection.templateId).toBe("mihomo-basic");
    expect(patchedCollection.ignoreFailed).toBe(false);

    const blockedDelete = await workerRequest("/api/sources/patch-source", { method: "DELETE" });
    expect(blockedDelete.status).toBe(409);
    expect(getPath(await jsonObject(blockedDelete), "error", "message")).toContain("patch-collection");
  });

  it("treats an empty sourceIds list as all enabled sources", async () => {
    for (const [id, nodeName] of [["all-source-a", "All Node A"], ["all-source-b", "All Node B"]]) {
      const response = await workerRequest("/api/sources", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id,
          name: id,
          type: "local",
          content: `trojan://password@example.com:443#${encodeURIComponent(nodeName)}`,
          enabled: true,
        }),
      });
      expect(response.status).toBe(200);
    }

    const collection = await workerRequest("/api/collections", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: "all-enabled",
        name: "All Enabled",
        sourceIds: [],
        templateId: "mihomo-basic",
        enabled: true,
      }),
    });
    expect(collection.status).toBe(200);

    const download = await workerRequest(`/download/collection/all-enabled/json/${DOWNLOAD_TOKEN}`, {}, false);
    expect(download.status).toBe(200);
    const body = await download.text();
    expect(body).toContain("All Node A");
    expect(body).toContain("All Node B");
  });

  it("rejects invalid and duplicate record ids", async () => {
    const invalid = await workerRequest("/api/sources", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: "Invalid ID",
        name: "Invalid",
        type: "local",
        content: "trojan://password@example.com:443#Invalid",
      }),
    });
    expect(invalid.status).toBe(400);

    const invalidType = await workerRequest("/api/sources", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: "invalid-type", name: "Invalid", type: "file", content: "x" }),
    });
    expect(invalidType.status).toBe(400);

    const invalidSourceIds = await workerRequest("/api/collections", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: "invalid-source-ids",
        name: "Invalid",
        sourceIds: "all-source-a",
        templateId: "mihomo-basic",
      }),
    });
    expect(invalidSourceIds.status).toBe(400);

    const duplicatePayload = JSON.stringify({
      id: "duplicate-source",
      name: "Duplicate",
      type: "local",
      content: "trojan://password@example.com:443#Duplicate",
    });
    const first = await workerRequest("/api/sources", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: duplicatePayload,
    });
    expect(first.status).toBe(200);

    const duplicate = await workerRequest("/api/sources", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: duplicatePayload,
    });
    expect(duplicate.status).toBe(409);
  });

  it("serves code-owned built-ins and restores custom storage in one request", async () => {
    const templatesResponse = await workerRequest("/api/templates");
    const initialTemplates = getPath(await jsonObject(templatesResponse), "data");
    expect(Array.isArray(initialTemplates) ? initialTemplates.length : 0).toBe(6);

    const restoreResponse = await workerRequest("/api/storage", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        settings: { defaultTimeout: "15000" },
        sources: [{
          id: "test-local",
          name: "Test Local",
          type: "local",
          content: "vless://00000000-0000-4000-8000-000000000001@example.com:443?security=tls#Test%20Node",
          enabled: true,
        }],
        templates: [{
          id: "test-template",
          name: "Test Template",
          target: "mihomo",
          config: {
            proxyGroups: [{ name: "Proxy", type: "select", proxies: ["$all"] }],
            rules: ["MATCH,Proxy"],
          },
        }],
        collections: [{
          id: "test-collection",
          name: "测试集合",
          sourceIds: ["test-local"],
          templateId: "test-template",
          enabled: true,
        }],
      }),
    });
    expect(restoreResponse.status).toBe(200);
    expect(getPath(await jsonObject(restoreResponse), "data", "sources")).toBe(1);

    const customCount = await env.DB.prepare("SELECT COUNT(*) AS count FROM templates WHERE id = 'test-template'").first("count");
    expect(customCount).toBe(1);

    const download = await workerRequest(
      `/download/collection/test-collection/mihomo/${DOWNLOAD_TOKEN}`,
      {},
      false,
    );
    expect(download.status).toBe(200);
    expect(download.headers.get("content-type")).toContain("text/yaml");
    expect(await download.text()).toContain("Test Node");

    const shadowrocketLinkResponse = await workerRequest(
      "/api/link/collection/test-collection?target=shadowrocket",
    );
    const shadowrocketLink = String(getPath(await jsonObject(shadowrocketLinkResponse), "data", "url"));
    const [encodedUrl, encodedRemark] = shadowrocketLink.split("#");
    expect(atob(encodedUrl.slice("sub://".length))).toBe(
      `https://downloads.example.com/download/collection/test-collection/shadowrocket?token=${DOWNLOAD_TOKEN}`,
    );
    expect(decodeURIComponent(encodedRemark)).toBe("测试集合");
  });

  it("rejects oversized API bodies", async () => {
    const response = await workerRequest("/api/storage", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: "x".repeat(4 * 1024 * 1024) }),
    });
    expect(response.status).toBe(413);
  });

  it("converts proxies and rules without saving records", async () => {
    const proxy = await workerRequest("/api/proxy/parse", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        content: "trojan://password@example.com:443#One%20Shot",
        target: "surge-mac",
      }),
    });
    expect(proxy.status).toBe(200);
    expect(getPath(await jsonObject(proxy), "data", "content")).toContain("One Shot");

    const rules = await workerRequest("/api/rule/parse", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: "DOMAIN-SUFFIX,example.com,Proxy", target: "qx" }),
    });
    expect(rules.status).toBe(200);
    expect(getPath(await jsonObject(rules), "data", "content")).toContain("HOST-SUFFIX");
  });

  it("creates scoped share links and enforces resource and target restrictions", async () => {
    await workerRequest("/api/sources", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: "shared-source",
        name: "Shared Source",
        type: "local",
        content: "trojan://password@example.com:443#Shared%20Node",
      }),
    });
    const create = await workerRequest("/api/shares", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ resourceType: "source", resourceId: "shared-source", target: "json", expiresIn: 3600 }),
    });
    expect(create.status).toBe(200);
    const payload = await jsonObject(create);
    const token = String(getPath(payload, "data", "token"));
    const id = String(getPath(payload, "data", "id"));
    expect(token.length).toBeGreaterThan(20);

    const allowed = await workerRequest(`/download/source/shared-source/json?token=${encodeURIComponent(token)}`, {}, false);
    expect(allowed.status).toBe(200);
    const wrongTarget = await workerRequest(`/download/source/shared-source/mihomo?token=${encodeURIComponent(token)}`, {}, false);
    expect(wrongTarget.status).toBe(403);

    await workerRequest(`/api/shares/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled: false }),
    });
    const disabled = await workerRequest(`/download/source/shared-source/json?token=${encodeURIComponent(token)}`, {}, false);
    expect(disabled.status).toBe(403);
  });

  it("archives deleted configuration and restores it without overwrite", async () => {
    await workerRequest("/api/sources", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: "recycled-source",
        name: "Recycled Source",
        type: "local",
        content: "trojan://password@example.com:443#Recycle%20Node",
      }),
    });
    expect((await workerRequest("/api/sources/recycled-source", { method: "DELETE" })).status).toBe(200);
    expect((await workerRequest("/api/sources/recycled-source")).status).toBe(404);

    const recycle = await workerRequest("/api/recycle-bin");
    const entries = getPath(await jsonObject(recycle), "data");
    const entry = Array.isArray(entries) ? entries.find((item) => getPath(item, "resourceId") === "recycled-source") : undefined;
    expect(entry).toBeTruthy();
    const entryId = String(getPath(entry, "id"));
    expect((await workerRequest(`/api/recycle-bin/${entryId}/restore`, { method: "POST" })).status).toBe(200);
    expect((await workerRequest("/api/sources/recycled-source")).status).toBe(200);
  });
});

async function workerRequest(path: string, init: RequestInit = {}, includeAdmin = true) {
  const headers = new Headers(init.headers);
  if (includeAdmin) headers.set("authorization", `Bearer ${ADMIN_TOKEN}`);
  return workerExports.default.fetch(new Request(`https://example.com${path}`, { ...init, headers }));
}

async function jsonObject(response: Response) {
  const input: unknown = await response.json();
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Expected a JSON object");
  return input as Record<string, unknown>;
}

function getPath(input: Record<string, unknown>, ...path: string[]): unknown {
  let current: unknown = input;
  for (const key of path) {
    if (!current || typeof current !== "object" || Array.isArray(current)) return undefined;
    current = Reflect.get(current, key);
  }
  return current;
}
