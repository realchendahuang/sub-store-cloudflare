import { Hono } from "hono";
import type { Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import { parse as parseYaml } from "yaml";
import { failed, requireAdmin, success } from "../lib/http";
import { BUILTIN_TEMPLATE_IDS } from "../lib/defaults";
import { MAX_API_BODY_BYTES, MAX_FLOW_RESPONSE_BYTES } from "../lib/limits";
import { readResponseText } from "../lib/read";
import { convertRules, type RuleTarget } from "../lib/rules";
import { listScriptMetadata, validateScriptActions } from "../lib/scripts";
import {
  archiveAndDeleteResource,
  createDownloadGrant,
  deleteRecycleBinEntry,
  getDownloadGrant,
  getDownloadGrantSnapshot,
  getRecycleBinEntry,
  listDownloadGrants,
  listRecycleBin,
  restoreDownloadGrantSnapshot,
  updateDownloadGrant,
} from "../lib/compatibility-resources";
import {
  exportStorage,
  getCollection,
  getSettings,
  getSource,
  getSubscriptionSources,
  getTemplate,
  importStorage,
  listCollections,
  listSources,
  listTemplates,
  sortCollections,
  sortSources,
  updateSettings,
  upsertCollection,
  upsertSource,
  upsertTemplate,
} from "../lib/store";
import { convertSubscriptionContent, normalizeTargetAlias, previewSourceContent, previewSubscription } from "../lib/subscription";
import type {
  CollectionRecord,
  FilterRule,
  SourceRecord,
  SubscriptionCollection,
  SubscriptionSource,
  SubscriptionTarget,
  TemplateRecord,
} from "../types";

export const apiRoutes = new Hono<{ Bindings: SubStoreEnv }>();

type JsonMap = Record<string, unknown>;
type ApiContext = Context<{ Bindings: SubStoreEnv }>;

const FRONTEND_VERSION = "1.1.0";
apiRoutes.use("*", async (c, next) => {
  const invalid = await requireAdmin(c);
  if (invalid) return invalid;
  return next();
});
apiRoutes.use(
  "*",
  bodyLimit({
    maxSize: MAX_API_BODY_BYTES,
    onError: (c) => failed(c, "Request body is too large", 413),
  }),
);

apiRoutes.get("/env", async (c) => success(c, envPayload(c.env)));
apiRoutes.get("/scripts", async (c) => success(c, listScriptMetadata()));
apiRoutes.post("/proxy/parse", async (c) => {
  const input: JsonMap = await c.req.json<JsonMap>().catch(() => ({}));
  const target = normalizeTargetAlias(input.client || input.platform || input.target);
  if (!target) return failed(c, "Unsupported target", 400);
  const content = stringValue(input.data ?? input.content);
  if (!content) return failed(c, "Proxy content is required", 400);
  try {
    const result = await convertSubscriptionContent({
      content,
      target,
      filters: filterList(input.filters, input.process),
      settings: await getSettings(c.env),
    });
    return success(c, { par_res: result.content, ...result });
  } catch (error) {
    return failed(c, error instanceof Error ? error.message : String(error), 400);
  }
});
apiRoutes.post("/rule/parse", async (c) => {
  const input: JsonMap = await c.req.json<JsonMap>().catch(() => ({}));
  const target = normalizeRuleTarget(input.client || input.platform || input.target);
  if (!target) return failed(c, "Unsupported rule target", 400);
  const content = stringValue(input.data ?? input.content);
  if (!content) return failed(c, "Rule content is required", 400);
  const result = convertRules(content, target);
  return success(c, { par_res: result.content, ...result });
});
apiRoutes.get("/settings", async (c) => success(c, mergeSettings(defaultSettings(c.env), await getSettings(c.env))));
apiRoutes.patch("/settings", async (c) => {
  const input: JsonMap = await c.req.json<JsonMap>().catch(() => ({}));
  const settings = await updateSettings(c.env, input);
  return success(c, mergeSettings(defaultSettings(c.env), settings));
});
apiRoutes.get("/storage", async (c) => {
  const payload = await exportStorage(c.env);
  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="sub-store-cloudflare-backup-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
});
apiRoutes.post("/storage", async (c) => {
  const input = await parseJsonOrText(c);
  return success(c, await importStorage(c.env, input));
});

apiRoutes.get("/sources", async (c) => success(c, (await listSources(c.env)).map(toApiSource)));
apiRoutes.post("/sources", async (c) => {
  const input = await c.req.json<JsonMap>();
  const payloadError = validateSourcePayload(input);
  if (payloadError) return failed(c, payloadError);
  const idError = validateRecordId(input.id || input.name, "Source");
  if (idError) return failed(c, idError);
  const source = fromApiSource(input);
  if (await getSource(c.env, source.id || "")) return failed(c, "Source id already exists", 409);
  const validationError = validateSource(source);
  if (validationError) return failed(c, validationError);
  return success(c, toApiSource(await upsertSource(c.env, source)));
});
apiRoutes.put("/sources", async (c) => {
  const input = await c.req.json().catch(() => []);
  if (!Array.isArray(input)) return failed(c, "Source sort payload must be an array");
  return success(c, (await sortSources(c.env, input.map((item) => stringValue(item.id || item.name || item)).filter(Boolean))).map(toApiSource));
});
apiRoutes.post("/sort/sources", async (c) => success(c, (await sortSources(c.env, await stringListBody(c))).map(toApiSource)));

apiRoutes.get("/sources/:name", async (c) => {
  const sub = await getSource(c.env, c.req.param("name"));
  if (!sub) return failed(c, "Source not found", 404);
  return success(c, toApiSource(sub));
});
apiRoutes.patch("/sources/:name", async (c) => {
  const existing = await getSource(c.env, c.req.param("name"));
  if (!existing) return failed(c, "Source not found", 404);
  const input = await c.req.json<JsonMap>();
  const payloadError = validateSourcePayload(input, true);
  if (payloadError) return failed(c, payloadError);
  const source = mergeSource(existing, fromApiSource(input, true));
  const validationError = validateSource(source);
  if (validationError) return failed(c, validationError);
  return success(c, toApiSource(await upsertSource(c.env, source)));
});
apiRoutes.delete("/sources/:name", async (c) => {
  const existing = await getSource(c.env, c.req.param("name"));
  if (!existing) return failed(c, "Source not found", 404);
  const references = (await listCollections(c.env)).filter((collection) => collection.sourceIds.includes(existing.id)).map((collection) => collection.id);
  if (references.length > 0) return failed(c, `Source is used by collections: ${references.join(", ")}`, 409);
  await archiveAndDeleteResource(
    c.env,
    "source",
    existing.id,
    existing as unknown as JsonMap,
    c.env.DB.prepare("DELETE FROM sources WHERE id = ?").bind(existing.id),
  );
  return success(c, { deleted: true, references: [] });
});

apiRoutes.get("/collections", async (c) => success(c, (await listCollections(c.env)).map(toApiCollection)));
apiRoutes.post("/collections", async (c) => {
  const input = await c.req.json<JsonMap>();
  const payloadError = validateCollectionPayload(input);
  if (payloadError) return failed(c, payloadError);
  const idError = validateRecordId(input.id || input.name, "Collection");
  if (idError) return failed(c, idError);
  const collection = fromApiCollection(input);
  if (await getCollection(c.env, collection.id || "")) return failed(c, "Collection id already exists", 409);
  const validationError = await validateCollection(c.env, collection);
  if (validationError) return failed(c, validationError);
  return success(c, toApiCollection(await upsertCollection(c.env, collection)));
});
apiRoutes.put("/collections", async (c) => {
  const input = await c.req.json().catch(() => []);
  if (!Array.isArray(input)) return failed(c, "Collection sort payload must be an array");
  return success(c, (await sortCollections(c.env, input.map((item) => stringValue(item.id || item.name || item)).filter(Boolean))).map(toApiCollection));
});
apiRoutes.post("/sort/collections", async (c) => success(c, (await sortCollections(c.env, await stringListBody(c))).map(toApiCollection)));

apiRoutes.get("/collections/:name", async (c) => {
  const collection = await getCollection(c.env, c.req.param("name"));
  if (!collection) return failed(c, "Collection not found", 404);
  return success(c, toApiCollection(collection));
});
apiRoutes.patch("/collections/:name", async (c) => {
  const existing = await getCollection(c.env, c.req.param("name"));
  if (!existing) return failed(c, "Collection not found", 404);
  const input = await c.req.json<JsonMap>();
  const payloadError = validateCollectionPayload(input, true);
  if (payloadError) return failed(c, payloadError);
  const collection = mergeCollection(existing, fromApiCollection(input, true));
  const validationError = await validateCollection(c.env, collection);
  if (validationError) return failed(c, validationError);
  return success(c, toApiCollection(await upsertCollection(c.env, collection)));
});
apiRoutes.delete("/collections/:name", async (c) => {
  const existing = await getCollection(c.env, c.req.param("name"));
  if (!existing) return failed(c, "Collection not found", 404);
  await archiveAndDeleteResource(
    c.env,
    "collection",
    existing.id,
    existing as unknown as JsonMap,
    c.env.DB.prepare("DELETE FROM collections WHERE id = ?").bind(existing.id),
  );
  return success(c, { deleted: true });
});

apiRoutes.get("/templates", async (c) => success(c, (await listTemplates(c.env)).map(toApiTemplate)));
apiRoutes.post("/templates", async (c) => {
  try {
    const input = await parseJsonOrText(c) as JsonMap;
    if (!stringValue(input.name || input.id)) return failed(c, "Template name is required");
    return success(c, toApiTemplate(await upsertTemplate(c.env, fromApiTemplate(input))));
  } catch (error) {
    return failed(c, error instanceof Error ? error.message : String(error), 400);
  }
});
apiRoutes.get("/templates/:name", async (c) => {
  const template = await getTemplate(c.env, c.req.param("name"));
  if (!template) return failed(c, "Template not found", 404);
  return success(c, toApiTemplate(template));
});
apiRoutes.patch("/templates/:name", async (c) => {
  try {
    const existing = await getTemplate(c.env, c.req.param("name"));
    if (!existing) return failed(c, "Template not found", 404);
    return success(c, toApiTemplate(await upsertTemplate(c.env, { ...fromApiTemplate(await parseJsonOrText(c) as JsonMap), id: existing.id })));
  } catch (error) {
    return failed(c, error instanceof Error ? error.message : String(error), 400);
  }
});
apiRoutes.delete("/templates/:name", async (c) => {
  try {
    const existing = await getTemplate(c.env, c.req.param("name"));
    if (!existing) return failed(c, "Template not found", 404);
    if (BUILTIN_TEMPLATE_IDS.has(existing.id)) return failed(c, "Built-in templates cannot be deleted", 400);
    await archiveAndDeleteResource(
      c.env,
      "template",
      existing.id,
      existing as unknown as JsonMap,
      c.env.DB.prepare("DELETE FROM templates WHERE id = ?").bind(existing.id),
    );
    return success(c, { deleted: true });
  } catch (error) {
    return failed(c, error instanceof Error ? error.message : String(error), 400);
  }
});

apiRoutes.get("/shares", async (c) => success(c, await listDownloadGrants(c.env)));
apiRoutes.post("/shares", async (c) => {
  const input: JsonMap = await c.req.json<JsonMap>().catch(() => ({}));
  const resourceType = input.resourceType === "collection" ? "collection" : input.resourceType === "source" ? "source" : undefined;
  const resourceId = stringValue(input.resourceId);
  if (!resourceType || !resourceId) return failed(c, "Share resourceType and resourceId are required", 400);
  const resourceExists = resourceType === "source"
    ? Boolean(await getSource(c.env, resourceId))
    : Boolean(await getCollection(c.env, resourceId));
  if (!resourceExists) return failed(c, "Share resource does not exist", 404);
  const target = input.target ? normalizeTargetAlias(input.target) : undefined;
  if (input.target && !target) return failed(c, "Unsupported target", 400);
  const expiresIn = numberValue(input.expiresIn, 0, 0, 365 * 24 * 60 * 60);
  const expiresAt = input.expiresAt
    ? numberValue(input.expiresAt, 0, Date.now() + 60_000, Date.now() + 365 * 24 * 60 * 60 * 1000)
    : expiresIn > 0 ? Date.now() + expiresIn * 1000 : undefined;
  const created = await createDownloadGrant(c.env, { resourceType, resourceId, target, expiresAt });
  const path = ["/download", resourceType, encodeURIComponent(resourceId), target].filter(Boolean).join("/");
  const url = new URL(path, getPublicBaseUrl(c));
  url.searchParams.set("token", created.token);
  return success(c, { ...created.grant, token: created.token, url: url.toString() });
});
apiRoutes.patch("/shares/:id", async (c) => {
  const input: JsonMap = await c.req.json<JsonMap>().catch(() => ({}));
  const updated = await updateDownloadGrant(c.env, c.req.param("id"), {
    enabled: typeof input.enabled === "boolean" ? input.enabled : undefined,
    expiresAt: input.expiresAt === null ? null : input.expiresAt ? Number(input.expiresAt) : undefined,
  });
  return updated ? success(c, updated) : failed(c, "Share not found", 404);
});
apiRoutes.delete("/shares/:id", async (c) => {
  const snapshot = await getDownloadGrantSnapshot(c.env, c.req.param("id"));
  if (!snapshot) return failed(c, "Share not found", 404);
  await archiveAndDeleteResource(
    c.env,
    "share",
    snapshot.id,
    snapshot as unknown as JsonMap,
    c.env.DB.prepare("DELETE FROM download_grants WHERE id = ?").bind(snapshot.id),
  );
  return success(c, { deleted: true });
});

apiRoutes.get("/recycle-bin", async (c) => success(c, await listRecycleBin(c.env)));
apiRoutes.delete("/recycle-bin/:id", async (c) => {
  const existing = await getRecycleBinEntry(c.env, c.req.param("id"));
  if (!existing) return failed(c, "Recycle entry not found", 404);
  await deleteRecycleBinEntry(c.env, existing.id);
  return success(c, { deleted: true });
});
apiRoutes.post("/recycle-bin/:id/restore", async (c) => {
  const entry = await getRecycleBinEntry(c.env, c.req.param("id"));
  if (!entry) return failed(c, "Recycle entry not found", 404);
  try {
    if (entry.resourceType === "source") {
      if (await getSource(c.env, entry.resourceId)) return failed(c, "Source id already exists", 409);
      await upsertSource(c.env, entry.snapshot as Partial<SourceRecord>);
    } else if (entry.resourceType === "collection") {
      if (await getCollection(c.env, entry.resourceId)) return failed(c, "Collection id already exists", 409);
      const validationError = await validateCollection(c.env, entry.snapshot as Partial<CollectionRecord>);
      if (validationError) return failed(c, validationError, 409);
      await upsertCollection(c.env, entry.snapshot as Partial<CollectionRecord>);
    } else if (entry.resourceType === "template") {
      if (await getTemplate(c.env, entry.resourceId)) return failed(c, "Template id already exists", 409);
      await upsertTemplate(c.env, entry.snapshot as Partial<TemplateRecord>);
    } else {
      if (await getDownloadGrant(c.env, entry.resourceId)) return failed(c, "Share id already exists", 409);
      await restoreDownloadGrantSnapshot(c.env, entry.snapshot);
    }
    await deleteRecycleBinEntry(c.env, entry.id);
    return success(c, { restored: true, resourceType: entry.resourceType, resourceId: entry.resourceId });
  } catch (error) {
    return failed(c, error instanceof Error ? error.message : String(error), 409);
  }
});

apiRoutes.post("/utils/node-info", async (c) => {
  const input: JsonMap = await c.req.json<JsonMap>().catch(() => ({}));
  const server = stringValue(input.server).replace(/^\[|\]$/g, "").trim();
  if (!server) return failed(c, "Node server is required", 400);
  const settings = await getSettings(c.env);
  const configured = stringValue(settings.nodeInfoApiUrl) || "https://ipwho.is/{ip}";
  if (!configured.startsWith("https://") || !configured.includes("{ip}")) return failed(c, "Node info API must be an HTTPS URL containing {ip}", 400);
  try {
    const response = await fetch(configured.replace("{ip}", encodeURIComponent(server)), {
      headers: { accept: "application/json", "user-agent": "Sub-Store-Cloudflare/1.0" },
    });
    if (!response.ok) throw new Error(`Node info provider failed: ${response.status}`);
    const body = await readResponseText(response, MAX_FLOW_RESPONSE_BYTES, "Node info response");
    const data = JSON.parse(body) as JsonMap;
    if (data.success === false) throw new Error(stringValue(data.message) || "Node info lookup failed");
    return success(c, {
      ip: stringValue(data.ip),
      country: stringValue(data.country),
      region: stringValue(data.region),
      city: stringValue(data.city),
      connection: objectValue(data.connection),
    });
  } catch (error) {
    return failed(c, error instanceof Error ? error.message : String(error), 502);
  }
});

apiRoutes.post("/preview/source", async (c) => {
  const input = await c.req.json<JsonMap>();
  try {
    if (input.source === "local" || input.content) {
      return success(c, await previewSourceContent(toSubscriptionSource(input), await getSettings(c.env)));
    }
    const source = toSubscriptionSource(input);
    return success(c, await previewSubscription({ source, sources: [source], settings: await getSettings(c.env) }));
  } catch (error) {
    return failed(c, error instanceof Error ? error.message : String(error), 400);
  }
});

apiRoutes.post("/preview/collection", async (c) => {
  const input = await c.req.json<JsonMap>();
  try {
    return success(c, await previewSubscription({ collection: toSubscriptionCollection(input), sources: await getSubscriptionSources(c.env), settings: await getSettings(c.env) }));
  } catch (error) {
    return failed(c, error instanceof Error ? error.message : String(error), 400);
  }
});

apiRoutes.get("/link/source/:name", async (c) => {
  const sub = await getSource(c.env, c.req.param("name"));
  if (!sub) return failed(c, "Source not found", 404);
  const link = buildDownloadLink(c, "source", sub.id, sub.name);
  if (!link) return failed(c, "Unsupported target", 400);
  return success(c, link);
});
apiRoutes.get("/link/collection/:name", async (c) => {
  const collection = await getCollection(c.env, c.req.param("name"));
  if (!collection) return failed(c, "Collection not found", 404);
  const link = buildDownloadLink(c, "collection", collection.id, collection.name);
  if (!link) return failed(c, "Unsupported target", 400);
  return success(c, link);
});

apiRoutes.get("/source/flow/:name", async (c) => {
  const sub = await getSource(c.env, c.req.param("name"));
  if (!sub) return flowFailed(c, "Source not found", 404);
  const parsed = parseFlowRequest(toApiSource(sub), await getSettings(c.env));
  if (!parsed) return flowFailed(c, "No flow info");

  try {
    const headers = await fetchFlowHeaders(parsed);
    const flow = parseFlowHeaders([stringValue(sub.meta.subUserinfo), headers].filter(Boolean).join("; "));
    if (!flow) return flowFailed(c, "No flow info");
    return success(c, flow);
  } catch (error) {
    return flowFailed(c, error instanceof Error ? error.message : String(error), 500);
  }
});

function envPayload(env: SubStoreEnv) {
  return {
    app: env.SUB_STORE_APP_NAME || "Sub-Store Cloudflare",
    backend: "Cloudflare",
    version: FRONTEND_VERSION,
    runtime: "Cloudflare Workers",
    storage: "D1",
    feature: {
      buildTimeScripts: true,
      proxyConversion: true,
      ruleConversion: true,
      scopedShares: true,
      recycleBin: true,
      nodeInfo: true,
      surgeMac: true,
    },
    meta: {
      cloudflare: {
        env: {
          SUB_STORE_BACKEND_CUSTOM_NAME: env.SUB_STORE_APP_NAME || "Sub-Store Cloudflare",
          SUB_STORE_DOCKER: "false",
        },
      },
    },
  };
}

function defaultSettings(env: SubStoreEnv) {
  return {
    defaultUserAgent: "clash.meta/v1.19.24",
    defaultFlowUserAgent: "clash.meta/v1.19.24",
    defaultTimeout: "30000",
    backendRequestConcurrency: "3",
    backendRequestConcurrencyWaitTime: "100",
    remoteCacheTtl: "300",
    remoteCacheStaleOnError: true,
    nodeInfoApiUrl: "https://ipwho.is/{ip}",
    theme: { auto: true, name: "light", dark: "dark", light: "light" },
    appearanceSetting: {
      isSimpleMode: true,
      isLeftRight: false,
      isDefaultIcon: false,
      isIconColor: false,
      isShowIcon: true,
      isSimpleShowRemark: false,
      isEditorCommon: false,
      manualSubscriptionsDisplayMode: "collapsed",
      editorGroupingMode: "always",
      isSimpleReicon: false,
      isSubItemMenuFold: true,
      showFloatingRefreshButton: false,
      showFloatingAddButton: false,
      createItemPosition: "bottom",
      displayPreviewInWebPage: true,
      subProgressStyle: "hidden",
      listPageViewMode: "single-column",
      listPageViewModeInWideScreenNarrowMode: "single-column",
      useNarrowModeOnWideScreen: false,
    },
    appName: env.SUB_STORE_APP_NAME || "Sub-Store Cloudflare",
  };
}

function mergeSettings(base: JsonMap, input: JsonMap) {
  return {
    ...base,
    ...input,
    theme: { ...objectValue(base.theme), ...objectValue(input.theme) },
    appearanceSetting: { ...objectValue(base.appearanceSetting), ...objectValue(input.appearanceSetting) },
  };
}

function toApiSource(source: SourceRecord) {
  return {
    id: source.id,
    name: source.name,
    type: source.type,
    url: source.url,
    content: source.content,
    filters: source.filters,
    enabled: source.enabled,
    meta: source.meta,
  };
}

function fromApiSource(input: JsonMap, partial = false): Partial<SourceRecord> {
  const id = stringValue(input.id || input.name);
  const name = partial ? stringValue(input.name) : stringValue(input.name || input.id);
  const output: Partial<SourceRecord> = {};
  if (!partial || id) output.id = id;
  if (!partial || name) output.name = name;
  if (!partial || "type" in input) output.type = input.type === "local" ? "local" : "remote";
  if (!partial || "url" in input) output.url = stringValue(input.url);
  if (!partial || "content" in input) output.content = stringValue(input.content);
  if (!partial || "enabled" in input) output.enabled = input.enabled !== false;
  if (!partial || "filters" in input || "process" in input) output.filters = filterList(input.filters, input.process);
  if (!partial || "meta" in input) output.meta = objectValue(input.meta);
  return output;
}

function mergeSource(existing: SourceRecord, next: Partial<SourceRecord>) {
  return { ...existing, ...next, id: existing.id, meta: { ...existing.meta, ...next.meta } };
}

function toApiCollection(collection: CollectionRecord) {
  return {
    id: collection.id,
    name: collection.name,
    sourceIds: collection.sourceIds,
    filters: collection.filters,
    templateId: collection.templateId,
    ignoreFailed: collection.ignoreFailed,
    enabled: collection.enabled,
    meta: collection.meta,
  };
}

function fromApiCollection(input: JsonMap, partial = false): Partial<CollectionRecord> {
  const id = stringValue(input.id || input.name);
  const name = partial ? stringValue(input.name) : stringValue(input.name || input.id);
  const output: Partial<CollectionRecord> = {};
  if (!partial || id) output.id = id;
  if (!partial || name) output.name = name;
  if (!partial || "sourceIds" in input) output.sourceIds = stringArray(input.sourceIds);
  if (!partial || "filters" in input || "process" in input) output.filters = filterList(input.filters, input.process);
  if (!partial || "templateId" in input) output.templateId = stringValue(input.templateId) || undefined;
  if (!partial || "ignoreFailed" in input) output.ignoreFailed = input.ignoreFailed !== false;
  if (!partial || "enabled" in input) output.enabled = input.enabled !== false;
  if (!partial || "meta" in input) output.meta = objectValue(input.meta);
  return output;
}

function mergeCollection(existing: CollectionRecord, next: Partial<CollectionRecord>) {
  return { ...existing, ...next, id: existing.id, meta: { ...existing.meta, ...next.meta } };
}

function toApiTemplate(template: TemplateRecord) {
  return {
    id: template.id,
    name: template.name,
    target: template.target,
    config: template.config,
    readonly: BUILTIN_TEMPLATE_IDS.has(template.id),
  };
}

function fromApiTemplate(input: JsonMap): Partial<TemplateRecord> {
  return {
    id: stringValue(input.id || input.name),
    name: stringValue(input.name || input.id),
    target: normalizeTargetValue(input.target),
    config: parseTemplateConfig(input.config ?? input.content),
  };
}

function toSubscriptionSource(input: JsonMap): SubscriptionSource {
  const sub = fromApiSource(input);
  return {
    id: sub.id || "preview",
    name: sub.name || stringValue(input.name) || "Preview",
    type: sub.type || "remote",
    url: sub.url || "",
    content: sub.content || "",
    filters: sub.filters || [],
    enabled: sub.enabled !== false,
    meta: sub.meta || {},
  };
}

function toSubscriptionCollection(input: JsonMap): SubscriptionCollection {
  const collection = fromApiCollection(input);
  return {
    id: collection.id || "preview",
    name: collection.name || stringValue(input.name) || "Preview",
    sourceIds: collection.sourceIds || [],
    filters: collection.filters || [],
    templateId: collection.templateId || "",
    ignoreFailed: collection.ignoreFailed !== false,
    enabled: collection.enabled !== false,
    meta: collection.meta || {},
  };
}

function buildDownloadLink(c: ApiContext, kind: "source" | "collection", id: string, name: string) {
  const rawTarget = c.req.query("target");
  const target = normalizeDownloadTarget(rawTarget);
  if (rawTarget && !target) return undefined;
  const path = ["/download", kind, encodeURIComponent(id), target].filter(Boolean).join("/");
  const url = new URL(path, getPublicBaseUrl(c));
  if (c.env.SUB_STORE_PUBLIC_DOWNLOAD_TOKEN) url.searchParams.set("token", c.env.SUB_STORE_PUBLIC_DOWNLOAD_TOKEN);
  for (const key of ["url", "content", "ua", "userAgent"]) {
    const value = c.req.query(key);
    if (value) url.searchParams.set(key, value);
  }
  const subscriptionUrl = url.toString();
  return {
    url: target === "shadowrocket" ? buildShadowrocketLink(subscriptionUrl, name) : subscriptionUrl,
    subscriptionUrl,
    target: target || "auto",
    tokenIncluded: Boolean(c.env.SUB_STORE_PUBLIC_DOWNLOAD_TOKEN),
  };
}

function buildShadowrocketLink(subscriptionUrl: string, remark: string) {
  const bytes = new TextEncoder().encode(subscriptionUrl);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `sub://${btoa(binary)}#${encodeURIComponent(remark || "订阅")}`;
}

function getPublicBaseUrl(c: ApiContext) {
  const publicHost = (c.env.SUB_STORE_PUBLIC_DOWNLOAD_HOSTS || "").split(",").map((host) => host.trim()).find(Boolean);
  return publicHost ? `https://${publicHost}` : new URL(c.req.url).origin;
}

function validateSource(input: Partial<SourceRecord>) {
  const idError = validateRecordId(input.id, "Source");
  if (idError) return idError;
  const scriptError = validateScriptActions(input.filters || []);
  if (scriptError) return scriptError;
  if (input.type === "local") {
    return stringValue(input.content) ? undefined : "Local source content is required";
  }
  const urls = stringValue(input.url).split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
  if (urls.length === 0) return "Remote source URL is required";
  if (urls.some((url) => !/^https?:\/\//i.test(url))) return "Remote source URLs must use http or https";
  return undefined;
}

function validateSourcePayload(input: JsonMap, partial = false) {
  if ((!partial || "type" in input) && input.type !== "remote" && input.type !== "local") {
    return "Source type must be remote or local";
  }
  return undefined;
}

async function validateCollection(env: SubStoreEnv, input: Partial<CollectionRecord>) {
  const idError = validateRecordId(input.id, "Collection");
  if (idError) return idError;
  const scriptError = validateScriptActions(input.filters || []);
  if (scriptError) return scriptError;
  const sourceIds = input.sourceIds || [];
  const sourceIdSet = new Set((await listSources(env)).map((source) => source.id));
  const missingSources = sourceIds.filter((id) => !sourceIdSet.has(id));
  if (missingSources.length > 0) return `Collection references missing sources: ${missingSources.join(", ")}`;

  const templateId = stringValue(input.templateId);
  if (templateId && !(await getTemplate(env, templateId))) return `Collection references missing template: ${templateId}`;
  return undefined;
}

function validateCollectionPayload(input: JsonMap, partial = false) {
  if ((!partial || "sourceIds" in input) && input.sourceIds !== undefined && !Array.isArray(input.sourceIds)) {
    return "Collection sourceIds must be an array";
  }
  return undefined;
}

function validateRecordId(input: unknown, label: string) {
  const id = stringValue(input);
  if (!id) return `${label} id is required`;
  if (!/^[a-z0-9_-]{1,64}$/.test(id)) {
    return `${label} id must use 1-64 lowercase letters, numbers, underscores, or hyphens`;
  }
  return undefined;
}

function normalizeDownloadTarget(input: unknown): SubscriptionTarget | undefined {
  if (input === undefined || input === null || String(input) === "") return undefined;
  return normalizeTargetAlias(input);
}

function normalizeTargetValue(input: unknown): SubscriptionTarget {
  return normalizeTargetAlias(input) || "mihomo";
}

function normalizeRuleTarget(input: unknown): RuleTarget | undefined {
  const value = String(input || "").toLowerCase();
  if (["mihomo", "clash", "clashmeta", "clash-meta"].includes(value)) return "mihomo";
  if (value === "surge") return "surge";
  if (value === "loon") return "loon";
  if (["qx", "quanx", "quantumultx", "quantumult-x"].includes(value)) return "qx";
  return undefined;
}

async function stringListBody(c: ApiContext) {
  const input = await c.req.json().catch(() => []);
  return Array.isArray(input) ? input.map(String).filter(Boolean) : [];
}

async function parseJsonOrText(c: ApiContext) {
  const contentType = c.req.header("content-type") || "";
  if (contentType.includes("application/json")) {
    return c.req.json().catch(() => ({}));
  }
  const text = await c.req.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as JsonMap;
  } catch {
    return { content: text };
  }
}

function parseTemplateConfig(input: unknown) {
  if (input && typeof input === "object" && !Array.isArray(input)) return normalizeMihomoTemplateConfig(input as JsonMap);
  if (typeof input !== "string" || !input.trim()) throw new Error("Template config is required");
  try {
    const parsed = input.trim().startsWith("{") ? JSON.parse(input) : parseYaml(input);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return normalizeMihomoTemplateConfig(parsed as JsonMap);
  } catch {
    throw new Error("Template config must be valid JSON or YAML");
  }
  throw new Error("Template config must be an object");
}

function normalizeMihomoTemplateConfig(input: JsonMap) {
  const output: JsonMap = { ...input };
  copyAlias(output, "mixed-port", "mixedPort");
  copyAlias(output, "allow-lan", "allowLan");
  copyAlias(output, "log-level", "logLevel");
  copyAlias(output, "proxy-groups", "proxyGroups");
  copyAlias(output, "rule-providers", "ruleProviders");
  return output;
}

function copyAlias(input: JsonMap, from: string, to: string) {
  if (input[to] === undefined && input[from] !== undefined) input[to] = input[from];
  delete input[from];
}

type FlowRequest = {
  url: string;
  userAgent: string;
  headers: Record<string, string>;
  timeout: number;
};

function flowFailed(c: ApiContext, message: string, status = 400) {
  return c.json({ status: "failed", error: { code: "NO_FLOW_INFO", type: "NO_FLOW_INFO", message } }, status as 400);
}

function parseFlowRequest(sub: JsonMap, settings: JsonMap = {}): FlowRequest | undefined {
  const rawUrl = stringValue(sub.url);
  const args = parseUrlArguments(rawUrl);
  const flowUrl = stringValue(args.flowUrl) || rawUrl.split("#")[0];
  if (args.noFlow || !/^https?:\/\//i.test(flowUrl)) return undefined;
  return {
    url: flowUrl,
    userAgent: stringValue(args.flowUserAgent) || stringValue(settings.defaultFlowUserAgent) || stringValue(settings.defaultUserAgent) || "clash.meta/v1.19.24",
    headers: parseJsonHeaders(args.flowHeaders),
    timeout: numberValue(settings.defaultTimeout, 30000, 1000, 120000),
  };
}

function parseUrlArguments(rawUrl: string) {
  const hash = rawUrl.split("#").slice(1).join("#");
  if (!hash) return {} as JsonMap;
  try {
    return JSON.parse(decodeURIComponent(hash)) as JsonMap;
  } catch {
    return Object.fromEntries(
      hash
        .split("&")
        .filter(Boolean)
        .map((pair) => {
          const [key, value] = pair.split("=");
          return [key, value === undefined || value === "" ? true : decodeURIComponent(value)];
        }),
    );
  }
}

function parseJsonHeaders(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value) as JsonMap;
    return Object.fromEntries(Object.entries(parsed).map(([key, item]) => [key, String(item)]));
  } catch {
    return {};
  }
}

async function fetchFlowHeaders(input: FlowRequest) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), input.timeout);
  try {
    const response = await fetch(input.url, {
      headers: { "user-agent": input.userAgent, ...input.headers },
      signal: controller.signal,
    });
    const headerFlow = response.headers.get("subscription-userinfo");
    const appUrl = response.headers.get("profile-web-page-url");
    const planName = response.headers.get("profile-title") || response.headers.get("plan-name");
    const body = await readResponseText(response, MAX_FLOW_RESPONSE_BYTES, "Flow response");
    return [
      headerFlow,
      /(?:^|[;\n\r ])upload=/.test(body) ? body : undefined,
      appUrl ? `app_url=${encodeURIComponent(appUrl)}` : undefined,
      planName ? `plan_name=${encodeURIComponent(planName)}` : undefined,
    ]
      .filter(Boolean)
      .join("; ");
  } finally {
    clearTimeout(timeoutId);
  }
}

