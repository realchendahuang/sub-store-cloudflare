import { Hono } from "hono";
import type { Context } from "hono";
import { parse as parseYaml } from "yaml";
import { failed, requireAdmin, success } from "../lib/http";
import { BUILTIN_TEMPLATE_IDS } from "../lib/defaults";
import {
  deleteCollection,
  deleteSource,
  deleteTemplate,
  ensureSchema,
  exportStorage,
  getAppConfig,
  getCollection,
  getSettings,
  getSource,
  getSubscriptionSources,
  getTemplate,
  importStorage,
  sortCollections,
  sortSources,
  updateSettings,
  upsertCollection,
  upsertSource,
  upsertTemplate,
} from "../lib/store";
import { normalizeTargetAlias, previewSourceContent, previewSubscription } from "../lib/subscription";
import type {
  CollectionRecord,
  FilterRule,
  SourceRecord,
  SubStoreEnv,
  SubscriptionCollection,
  SubscriptionSource,
  SubscriptionTarget,
  TemplateRecord,
} from "../types";

export const apiRoutes = new Hono<{ Bindings: SubStoreEnv }>();

type JsonMap = Record<string, unknown>;
type ApiContext = Context<{ Bindings: SubStoreEnv }>;

const FRONTEND_VERSION = "2.17.35";
apiRoutes.use("*", async (c, next) => {
  const invalid = await requireAdmin(c);
  if (invalid) return invalid;
  await ensureSchema(c.env);
  return next();
});

apiRoutes.get("/env", async (c) => success(c, envPayload(c.env)));
apiRoutes.get("/settings", async (c) => success(c, mergeSettings(defaultSettings(c.env), await getSettings(c.env))));
apiRoutes.patch("/settings", async (c) => {
  const input = await c.req.json<JsonMap>().catch(() => ({}));
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

apiRoutes.get("/sources", async (c) => success(c, (await getAppConfig(c.env)).sources.map(toApiSource)));
apiRoutes.post("/sources", async (c) => {
  const input = await c.req.json<JsonMap>();
  if (!stringValue(input.id || input.name)) return failed(c, "Source id is required");
  return success(c, toApiSource(await upsertSource(c.env, fromApiSource(input))));
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
  return success(c, toApiSource(await upsertSource(c.env, mergeSource(existing, fromApiSource(await c.req.json())))));
});
apiRoutes.delete("/sources/:name", async (c) => success(c, await deleteSource(c.env, c.req.param("name"))));

apiRoutes.get("/collections", async (c) => success(c, (await getAppConfig(c.env)).collections.map(toApiCollection)));
apiRoutes.post("/collections", async (c) => {
  const input = await c.req.json<JsonMap>();
  if (!stringValue(input.id || input.name)) return failed(c, "Collection id is required");
  return success(c, toApiCollection(await upsertCollection(c.env, fromApiCollection(input))));
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
  return success(c, toApiCollection(await upsertCollection(c.env, mergeCollection(existing, fromApiCollection(await c.req.json())))));
});
apiRoutes.delete("/collections/:name", async (c) => success(c, await deleteCollection(c.env, c.req.param("name"))));

apiRoutes.get("/templates", async (c) => success(c, (await getAppConfig(c.env)).templates.map(toApiTemplate)));
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
    return success(c, await deleteTemplate(c.env, c.req.param("name")));
  } catch (error) {
    return failed(c, error instanceof Error ? error.message : String(error), 400);
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
  const link = buildDownloadLink(c, "source", sub.id);
  if (!link) return failed(c, "Unsupported target", 400);
  return success(c, link);
});
apiRoutes.get("/link/collection/:name", async (c) => {
  const collection = await getCollection(c.env, c.req.param("name"));
  if (!collection) return failed(c, "Collection not found", 404);
  const link = buildDownloadLink(c, "collection", collection.id);
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
    feature: {},
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
      editorGroupingMode: "edit-only",
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

function fromApiSource(input: JsonMap): Partial<SourceRecord> {
  const id = stringValue(input.id || input.name);
  const name = stringValue(input.name || input.id);
  return {
    id,
    name,
    type: input.type === "local" ? "local" : "remote",
    url: stringValue(input.url),
    content: stringValue(input.content),
    enabled: input.enabled !== false,
    filters: filterList(input.filters, input.process),
    meta: objectValue(input.meta),
  };
}

function mergeSource(existing: SourceRecord, next: Partial<SourceRecord>) {
  return { ...existing, ...next, meta: { ...existing.meta, ...next.meta } };
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

function fromApiCollection(input: JsonMap): Partial<CollectionRecord> {
  const id = stringValue(input.id || input.name);
  const name = stringValue(input.name || input.id);
  return {
    id,
    name,
    sourceIds: stringArray(input.sourceIds),
    filters: filterList(input.filters, input.process),
    templateId: stringValue(input.templateId) || undefined,
    ignoreFailed: input.ignoreFailed !== false,
    enabled: input.enabled !== false,
    meta: objectValue(input.meta),
  };
}

function mergeCollection(existing: CollectionRecord, next: Partial<CollectionRecord>) {
  return { ...existing, ...next, meta: { ...existing.meta, ...next.meta } };
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

function buildDownloadLink(c: ApiContext, kind: "source" | "collection", id: string) {
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
  return { url: url.toString(), target: target || "auto", tokenIncluded: Boolean(c.env.SUB_STORE_PUBLIC_DOWNLOAD_TOKEN) };
}

function getPublicBaseUrl(c: ApiContext) {
  const publicHost = (c.env.SUB_STORE_PUBLIC_DOWNLOAD_HOSTS || "").split(",").map((host) => host.trim()).find(Boolean);
  const host = publicHost || c.req.header("x-forwarded-host") || c.req.header("host") || new URL(c.req.url).host;
  const protocol = publicHost ? "https:" : new URL(c.req.url).protocol;
  return `${protocol}//${host}`;
}

function normalizeDownloadTarget(input: unknown): SubscriptionTarget | undefined {
  if (input === undefined || input === null || String(input) === "") return undefined;
  return normalizeTargetAlias(input);
}

function normalizeTargetValue(input: unknown): SubscriptionTarget {
  return normalizeTargetAlias(input) || "mihomo";
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
  const parsed = JSON.parse(value) as JsonMap;
  return Object.fromEntries(Object.entries(parsed).map(([key, item]) => [key, String(item)]));
}

async function fetchFlowHeaders(input: FlowRequest) {
  const response = await fetch(input.url, { headers: { "user-agent": input.userAgent, ...input.headers } });
  const headerFlow = response.headers.get("subscription-userinfo");
  const appUrl = response.headers.get("profile-web-page-url");
  const planName = response.headers.get("profile-title") || response.headers.get("plan-name");
  const body = await response.text();
  return [
    headerFlow,
    /(?:^|[;\n\r ])upload=/.test(body) ? body : undefined,
    appUrl ? `app_url=${encodeURIComponent(appUrl)}` : undefined,
    planName ? `plan_name=${encodeURIComponent(planName)}` : undefined,
  ]
    .filter(Boolean)
    .join("; ");
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
  if (["include", "exclude", "rename", "delete-field", "dedupe", "sort", "regex-sort", "flag", "quick", "resolve"].includes(String(item.type))) {
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
