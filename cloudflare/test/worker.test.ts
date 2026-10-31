import { env, exports as workerExports } from "cloudflare:workers";
import { afterEach, describe, expect, it, vi } from "vitest";

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
          name: "Test Collection",
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

describe("admin and download auth hardening", () => {
  afterEach(() => vi.restoreAllMocks());

  it("does not accept the admin token from the query string", async () => {
    const queryOnly = await workerRequest(`/api/env?token=${ADMIN_TOKEN}`, {}, false);
    expect(queryOnly.status).toBe(401);
    expect((await workerRequest(`/api/sources?token=${ADMIN_TOKEN}`, {}, false)).status).toBe(401);

    expect((await workerRequest(`/api/env?token=${ADMIN_TOKEN}`)).status).toBe(200);
    const headerToken = await workerRequest("/api/env", { headers: { "x-sub-store-token": ADMIN_TOKEN } }, false);
    expect(headerToken.status).toBe(200);
    const wrong = await workerRequest("/api/env", { headers: { authorization: "Bearer wrong-token" } }, false);
    expect(wrong.status).toBe(401);
  });

  it("ignores content overrides for scoped share tokens but honors them for the main token", async () => {
    await createSource({ id: "override-source", content: "trojan://password@example.com:443#Stored%20Node" });
    const token = await createShare({ resourceType: "source", resourceId: "override-source", target: "json" });
    const override = encodeURIComponent("trojan://password@override.example.com:443#Override%20Node");

    const scoped = await workerRequest(`/download/source/override-source/json?token=${encodeURIComponent(token)}&content=${override}`, {}, false);
    expect(scoped.status).toBe(200);
    const scopedBody = await scoped.text();
    expect(scopedBody).toContain("Stored Node");
    expect(scopedBody).not.toContain("Override Node");

    const main = await workerRequest(`/download/source/override-source/json?token=${DOWNLOAD_TOKEN}&content=${override}`, {}, false);
    expect(main.status).toBe(200);
    const mainBody = await main.text();
    expect(mainBody).toContain("Override Node");
    expect(mainBody).not.toContain("Stored Node");
  });

  it("ignores url and refresh overrides for scoped share tokens", async () => {
    const upstream = "https://upstream.example/scoped-refresh";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response("trojan://password@remote.example.com:443#Remote%20Node"),
    );
    await createSource({ id: "refresh-source", type: "remote", url: upstream, meta: { cacheTtl: 0 } });
    const token = await createShare({ resourceType: "source", resourceId: "refresh-source", target: "json" });
    const evil = encodeURIComponent("https://evil.example/steal");

    const scoped = await workerRequest(`/download/source/refresh-source/json?token=${encodeURIComponent(token)}&refresh=1&url=${evil}`, {}, false);
    expect(scoped.status).toBe(200);
    expect(scoped.headers.get("x-sub-store-cache")).toBe("miss");
    expect(fetchMock.mock.calls.map(([input]) => String(input))).toEqual([upstream]);

    const scopedNoCache = await workerRequest(`/download/source/refresh-source/json?token=${encodeURIComponent(token)}&noCache=true`, {}, false);
    expect(scopedNoCache.headers.get("x-sub-store-cache")).toBe("miss");

    fetchMock.mockClear();
    const main = await workerRequest(`/download/source/refresh-source/json?token=${DOWNLOAD_TOKEN}&refresh=1&url=${evil}`, {}, false);
    expect(main.status).toBe(200);
    expect(main.headers.get("x-sub-store-cache")).toBe("refresh");
    expect(fetchMock.mock.calls.map(([input]) => String(input))).toEqual(["https://evil.example/steal"]);
  });

  it("removes share grants together with their source or collection", async () => {
    await createSource({ id: "grant-source", content: "trojan://password@example.com:443#Grant%20Node" });
    const sourceToken = await createShare({ resourceType: "source", resourceId: "grant-source", target: "json" });
    const sourceUrl = `/download/source/grant-source/json?token=${encodeURIComponent(sourceToken)}`;
    expect((await workerRequest(sourceUrl, {}, false)).status).toBe(200);

    expect((await workerRequest("/api/sources/grant-source", { method: "DELETE" })).status).toBe(200);
    expect(await grantCount("source", "grant-source")).toBe(0);
    await createSource({ id: "grant-source", content: "trojan://password@example.com:443#Grant%20Node" });
    expect((await workerRequest(sourceUrl, {}, false)).status).toBe(403);

    const collection = await workerRequest("/api/collections", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: "grant-collection", name: "Grant Collection", sourceIds: ["grant-source"], templateId: "mihomo-basic" }),
    });
    expect(collection.status).toBe(200);
    const collectionToken = await createShare({ resourceType: "collection", resourceId: "grant-collection", target: "json" });
    const collectionUrl = `/download/collection/grant-collection/json?token=${encodeURIComponent(collectionToken)}`;
    expect((await workerRequest(collectionUrl, {}, false)).status).toBe(200);

    expect((await workerRequest("/api/collections/grant-collection", { method: "DELETE" })).status).toBe(200);
    expect(await grantCount("collection", "grant-collection")).toBe(0);
    const recreated = await workerRequest("/api/collections", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: "grant-collection", name: "Grant Collection", sourceIds: ["grant-source"], templateId: "mihomo-basic" }),
    });
    expect(recreated.status).toBe(200);
    expect((await workerRequest(collectionUrl, {}, false)).status).toBe(403);
  });
});