function parseFlowHeaders(flowHeaders: string) {
  const upload = numberField(flowHeaders, "upload") ?? 0;
  const download = numberField(flowHeaders, "download");
  const total = numberField(flowHeaders, "total");
  if (download === undefined || total === undefined) return undefined;
  return {
    expires: numberField(flowHeaders, "expire"),
    total,
    usage: { upload, download },
    remainingDays: numberField(flowHeaders, "reset_day"),
    appUrl: textField(flowHeaders, "app_url"),
    planName: textField(flowHeaders, "plan_name"),
  };
}

function numberField(input: string, key: string) {
  const match = input.match(new RegExp(`${key}=([-+]?)([0-9]*\\.?[0-9]+(?:[eE][-+]?[0-9]+)?)`));
  return match ? Number(match[1] + match[2]) : undefined;
}

function textField(input: string, key: string) {
  const match = input.match(new RegExp(`${key}=(.*?)\\s*?(;|$)`));
  return match ? decodeURIComponent(match[1]) : undefined;
}

function keepMeta(input: JsonMap, excluded: string[]) {
  const excludedSet = new Set(excluded);
  return Object.fromEntries(Object.entries(input).filter(([key]) => !excludedSet.has(key)));
}

function objectValue(input: unknown): JsonMap {
  return input && typeof input === "object" && !Array.isArray(input) ? (input as JsonMap) : {};
}

