import { Hono } from "hono";
import type { Context } from "hono";
import { failed, isTokenValid } from "../lib/http";
import { authorizeScopedDownload } from "../lib/compatibility-resources";
import { buildSubscriptionResult, getTargetContentType, normalizeTarget, normalizeTargetAlias } from "../lib/subscription";
import { getRoutingTemplate, getSettings, getSource, getSubscriptionCollection, getSubscriptionSources } from "../lib/store";
import type { SubscriptionCollection, SubscriptionSource, SubscriptionTarget } from "../types";

export const downloadRoutes = new Hono<{ Bindings: SubStoreEnv }>();

type DownloadContext = Context<{ Bindings: SubStoreEnv }>;

downloadRoutes.get("/download/collection/:name/:target?/:token?", async (c) => {
  const target = getDownloadTarget(c);
  if (!target) return failed(c, "Unsupported target", 400);
  const invalidToken = await rejectInvalidDownloadToken(c, "collection", c.req.param("name"), target);
  if (invalidToken) return invalidToken;

  const collection = await getSubscriptionCollection(c.env, c.req.param("name"));
  if (!collection) return failed(c, "Collection not found", 404);

  return renderDownload(c, {
    collection,
    sources: await getSubscriptionSources(c.env),
    target,
    templateId: collection.templateId,
  });
});

downloadRoutes.get("/download/source/:name/:target?/:token?", async (c) => {
  const target = getDownloadTarget(c);
  if (!target) return failed(c, "Unsupported target", 400);
  const invalidToken = await rejectInvalidDownloadToken(c, "source", c.req.param("name"), target);
  if (invalidToken) return invalidToken;

  const source = await getSource(c.env, c.req.param("name"));
  if (!source || !source.enabled) return failed(c, "Subscription not found", 404);
  const subscriptionSource: SubscriptionSource = {
    id: source.id,
    name: source.name,
    type: source.type,
    url: source.url,
    content: source.content,
    filters: source.filters,
    enabled: source.enabled,
    meta: source.meta,
  };

  return renderDownload(c, {
    source: subscriptionSource,
    sources: [subscriptionSource],
    target,
  });
});

async function renderDownload(
  c: DownloadContext,
  options: {
    source?: SubscriptionSource;
    collection?: SubscriptionCollection;
    sources: SubscriptionSource[];
    target: SubscriptionTarget;
    templateId?: string;
  },
) {
  const sourceOverride = getTemporarySourceOverride(c);
  const sources = sourceOverride ? applyTemporarySourceOverride(options.sources, sourceOverride, options.collection) : options.sources;
  const source = sourceOverride && options.source ? applyTemporarySourceOverride([options.source], sourceOverride)[0] : options.source;
  const [template, settings] = await Promise.all([
    getRoutingTemplate(c.env, options.templateId),
    getSettings(c.env),
  ]);
  try {
    const result = await buildSubscriptionResult({
      source,
      collection: options.collection,
      sources,
      requestUrl: new URL(c.req.url),
      target: options.target,
      template,
      settings,
      requestUserAgent: c.req.header("user-agent") || "",
      forceRefresh: ["1", "true"].includes(c.req.query("refresh") || c.req.query("noCache") || ""),
      waitUntil: (promise) => c.executionCtx.waitUntil(promise),
    });
    const headers = new Headers({
      "content-type": getTargetContentType(options.target),
      "profile-update-interval": result.metadata.profileUpdateInterval || "6",
      "cache-control": "no-store",
    });
    setResponseHeader(headers, "subscription-userinfo", result.metadata.subscriptionUserinfo);
    setResponseHeader(headers, "profile-web-page-url", result.metadata.profileWebPageUrl);
    setResponseHeader(headers, "content-disposition", result.metadata.contentDisposition);
    setResponseHeader(headers, "x-sub-store-cache", result.metadata.cacheStatus);
    return new Response(result.body, { headers });
  } catch (error) {
    return failed(c, error instanceof Error ? error.message : String(error), 500);
  }
}

function setResponseHeader(headers: Headers, name: string, value: string | undefined) {
  if (value && !/[\r\n]/.test(value)) headers.set(name, value);
}

type TemporarySourceOverride = {
  url?: string;
  content?: string;
  ua?: string;
};

function getTemporarySourceOverride(c: DownloadContext): TemporarySourceOverride | undefined {
  const url = stringQuery(c, "url");
  const content = stringQuery(c, "content");
  const ua = stringQuery(c, "ua") || stringQuery(c, "userAgent") || stringQuery(c, "user-agent");
  if (!url && !content && !ua) return undefined;
  return { url, content, ua };
}

function applyTemporarySourceOverride(sources: SubscriptionSource[], override: TemporarySourceOverride, collection?: SubscriptionCollection) {
  const selectedIds = collection?.sourceIds || [];
  const overrideIndex = selectedIds.length > 0
    ? sources.findIndex((source) => selectedIds.includes(source.id) || selectedIds.includes(source.name))
    : 0;
  const targetIndex = overrideIndex >= 0 ? overrideIndex : 0;

  return sources.map((source, index) => {
    if (index !== targetIndex) return source;
    const meta = { ...(source.meta || {}) };
    if (override.ua) meta.ua = override.ua;
    return {
      ...source,
      type: override.content ? "local" : override.url ? "remote" : source.type,
      url: override.url || source.url,
      content: override.content || (override.url ? "" : source.content),
      meta,
    };
  });
}

function stringQuery(c: DownloadContext, key: string) {
  const value = c.req.query(key);
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function getDownloadToken(c: DownloadContext) {
  return c.req.param("token") || c.req.query("token");
}

async function rejectInvalidDownloadToken(
  c: DownloadContext,
  resourceType: "source" | "collection",
  resourceId: string,
  target: SubscriptionTarget,
) {
  const token = getDownloadToken(c);
  if (await isTokenValid(c.env.SUB_STORE_PUBLIC_DOWNLOAD_TOKEN, token)) return undefined;
  if (await authorizeScopedDownload(c.env, token, resourceType, resourceId, target)) return undefined;
  return failed(c, "Download token is invalid", 403);
}

function getDownloadTarget(c: DownloadContext, defaultTarget?: string) {
  const explicit = c.req.param("target") || c.req.query("target");
  if (explicit) return normalizeTargetAlias(explicit);
  return normalizeTarget(defaultTarget, c.req.header("user-agent") || "");
}