describe("share expiry validation", () => {
  async function newShare() {
    await createSource({ id: "expiry-source", content: "trojan://password@example.com:443#Expiry%20Node", allowExisting: true });
    const create = await workerRequest("/api/shares", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ resourceType: "source", resourceId: "expiry-source", target: "json", expiresIn: 3600 }),
    });
    expect(create.status).toBe(200);
    const grant = getPath(await jsonObject(create), "data") as Record<string, unknown>;
    expect(typeof grant.expiresAt).toBe("number");
    return String(grant.id);
  }

  function patchShare(id: string, body: Record<string, unknown>) {
    return workerRequest(`/api/shares/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("rejects past, non-numeric, zero and too-distant expiresAt values", async () => {
    const id = await newShare();
    const before = (getPath(await jsonObject(await workerRequest("/api/shares")), "data") as Array<Record<string, unknown>>).find((item) => item.id === id);
    for (const expiresAt of [Date.now() - 60_000, "abc", "NaN", 0, "0", "", "  ", -1, Date.now() + 400 * 24 * 60 * 60 * 1000, true, {}]) {
      const response = await patchShare(id, { expiresAt });
      expect(response.status, JSON.stringify(expiresAt)).toBe(400);
    }
    const after = (getPath(await jsonObject(await workerRequest("/api/shares")), "data") as Array<Record<string, unknown>>).find((item) => item.id === id);
    expect(after?.expiresAt).toBe(before?.expiresAt);
  });

  it("accepts a future timestamp and clears the expiry with null", async () => {
    const id = await newShare();
    const future = Date.now() + 2 * 24 * 60 * 60 * 1000;
    const updated = await patchShare(id, { expiresAt: future });
    expect(updated.status).toBe(200);
    expect(getPath(await jsonObject(updated), "data", "expiresAt")).toBe(future);

    const cleared = await patchShare(id, { expiresAt: null });
    expect(cleared.status).toBe(200);
    expect(getPath(await jsonObject(cleared), "data", "expiresAt")).toBeUndefined();
    expect(await env.DB.prepare("SELECT expires_at FROM download_grants WHERE id = ?").bind(id).first("expires_at")).toBeNull();

    // Omitting expiresAt leaves it untouched; toggling enabled alone still works.
    const toggled = await patchShare(id, { enabled: false });
    expect(toggled.status).toBe(200);
    expect(getPath(await jsonObject(toggled), "data", "enabled")).toBe(false);
    expect((await patchShare("does-not-exist", { expiresAt: null })).status).toBe(404);
  });
});

describe("recycle bin restore", () => {
  it("keeps createdAt and removes the entry in the same operation", async () => {
    const OLD = 1_000_000;
    await createSource({ id: "restore-source", content: "trojan://password@example.com:443#Restore%20Node" });
    await env.DB.prepare("UPDATE sources SET created_at = ? WHERE id = 'restore-source'").bind(OLD).run();
    const collection = await workerRequest("/api/collections", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: "restore-collection", name: "Restore Collection", sourceIds: [], templateId: "mihomo-basic" }),
    });
    expect(collection.status).toBe(200);
    await env.DB.prepare("UPDATE collections SET created_at = ? WHERE id = 'restore-collection'").bind(OLD).run();
    const template = await workerRequest("/api/templates", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: "restore-template",
        name: "Restore Template",
        target: "mihomo",
        config: { proxyGroups: [{ name: "Proxy", type: "select", proxies: ["$all"] }], rules: ["MATCH,Proxy"] },
      }),
    });
    expect(template.status).toBe(200);
    await env.DB.prepare("UPDATE templates SET created_at = ? WHERE id = 'restore-template'").bind(OLD).run();

    for (const [kind, id, table] of [
      ["sources", "restore-source", "sources"],
      ["collections", "restore-collection", "collections"],
      ["templates", "restore-template", "templates"],
    ] as const) {
      expect((await workerRequest(`/api/${kind}/${id}`, { method: "DELETE" })).status, `delete ${id}`).toBe(200);
      const entryId = await recycleEntryId(id);
      expect(entryId, `recycle entry for ${id}`).toBeTruthy();

      const restore = await workerRequest(`/api/recycle-bin/${entryId}/restore`, { method: "POST" });
      expect(restore.status, `restore ${id}`).toBe(200);
      expect(await env.DB.prepare(`SELECT created_at FROM ${table} WHERE id = ?`).bind(id).first("created_at")).toBe(OLD);
      expect(await recycleEntryId(id)).toBeUndefined();
      expect((await workerRequest(`/api/recycle-bin/${entryId}/restore`, { method: "POST" })).status).toBe(404);
    }
  });

  it("does not drop the entry when the restore conflicts with an existing id", async () => {
    await createSource({ id: "conflict-source", content: "trojan://password@example.com:443#Conflict%20Node" });
    expect((await workerRequest("/api/sources/conflict-source", { method: "DELETE" })).status).toBe(200);
    const entryId = await recycleEntryId("conflict-source");
    await createSource({ id: "conflict-source", content: "trojan://password@example.com:443#Conflict%20Node" });

    expect((await workerRequest(`/api/recycle-bin/${entryId}/restore`, { method: "POST" })).status).toBe(409);
    expect(await recycleEntryId("conflict-source")).toBe(entryId);
  });

  it("restores a deleted share with its original token", async () => {
    await createSource({ id: "share-restore-source", content: "trojan://password@example.com:443#Share%20Restore" });
    const create = await workerRequest("/api/shares", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ resourceType: "source", resourceId: "share-restore-source", target: "json" }),
    });
    const payload = await jsonObject(create);
    const token = String(getPath(payload, "data", "token"));
    const shareId = String(getPath(payload, "data", "id"));
    const url = `/download/source/share-restore-source/json?token=${encodeURIComponent(token)}`;

    expect((await workerRequest(`/api/shares/${shareId}`, { method: "DELETE" })).status).toBe(200);
    expect((await workerRequest(url, {}, false)).status).toBe(403);
    const entryId = await recycleEntryId(shareId);
    expect((await workerRequest(`/api/recycle-bin/${entryId}/restore`, { method: "POST" })).status).toBe(200);
    expect((await workerRequest(url, {}, false)).status).toBe(200);
  });
});

describe("storage limits and import", () => {
  it("returns 413 when stored text exceeds the D1 limit", async () => {
    const tooBig = "x".repeat(1_950_000);
    const create = await workerRequest("/api/sources", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: "huge-source", name: "Huge", type: "local", content: tooBig }),
    });
    expect(create.status).toBe(413);
    expect(await env.DB.prepare("SELECT COUNT(*) AS count FROM sources WHERE id = 'huge-source'").first("count")).toBe(0);

    // The limit counts UTF-8 bytes, not characters: 700k CJK characters are ~2.1 MB.
    const multibyte = await workerRequest("/api/sources", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: "huge-cjk-source", name: "Huge CJK", type: "local", content: "节".repeat(700_000) }),
    });
    expect(multibyte.status).toBe(413);

    await createSource({ id: "growing-source", content: "trojan://password@example.com:443#Small" });
    const patch = await workerRequest("/api/sources/growing-source", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: tooBig }),
    });
    expect(patch.status).toBe(413);
    const stored = await workerRequest("/api/sources/growing-source");
    expect(getPath(await jsonObject(stored), "data", "content")).toContain("Small");

    const importResponse = await workerRequest("/api/storage", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sources: [{ id: "huge-import", name: "Huge", type: "local", content: tooBig }] }),
    });
    expect(importResponse.status).toBe(413);
  });

  it("rejects imports where two ids normalize to the same id", async () => {
    const response = await workerRequest("/api/storage", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sources: [
          { id: "Import Dup", name: "First", type: "local", content: "trojan://password@example.com:443#First" },
          { id: "import-dup", name: "Second", type: "local", content: "trojan://password@example.com:443#Second" },
        ],
      }),
    });
    expect(response.status).toBe(400);
    expect(String(getPath(await jsonObject(response), "error", "message"))).toContain("import-dup");
    expect(await env.DB.prepare("SELECT COUNT(*) AS count FROM sources WHERE id = 'import-dup'").first("count")).toBe(0);

    for (const key of ["collections", "templates"] as const) {
      const duplicate = await workerRequest("/api/storage", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ [key]: [{ id: "Same Name", name: "A", config: {} }, { name: "same-name", config: {} }] }),
      });
      expect(duplicate.status, key).toBe(400);
    }
  });

  it("normalizes imported ids and skips entries without an id or name", async () => {
    const response = await workerRequest("/api/storage", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sources: [
          { id: "  Spaced Source  ", name: "Spaced", type: "local", content: "trojan://password@example.com:443#Spaced" },
          { id: "UPPER_Case", type: "local", content: "trojan://password@example.com:443#Upper" },
          { type: "local", content: "trojan://password@example.com:443#Anonymous" },
          { id: "", name: "", content: "x" },
          null,
          "not-an-object",
        ],
        collections: [{ name: "Named Collection", sourceIds: ["spaced-source"], templateId: "mihomo-basic" }, { sourceIds: [] }],
      }),
    });
    expect(response.status).toBe(200);
    const data = getPath(await jsonObject(response), "data") as Record<string, unknown>;
    expect(data.sources).toBe(2);
    expect(data.collections).toBe(1);

    expect((await workerRequest("/api/sources/spaced-source")).status).toBe(200);
    expect((await workerRequest("/api/sources/upper_case")).status).toBe(200);
    expect((await workerRequest("/api/collections/named-collection")).status).toBe(200);
    expect(await env.DB.prepare("SELECT COUNT(*) AS count FROM sources WHERE id IN ('item', '') OR name = ''").first("count")).toBe(0);
  });
});

describe("settings", () => {
  it("clamps backendRequestConcurrency to the supported range", async () => {
    const patchSettings = (backendRequestConcurrency: unknown) => workerRequest("/api/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ backendRequestConcurrency }),
    });

    const high = await patchSettings("50");
    expect(high.status).toBe(200);
    expect(getPath(await jsonObject(high), "data", "backendRequestConcurrency")).toBe("6");
    const stored = await workerRequest("/api/settings");
    expect(getPath(await jsonObject(stored), "data", "backendRequestConcurrency")).toBe("6");

    expect(getPath(await jsonObject(await patchSettings(0)), "data", "backendRequestConcurrency")).toBe("1");
    expect(getPath(await jsonObject(await patchSettings(4.9)), "data", "backendRequestConcurrency")).toBe("4");

    for (const invalid of ["abc", true, {}, [], "Infinity"]) {
      const response = await patchSettings(invalid);
      expect(response.status, JSON.stringify(invalid)).toBe(400);
    }
    // A rejected value must not overwrite the stored one.
    const after = await workerRequest("/api/settings");
    expect(getPath(await jsonObject(after), "data", "backendRequestConcurrency")).toBe("4");
    expect((await patchSettings("3")).status).toBe(200);
  });
});

describe("downloads with non-ASCII data", () => {
  afterEach(() => vi.restoreAllMocks());

  it("renders base64 local sources with Chinese names", async () => {
    const lines = [
      "trojan://password@hk.example.com:443?sni=hk.example.com#%E9%A6%99%E6%B8%AF%20%E4%BC%98%E8%B4%A8",
      `vmess://${toBase64(JSON.stringify({ v: "2", ps: "日本 vmess", add: "jp.example.com", port: "443", id: "00000000-0000-4000-8000-000000000003", aid: "0", net: "tcp" }))}`,
    ];
    await createSource({ id: "base64-local", content: toBase64(lines.join("\n")).replace(/(.{60})/g, "$1\n") });

    for (const target of ["json", "mihomo"]) {
      const download = await workerRequest(`/download/source/base64-local/${target}/${DOWNLOAD_TOKEN}`, {}, false);
      expect(download.status, target).toBe(200);
      const body = await download.text();
      expect(body, target).toContain("香港 优质");
      expect(body, target).toContain("日本 vmess");
    }
    const uri = await workerRequest(`/download/source/base64-local/uri/${DOWNLOAD_TOKEN}`, {}, false);
    expect(uri.status).toBe(200);
    expect(await uri.text()).toContain(`#${encodeURIComponent("香港 优质")}`);
  });

  it("does not fail when upstream-style metadata contains Chinese text", async () => {
    await createSource({
      id: "chinese-meta",
      content: "trojan://password@example.com:443#Meta%20Node",
      meta: {
        contentDisposition: "attachment; filename*=UTF-8''%E8%AE%A2%E9%98%85.yaml",
        subUserinfo: "upload=1; download=2; total=10",
        profileWebPageUrl: "https://example.com/订阅",
      },
    });
    const download = await workerRequest(`/download/source/chinese-meta/json/${DOWNLOAD_TOKEN}`, {}, false);
    expect(download.status).toBe(200);
    expect(download.headers.get("content-disposition")).toBe("attachment; filename=\"__.yaml\"; filename*=UTF-8''%E8%AE%A2%E9%98%85.yaml");
    expect(download.headers.get("subscription-userinfo")).toBe("upload=1; download=2; total=10");
    expect(download.headers.get("profile-web-page-url")).toBeNull();

    await createSource({
      id: "chinese-quoted",
      content: "trojan://password@example.com:443#Meta%20Node",
      meta: { contentDisposition: 'attachment; filename="订阅 配置.yaml"' },
    });
    const quoted = await workerRequest(`/download/source/chinese-quoted/json/${DOWNLOAD_TOKEN}`, {}, false);
    expect(quoted.status).toBe(200);
    const disposition = quoted.headers.get("content-disposition") || "";
    expect(disposition).toMatch(/^attachment; filename="[\x20-\x7e]+"; filename\*=UTF-8''/);
    expect(disposition).toContain(encodeURIComponent("订阅 配置.yaml"));
  });

  it("forwards a Chinese Content-Disposition from a remote source", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response("trojan://password@example.com:443#Remote", {
      headers: { "content-disposition": "attachment; filename*=UTF-8''%E8%AE%A2%E9%98%85.yaml" },
    }));
    await createSource({ id: "chinese-remote", type: "remote", url: "https://upstream.example/chinese", meta: { cacheTtl: 0 } });
    const download = await workerRequest(`/download/source/chinese-remote/json/${DOWNLOAD_TOKEN}`, {}, false);
    expect(download.status).toBe(200);
    expect(download.headers.get("content-disposition")).toContain("filename*=UTF-8''%E8%AE%A2%E9%98%85.yaml");
  });
});