function filterList(input: unknown, process?: unknown): FilterRule[] {
  const direct = Array.isArray(input) ? (input.filter((item) => item && typeof item === "object") as FilterRule[]) : [];
  if (direct.length > 0 || !Array.isArray(process)) return direct;
  return process.flatMap((item) => processToFilter(item)).filter(Boolean) as FilterRule[];
}

function processToFilter(input: unknown): FilterRule | FilterRule[] | undefined {
  const item = objectValue(input);
  if (!item.type || item.disabled === true) return undefined;
  const args = objectValue(item.args);
  if (["include", "exclude", "rename", "delete-field", "dedupe", "sort", "regex-sort", "flag", "quick", "resolve", "script"].includes(String(item.type))) {
    const { id: _id, customName: _customName, disabled: _disabled, ...filter } = item;
    return filter as FilterRule;
  }
  if (item.type === "Resolve Domain Operator") {
    return {
      type: "resolve",
      provider: normalizeResolveProvider(args.provider),
      recordType: args.type === "IPv6" ? "AAAA" : "A",
      filter: stringValue(args.filter) || "disabled",
      url: stringValue(args.url),
      edns: stringValue(args.edns),
      concurrency: args.concurrency === undefined ? "" : String(args.concurrency),
    };
  }
  return undefined;
}

function normalizeResolveProvider(input: unknown) {
  const provider = stringValue(input) || "Cloudflare";
  return ["Google", "Cloudflare", "Ali", "Tencent", "Custom"].includes(provider) ? provider : "Cloudflare";
}

function stringArray(input: unknown): string[] {
  return Array.isArray(input) ? input.map(String).filter(Boolean) : [];
}

function arrayValue(input: unknown): unknown[] {
  return Array.isArray(input) ? input : [];
}

function stringValue(input: unknown): string {
  return typeof input === "string" ? input : "";
}

function numberValue(input: unknown, fallback: number, min: number, max: number) {
  const number = Number(input);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(Math.max(Math.trunc(number), min), max);
}