async function createSource(input: {
  id: string;
  type?: "local" | "remote";
  content?: string;
  url?: string;
  meta?: Record<string, unknown>;
  allowExisting?: boolean;
}) {
  const response = await workerRequest("/api/sources", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      id: input.id,
      name: input.id,
      type: input.type ?? "local",
      content: input.content ?? "",
      url: input.url ?? "",
      meta: input.meta ?? {},
      enabled: true,
    }),
  });
  if (input.allowExisting && response.status === 409) return;
  expect(response.status, `create source ${input.id}`).toBe(200);
}

async function createShare(input: { resourceType: "source" | "collection"; resourceId: string; target?: string }) {
  const response = await workerRequest("/api/shares", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  expect(response.status, "create share").toBe(200);
  return String(getPath(await jsonObject(response), "data", "token"));
}

async function grantCount(resourceType: string, resourceId: string) {
  return env.DB.prepare("SELECT COUNT(*) AS count FROM download_grants WHERE resource_type = ? AND resource_id = ?")
    .bind(resourceType, resourceId)
    .first<number>("count");
}

async function recycleEntryId(resourceId: string) {
  const entries = getPath(await jsonObject(await workerRequest("/api/recycle-bin")), "data");
  const entry = Array.isArray(entries) ? entries.find((item) => getPath(item, "resourceId") === resourceId) : undefined;
  return entry ? String(getPath(entry, "id")) : undefined;
}

function toBase64(text: string) {
  let binary = "";
  for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte);
  return btoa(binary);
}

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
