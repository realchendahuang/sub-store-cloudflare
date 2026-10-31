import JSON5 from "json5";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
export { normalizeTarget, normalizeTargetAlias } from "./targets";
import {
  MAX_DOH_RESPONSE_BYTES,
  MAX_REMOTE_SOURCE_RESPONSE_BYTES,
  MAX_REMOTE_SOURCE_TOTAL_BYTES,
  MAX_REMOTE_SOURCE_URLS,
} from "./limits";
import { readResponseText, utf8ByteLength } from "./read";
import { applyScriptAction, isIPv4, isIPv6, validateScriptActions } from "./scripts";
import type {
  AppSettings,
  FilterRule,
  ProxyNode,
  RoutingTemplate,
  RoutingTemplateConfig,
  SubscriptionCollection,
  SubscriptionResponseMetadata,
  SubscriptionSource,
  SubscriptionTarget,
  TemplateProxyGroup,
} from "../types";

type SingBoxOutbound = Record<string, unknown> & {
  type: string;
  tag: string;
};

type BuildOptions = {
  source?: SubscriptionSource;
  collection?: SubscriptionCollection;
  sources: SubscriptionSource[];
  requestUrl: URL;
  target: SubscriptionTarget;
  template?: RoutingTemplate;
  settings?: AppSettings;
  requestUserAgent?: string;
  forceRefresh?: boolean;
  waitUntil?: (promise: Promise<unknown>) => void;
};

type SubrequestBudget = { limit: number; used: number };

type InternalBuildOptions = BuildOptions & {
  responseMetadata: Map<string, SubscriptionResponseMetadata>;
  budget?: SubrequestBudget;
};

type FetchRuntime = Partial<Pick<InternalBuildOptions, "responseMetadata" | "forceRefresh" | "waitUntil" | "budget">>;

type FilterContext = {
  targetPlatform: SubscriptionTarget;
  sourceId?: string;
  collectionId?: string;
  budget?: SubrequestBudget;
};

const TEST_URL = "https://www.gstatic.com/generate_204";
// Workers allow 6 simultaneous open connections and 50 (free plan) subrequests per request.
const MAX_CONCURRENCY = 6;
const DEFAULT_SUBREQUEST_LIMIT = 45;
// Cache entries outlive the freshness TTL so that stale-on-error and 304 revalidation keep working.
const CACHE_STORE_TTL_SECONDS = 7 * 24 * 60 * 60;
const CACHED_AT_HEADER = "x-sub-store-cached-at";
const nameCollator = new Intl.Collator("zh-Hans-CN");

export function getTargetContentType(target: SubscriptionTarget) {
  if (target === "sing-box" || target === "json") return "application/json; charset=utf-8";
  if (target === "v2ray" || target === "uri" || target === "surge" || target === "surge-mac" || target === "surfboard" || target === "loon" || target === "shadowrocket" || target === "qx") return "text/plain; charset=utf-8";
  return "text/yaml; charset=utf-8";
}

export async function buildSubscription(options: BuildOptions) {
  return (await buildSubscriptionResult(options)).body;
}

export async function buildSubscriptionResult(options: BuildOptions) {
  const internal: InternalBuildOptions = { ...options, responseMetadata: new Map(), budget: createSubrequestBudget(options.settings) };
  const proxies = await loadProxyNodes(internal);
  if (proxies.length === 0) throw new Error("No available nodes found");
  const body = renderTarget(proxies, options.target, options.requestUrl, options.template?.config);
  return { body, metadata: selectResponseMetadata(internal), nodes: proxies.length };
}

export async function previewSubscription(options: Pick<BuildOptions, "source" | "collection" | "sources" | "settings" | "requestUserAgent">) {
  const sources = getSources({
    ...options,
    requestUrl: new URL("https://sub-store.local/preview"),
    target: "json",
  });
  const budget = createSubrequestBudget(options.settings);
  const originalLists = await runWithConcurrency(
    sources.map((sub) => async () => parseProxies(await loadSubscriptionRaw(sub, options.settings, options.requestUserAgent, { budget }))),
    getRequestConcurrency(options.settings),
    getRequestConcurrencyWait(options.settings),
  );
  const original = addPreviewIds(originalLists.flat());
  const processedLists = await runWithConcurrency(
    originalLists.map((nodes, index) => async () => applyFilters(nodes, getFilters(sources[index]), options.settings, {
      targetPlatform: "json",
      sourceId: sources[index].id,
      budget,
    })),
    getRequestConcurrency(options.settings),
    getRequestConcurrencyWait(options.settings),
  );
  const processed = addPreviewIds(ensureUniqueProxyNames(await applyFilters(processedLists.flat(), getFilters(options.collection), options.settings, {
    targetPlatform: "json",
    collectionId: options.collection?.id,
    budget,
  })));

  return { original, processed };
}

export async function previewSourceContent(source: SubscriptionSource, settings?: AppSettings) {
  const original = parseProxies(decodeMaybeBase64(source.content || source.url || ""));
  if (original.length === 0) throw new Error(formatInvalidLocalContentError(source.content || source.url || ""));
  const processed = ensureUniqueProxyNames(await applyFilters(original, getFilters(source), settings, {
    targetPlatform: "json",
    sourceId: source.id,
    budget: createSubrequestBudget(settings),
  }));
  return {
    original: addPreviewIds(original),
    processed: addPreviewIds(processed),
  };
}

export function validateSubscriptionContent(raw: string) {
  const proxies = parseProxies(decodeMaybeBase64(raw));
  if (proxies.length === 0) throw new Error(formatInvalidLocalContentError(raw));
  return addPreviewIds(proxies);
}

export async function convertSubscriptionContent(input: {
  content: string;
  target: SubscriptionTarget;
  filters?: FilterRule[];
  template?: RoutingTemplate;
  settings?: AppSettings;
}) {
  const parsed = parseProxies(decodeMaybeBase64(input.content));
  if (parsed.length === 0) throw new Error(formatInvalidLocalContentError(input.content));
  const processed = ensureUniqueProxyNames(await applyFilters(parsed, input.filters || [], input.settings, {
    targetPlatform: input.target,
    sourceId: "one-shot",
    budget: createSubrequestBudget(input.settings),
  }));
  const supported = processed.filter((proxy) => isTargetCompatible(proxy, input.target));
  const output = renderTarget(supported, input.target, new URL("https://sub-store.local/convert"), input.template?.config);
  return {
    content: output,
    parsed: parsed.length,
    emitted: supported.length,
    skipped: processed.length - supported.length,
    warnings: processed.length === supported.length
      ? []
      : [`${processed.length - supported.length} node(s) cannot be represented by ${input.target}`],
  };
}

export function isTargetCompatible(proxy: ProxyNode, target: SubscriptionTarget) {
  if (target === "mihomo" || target === "stash" || target === "json") return true;
  const commonUri = ["ss", "ssr", "vmess", "vless", "trojan", "hysteria", "hysteria2", "tuic", "anytls", "http", "socks5", "wireguard"];
  if (target === "uri" || target === "v2ray" || target === "shadowrocket") return commonUri.includes(proxy.type);
  if (target === "sing-box") return ["ss", "vmess", "vless", "trojan", "hysteria", "hysteria2", "tuic", "anytls", "http", "socks5", "wireguard"].includes(proxy.type);
  if (target === "surge") return ["ss", "vmess", "trojan", "http", "socks5", "hysteria2", "tuic", "anytls", "snell"].includes(proxy.type);
  if (target === "surge-mac") return ["ss", "vmess", "trojan", "http", "socks5", "hysteria2", "tuic", "anytls", "snell", "ssh", "h2-connect"].includes(proxy.type);
  if (target === "surfboard") return ["ss", "vmess", "trojan", "http", "socks5"].includes(proxy.type);
  if (target === "loon") return ["ss", "ssr", "vmess", "vless", "trojan", "http", "socks5", "hysteria2", "tuic", "anytls", "wireguard"].includes(proxy.type);
  if (target === "qx") return ["ss", "ssr", "vmess", "vless", "trojan", "http", "socks5", "anytls"].includes(proxy.type);
  if (target === "egern") return ["ss", "vmess", "trojan", "http", "socks5", "hysteria2", "tuic", "anytls"].includes(proxy.type);
  return false;
}

async function loadProxyNodes(options: InternalBuildOptions) {
  const sources = getSources(options).filter((sub) => sub.enabled !== false);
  if (sources.length === 0) return [];

  const tasks = sources.map((sub) => async () => applyFilters(
    parseProxies(await loadSubscriptionRaw(sub, options.settings, options.requestUserAgent, options)),
    getFilters(sub),
    options.settings,
    { targetPlatform: options.target, sourceId: sub.id, budget: options.budget },
  ));
  const proxyLists = options.collection?.ignoreFailed
    ? (await runSettledWithConcurrency(tasks, getRequestConcurrency(options.settings), getRequestConcurrencyWait(options.settings))).flatMap((result) => {
        if (result.status === "fulfilled") return [result.value];
        // An exhausted budget is a configuration problem; never hide it as a silently missing source.
        if (result.reason instanceof SubrequestBudgetError) throw result.reason;
        return [];
      })
    : await runWithConcurrency(tasks, getRequestConcurrency(options.settings), getRequestConcurrencyWait(options.settings));

  return ensureUniqueProxyNames(await applyFilters(proxyLists.flat(), getFilters(options.collection), options.settings, {
    targetPlatform: options.target,
    collectionId: options.collection?.id,
    budget: options.budget,
  }));
}

function getSources(options: BuildOptions) {
  if (!options.collection) return options.source ? [options.source] : [];

  const sourceIds = options.collection.sourceIds || [];
  if (sourceIds.length === 0) return options.sources;
  return sourceIds
    .map((id) => options.sources.find((source) => source.id === id || source.name === id))
    .filter((source): source is SubscriptionSource => Boolean(source));
}

function getFilters(input: SubscriptionSource | SubscriptionCollection | undefined): FilterRule[] {
  const filters = input?.filters || [];
  return Array.isArray(filters) ? (filters as FilterRule[]) : [];
}

async function loadSubscriptionRaw(
  sub: SubscriptionSource,
  settings?: AppSettings,
  requestUserAgent?: string,
  runtime?: FetchRuntime,
) {
  if (sub.type === "local") {
    runtime?.responseMetadata?.set(sub.id, metadataFromSource(sub));
    return decodeMaybeBase64(String(sub.content || sub.url || ""));
  }

  const urls = splitSourceUrls(sub.url);
  if (urls.length === 0) throw new Error(`Remote source ${sub.name} has no valid URL`);
  if (urls.length > MAX_REMOTE_SOURCE_URLS) {
    throw new Error(`Remote source ${sub.name} exceeds the ${MAX_REMOTE_SOURCE_URLS} URL limit`);
  }

  const contents = await runWithConcurrency(
    urls.map((url) => async () => fetchSubscriptionUrl(url, sub, settings, requestUserAgent, runtime)),
    getRequestConcurrency(settings),
    getRequestConcurrencyWait(settings),
  );
  const totalBytes = contents.reduce((total, item) => total + utf8ByteLength(item.content), 0);
  if (totalBytes > MAX_REMOTE_SOURCE_TOTAL_BYTES) {
    throw new Error(`Remote source ${sub.name} exceeds the ${MAX_REMOTE_SOURCE_TOTAL_BYTES / (1024 * 1024)} MiB combined limit`);
  }
  const metadata = contents.map((item) => item.metadata).find((item) => Object.keys(item).length > 0) || metadataFromSource(sub);
  runtime?.responseMetadata?.set(sub.id, metadata);
  return contents.map((item) => decodeMaybeBase64(item.content)).join("\n");
}

function splitSourceUrls(raw: string) {
  return String(raw || "")
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter((item) => /^https?:\/\//i.test(item));
}

async function fetchSubscriptionUrl(
  url: string,
  sub: SubscriptionSource,
  settings?: AppSettings,
  requestUserAgent?: string,
  runtime?: FetchRuntime,
) {
  const budget = runtime?.budget;
  const userAgent = getSourceUserAgent(sub, settings, requestUserAgent);
  const cacheTtl = numberSetting(sub.meta?.cacheTtl ?? settings?.remoteCacheTtl, 300, 0, 3600);
  const cacheKey = cacheTtl > 0 ? await remoteCacheKey(url, userAgent) : undefined;
  // Keep one subrequest in reserve for the upstream fetch that a cache miss needs.
  const cached = cacheKey && consumeSubrequest(budget, 1) ? await safeCacheMatch(cacheKey) : undefined;
  if (cached && !runtime?.forceRefresh && isCacheFresh(cached, cacheTtl)) {
    return {
      content: await readResponseText(cached.clone(), MAX_REMOTE_SOURCE_RESPONSE_BYTES, `Cached remote source ${sub.name}`),
      metadata: metadataFromResponse(cached, "hit"),
    };
  }
  const controller = new AbortController();
  const timeout = getRequestTimeout(settings);
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  try {
    if (!consumeSubrequest(budget)) throw new SubrequestBudgetError(subrequestBudgetMessage(budget));
    const requestHeaders: Record<string, string> = { "user-agent": userAgent };
    const etag = cached?.headers.get("x-sub-store-etag");
    const lastModified = cached?.headers.get("x-sub-store-last-modified");
    if (etag) requestHeaders["if-none-match"] = etag;
    if (lastModified) requestHeaders["if-modified-since"] = lastModified;
    const response = await fetch(url, {
      headers: requestHeaders,
      signal: controller.signal,
    });
    if (response.status === 304 && cached) {
      const content = await readResponseText(cached.clone(), MAX_REMOTE_SOURCE_RESPONSE_BYTES, `Cached remote source ${sub.name}`);
      const metadata = metadataFromResponse(cached, "refresh");
      if (cacheKey) await storeRemoteCache(cacheKey, content, metadata, runtime);
      return { content, metadata };
    }
    if (!response.ok) throw new Error(`Remote source ${sub.name} failed: ${response.status}`);
    const content = await readResponseText(response, MAX_REMOTE_SOURCE_RESPONSE_BYTES, `Remote source ${sub.name}`);
    const metadata = metadataFromResponse(response, runtime?.forceRefresh ? "refresh" : "miss");
    if (cacheKey) await storeRemoteCache(cacheKey, content, metadata, runtime);
    return { content, metadata };
  } catch (error) {
    if (cached && settings?.remoteCacheStaleOnError !== false) {
      return {
        content: await readResponseText(cached.clone(), MAX_REMOTE_SOURCE_RESPONSE_BYTES, `Stale remote source ${sub.name}`),
        metadata: metadataFromResponse(cached, "stale"),
      };
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function isCacheFresh(cached: Response, ttlSeconds: number) {
  const cachedAt = Number(cached.headers.get(CACHED_AT_HEADER));
  if (!Number.isFinite(cachedAt) || cachedAt <= 0) return false;
  const age = Date.now() - cachedAt;
  return age >= 0 && age < ttlSeconds * 1000;
}

async function storeRemoteCache(key: Request, content: string, metadata: SubscriptionResponseMetadata, runtime?: FetchRuntime) {
  if (!consumeSubrequest(runtime?.budget)) return;
  const put = safeCachePut(key, content, metadata);
  if (runtime?.waitUntil) runtime.waitUntil(put);
  else await put;
}

function createSubrequestBudget(settings?: AppSettings): SubrequestBudget | undefined {
  // Without an explicit limit behave as before (no app-level cap); the platform limit still applies.
  const raw = settings?.subrequestLimit;
  if (raw === undefined || raw === null || String(raw).trim() === "") return undefined;
  return { limit: numberSetting(raw, DEFAULT_SUBREQUEST_LIMIT, 10, 1000), used: 0 };
}

export class SubrequestBudgetError extends Error {}

/**
 * Reserves one subrequest. `reserve` keeps that many additional subrequests available
 * so optional work (cache lookups) cannot starve required work (upstream fetches).
 */
function consumeSubrequest(budget: SubrequestBudget | undefined, reserve = 0) {
  if (!budget) return true;
  if (budget.used + 1 + reserve > budget.limit) return false;
  budget.used += 1;
  return true;
}

function subrequestBudgetMessage(budget: SubrequestBudget | undefined) {
  return `Subrequest budget exhausted (${budget?.limit ?? DEFAULT_SUBREQUEST_LIMIT}); reduce sources/URLs or raise subrequestLimit on a paid plan`;
}

function getSourceUserAgent(sub: SubscriptionSource, settings?: AppSettings, requestUserAgent?: string) {
  const explicitUserAgent = stringSetting(sub.meta?.ua) || stringSetting(sub.meta?.userAgent);
  if (explicitUserAgent) return explicitUserAgent;
  if (sub.meta?.passThroughUA === true || sub.meta?.passThroughUA === "true") {
    return stringSetting(requestUserAgent) || stringSetting(settings?.defaultUserAgent) || "clash.meta/v1.19.24";
  }
  return (
    stringSetting(settings?.defaultUserAgent)
    || "clash.meta/v1.19.24"
  );
}

function getRequestTimeout(settings?: AppSettings) {
  return numberSetting(settings?.defaultTimeout, 30000, 1000, 120000);
}

function getRequestConcurrency(settings?: AppSettings) {
  return numberSetting(settings?.backendRequestConcurrency, 3, 1, MAX_CONCURRENCY);
}

function getRequestConcurrencyWait(settings?: AppSettings) {
  return numberSetting(settings?.backendRequestConcurrencyWaitTime, 0, 0, 5000);
}

async function runWithConcurrency<T>(tasks: Array<() => Promise<T>>, concurrency: number, waitMs = 0) {
  const results = new Array<T>(tasks.length);
  let cursor = 0;

  async function worker() {
    while (cursor < tasks.length) {
      const index = cursor;
      cursor += 1;
      if (waitMs > 0 && index > 0) await delay(waitMs);
      results[index] = await tasks[index]();
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, worker));
  return results;
}

async function runSettledWithConcurrency<T>(tasks: Array<() => Promise<T>>, concurrency: number, waitMs = 0) {
  const results = new Array<PromiseSettledResult<T>>(tasks.length);
  const wrapped = tasks.map((task, index) => async () => {
    try {
      results[index] = { status: "fulfilled", value: await task() };
    } catch (reason) {
      results[index] = { status: "rejected", reason };
    }
  });
  await runWithConcurrency(wrapped, concurrency, waitMs);
  return results;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stringSetting(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function numberSetting(value: unknown, fallback: number, min: number, max: number) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(Math.max(Math.trunc(number), min), max);
}

function decodeMaybeBase64(raw: string) {
  const text = raw.trim();
  if (looksLikeStructuredSubscription(text)) return raw;

  const decoded = decodeBase64UrlText(text);
  if (decoded && looksLikeStructuredSubscription(decoded.trim())) return decoded;
  return raw;
}

function looksLikeStructuredSubscription(text: string) {
  return (
    /^[a-z][a-z0-9+.-]*:\/\//im.test(text)
    || /^\s*(proxies|proxy-groups|rules)\s*:/m.test(text)
    || /^\s*[\[{]/.test(text)
    || /^\s*(shadowsocks|vmess|vless|trojan|http|socks5|anytls)\s*=/im.test(text)
    || /^\s*[^=\n]{1,80}\s*=\s*(ss|shadowsocks|ssr|vmess|vless|trojan|http|https|socks5|socks5-tls|hysteria2|hysteria|anytls|tuic|tuic-v5)\s*,/im.test(text)
  );
}

function parseProxies(raw: string): ProxyNode[] {
  const text = raw.trim();
  if (!text) return [];
  if (/^\s*[\[{]/.test(text)) return parseJsonProxies(text);
  if (/^\s*proxies\s*:/m.test(text)) return parseYamlProxies(text);
  return parseProxyLines(text);
}

function addPreviewIds(proxies: ProxyNode[]) {
  return proxies.map((proxy, index) => ({
    id: stableProxyId(proxy, index),
    ...proxy,
  }));
}

function stableProxyId(proxy: ProxyNode, index: number) {
  return [proxy.name, proxy.type, proxy.server || "", proxy.port || "", index].join("|");
}

function parseJsonProxies(raw: string) {
  try {
    const payload = JSON5.parse(raw);
    const proxies = Array.isArray(payload) ? payload : Array.isArray(payload.proxies) ? payload.proxies : [];
    return proxies.map(normalizeProxy).filter(isProxyNode);
  } catch {
    return [];
  }
}

function parseYamlProxies(raw: string) {
  try {
    const payload = parseYaml(raw) as { proxies?: unknown };
    const proxies = Array.isArray(payload?.proxies) ? payload.proxies : [];
    return proxies.map(normalizeProxy).filter(isProxyNode);
  } catch {
    return [];
  }
}

function parseProxyLines(raw: string) {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && !line.startsWith(";") && !/^\[[^\]]+\]$/.test(line))
    .map((line, index) => parseProxyUri(line, index) || parseClientProxyLine(line, index))
    .filter(isProxyNode);
}

function parseClientProxyLine(line: string, index: number): ProxyNode | undefined {
  try {
    if (/^\s*(shadowsocks|vmess|vless|trojan|http|socks5|anytls)\s*=/i.test(line)) return parseQxProxyLine(line, index);
    if (/^\s*[^=\n]{1,120}\s*=/.test(line)) return parseNamedClientProxyLine(line, index);
    return undefined;
  } catch {
    return undefined;
  }
}

function parseQxProxyLine(line: string, index: number): ProxyNode | undefined {
  const equalIndex = line.indexOf("=");
  if (equalIndex <= 0) return undefined;
  const kind = line.slice(0, equalIndex).trim().toLowerCase();
  const parts = splitClientCsv(line.slice(equalIndex + 1));
  const [server, rawPort] = splitHostPort(parts[0]);
  const options = parseClientOptions(parts.slice(1));
  const name = clientOption(options, "tag") || `${kind}-${index + 1}`;
  const port = Number(rawPort || clientOption(options, "port") || (kind === "http" || kind === "socks5" ? 80 : 443));
  const tls = qxTlsEnabled(options);
  const common = clientCommonOptions(options);

  if (kind === "shadowsocks") {
    return stripUndefined({
      name,
      type: "ss",
      server,
      port,
      cipher: clientOption(options, "method"),
      password: clientOption(options, "password"),
      plugin: qxPlugin(options),
      "plugin-opts": qxPluginOptions(options),
      udp: optionBoolean(clientOption(options, "udp-relay")),
      tfo: optionBoolean(clientOption(options, "fast-open")),
      ...common,
    });
  }

  if (kind === "vmess" || kind === "vless") {
    return stripUndefined({
      name,
      type: kind,
      server,
      port,
      uuid: clientOption(options, "password") || clientOption(options, "uuid") || clientOption(options, "username"),
      cipher: kind === "vmess" ? clientOption(options, "method") || "auto" : undefined,
      alterId: numberOrUndefined(clientOption(options, "alterId") || clientOption(options, "alterid")),
      encryption: kind === "vless" ? clientOption(options, "encryption") || "none" : undefined,
      network: qxNetwork(options),
      tls,
      servername: clientOption(options, "tls-host") || clientOption(options, "obfs-host"),
      "ws-opts": qxWsOptions(options),
      "reality-opts": parseRealityOptions(options),
      flow: clientOption(options, "flow"),
      udp: optionBoolean(clientOption(options, "udp-relay")),
      tfo: optionBoolean(clientOption(options, "fast-open")),
      ...common,
    });
  }

  if (kind === "trojan" || kind === "anytls") {
    return stripUndefined({
      name,
      type: kind,
      server,
      port,
      password: clientOption(options, "password"),
      sni: clientOption(options, "tls-host") || clientOption(options, "sni") || clientOption(options, "obfs-host"),
      "reality-opts": parseRealityOptions(options),
      udp: optionBoolean(clientOption(options, "udp-relay")),
      tfo: optionBoolean(clientOption(options, "fast-open")),
      ...common,
    });
  }

  if (kind === "http" || kind === "socks5") {
    return stripUndefined({
      name,
      type: kind === "socks5" ? "socks5" : "http",
      server,
      port,
      username: clientOption(options, "username"),
      password: clientOption(options, "password"),
      tls,
      udp: optionBoolean(clientOption(options, "udp-relay")),
      tfo: optionBoolean(clientOption(options, "fast-open")),
      ...common,
    });
  }

  return undefined;
}

function parseNamedClientProxyLine(line: string, index: number): ProxyNode | undefined {
  const equalIndex = line.indexOf("=");
  const name = line.slice(0, equalIndex).trim() || `proxy-${index + 1}`;
  const parts = splitClientCsv(line.slice(equalIndex + 1));
  const rawKind = String(parts[0] || "").trim().toLowerCase();
  const kind = normalizeClientProxyKind(parts[0]);
  const server = parts[1];
  const port = Number(parts[2] || 0);
  const positional = parts.slice(3);
  const positionalValues = positional.filter((part) => !part.includes("="));
  const options = parseClientOptions(positional);
  const common = clientCommonOptions(options);

  if (!kind || !server || !Number.isFinite(port)) return undefined;

  if (kind === "ss") {
    return stripUndefined({
      name,
      type: "ss",
      server,
      port,
      cipher: clientOption(options, "encrypt-method") || clientOption(options, "method") || positionalValues[0],
      password: clientOption(options, "password") || positionalValues[1],
      plugin: clientOption(options, "obfs") || clientOption(options, "obfs-name") ? "obfs" : undefined,
      "plugin-opts": clientOption(options, "obfs") || clientOption(options, "obfs-name") ? stripUndefined({
        mode: clientOption(options, "obfs") || clientOption(options, "obfs-name"),
        host: clientOption(options, "obfs-host"),
        path: clientOption(options, "obfs-uri"),
      }) : undefined,
      udp: optionBoolean(clientOption(options, "udp") || clientOption(options, "udp-relay")),
      tfo: optionBoolean(clientOption(options, "fast-open")),
      ...common,
    });
  }

  if (kind === "ssr") {
    return stripUndefined({
      name,
      type: "ssr",
      server,
      port,
      cipher: positionalValues[0] || clientOption(options, "encrypt-method") || clientOption(options, "method"),
      password: positionalValues[1] || clientOption(options, "password"),
      protocol: clientOption(options, "protocol") || "origin",
      obfs: clientOption(options, "obfs") || "plain",
      "protocol-param": clientOption(options, "protocol-param") || clientOption(options, "protoparam"),
      "obfs-param": clientOption(options, "obfs-param") || clientOption(options, "obfsparam"),
      udp: optionBoolean(clientOption(options, "udp") || clientOption(options, "udp-relay")),
      ...common,
    });
  }

  if (kind === "vmess" || kind === "vless") {
    const tls = optionBoolean(clientOption(options, "tls") || clientOption(options, "over-tls")) ?? false;
    return stripUndefined({
      name,
      type: kind,
      server,
      port,
      uuid: clientOption(options, "username") || clientOption(options, "password") || positionalValues[1] || positionalValues[0],
      cipher: kind === "vmess" ? positionalValues[0] || clientOption(options, "encrypt-method") || clientOption(options, "method") || "auto" : undefined,
      alterId: numberOrUndefined(clientOption(options, "alterId") || clientOption(options, "alterid")),
      encryption: kind === "vless" ? clientOption(options, "encryption") || "none" : undefined,
      network: namedClientNetwork(options),
      tls,
      servername: clientOption(options, "sni") || clientOption(options, "tls-name") || clientOption(options, "tls-host"),
      "ws-opts": namedClientWsOptions(options),
      "reality-opts": parseRealityOptions(options),
      flow: clientOption(options, "flow"),
      udp: optionBoolean(clientOption(options, "udp") || clientOption(options, "udp-relay")),
      tfo: optionBoolean(clientOption(options, "fast-open")),
      ...common,
    });
  }

  if (kind === "trojan" || kind === "anytls") {
    return stripUndefined({
      name,
      type: kind,
      server,
      port,
      password: clientOption(options, "password") || positionalValues[0],
      sni: clientOption(options, "sni") || clientOption(options, "tls-name") || clientOption(options, "tls-host"),
      "reality-opts": parseRealityOptions(options),
      udp: optionBoolean(clientOption(options, "udp") || clientOption(options, "udp-relay")),
      tfo: optionBoolean(clientOption(options, "fast-open")),
      ...common,
    });
  }

  if (kind === "http" || kind === "socks5") {
    return stripUndefined({
      name,
      type: kind === "socks5" ? "socks5" : "http",
      server,
      port,
      username: clientOption(options, "username"),
      password: clientOption(options, "password"),
      tls: rawKind === "https" || rawKind === "socks5-tls" || optionBoolean(clientOption(options, "tls") || clientOption(options, "over-tls")),
      udp: optionBoolean(clientOption(options, "udp") || clientOption(options, "udp-relay")),
      tfo: optionBoolean(clientOption(options, "fast-open")),
      ...common,
    });
  }

  if (kind === "hysteria2") {
    return stripUndefined({
      ...common,
      name,
      type: "hysteria2",
      server,
      port,
      password: clientOption(options, "password") || positionalValues[0],
      sni: clientOption(options, "sni") || clientOption(options, "tls-name"),
      obfs: clientOption(options, "obfs"),
      "obfs-password": clientOption(options, "obfs-password") || clientOption(options, "gecko-password"),
      "skip-cert-verify": optionBoolean(clientOption(options, "skip-cert-verify")) ?? common["skip-cert-verify"],
    });
  }

  if (kind === "tuic") {
    return stripUndefined({
      ...common,
      name,
      type: "tuic",
      server,
      port,
      uuid: clientOption(options, "uuid") || positionalValues[0],
      password: clientOption(options, "password") || positionalValues[1],
      sni: clientOption(options, "sni"),
      alpn: commaList(clientOption(options, "alpn") || null),
      "skip-cert-verify": optionBoolean(clientOption(options, "skip-cert-verify")) ?? common["skip-cert-verify"],
    });
  }

  if (kind === "snell") {
    return stripUndefined({
      ...common,
      name,
      type: "snell",
      server,
      port,
      psk: clientOption(options, "psk") || clientOption(options, "password") || positionalValues[0],
      version: numberOrUndefined(clientOption(options, "version")) || 3,
      obfs: clientOption(options, "obfs"),
      "obfs-host": clientOption(options, "obfs-host"),
    });
  }

  if (kind === "ssh") {
    return stripUndefined({
      ...common,
      name,
      type: "ssh",
      server,
      port,
      username: clientOption(options, "username") || positionalValues[0],
      password: clientOption(options, "password") || positionalValues[1],
      "private-key": clientOption(options, "private-key"),
      "host-key": clientOption(options, "host-key"),
    });
  }

  if (kind === "h2-connect") {
    return stripUndefined({
      ...common,
      name,
      type: "h2-connect",
      server,
      port,
      username: clientOption(options, "username"),
      password: clientOption(options, "password"),
      tls: optionBoolean(clientOption(options, "tls")) ?? true,
      sni: clientOption(options, "sni") || clientOption(options, "tls-name"),
    });
  }

  return undefined;
}

function normalizeClientProxyKind(input: string | undefined) {
  const value = String(input || "").trim().toLowerCase();
  if (value === "shadowsocks") return "ss";
  if (value === "socks5-tls") return "socks5";
  if (value === "https") return "http";
  if (value === "hysteria2" || value === "hysteria 2") return "hysteria2";
  if (value === "tuic-v5") return "tuic";
  if (["ss", "ssr", "vmess", "vless", "trojan", "http", "socks5", "hysteria2", "tuic", "anytls", "snell", "ssh", "h2-connect"].includes(value)) return value;
  return "";
}

function splitHostPort(input: string | undefined): [string, string] {
  const value = String(input || "").trim();
  const lastColon = value.lastIndexOf(":");
  if (lastColon <= 0) return [value, ""];
  return [value.slice(0, lastColon), value.slice(lastColon + 1)];
}

function splitClientCsv(input: string) {
  const parts: string[] = [];
  let current = "";
  let quote = "";
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (quote) {
      if (char === quote) quote = "";
      else current += char;
    } else if (char === "\"" || char === "'") {
      quote = char;
    } else if (char === ",") {
      parts.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  parts.push(current.trim());
  return parts.filter((part) => part !== "");
}

function parseClientOptions(parts: string[]) {
  const options = new Map<string, string>();
  for (const part of parts) {
    const equalIndex = part.indexOf("=");
    if (equalIndex <= 0) continue;
    options.set(part.slice(0, equalIndex).trim().toLowerCase(), unquoteClientValue(part.slice(equalIndex + 1).trim()));
  }
  return options;
}

function unquoteClientValue(input: string) {
  const text = input.trim();
  const quote = text[0];
  if ((quote === "\"" || quote === "'") && text[text.length - 1] === quote) return text.slice(1, -1);
  return text;
}

function clientOption(options: Map<string, string>, key: string) {
  return options.get(key.toLowerCase());
}

function clientCommonOptions(options: Map<string, string>) {
  return stripUndefined({
    "skip-cert-verify": optionBoolean(clientOption(options, "skip-cert-verify")) ?? optionBoolean(clientOption(options, "tls-verification"), true),
    "client-fingerprint": clientOption(options, "client-fingerprint") || clientOption(options, "fingerprint"),
  });
}

function optionBoolean(value: unknown, inverted = false): boolean | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const normalized = String(value).trim().toLowerCase();
  const result = ["1", "true", "yes", "on", "enabled"].includes(normalized)
    ? true
    : ["0", "false", "no", "off", "disabled"].includes(normalized)
      ? false
      : undefined;
  return result === undefined ? undefined : inverted ? !result : result;
}

function qxTlsEnabled(options: Map<string, string>) {
  const obfs = clientOption(options, "obfs");
  return ["tls", "wss", "over-tls"].includes(String(obfs || "").toLowerCase())
    || optionBoolean(clientOption(options, "over-tls")) === true
    || optionBoolean(clientOption(options, "tls")) === true;
}

function qxNetwork(options: Map<string, string>) {
  const obfs = String(clientOption(options, "obfs") || "").toLowerCase();
  if (obfs === "ws" || obfs === "wss") return "ws";
  return "tcp";
}

function qxWsOptions(options: Map<string, string>) {
  const network = qxNetwork(options);
  if (network !== "ws") return undefined;
  return stripUndefined({
    path: clientOption(options, "obfs-uri") || "/",
    headers: stripUndefined({ Host: clientOption(options, "obfs-host") }),
  });
}

function qxPlugin(options: Map<string, string>) {
  const obfs = String(clientOption(options, "obfs") || "").toLowerCase();
  return ["http", "shadowsocks-http"].includes(obfs) ? "obfs" : undefined;
}

function qxPluginOptions(options: Map<string, string>) {
  if (!qxPlugin(options)) return undefined;
  return stripUndefined({
    mode: "http",
    host: clientOption(options, "obfs-host"),
    path: clientOption(options, "obfs-uri"),
  });
}

function namedClientNetwork(options: Map<string, string>) {
  if (optionBoolean(clientOption(options, "ws")) === true) return "ws";
  const transport = clientOption(options, "transport") || clientOption(options, "network");
  if (transport) return transport;
  return "tcp";
}

function namedClientWsOptions(options: Map<string, string>) {
  if (namedClientNetwork(options) !== "ws") return undefined;
  return stripUndefined({
    path: clientOption(options, "ws-path") || clientOption(options, "path") || "/",
    headers: stripUndefined({ Host: clientOption(options, "ws-headers")?.replace(/^Host:/i, "") || clientOption(options, "ws-host") || clientOption(options, "host") }),
  });
}

function parseRealityOptions(options: Map<string, string>) {
  const publicKey = clientOption(options, "reality-base64-pubkey") || clientOption(options, "public-key");
  const shortId = clientOption(options, "reality-hex-shortid") || clientOption(options, "short-id");
  return publicKey ? stripUndefined({ "public-key": publicKey, "short-id": shortId }) : undefined;
}

function parseProxyUri(line: string, index: number): ProxyNode | undefined {
  try {
    if (line.startsWith("vless://")) return parseVless(line, index);
    if (line.startsWith("anytls://")) return parseAnytls(line, index);
    if (line.startsWith("hysteria://") || line.startsWith("hy://")) return parseHysteria(line, index);
    if (line.startsWith("hysteria2://") || line.startsWith("hy2://")) return parseHysteria2(line, index);
    if (line.startsWith("trojan://")) return parseTrojan(line, index);
    if (line.startsWith("vmess://")) return parseVmess(line, index);
    if (line.startsWith("ss://")) return parseShadowsocks(line, index);
    if (line.startsWith("ssr://")) return parseShadowsocksR(line, index);
    if (line.startsWith("socks://") || line.startsWith("socks5://") || line.startsWith("socks5+tls://")) return parseSocks(line, index);
    if (line.startsWith("tuic://")) return parseTuic(line, index);
    if (line.startsWith("wireguard://") || line.startsWith("wg://")) return parseWireGuard(line, index);
    if (line.startsWith("http://") || line.startsWith("https://")) return parseHttpProxy(line, index);
    return undefined;
  } catch {
    return undefined;
  }
}

function parseVless(line: string, index: number): ProxyNode {
  const url = new URL(line);
  const params = url.searchParams;
  const publicKey = params.get("pbk") || params.get("public-key");
  const shortId = params.get("sid") || params.get("short-id");
  // Missing `security` means none per the share-link spec, but many providers omit it while
  // still sending TLS-only parameters; treat those as TLS so existing links keep working.
  const hasTlsHint = ["sni", "fp", "alpn", "allowInsecure", "insecure"].some((key) => params.has(key));
  const security = (params.get("security") || (publicKey ? "reality" : hasTlsHint ? "tls" : "none")).toLowerCase();
  const tls = security !== "none";

  return stripUndefined({
    name: uriName(url, `vless-${index + 1}`),
    type: "vless",
    server: uriHostname(url),
    port: Number(url.port || 443),
    uuid: safeDecodeURIComponent(url.username),
    udp: true,
    flow: params.get("flow") || undefined,
    ...parseUriTransport(params),
    tls,
    servername: params.get("sni") || params.get("peer") || undefined,
    alpn: commaList(params.get("alpn")),
    "skip-cert-verify": insecureParam(params),
    encryption: params.get("encryption") || "none",
    "client-fingerprint": tls ? params.get("fp") || "chrome" : undefined,
    "reality-opts": tls && publicKey ? stripUndefined({ "public-key": publicKey, "short-id": shortId, "spider-x": params.get("spx") || "/" }) : undefined,
  });
}

/** Maps the shared `type`/`path`/`host`/`serviceName` URI parameters used by vless and trojan links. */
function parseUriTransport(params: URLSearchParams) {
  const type = (params.get("type") || "tcp").toLowerCase();
  const path = params.get("path") || undefined;
  const host = params.get("host") || undefined;
  if (type === "ws" || type === "httpupgrade") {
    return {
      network: "ws",
      "ws-opts": stripUndefined({
        path: path || "/",
        headers: host ? { Host: host } : undefined,
        "v2ray-http-upgrade": type === "httpupgrade" ? true : undefined,
      }),
    };
  }
  if (type === "grpc") {
    const serviceName = params.get("serviceName") || undefined;
    return {
      network: "grpc",
      "grpc-opts": serviceName ? { "grpc-service-name": serviceName } : undefined,
    };
  }
  if (type === "h2" || type === "http") {
    return {
      network: "h2",
      "h2-opts": stripUndefined({ path: path || "/", host: commaList(host || null) }),
    };
  }
  return { network: type };
}

function parseAnytls(line: string, index: number): ProxyNode {
  const url = new URL(line);
  const params = url.searchParams;
  return stripUndefined({
    name: uriName(url, `anytls-${index + 1}`),
    type: "anytls",
    server: uriHostname(url),
    port: Number(url.port || 443),
    password: safeDecodeURIComponent(url.username),
    sni: params.get("sni") || params.get("peer") || undefined,
    "skip-cert-verify": boolParam(params.get("insecure") || params.get("allowInsecure")),
    "client-fingerprint": params.get("fp") || "chrome",
  });
}

function parseHysteria2(line: string, index: number): ProxyNode {
  const { line: normalized, ports: hoppingPorts } = extractPortHopping(line.replace(/^hy2:\/\//, "hysteria2://"));
  const url = new URL(normalized);
  const params = url.searchParams;
  // The hysteria2 URI spec treats the whole userinfo ("user:pass") as the auth string.
  const auth = url.password ? `${safeDecodeURIComponent(url.username)}:${safeDecodeURIComponent(url.password)}` : safeDecodeURIComponent(url.username);
  return stripUndefined({
    name: uriName(url, `hysteria2-${index + 1}`),
    type: "hysteria2",
    server: uriHostname(url),
    port: Number(url.port || 443),
    ports: hoppingPorts || params.get("mport")?.replace(/;/g, ",") || undefined,
    password: auth,
    sni: params.get("sni") || params.get("peer") || undefined,
    alpn: commaList(params.get("alpn")),
    "skip-cert-verify": boolParam(params.get("insecure") || params.get("allowInsecure")),
    obfs: params.get("obfs") || undefined,
    "obfs-password": params.get("obfs-password") || params.get("salamander-password") || undefined,
  });
}

/**
 * `new URL()` rejects `host:443,5000-6000`. Strip the hopping list from the authority,
 * keep the first port as the connect port and return the full list separately.
 */
function extractPortHopping(line: string) {
  const match = line.match(/^([a-z0-9+.-]+:\/\/)([^/?#]*)([\s\S]*)$/i);
  if (!match) return { line, ports: undefined };
  const [, scheme, authority, rest] = match;
  const at = authority.lastIndexOf("@");
  const userInfo = authority.slice(0, at + 1);
  const hostPort = authority.slice(at + 1);
  const portMatch = hostPort.match(/^(.*):(\d+(?:[-,;]\d+)+)$/);
  if (!portMatch) return { line, ports: undefined };
  const ports = portMatch[2].replace(/;/g, ",");
  const firstPort = ports.split(/[-,]/)[0];
  return { line: `${scheme}${userInfo}${portMatch[1]}:${firstPort}${rest}`, ports };
}

function parseHysteria(line: string, index: number): ProxyNode {
  const url = new URL(line.replace(/^hy:\/\//, "hysteria://"));
  const params = url.searchParams;
  return stripUndefined({
    name: uriName(url, `hysteria-${index + 1}`),
    type: "hysteria",
    server: uriHostname(url),
    port: Number(url.port || 443),
    auth_str: safeDecodeURIComponent(url.username || params.get("auth") || params.get("auth_str") || ""),
    protocol: params.get("protocol") || undefined,
    up: params.get("up") || params.get("upmbps") || undefined,
    down: params.get("down") || params.get("downmbps") || undefined,
    sni: params.get("sni") || params.get("peer") || undefined,
    alpn: commaList(params.get("alpn")),
    obfs: params.get("obfs") || undefined,
    "obfs-password": params.get("obfs-password") || undefined,
    "skip-cert-verify": boolParam(params.get("insecure") || params.get("allowInsecure")),
  });
}

function parseTrojan(line: string, index: number): ProxyNode {
  const url = new URL(line);
  const params = url.searchParams;
  const type = (params.get("type") || "tcp").toLowerCase();
  return stripUndefined({
    name: uriName(url, `trojan-${index + 1}`),
    type: "trojan",
    server: uriHostname(url),
    port: Number(url.port || 443),
    password: safeDecodeURIComponent(url.username),
    sni: params.get("sni") || params.get("peer") || undefined,
    alpn: commaList(params.get("alpn")),
    "skip-cert-verify": boolParam(params.get("allowInsecure") || params.get("insecure")),
    "client-fingerprint": params.get("fp") || undefined,
    ...(type === "tcp" ? {} : parseUriTransport(params)),
    udp: true,
  });
}

function parseVmess(line: string, index: number): ProxyNode | undefined {
  try {
    const payload = JSON.parse(decodeBase64UrlText(line.slice("vmess://".length)));
    const tls = payload.tls === "tls";
    const net = String(payload.net || "tcp").toLowerCase();
    const host = payload.host ? String(payload.host) : undefined;
    const path = payload.path ? String(payload.path) : undefined;
    const transport: Record<string, unknown> = { network: net };
    if (net === "ws" || net === "httpupgrade") {
      transport.network = "ws";
      transport["ws-opts"] = stripUndefined({
        path: path || "/",
        headers: host ? { Host: host } : undefined,
        "v2ray-http-upgrade": net === "httpupgrade" ? true : undefined,
      });
    } else if (net === "grpc") {
      transport["grpc-opts"] = path ? { "grpc-service-name": path } : undefined;
    } else if (net === "h2") {
      transport["h2-opts"] = stripUndefined({ path: path || "/", host: commaList(host || null) });
    }
    return stripUndefined({
      name: payload.ps || `vmess-${index + 1}`,
      type: "vmess",
      server: payload.add,
      port: Number(payload.port),
      uuid: payload.id,
      alterId: Number(payload.aid || 0),
      cipher: payload.scy || "auto",
      tls,
      servername: payload.sni || payload.host || undefined,
      alpn: commaList(typeof payload.alpn === "string" ? payload.alpn : null),
      "client-fingerprint": tls && payload.fp ? String(payload.fp) : undefined,
      ...transport,
      udp: true,
    });
  } catch {
    return undefined;
  }
}

function parseShadowsocks(line: string, index: number): ProxyNode | undefined {
  try {
    const withoutScheme = line.slice("ss://".length);
    const hashIndex = withoutScheme.indexOf("#");
    const main = hashIndex >= 0 ? withoutScheme.slice(0, hashIndex) : withoutScheme;
    const hash = hashIndex >= 0 ? withoutScheme.slice(hashIndex + 1) : "";
    const queryIndex = main.indexOf("?");
    const query = new URLSearchParams(queryIndex >= 0 ? main.slice(queryIndex + 1) : "");
    const core = queryIndex >= 0 ? main.slice(0, queryIndex).replace(/\/+$/, "") : main;

    // SIP002 keeps "@" in clear text; the legacy form base64-encodes "method:password@host:port" as a whole.
    const legacy = !core.includes("@");
    const decodedMain = legacy ? decodeBase64UrlText(core) : core;
    const atIndex = decodedMain.lastIndexOf("@");
    if (atIndex < 0) return undefined;
    let userInfo = decodedMain.slice(0, atIndex);
    if (!userInfo.includes(":")) userInfo = decodeBase64UrlText(safeDecodeURIComponent(userInfo));
    else if (!legacy) userInfo = safeDecodeURIComponent(userInfo);
    const separator = userInfo.indexOf(":");
    if (separator <= 0) return undefined;
    const cipher = userInfo.slice(0, separator);
    const password = userInfo.slice(separator + 1);

    const hostInfo = decodedMain.slice(atIndex + 1).split("/")[0];
    const lastColon = hostInfo.lastIndexOf(":");
    if (lastColon <= 0) return undefined;
    const port = Number(hostInfo.slice(lastColon + 1));
    if (!Number.isInteger(port) || port <= 0) return undefined;
    const plugin = parseShadowsocksPlugin(query.get("plugin"));
    return stripUndefined({
      name: safeDecodeURIComponent(hash || `ss-${index + 1}`),
      type: "ss",
      server: hostInfo.slice(0, lastColon).replace(/^\[(.*)\]$/, "$1"),
      port,
      cipher,
      password,
      ...plugin,
      udp: true,
    });
  } catch {
    return undefined;
  }
}

function parseShadowsocksPlugin(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  const [name, ...parts] = raw.split(";");
  const options = new Map<string, string>();
  for (const part of parts) {
    const equalIndex = part.indexOf("=");
    if (equalIndex < 0) options.set(part.trim().toLowerCase(), "true");
    else options.set(part.slice(0, equalIndex).trim().toLowerCase(), part.slice(equalIndex + 1).trim());
  }
  if (name === "obfs-local" || name === "simple-obfs") {
    return { plugin: "obfs", "plugin-opts": stripUndefined({ mode: options.get("obfs"), host: options.get("obfs-host") }) };
  }
  if (name === "v2ray-plugin") {
    return {
      plugin: "v2ray-plugin",
      "plugin-opts": stripUndefined({
        mode: options.get("mode") || "websocket",
        host: options.get("host"),
        path: options.get("path"),
        tls: options.has("tls") ? true : undefined,
      }),
    };
  }
  return {};
}

function parseShadowsocksR(line: string, index: number): ProxyNode | undefined {
  try {
    const decoded = decodeBase64UrlText(line.slice("ssr://".length));
    const [main, rawQuery = ""] = decoded.split("/?");
    const [server, port, protocol, method, obfs, encodedPassword] = main.split(":");
    const query = new URLSearchParams(rawQuery);
    const remarks = query.get("remarks");
    return stripUndefined({
      name: remarks ? decodeBase64UrlText(remarks) : `ssr-${index + 1}`,
      type: "ssr",
      server,
      port: Number(port),
      cipher: method,
      password: decodeBase64UrlText(encodedPassword || ""),
      protocol,
      "protocol-param": query.get("protoparam") ? decodeBase64UrlText(query.get("protoparam") || "") : undefined,
      obfs,
      "obfs-param": query.get("obfsparam") ? decodeBase64UrlText(query.get("obfsparam") || "") : undefined,
      udp: true,
    });
  } catch {
    return undefined;
  }
}

function parseSocks(line: string, index: number): ProxyNode | undefined {
  const normalizedLine = line.replace(/^socks:\/\//, "socks5://").replace(/^socks5\+tls:\/\//, "socks5://");
  const url = new URL(normalizedLine);
  if (!url.port) return undefined;
  return stripUndefined({
    name: uriName(url, `socks5-${index + 1}`),
    type: "socks5",
    server: uriHostname(url),
    port: Number(url.port),
    username: safeDecodeURIComponent(url.username),
    password: safeDecodeURIComponent(url.password),
    tls: line.startsWith("socks5+tls://") || boolParam(url.searchParams.get("tls")),
    udp: true,
  });
}

function parseHttpProxy(line: string, index: number): ProxyNode | undefined {
  const url = new URL(line);
  if (!url.port) return undefined;
  return stripUndefined({
    name: uriName(url, `${url.protocol === "https:" ? "https" : "http"}-${index + 1}`),
    type: "http",
    server: uriHostname(url),
    port: Number(url.port),
    username: safeDecodeURIComponent(url.username),
    password: safeDecodeURIComponent(url.password),
    tls: url.protocol === "https:",
  });
}

function parseTuic(line: string, index: number): ProxyNode {
  const url = new URL(line);
  const params = url.searchParams;
  return stripUndefined({
    name: uriName(url, `tuic-${index + 1}`),
    type: "tuic",
    server: uriHostname(url),
    port: Number(url.port || 443),
    uuid: safeDecodeURIComponent(url.username),
    password: safeDecodeURIComponent(url.password),
    sni: params.get("sni") || undefined,
    alpn: commaList(params.get("alpn")),
    "skip-cert-verify": boolParam(params.get("allow_insecure") || params.get("insecure")),
    "disable-sni": boolParam(params.get("disable_sni") || params.get("disable-sni")),
    "reduce-rtt": boolParam(params.get("reduce_rtt") || params.get("reduce-rtt")),
    "udp-relay-mode": params.get("udp_relay_mode") || params.get("udp-relay-mode") || undefined,
    "congestion-controller": params.get("congestion_control") || params.get("congestion-controller") || undefined,
  });
}

function parseWireGuard(line: string, index: number): ProxyNode {
  const url = new URL(line.replace(/^wg:\/\//, "wireguard://"));
  const params = url.searchParams;
  return stripUndefined({
    name: uriName(url, `wireguard-${index + 1}`),
    type: "wireguard",
    server: uriHostname(url),
    port: Number(url.port || 51820),
    ip: params.get("ip") || params.get("address") || undefined,
    ipv6: params.get("ipv6") || undefined,
    "private-key": safeDecodeURIComponent(url.username || params.get("private-key") || params.get("privatekey") || ""),
    "public-key": params.get("public-key") || params.get("publickey") || params.get("peer-public-key") || undefined,
    "pre-shared-key": params.get("pre-shared-key") || params.get("presharedkey") || params.get("psk") || undefined,
    reserved: params.get("reserved") || undefined,
    udp: true,
  });
}

async function applyFilters(
  proxies: ProxyNode[],
  filters: FilterRule[],
  settings?: AppSettings,
  scriptContext: FilterContext = { targetPlatform: "json" },
) {
  const scriptError = validateScriptActions(filters);
  if (scriptError) throw new Error(scriptError);
  let current = proxies;
  for (const filter of filters) {
    if (!filter || typeof filter !== "object") continue;
    if (filter.type === "include") current = matchFilter(current, filter, true);
    else if (filter.type === "exclude") current = matchFilter(current, filter, false);
    else if (filter.type === "rename") current = renameProxies(current, filter);
    else if (filter.type === "delete-field") current = deleteFieldMatches(current, filter);
    else if (filter.type === "dedupe") current = handleDuplicateProxies(current, filter);
    else if (filter.type === "sort") current = sortProxies(current, filter.direction || "asc");
    else if (filter.type === "regex-sort") current = regexSortProxies(current, filter);
    else if (filter.type === "flag") current = flagProxies(current, filter);
    else if (filter.type === "quick") current = applyQuickSettings(current, filter);
    else if (filter.type === "resolve") current = await resolveProxyDomains(current, filter, settings, scriptContext.budget);
    else if (filter.type === "script") current = await applyScriptAction(current, filter, scriptContext.targetPlatform, {
      sourceId: scriptContext.sourceId,
      collectionId: scriptContext.collectionId,
    });
  }
  return current;
}

function matchFilter(proxies: ProxyNode[], filter: FilterRule, keepMatches: boolean) {
  if (!filter.pattern) return proxies;
  const pattern = compileRegex(filter.pattern);
  const field = filter.field || "name";
  return proxies.filter((proxy) => {
    const matched = pattern.test(String(getByPath(proxy, field) || ""));
    return keepMatches ? matched : !matched;
  });
}

function renameProxies(proxies: ProxyNode[], filter: FilterRule) {
  if (!filter.pattern) return proxies;
  const pattern = compileRegex(filter.pattern, "g");
  const replacement = filter.replacement || "";
  const field = filter.field || "name";
  return proxies.map((proxy) => setByPath({ ...proxy }, field, String(getByPath(proxy, field) || "").replace(pattern, replacement).trim()));
}

function deleteFieldMatches(proxies: ProxyNode[], filter: FilterRule) {
  const patterns = filter.patterns || (filter.pattern ? [filter.pattern] : []);
  if (patterns.length === 0) return proxies;
  const field = filter.field || "name";
  const expressions = patterns.map((pattern) => compileRegex(String(pattern), "g"));
  return proxies.map((proxy) => {
    const next = { ...proxy };
    const value = expressions.reduce((name, expression) => name.replace(expression, ""), String(getByPath(next, field) || ""));
    return setByPath(next, field, value.trim());
  });
}

function handleDuplicateProxies(proxies: ProxyNode[], filter: FilterRule) {
  const fields = normalizeDedupeFields(filter.fields || [filter.field || "name"]);
  if (filter.action === "rename") return renameDuplicateProxies(proxies, fields, filter);
  return deleteDuplicateProxies(proxies, fields);
}

function normalizeDedupeFields(fields: unknown) {
  const list = Array.isArray(fields) ? fields : [fields];
  return list.map(String).filter(Boolean);
}

function deleteDuplicateProxies(proxies: ProxyNode[], fields: string[]) {
  const seen = new Set<string>();
  return proxies.filter((proxy) => {
    const key = duplicateKey(proxy, fields);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function renameDuplicateProxies(proxies: ProxyNode[], fields: string[], filter: FilterRule) {
  const counters = new Map<string, number>();
  for (const proxy of proxies) {
    const key = duplicateKey(proxy, fields);
    counters.set(key, (counters.get(key) || 0) + 1);
  }

  const increments = new Map<string, number>();
  const maxLen = Math.max(1, ...[...counters.values()].map((count) => String(count).length));
  const digits = String(filter.template || "0 1 2 3 4 5 6 7 8 9").split(/\s+/).filter(Boolean);
  const link = String(filter.link ?? "-");
  const position = filter.position === "front" ? "front" : "back";

  return proxies.map((proxy) => {
    const key = duplicateKey(proxy, fields);
    if ((counters.get(key) || 0) <= 1) return proxy;
    const count = (increments.get(key) || 0) + 1;
    increments.set(key, count);
    const suffix = formatDuplicateNumber(count, maxLen, digits);
    return {
      ...proxy,
      name: position === "front" ? `${suffix}${link}${proxy.name}` : `${proxy.name}${link}${suffix}`,
    };
  });
}

function duplicateKey(proxy: ProxyNode, fields: string[]) {
  // Missing values get an explicit marker so 0, "" and undefined stay distinct.
  return JSON.stringify(fields.map((field) => {
    const value = getByPath(proxy, field);
    if (value === undefined || value === null) return null;
    return typeof value === "object" ? JSON.stringify(value) : String(value);
  }));
}

function formatDuplicateNumber(input: number, minLength: number, digits: string[]) {
  const normalizedDigits = digits.length >= 10 ? digits : ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
  let count = input;
  let output = "";
  do {
    output = normalizedDigits[count % 10] + output;
    count = Math.floor(count / 10);
  } while (count > 0);
  while (output.length < minLength) output = normalizedDigits[0] + output;
  return output;
}

function sortProxies(proxies: ProxyNode[], direction: string) {
  if (direction === "random") return shuffleProxies(proxies);
  const sign = direction === "desc" ? -1 : 1;
  return [...proxies].sort((a, b) => sign * nameCollator.compare(a.name, b.name));
}

function regexSortProxies(proxies: ProxyNode[], filter: FilterRule) {
  const expressions = (filter.expressions || filter.patterns || (filter.pattern ? [filter.pattern] : []))
    .map(String)
    .filter(Boolean)
    .map((pattern) => compileRegex(pattern));
  const direction = filter.direction || "asc";
  if (expressions.length === 0) return sortProxies(proxies, direction);

  // Matched nodes follow expression order; unmatched nodes follow the requested direction.
  const buckets: ProxyNode[][] = expressions.map(() => []);
  const unmatched: ProxyNode[] = [];
  for (const proxy of proxies) {
    const order = regexOrder(expressions, proxy.name);
    if (order > 0) buckets[order - 1].push(proxy);
    else unmatched.push(proxy);
  }
  const orderedUnmatched = direction === "original" ? unmatched : sortProxies(unmatched, direction);
  return [...buckets.flatMap((bucket) => (direction === "random" ? shuffleProxies(bucket) : bucket)), ...orderedUnmatched];
}

function regexOrder(expressions: RegExp[], name: string) {
  for (let index = 0; index < expressions.length; index += 1) {
    if (expressions[index].test(name)) return index + 1;
  }
  return 0;
}

function shuffleProxies(proxies: ProxyNode[]) {
  const next = [...proxies];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const randomIndex = secureRandomInt(index + 1);
    [next[index], next[randomIndex]] = [next[randomIndex], next[index]];
  }
  return next;
}

function secureRandomInt(maxExclusive: number) {
  const limit = Math.floor(0x100000000 / maxExclusive) * maxExclusive;
  const buffer = new Uint32Array(1);
  do {
    crypto.getRandomValues(buffer);
  } while (buffer[0] >= limit);
  return buffer[0] % maxExclusive;
}

function flagProxies(proxies: ProxyNode[], filter: FilterRule) {
  const mode = String(filter.mode || filter.action || "add");
  const tw = String(filter.tw || "cn");
  return proxies.map((proxy) => {
    const cleanName = removeFlag(proxy.name).trim();
    if (mode === "remove") return { ...proxy, name: cleanName };
    const flag = normalizeTaiwanFlag(detectFlag(proxy.name), tw);
    return { ...proxy, name: `${flag} ${cleanName}`.trim() };
  });
}

function applyQuickSettings(proxies: ProxyNode[], filter: FilterRule) {
  let next = proxies;
  if (stateEnabled(filter.useless)) {
    next = next.filter(isUsefulProxy);
  }

  return next.map((proxy) => {
    const output = { ...proxy };
    applyState(output, "udp", filter.udp);
    applyState(output, "tfo", filter.tfo);
    applyState(output, "fast-open", filter.tfo);
    applyState(output, "skip-cert-verify", filter.scert ?? filter["skip-cert-verify"]);
    if (output.type === "vmess") applyState(output, "aead", filter["vmess aead"]);
    return output;
  });
}

async function resolveProxyDomains(proxies: ProxyNode[], filter: FilterRule, settings?: AppSettings, budget?: SubrequestBudget) {
  // Each hostname is resolved once, however many nodes share it.
  const lookups = new Map<string, Promise<string | undefined>>();
  const tasks = proxies.map((proxy) => async () => resolveProxyDomain(proxy, filter, settings, budget, lookups));
  const resolved = await runWithConcurrency(tasks, getResolveConcurrency(filter, settings), getRequestConcurrencyWait(settings));
  const mode = String(filter.filter || "disabled");

  return resolved
    .filter(({ proxy, resolved, skipped }) => {
      // Nodes skipped because the subrequest budget ran out are kept only in modes that don't require resolution.
      if (skipped) return mode === "disabled";
      if (mode === "removeFailed") return resolved || !shouldResolveServer(proxy.server);
      if (mode === "IPOnly") return isIpAddress(String(proxy.server || ""));
      if (mode === "IPv4Only") return isIPv4(String(proxy.server || ""));
      if (mode === "IPv6Only") return isIPv6(String(proxy.server || ""));
      return true;
    })
    .map(({ proxy }) => proxy);
}

async function resolveProxyDomain(
  proxy: ProxyNode,
  filter: FilterRule,
  settings: AppSettings | undefined,
  budget: SubrequestBudget | undefined,
  lookups: Map<string, Promise<string | undefined>>,
) {
  const server = String(proxy.server || "");
  if (!shouldResolveServer(server)) return { proxy, resolved: false, skipped: false };

  try {
    const key = server.toLowerCase();
    let lookup = lookups.get(key);
    if (!lookup) {
      lookup = resolveHostname(server, filter, settings, budget);
      lookups.set(key, lookup);
    }
    const address = await lookup;
    if (address === undefined) return { proxy, resolved: false, skipped: true };
    if (!address) return { proxy, resolved: false, skipped: false };
    return { proxy: preserveTlsServerName({ ...proxy, server: address }, server), resolved: true, skipped: false };
  } catch {
    return { proxy, resolved: false, skipped: false };
  }
}

function preserveTlsServerName(proxy: ProxyNode, originalServer: string) {
  const next = { ...proxy };
  if (proxy.type === "vless" || proxy.type === "vmess") {
    if (!next.servername) next.servername = originalServer;
  }
  if (["trojan", "hysteria", "hysteria2", "tuic", "anytls"].includes(String(proxy.type))) {
    if (!next.sni) next.sni = originalServer;
  }
  return next;
}

/** Resolves to an address, "" when the lookup failed, or undefined when the subrequest budget is exhausted. */
async function resolveHostname(hostname: string, filter: FilterRule, settings?: AppSettings, budget?: SubrequestBudget) {
  if (!consumeSubrequest(budget)) return undefined;
  const recordType = getResolveRecordType(filter);
  const url = getResolveEndpoint(filter, hostname, recordType);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), getRequestTimeout(settings));
  try {
    const response = await fetch(url, {
      headers: { accept: "application/dns-json", "user-agent": stringSetting(settings?.defaultUserAgent) || "sub-store-cloudflare" },
      signal: controller.signal,
    });
    if (!response.ok) return "";
    const payload = parseDnsResponse(await readResponseText(response, MAX_DOH_RESPONSE_BYTES, "DNS response"));
    const answerType = recordType === "AAAA" ? 28 : 1;
    return (payload.Answer || [])
      .map((answer) => (answer.type === answerType ? String(answer.data || "") : ""))
      .find((item) => (recordType === "AAAA" ? isIPv6(item) : isIPv4(item))) || "";
  } finally {
    clearTimeout(timeoutId);
  }
}

function parseDnsResponse(text: string) {
  const payload: unknown = JSON.parse(text);
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return { Answer: [] };
  const answers = Reflect.get(payload, "Answer");
  if (!Array.isArray(answers)) return { Answer: [] };
  return {
    Answer: answers.flatMap((answer) => {
      if (!answer || typeof answer !== "object" || Array.isArray(answer)) return [];
      const type = Reflect.get(answer, "type");
      const data = Reflect.get(answer, "data");
      return [{ type: typeof type === "number" ? type : undefined, data: typeof data === "string" ? data : undefined }];
    }),
  };
}

function getResolveEndpoint(filter: FilterRule, hostname: string, recordType: "A" | "AAAA") {
  const provider = String(filter.provider || "Cloudflare");
  const baseUrl = provider === "Google"
    ? "https://dns.google/resolve"
    : provider === "Ali"
      ? "https://dns.alidns.com/resolve"
      : provider === "Tencent"
        ? "https://doh.pub/resolve"
        : provider === "Custom" && typeof filter.url === "string" && /^https:\/\//i.test(filter.url)
          ? filter.url
          : "https://cloudflare-dns.com/dns-query";
  const url = new URL(baseUrl);
  url.searchParams.set("name", hostname);
  url.searchParams.set("type", recordType);
  if (filter.edns && provider !== "Cloudflare") url.searchParams.set("edns_client_subnet", String(filter.edns));
  return url.toString();
}

function getResolveRecordType(filter: FilterRule): "A" | "AAAA" {
  const value = String(filter.recordType || filter.typeValue || filter.resolveType || filter["resolve-type"] || "").toUpperCase();
  if (value === "IPV6" || value === "AAAA") return "AAAA";
  return "A";
}

function getResolveConcurrency(filter: FilterRule, settings?: AppSettings) {
  return numberSetting(filter.concurrency, getRequestConcurrency(settings), 1, MAX_CONCURRENCY);
}

function shouldResolveServer(server: unknown) {
  const value = String(server || "").trim();
  return Boolean(value && !isIpAddress(value) && /^[a-z0-9.-]+$/i.test(value) && value.includes("."));
}

function isIpAddress(value: string) {
  return isIPv4(value) || isIPv6(value);
}

function applyState(proxy: ProxyNode, key: string, value: unknown) {
  if (stateEnabled(value)) proxy[key] = true;
  if (stateDisabled(value)) proxy[key] = false;
}

function stateEnabled(value: unknown) {
  return value === true || value === "ENABLED" || value === "enabled";
}

function stateDisabled(value: unknown) {
  return value === false || value === "DISABLED" || value === "disabled";
}

function isUsefulProxy(proxy: ProxyNode) {
  if (!Number.isFinite(proxy.port) || Number(proxy.port) <= 0 || Number(proxy.port) > 65535) return false;
  if (proxy.cipher && !isAscii(String(proxy.cipher))) return false;
  if (proxy.password && !isAscii(String(proxy.password))) return false;
  const network = String(proxy.network || "");
  const host = network ? getByPath(proxy, `${network}-opts.headers.Host`) || getByPath(proxy, `${network}-opts.headers.host`) : undefined;
  const hosts = Array.isArray(host) ? host : [host];
  if (hosts.some((item) => item && !isAscii(String(item)))) return false;
  return !/网址|流量|时间|应急|过期|官网|剩余|Bandwidth|expire/i.test(proxy.name);
}

function isAscii(input: string) {
  return /^[\x00-\x7F]+$/.test(input);
}

const FLAG_RULES: Array<[RegExp, string]> = [
  [/香港|港|hong\s*kong|\bhk\b/, "🇭🇰"],
  [/台湾|台灣|taiwan|\btw\b/, "🇹🇼"],
  [/新加坡|狮城|獅城|singapore|\bsg\b/, "🇸🇬"],
  [/日本|东京|東京|大阪|japan|tokyo|osaka|\bjp\b/, "🇯🇵"],
  [/美国|美國|洛杉矶|洛杉磯|纽约|紐約|united\s*states|los\s*angeles|new\s*york|\bus\b|\busa\b/, "🇺🇸"],
  [/英国|英國|伦敦|倫敦|united\s*kingdom|london|\buk\b/, "🇬🇧"],
  [/德国|德國|法兰克福|法蘭克福|germany|frankfurt|\bde\b/, "🇩🇪"],
  [/韩国|韓國|首尔|首爾|korea|seoul|\bkr\b/, "🇰🇷"],
];

function detectFlag(name: string) {
  const text = name.toLowerCase();
  return FLAG_RULES.find(([pattern]) => pattern.test(text))?.[1] || "🏳️";
}

function removeFlag(name: string) {
  return name.replace(/^[\p{Regional_Indicator}\uFE0F\u200D\s]+/u, "").replace(/^[🏳️]+\s*/u, "");
}

function normalizeTaiwanFlag(flag: string, mode: string) {
  if (flag !== "🇹🇼") return flag;
  if (mode === "ws") return "🇼🇸";
  if (mode === "tw") return "🇹🇼";
  return "🇨🇳";
}

function ensureUniqueProxyNames(proxies: ProxyNode[]) {
  const taken = new Set(proxies.map((proxy) => proxy.name));
  const seen = new Set<string>();
  const counters = new Map<string, number>();
  return proxies.map((proxy) => {
    if (!seen.has(proxy.name)) {
      seen.add(proxy.name);
      return proxy;
    }
    // Skip suffixes that collide with any other node name, not just earlier duplicates.
    let counter = counters.get(proxy.name) || 1;
    let candidate: string;
    do {
      counter += 1;
      candidate = `${proxy.name}-${counter}`;
    } while (taken.has(candidate) || seen.has(candidate));
    counters.set(proxy.name, counter);
    taken.add(candidate);
    seen.add(candidate);
    return { ...proxy, name: candidate };
  });
}

function compileRegex(input: string, flags = "") {
  const normalizedFlags = [...new Set(flags.split(""))].join("");
  if (input.startsWith("(?i)")) return new RegExp(input.slice(4), [...new Set(`i${normalizedFlags}`.split(""))].join(""));
  return new RegExp(input, normalizedFlags);
}

function getByPath(input: Record<string, unknown>, path: string) {
  return path.split(".").reduce<unknown>((current, key) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[key];
  }, input);
}

function setByPath<T extends Record<string, unknown>>(input: T, path: string, value: unknown) {
  const parts = path.split(".");
  let current: Record<string, unknown> = input;
  for (const part of parts.slice(0, -1)) {
    if (!current[part] || typeof current[part] !== "object" || Array.isArray(current[part])) current[part] = {};
    current = current[part] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]] = value;
  return input;
}

function formatInvalidLocalContentError(raw: string) {
  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const samples = lines.slice(0, 5).map((line, index) => `${index + 1}. ${line.slice(0, 80)}`);
  return ["No valid proxy nodes found. Supported input: URI lines, Mihomo YAML, or JSON proxy arrays.", samples.length ? `First lines:\n${samples.join("\n")}` : ""]
    .filter(Boolean)
    .join("\n");
}

function renderMihomoYaml(proxies: ProxyNode[], requestUrl: URL, template?: RoutingTemplateConfig) {
  const config = template || {};
  const mixedPort = config.mixedPort ?? config["mixed-port"] ?? 7890;
  const allowLan = config.allowLan ?? config["allow-lan"] ?? false;
  const logLevel = config.logLevel || config["log-level"] || "info";
  const proxyGroups = config.proxyGroups || config["proxy-groups"] || defaultProxyGroups();
  const ruleProviders = config.ruleProviders || config["rule-providers"];
  const document = {
    "mixed-port": mixedPort,
    "allow-lan": allowLan,
    mode: config.mode || "rule",
    "log-level": logLevel,
    ...(config.dns ? { dns: config.dns } : {}),
    ...(config.sniffer ? { sniffer: config.sniffer } : {}),
    proxies: proxies.map(stripUndefined),
    "proxy-groups": renderTemplateProxyGroups(proxies, proxyGroups),
    ...(ruleProviders ? { "rule-providers": ruleProviders } : {}),
    rules: config.rules && config.rules.length > 0 ? config.rules : ["MATCH,🚀 节点选择"],
  };

  return [`# Generated by Sub-Store Cloudflare`, `# Source: ${requestUrl.pathname}`, stringifyYaml(document)].join("\n");
}

function defaultProxyGroups(): TemplateProxyGroup[] {
  return [
    { name: "🚀 节点选择", type: "select", proxies: ["♻️ 自动选择", "🚀 手动切换", "DIRECT"] },
    { name: "♻️ 自动选择", type: "url-test", proxies: ["$all"], url: TEST_URL, interval: 300, tolerance: 50 },
    { name: "🚀 手动切换", type: "select", proxies: ["$all"] },
  ];
}

function renderTemplateProxyGroups(proxies: ProxyNode[], groupTemplates: TemplateProxyGroup[]) {
  const nodeNames = proxies.map((proxy) => proxy.name);
  const nodeNameSet = new Set(nodeNames);
  const rawGroups = groupTemplates.map((group) => ({
    ...group,
    proxies: expandGroupProxies(group, nodeNames),
  }));
  const includedGroupNames = new Set(rawGroups.filter((group) => group.proxies.length > 0).map((group) => group.name));
  const allowedLiterals = new Set(["DIRECT", "REJECT"]);

  return rawGroups
    .map((group) => {
      const proxyEntries = group.proxies.filter(
        (name) => nodeNameSet.has(name) || includedGroupNames.has(name) || allowedLiterals.has(name),
      );
      if (proxyEntries.length === 0) return undefined;
      const { filter: _filter, proxies: _proxies, ...rest } = group;
      return stripUndefined({ ...rest, proxies: uniqueStrings(proxyEntries) });
    })
    .filter(Boolean);
}

function expandGroupProxies(group: TemplateProxyGroup, nodeNames: string[]) {
  const entries = group.filter ? findNamesByRegex(nodeNames, group.filter) : [];
  for (const item of group.proxies || []) {
    if (item === "$all") entries.push(...nodeNames);
    else entries.push(item);
  }
  return uniqueStrings(entries);
}

function findNamesByRegex(names: string[], pattern: string) {
  const regex = compileRegex(pattern);
  return names.filter((name) => regex.test(name));
}

function renderSurgeProxies(proxies: ProxyNode[]) {
  return renderTextProxyList(proxies, "surge", toSurgeProxyLine);
}

function renderSurgeMacProxies(proxies: ProxyNode[]) {
  return renderTextProxyList(proxies, "surge-mac", toSurgeMacProxyLine);
}

function renderSurfboardProxies(proxies: ProxyNode[]) {
  return renderTextProxyList(proxies, "surfboard", toSurfboardProxyLine);
}

function renderLoonProxies(proxies: ProxyNode[]) {
  return renderTextProxyList(proxies, "loon", toLoonProxyLine);
}

function renderQxProxies(proxies: ProxyNode[]) {
  return renderTextProxyList(proxies, "qx", toQxProxyLine);
}

function renderTextProxyList(proxies: ProxyNode[], target: string, producer: (proxy: ProxyNode) => string | undefined) {
  const lines = proxies.map(producer).filter((line): line is string => Boolean(line));
  if (lines.length === 0) throw new Error(`No supported nodes for ${target} output`);
  return lines.join("\n");
}

function renderEgernYaml(proxies: ProxyNode[]) {
  const list = proxies.map(toEgernProxy).filter((proxy) => Boolean(proxy));
  if (list.length === 0) throw new Error("No supported nodes for egern output");
  return stringifyYaml({ proxies: list });
}

function toSurgeProxyLine(proxy: ProxyNode) {
  const name = sanitizeTextProxyName(proxy.name);
  const base = `${name}=${surgeType(proxy)},${proxy.server},${proxy.port}`;
  const entries = commonTextOptions(proxy);

  if (proxy.type === "ss") {
    entries.unshift(["encrypt-method", proxy.cipher || "none"], ["password", proxy.password]);
    appendPluginOptions(entries, proxy, "surge");
    return joinTextProxy(base, entries);
  }
  if (proxy.type === "vmess") {
    entries.unshift(["username", proxy.uuid], ["encrypt-method", proxy.cipher || "auto"], ["tls", proxy.tls], ["sni", proxy.servername]);
    appendWsOptions(entries, proxy, "surge");
    return joinTextProxy(base, entries);
  }
  if (proxy.type === "trojan") {
    entries.unshift(["password", proxy.password], ["sni", proxy.sni || proxy.servername]);
    return joinTextProxy(base, entries);
  }
  if (proxy.type === "http" || proxy.type === "socks5") {
    entries.unshift(["username", proxy.username], ["password", proxy.password], ["tls", proxy.tls], ["sni", proxy.sni || proxy.servername]);
    return joinTextProxy(base, entries);
  }
  if (proxy.type === "hysteria2") {
    entries.unshift(["password", proxy.password], ["sni", proxy.sni]);
    if (proxy.obfs) entries.push(["obfs", proxy.obfs], ["obfs-password", proxy["obfs-password"]]);
    return joinTextProxy(base, entries);
  }
  if (proxy.type === "tuic") {
    entries.unshift(["uuid", proxy.uuid], ["password", proxy.password], ["sni", proxy.sni]);
    return joinTextProxy(`${name}=tuic-v5,${proxy.server},${proxy.port}`, entries);
  }
  if (proxy.type === "anytls") {
    entries.unshift(["password", proxy.password], ["sni", proxy.sni || proxy.servername]);
    return joinTextProxy(base, entries);
  }
  if (proxy.type === "snell") {
    entries.unshift(["psk", proxy.psk || proxy.password], ["version", proxy.version || 3]);
    return joinTextProxy(`${name}=snell,${proxy.server},${proxy.port}`, entries);
  }
  return undefined;
}

function toSurgeMacProxyLine(proxy: ProxyNode) {
  if (proxy.type === "ssh") {
    const entries = commonTextOptions(proxy);
    entries.unshift(["username", proxy.username], ["password", proxy.password], ["private-key", proxy["private-key"]]);
    return joinTextProxy(`${sanitizeTextProxyName(proxy.name)}=ssh,${proxy.server},${proxy.port}`, entries);
  }
  if (proxy.type === "snell") {
    const entries = commonTextOptions(proxy);
    entries.unshift(["psk", proxy.psk || proxy.password], ["version", proxy.version || 3]);
    return joinTextProxy(`${sanitizeTextProxyName(proxy.name)}=snell,${proxy.server},${proxy.port}`, entries);
  }
  if (proxy.type === "h2-connect") {
    const entries = commonTextOptions(proxy);
    entries.unshift(["username", proxy.username], ["password", proxy.password], ["tls", proxy.tls], ["sni", proxy.sni || proxy.servername]);
    return joinTextProxy(`${sanitizeTextProxyName(proxy.name)}=h2-connect,${proxy.server},${proxy.port}`, entries);
  }
  return toSurgeProxyLine(proxy);
}

function toSurfboardProxyLine(proxy: ProxyNode) {
  return ["ss", "vmess", "trojan", "http", "socks5"].includes(proxy.type)
    ? toSurgeProxyLine(proxy)
    : undefined;
}

function renderTarget(proxies: ProxyNode[], target: SubscriptionTarget, requestUrl: URL, template?: RoutingTemplateConfig) {
  if (proxies.length === 0) throw new Error(`No supported nodes for ${target} output`);
  switch (target) {
    case "surge": return renderSurgeProxies(proxies);
    case "surge-mac": return renderSurgeMacProxies(proxies);
    case "surfboard": return renderSurfboardProxies(proxies);
    case "loon": return renderLoonProxies(proxies);
    case "egern": return renderEgernYaml(proxies);
    case "qx": return renderQxProxies(proxies);
    case "sing-box": return renderSingBoxJson(proxies);
    case "v2ray": return base64Utf8(renderProxyUris(proxies));
    case "uri":
    case "shadowrocket": return renderProxyUris(proxies);
    case "json": return JSON.stringify({ proxies }, null, 2);
    case "mihomo":
    case "stash":
    default: return renderMihomoYaml(proxies, requestUrl, template);
  }
}

function selectResponseMetadata(options: InternalBuildOptions) {
  const ordered = getSources(options);
  for (const source of ordered) {
    const metadata = options.responseMetadata.get(source.id);
    if (metadata) return metadata;
  }
  return {} as SubscriptionResponseMetadata;
}

function metadataFromSource(source: SubscriptionSource): SubscriptionResponseMetadata {
  return {
    subscriptionUserinfo: safeHeaderValue(stringSetting(source.meta?.subUserinfo) || stringSetting(source.meta?.subscriptionUserinfo)),
    profileWebPageUrl: safeHeaderValue(stringSetting(source.meta?.profileWebPageUrl) || stringSetting(source.meta?.appUrl)),
    profileUpdateInterval: safeHeaderValue(stringSetting(source.meta?.profileUpdateInterval)),
    contentDisposition: safeContentDisposition(stringSetting(source.meta?.contentDisposition)),
    cacheStatus: "disabled",
  };
}

function metadataFromResponse(response: Response, cacheStatus: SubscriptionResponseMetadata["cacheStatus"]): SubscriptionResponseMetadata {
  return {
    subscriptionUserinfo: safeHeaderValue(response.headers.get("subscription-userinfo") || response.headers.get("x-sub-store-subscription-userinfo")),
    profileWebPageUrl: safeHeaderValue(response.headers.get("profile-web-page-url") || response.headers.get("x-sub-store-profile-web-page-url")),
    profileUpdateInterval: safeHeaderValue(response.headers.get("profile-update-interval") || response.headers.get("x-sub-store-profile-update-interval")),
    contentDisposition: safeContentDisposition(response.headers.get("content-disposition") || response.headers.get("x-sub-store-content-disposition") || ""),
    etag: safeHeaderValue(response.headers.get("etag") || response.headers.get("x-sub-store-etag")),
    lastModified: safeHeaderValue(response.headers.get("last-modified") || response.headers.get("x-sub-store-last-modified")),
    cacheStatus,
  };
}

/** Header values must be ByteStrings without line breaks or control characters; anything else is dropped. */
function safeHeaderValue(value: string | null | undefined) {
  if (!value) return undefined;
  if (/[^\u0000-\u00ff]/.test(value) || /[\u0000-\u0008\u000a-\u001f\u007f]/.test(value)) return undefined;
  return value;
}

async function remoteCacheKey(url: string, userAgent: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${url}\n${userAgent}`));
  const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return new Request(`https://sub-store-cache.invalid/source/${hash}`);
}

async function safeCacheMatch(key: Request) {
  try {
    return await caches.default.match(key);
  } catch {
    return undefined;
  }
}

async function safeCachePut(
  key: Request,
  content: string,
  metadata: SubscriptionResponseMetadata,
) {
  try {
    const headers = new Headers({
      "content-type": "text/plain; charset=utf-8",
      "cache-control": `public, s-maxage=${CACHE_STORE_TTL_SECONDS}`,
      [CACHED_AT_HEADER]: String(Date.now()),
    });
    setInternalMetadataHeader(headers, "x-sub-store-subscription-userinfo", metadata.subscriptionUserinfo);
    setInternalMetadataHeader(headers, "x-sub-store-profile-web-page-url", metadata.profileWebPageUrl);
    setInternalMetadataHeader(headers, "x-sub-store-profile-update-interval", metadata.profileUpdateInterval);
    setInternalMetadataHeader(headers, "x-sub-store-content-disposition", metadata.contentDisposition);
    setInternalMetadataHeader(headers, "x-sub-store-etag", metadata.etag);
    setInternalMetadataHeader(headers, "x-sub-store-last-modified", metadata.lastModified);
    await caches.default.put(key, new Response(content, { headers }));
  } catch {
    // Cache API is optional and must not affect subscription generation.
  }
}

function setInternalMetadataHeader(headers: Headers, name: string, value: string | undefined) {
  if (value) headers.set(name, value.slice(0, 4096));
}

function safeContentDisposition(value: string) {
  if (!value || /[\r\n]/.test(value)) return undefined;
  const filename = parseDispositionFilename(value);
  if (!filename) return undefined;
  const safeName = Array.from(filename.replace(/[\u0000-\u001f\u007f"\\/;]/g, "_")).slice(0, 120).join("").trim();
  if (!safeName) return undefined;
  const fallback = safeName.replace(/[^a-zA-Z0-9._() -]/g, "_");
  const encoded = encodeURIComponent(safeName).replace(/['()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

function parseDispositionFilename(value: string) {
  const extended = value.match(/filename\*\s*=\s*[^';]*'[^']*'([^;]+)/i)?.[1]?.trim();
  if (extended) {
    try {
      return decodeURIComponent(extended);
    } catch {
      // Fall through to the plain filename parameter.
    }
  }
  return value.match(/filename\s*=\s*(?:"([^"]+)"|([^";]+))/i)?.slice(1).find(Boolean)?.trim();
}

function surgeType(proxy: ProxyNode) {
  if (proxy.type === "socks5") return proxy.tls ? "socks5-tls" : "socks5";
  if (proxy.type === "http") return proxy.tls ? "https" : "http";
  return proxy.type;
}

function toLoonProxyLine(proxy: ProxyNode) {
  const name = sanitizeTextProxyName(proxy.name);
  const entries = commonTextOptions(proxy);

  if (proxy.type === "ss") {
    appendPluginOptions(entries, proxy, "loon");
    return joinTextProxy(`${name}=shadowsocks,${proxy.server},${proxy.port},${proxy.cipher || "none"},${quoteTextValue(proxy.password)}`, entries);
  }
  if (proxy.type === "ssr") {
    return joinTextProxy(
      `${name}=shadowsocksr,${proxy.server},${proxy.port},${proxy.cipher || "aes-256-cfb"},${quoteTextValue(proxy.password)},${proxy.protocol || "origin"},${proxy.obfs || "plain"}`,
      entries,
    );
  }
  if (proxy.type === "vmess" || proxy.type === "vless") {
    entries.unshift(["transport", proxy.network || "tcp"], ["over-tls", proxy.tls], ["sni", proxy.servername], ["flow", proxy.flow]);
    appendWsOptions(entries, proxy, "loon");
    appendRealityOptions(entries, proxy);
    const method = proxy.type === "vmess" ? proxy.cipher || "auto" : "none";
    return joinTextProxy(`${name}=${proxy.type},${proxy.server},${proxy.port},${method},${quoteTextValue(proxy.uuid)}`, entries);
  }
  if (proxy.type === "trojan" || proxy.type === "anytls") {
    entries.unshift(["sni", proxy.sni || proxy.servername]);
    appendRealityOptions(entries, proxy);
    return joinTextProxy(`${name}=${proxy.type},${proxy.server},${proxy.port},${quoteTextValue(proxy.password)}`, entries);
  }
  if (proxy.type === "http" || proxy.type === "socks5") {
    entries.unshift(["username", proxy.username], ["password", proxy.password], ["over-tls", proxy.tls], ["sni", proxy.sni || proxy.servername]);
    return joinTextProxy(`${name}=${proxy.type === "socks5" ? "socks5" : "http"},${proxy.server},${proxy.port}`, entries);
  }
  if (proxy.type === "hysteria2") {
    entries.unshift(["tls-name", proxy.sni], ["obfs", proxy.obfs], ["obfs-password", proxy["obfs-password"]]);
    return joinTextProxy(`${name}=Hysteria2,${proxy.server},${proxy.port},${quoteTextValue(proxy.password)}`, entries);
  }
  return undefined;
}

function toQxProxyLine(proxy: ProxyNode) {
  const entries = commonTextOptions(proxy);
  entries.push(["tag", sanitizeQxTag(proxy.name)]);

  if (proxy.type === "ss") {
    entries.unshift(["method", proxy.cipher || "none"], ["password", proxy.password]);
    appendQxObfs(entries, proxy);
    return joinTextProxy(`shadowsocks=${proxy.server}:${proxy.port}`, entries);
  }
  if (proxy.type === "ssr") {
    entries.unshift(["method", proxy.cipher || "aes-256-cfb"], ["password", proxy.password], ["ssr-protocol", proxy.protocol || "origin"], ["obfs", proxy.obfs || "plain"]);
    return joinTextProxy(`shadowsocks=${proxy.server}:${proxy.port}`, entries);
  }
  if (proxy.type === "vmess" || proxy.type === "vless") {
    entries.unshift(["method", proxy.type === "vmess" ? proxy.cipher || "auto" : "none"], ["password", proxy.uuid], ["over-tls", proxy.tls], ["tls-host", proxy.servername], ["flow", proxy.flow]);
    appendQxTransport(entries, proxy);
    appendQxRealityOptions(entries, proxy);
    return joinTextProxy(`${proxy.type}=${proxy.server}:${proxy.port}`, entries);
  }
  if (proxy.type === "trojan" || proxy.type === "anytls") {
    entries.unshift(["password", proxy.password], ["over-tls", true], ["tls-host", proxy.sni || proxy.servername]);
    appendQxRealityOptions(entries, proxy);
    return joinTextProxy(`${proxy.type}=${proxy.server}:${proxy.port}`, entries);
  }
  if (proxy.type === "http" || proxy.type === "socks5") {
    entries.unshift(["username", proxy.username], ["password", proxy.password], ["over-tls", proxy.tls]);
    return joinTextProxy(`${proxy.type === "socks5" ? "socks5" : "http"}=${proxy.server}:${proxy.port}`, entries);
  }
  return undefined;
}

function toEgernProxy(proxy: ProxyNode) {
  const common = stripUndefined({
    name: proxy.name,
    server: proxy.server,
    port: proxy.port,
    tfo: proxy.tfo,
    udp_relay: proxy.udp,
  });

  if (proxy.type === "ss") {
    return stripUndefined({ ...common, type: "shadowsocks", method: proxy.cipher, password: proxy.password });
  }
  if (proxy.type === "vmess" || proxy.type === "vless") {
    return stripUndefined({
      ...common,
      type: proxy.type,
      uuid: proxy.uuid,
      alter_id: proxy.alterId,
      security: proxy.type === "vmess" ? proxy.cipher || "auto" : undefined,
      flow: proxy.flow,
      tls: proxy.tls,
      sni: proxy.servername,
      network: proxy.network,
      ws_opts: egernWsOptions(proxy),
      reality: egernRealityOptions(proxy),
    });
  }
  if (proxy.type === "trojan" || proxy.type === "anytls" || proxy.type === "hysteria2") {
    return stripUndefined({
      ...common,
      type: proxy.type,
      password: proxy.password,
      sni: proxy.sni || proxy.servername,
      skip_tls_verify: proxy["skip-cert-verify"],
      obfs: proxy.obfs,
      obfs_password: proxy["obfs-password"],
      reality: egernRealityOptions(proxy),
    });
  }
  if (proxy.type === "http" || proxy.type === "socks5") {
    return stripUndefined({
      ...common,
      type: proxy.type === "http" && proxy.tls ? "https" : proxy.tls ? "socks5_tls" : proxy.type,
      username: proxy.username,
      password: proxy.password,
      skip_tls_verify: proxy["skip-cert-verify"],
    });
  }
  if (proxy.type === "tuic") {
    return stripUndefined({
      ...common,
      type: "tuic",
      uuid: proxy.uuid,
      password: proxy.password,
      sni: proxy.sni,
      skip_tls_verify: proxy["skip-cert-verify"],
    });
  }
  if (proxy.type === "wireguard") {
    return stripUndefined({
      ...common,
      type: "wireguard",
      private_key: proxy["private-key"],
      public_key: proxy["public-key"],
      pre_shared_key: proxy["pre-shared-key"],
      address: proxy.ip,
      ipv6_address: proxy.ipv6,
    });
  }
  return undefined;
}

function egernWsOptions(proxy: ProxyNode) {
  const wsOpts = proxy["ws-opts"] as { path?: unknown; headers?: Record<string, unknown> } | undefined;
  if (proxy.network !== "ws") return undefined;
  return stripUndefined({ path: wsOpts?.path || "/", headers: wsOpts?.headers });
}

function egernRealityOptions(proxy: ProxyNode) {
  const realityOpts = proxy["reality-opts"] as Record<string, unknown> | undefined;
  return realityOpts?.["public-key"] ? stripUndefined({ public_key: realityOpts["public-key"], short_id: realityOpts["short-id"] }) : undefined;
}

function commonTextOptions(proxy: ProxyNode): Array<[string, unknown]> {
  return [
    ["skip-cert-verify", proxy["skip-cert-verify"]],
    ["udp-relay", proxy.udp],
    ["fast-open", proxy.tfo || proxy["fast-open"]],
    ["alpn", formatAlpn(proxy.alpn)],
  ];
}

function appendWsOptions(entries: Array<[string, unknown]>, proxy: ProxyNode, target: "surge" | "loon") {
  const wsOpts = proxy["ws-opts"] as { path?: unknown; headers?: Record<string, unknown> } | undefined;
  if (proxy.network !== "ws") return;
  if (target === "surge") {
    entries.push(["ws", true], ["ws-path", wsOpts?.path || "/"], ["ws-headers", wsHeaderHost(wsOpts)]);
  } else {
    entries.push(["path", wsOpts?.path || "/"], ["host", wsHeaderHost(wsOpts)]);
  }
}

function appendPluginOptions(entries: Array<[string, unknown]>, proxy: ProxyNode, target: "surge" | "loon") {
  const pluginOpts = proxy["plugin-opts"] as Record<string, unknown> | undefined;
  if (proxy.plugin !== "obfs" || !pluginOpts) return;
  if (target === "surge") {
    entries.push(["obfs", pluginOpts.mode], ["obfs-host", pluginOpts.host], ["obfs-uri", pluginOpts.path]);
  } else {
    entries.push(["obfs-name", pluginOpts.mode], ["obfs-host", pluginOpts.host], ["obfs-uri", pluginOpts.path]);
  }
}

function appendRealityOptions(entries: Array<[string, unknown]>, proxy: ProxyNode) {
  const realityOpts = proxy["reality-opts"] as Record<string, unknown> | undefined;
  entries.push(["public-key", realityOpts?.["public-key"]], ["short-id", realityOpts?.["short-id"]]);
}

function appendQxRealityOptions(entries: Array<[string, unknown]>, proxy: ProxyNode) {
  const realityOpts = proxy["reality-opts"] as Record<string, unknown> | undefined;
  entries.push(["reality-base64-pubkey", realityOpts?.["public-key"]], ["reality-hex-shortid", realityOpts?.["short-id"]]);
}

function appendQxObfs(entries: Array<[string, unknown]>, proxy: ProxyNode) {
  const pluginOpts = proxy["plugin-opts"] as Record<string, unknown> | undefined;
  if (proxy.plugin === "obfs" && pluginOpts) entries.push(["obfs", pluginOpts.mode], ["obfs-host", pluginOpts.host], ["obfs-uri", pluginOpts.path]);
}

function appendQxTransport(entries: Array<[string, unknown]>, proxy: ProxyNode) {
  if (proxy.network !== "ws") return;
  const wsOpts = proxy["ws-opts"] as { path?: unknown; headers?: Record<string, unknown> } | undefined;
  entries.push(["obfs", proxy.tls ? "wss" : "ws"], ["obfs-uri", wsOpts?.path || "/"], ["obfs-host", wsHeaderHost(wsOpts)]);
}

function joinTextProxy(base: string, entries: Array<[string, unknown]>) {
  const suffix = entries
    .filter(([, value]) => value !== undefined && value !== "")
    .map(([key, value]) => `${key}=${formatTextOptionValue(value)}`)
    .join(",");
  return suffix ? `${base},${suffix}` : base;
}

function formatTextOptionValue(value: unknown) {
  if (typeof value === "boolean") return value ? "true" : "false";
  if (Array.isArray(value)) return quoteTextValue(value.join(","));
  const text = String(value);
  return /[,\s"]/.test(text) ? quoteTextValue(text) : text;
}

function quoteTextValue(value: unknown) {
  return `"${String(value || "").replace(/"/g, '\\"')}"`;
}

function sanitizeTextProxyName(name: string) {
  return name.replace(/[=,\r\n]/g, " ").trim() || "proxy";
}

function sanitizeQxTag(name: string) {
  return name.replace(/[,\r\n]/g, " ").trim() || "proxy";
}

function wsHeaderHost(wsOpts: { headers?: Record<string, unknown> } | undefined) {
  return wsOpts?.headers?.Host || wsOpts?.headers?.host;
}

function formatAlpn(value: unknown) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean).join(",");
  return stringSetting(value);
}

function renderSingBoxJson(proxies: ProxyNode[]) {
  const nodeOutbounds = proxies.map(toSingBoxOutbound).filter(isSingBoxOutbound);
  const tags = nodeOutbounds.map((outbound) => String(outbound.tag));
  if (tags.length === 0) throw new Error("No supported nodes for sing-box output");

  const outbounds = [
    {
      type: "selector",
      tag: "PROXY",
      outbounds: ["AUTO", ...tags],
      default: "AUTO",
      interrupt_exist_connections: false,
    },
    {
      type: "urltest",
      tag: "AUTO",
      outbounds: tags,
      url: TEST_URL,
      interval: "5m",
      tolerance: 50,
      interrupt_exist_connections: false,
    },
    ...nodeOutbounds,
    { type: "direct", tag: "DIRECT" },
  ];

  return JSON.stringify(
    {
      log: { level: "info" },
      inbounds: [{ type: "mixed", tag: "mixed-in", listen: "127.0.0.1", listen_port: 7890 }],
      outbounds,
      // sing-box 1.11+: sniffing is a route rule action and nothing here references a REJECT/block outbound.
      route: { rules: [{ action: "sniff" }], auto_detect_interface: true, final: "PROXY" },
    },
    null,
    2,
  );
}

function toSingBoxOutbound(proxy: ProxyNode): SingBoxOutbound | undefined {
  if (proxy.type === "vless") {
    return stripUndefined({
      type: "vless",
      tag: proxy.name,
      server: proxy.server,
      server_port: proxy.port,
      uuid: proxy.uuid,
      flow: proxy.flow,
      packet_encoding: "xudp",
      tls: proxy.tls ? singBoxTls(proxy, proxy.servername, { utls: "always" }) : undefined,
      transport: singBoxTransport(proxy),
    });
  }

  if (proxy.type === "hysteria2") {
    return stripUndefined({
      type: "hysteria2",
      tag: proxy.name,
      server: proxy.server,
      server_port: proxy.ports ? undefined : proxy.port,
      server_ports: singBoxServerPorts(proxy.ports),
      password: proxy.password,
      obfs: proxy.obfs ? { type: proxy.obfs, password: proxy["obfs-password"] } : undefined,
      tls: { enabled: true, server_name: proxy.sni, insecure: Boolean(proxy["skip-cert-verify"]), alpn: singBoxAlpn(proxy.alpn) },
    });
  }

  if (proxy.type === "hysteria") {
    return stripUndefined({
      type: "hysteria",
      tag: proxy.name,
      server: proxy.server,
      server_port: proxy.port,
      auth_str: proxy.auth_str,
      up_mbps: numberOrUndefined(proxy.up),
      down_mbps: numberOrUndefined(proxy.down),
      obfs: proxy.obfs ? String(proxy.obfs) : undefined,
      tls: { enabled: true, server_name: proxy.sni, insecure: Boolean(proxy["skip-cert-verify"]) },
    });
  }

  if (proxy.type === "anytls") {
    return stripUndefined({
      type: "anytls",
      tag: proxy.name,
      server: proxy.server,
      server_port: proxy.port,
      password: proxy.password,
      tls: {
        enabled: true,
        server_name: proxy.sni || proxy.servername,
        insecure: Boolean(proxy["skip-cert-verify"]),
        utls: { enabled: true, fingerprint: proxy["client-fingerprint"] || "chrome" },
      },
    });
  }

  if (proxy.type === "tuic") {
    return stripUndefined({
      type: "tuic",
      tag: proxy.name,
      server: proxy.server,
      server_port: proxy.port,
      uuid: proxy.uuid,
      password: proxy.password,
      congestion_control: proxy["congestion-controller"],
      udp_relay_mode: proxy["udp-relay-mode"],
      zero_rtt_handshake: proxy["reduce-rtt"],
      tls: { enabled: true, server_name: proxy.sni, insecure: Boolean(proxy["skip-cert-verify"]) },
    });
  }

  if (proxy.type === "trojan") {
    return stripUndefined({
      type: "trojan",
      tag: proxy.name,
      server: proxy.server,
      server_port: proxy.port,
      password: proxy.password,
      tls: singBoxTls(proxy, proxy.sni || proxy.servername, { utls: "when-set", forceEnabled: true }),
      transport: singBoxTransport(proxy),
    });
  }

  if (proxy.type === "socks5") {
    return stripUndefined({
      type: "socks",
      tag: proxy.name,
      server: proxy.server,
      server_port: proxy.port,
      version: "5",
      username: proxy.username,
      password: proxy.password,
      tls: proxy.tls ? { enabled: true } : undefined,
    });
  }

  if (proxy.type === "http") {
    return stripUndefined({
      type: "http",
      tag: proxy.name,
      server: proxy.server,
      server_port: proxy.port,
      username: proxy.username,
      password: proxy.password,
      tls: proxy.tls ? { enabled: true } : undefined,
    });
  }

  if (proxy.type === "ss") {
    return stripUndefined({
      type: "shadowsocks",
      tag: proxy.name,
      server: proxy.server,
      server_port: proxy.port,
      method: proxy.cipher,
      password: proxy.password,
    });
  }

  if (proxy.type === "wireguard") {
    const localAddress = [proxy.ip, proxy.ipv6].map((item) => String(item || "").trim()).filter(Boolean);
    return stripUndefined({
      type: "wireguard",
      tag: proxy.name,
      server: proxy.server,
      server_port: proxy.port,
      local_address: localAddress.length > 0 ? localAddress : undefined,
      private_key: proxy["private-key"],
      peer_public_key: proxy["public-key"],
      pre_shared_key: proxy["pre-shared-key"],
      reserved: parseWireGuardReserved(proxy.reserved),
    });
  }

  if (proxy.type === "vmess") {
    return stripUndefined({
      type: "vmess",
      tag: proxy.name,
      server: proxy.server,
      server_port: proxy.port,
      uuid: proxy.uuid,
      security: proxy.cipher || "auto",
      alter_id: proxy.alterId,
      tls: proxy.tls ? singBoxTls(proxy, proxy.servername, { utls: "when-set" }) : undefined,
      transport: singBoxTransport(proxy),
    });
  }

  return undefined;
}

/**
 * Builds a sing-box `tls` block. `utls: "always"` falls back to the chrome fingerprint,
 * `"when-set"` only emits utls when the node carries a client-fingerprint.
 */
function singBoxTls(proxy: ProxyNode, serverName: unknown, options: { utls: "always" | "when-set"; forceEnabled?: boolean }) {
  const realityOpts = proxy["reality-opts"] as Record<string, unknown> | undefined;
  const fingerprint = proxy["client-fingerprint"] || (options.utls === "always" ? "chrome" : undefined);
  return stripUndefined({
    enabled: true,
    server_name: serverName,
    insecure: proxy["skip-cert-verify"] ? true : options.forceEnabled ? false : undefined,
    alpn: singBoxAlpn(proxy.alpn),
    utls: fingerprint ? { enabled: true, fingerprint } : undefined,
    reality: realityOpts
      ? stripUndefined({ enabled: true, public_key: realityOpts["public-key"], short_id: realityOpts["short-id"] })
      : undefined,
  });
}

function singBoxAlpn(value: unknown) {
  const list = Array.isArray(value) ? value.map(String).filter(Boolean) : stringSetting(value) ? [stringSetting(value)] : [];
  return list.length > 0 ? list : undefined;
}

/** sing-box `network` only accepts tcp/udp, so ws/grpc/h2 are expressed as a `transport` block instead. */
function singBoxTransport(proxy: ProxyNode) {
  if (proxy.network === "ws") {
    const wsOpts = proxy["ws-opts"] as { path?: unknown; headers?: Record<string, unknown>; "v2ray-http-upgrade"?: unknown } | undefined;
    const host = wsHeaderHost(wsOpts);
    if (wsOpts?.["v2ray-http-upgrade"]) {
      return stripUndefined({ type: "httpupgrade", path: wsOpts.path || "/", host });
    }
    const headers = wsOpts?.headers && Object.keys(wsOpts.headers).length > 0 ? wsOpts.headers : undefined;
    return stripUndefined({ type: "ws", path: wsOpts?.path || "/", headers });
  }
  if (proxy.network === "grpc") {
    const grpcOpts = proxy["grpc-opts"] as Record<string, unknown> | undefined;
    return stripUndefined({ type: "grpc", service_name: grpcOpts?.["grpc-service-name"] });
  }
  if (proxy.network === "h2") {
    const h2Opts = proxy["h2-opts"] as { path?: unknown; host?: unknown } | undefined;
    const hosts = Array.isArray(h2Opts?.host) ? h2Opts.host.map(String) : h2Opts?.host ? [String(h2Opts.host)] : undefined;
    return stripUndefined({ type: "http", path: h2Opts?.path || "/", host: hosts });
  }
  return undefined;
}

/** Mihomo port-hopping lists use "-" ranges; sing-box expects "start:end" entries. */
function singBoxServerPorts(value: unknown) {
  const list = String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => (item.includes("-") ? item.replace("-", ":") : `${item}:${item}`));
  return list.length > 0 ? list : undefined;
}

function isSingBoxOutbound(input: SingBoxOutbound | undefined): input is SingBoxOutbound {
  return Boolean(input && typeof input.tag === "string");
}

function renderProxyUris(proxies: ProxyNode[]) {
  return proxies.map(toProxyUri).filter(Boolean).join("\n");
}

function toProxyUri(proxy: ProxyNode) {
  if (proxy.type === "vless") {
    const params = new URLSearchParams();
    const realityOpts = proxy["reality-opts"] as Record<string, unknown> | undefined;
    params.set("encryption", String(proxy.encryption || "none"));
    params.set("security", realityOpts ? "reality" : proxy.tls ? "tls" : "none");
    if (proxy.servername) params.set("sni", String(proxy.servername));
    if (proxy["client-fingerprint"]) params.set("fp", String(proxy["client-fingerprint"]));
    const alpn = formatAlpn(proxy.alpn);
    if (alpn) params.set("alpn", alpn);
    if (proxy["skip-cert-verify"]) params.set("allowInsecure", "1");
    if (realityOpts?.["public-key"]) params.set("pbk", String(realityOpts["public-key"]));
    if (realityOpts?.["short-id"]) params.set("sid", String(realityOpts["short-id"]));
    if (realityOpts?.["public-key"]) params.set("spx", String(realityOpts["spider-x"] || "/"));
    setUriTransportParams(params, proxy);
    if (proxy.flow) params.set("flow", String(proxy.flow));
    return `vless://${encodeURIComponent(String(proxy.uuid))}@${formatUriHost(proxy.server)}:${proxy.port}?${params.toString()}#${encodeURIComponent(proxy.name)}`;
  }

  if (proxy.type === "hysteria2") {
    const params = new URLSearchParams();
    if (proxy.sni) params.set("sni", String(proxy.sni));
    if (proxy["skip-cert-verify"]) params.set("insecure", "1");
    if (proxy.obfs) params.set("obfs", String(proxy.obfs));
    if (proxy["obfs-password"]) params.set("obfs-password", String(proxy["obfs-password"]));
    const alpn = formatAlpn(proxy.alpn);
    if (alpn) params.set("alpn", alpn);
    if (proxy.ports) params.set("mport", String(proxy.ports));
    // "user:pass" is a single auth string, so the separator stays a literal colon.
    const auth = String(proxy.password).split(":").map(encodeURIComponent).join(":");
    return `hysteria2://${auth}@${formatUriHost(proxy.server)}:${proxy.port}?${params.toString()}#${encodeURIComponent(proxy.name)}`;
  }

  if (proxy.type === "hysteria") {
    const params = new URLSearchParams();
    if (proxy.sni) params.set("sni", String(proxy.sni));
    if (proxy["skip-cert-verify"]) params.set("insecure", "1");
    if (proxy.protocol) params.set("protocol", String(proxy.protocol));
    if (proxy.up) params.set("up", String(proxy.up));
    if (proxy.down) params.set("down", String(proxy.down));
    if (proxy.obfs) params.set("obfs", String(proxy.obfs));
    if (proxy["obfs-password"]) params.set("obfs-password", String(proxy["obfs-password"]));
    return `hysteria://${encodeURIComponent(String(proxy.auth_str || ""))}@${formatUriHost(proxy.server)}:${proxy.port}?${params.toString()}#${encodeURIComponent(proxy.name)}`;
  }

  if (proxy.type === "anytls") {
    const params = new URLSearchParams();
    if (proxy.sni || proxy.servername) params.set("sni", String(proxy.sni || proxy.servername));
    if (proxy["skip-cert-verify"]) params.set("insecure", "1");
    if (proxy["client-fingerprint"]) params.set("fp", String(proxy["client-fingerprint"]));
    return `anytls://${encodeURIComponent(String(proxy.password))}@${formatUriHost(proxy.server)}:${proxy.port}?${params.toString()}#${encodeURIComponent(proxy.name)}`;
  }

  if (proxy.type === "tuic") {
    const params = new URLSearchParams();
    if (proxy.sni) params.set("sni", String(proxy.sni));
    if (proxy["skip-cert-verify"]) params.set("allow_insecure", "1");
    if (proxy["disable-sni"]) params.set("disable_sni", "1");
    if (proxy["reduce-rtt"]) params.set("reduce_rtt", "1");
    if (proxy["udp-relay-mode"]) params.set("udp_relay_mode", String(proxy["udp-relay-mode"]));
    if (proxy["congestion-controller"]) params.set("congestion_control", String(proxy["congestion-controller"]));
    return `tuic://${encodeURIComponent(String(proxy.uuid))}:${encodeURIComponent(String(proxy.password))}@${formatUriHost(proxy.server)}:${proxy.port}?${params.toString()}#${encodeURIComponent(proxy.name)}`;
  }

  if (proxy.type === "trojan") {
    const params = new URLSearchParams();
    if (proxy.sni) params.set("sni", String(proxy.sni));
    if (proxy["skip-cert-verify"]) params.set("allowInsecure", "1");
    const alpn = formatAlpn(proxy.alpn);
    if (alpn) params.set("alpn", alpn);
    if (proxy["client-fingerprint"]) params.set("fp", String(proxy["client-fingerprint"]));
    if (proxy.network && proxy.network !== "tcp") setUriTransportParams(params, proxy);
    return `trojan://${encodeURIComponent(String(proxy.password))}@${formatUriHost(proxy.server)}:${proxy.port}?${params.toString()}#${encodeURIComponent(proxy.name)}`;
  }

  if (proxy.type === "socks5") {
    const params = new URLSearchParams();
    if (proxy.tls) params.set("tls", "1");
    const auth = proxy.username ? `${encodeURIComponent(String(proxy.username))}:${encodeURIComponent(String(proxy.password || ""))}@` : "";
    const scheme = proxy.tls ? "socks5+tls" : "socks5";
    return `${scheme}://${auth}${formatUriHost(proxy.server)}:${proxy.port}${params.size > 0 ? `?${params.toString()}` : ""}#${encodeURIComponent(proxy.name)}`;
  }

  if (proxy.type === "http") {
    const auth = proxy.username ? `${encodeURIComponent(String(proxy.username))}:${encodeURIComponent(String(proxy.password || ""))}@` : "";
    const scheme = proxy.tls ? "https" : "http";
    return `${scheme}://${auth}${formatUriHost(proxy.server)}:${proxy.port}#${encodeURIComponent(proxy.name)}`;
  }

  if (proxy.type === "ss") {
    // SIP002: base64url(method:password)@host:port/?plugin=...#name
    const userInfo = encodeBase64UrlText(`${proxy.cipher}:${proxy.password}`);
    const plugin = shadowsocksPluginParam(proxy);
    return `ss://${userInfo}@${formatUriHost(proxy.server)}:${proxy.port}${plugin ? `/?plugin=${encodeURIComponent(plugin)}` : ""}#${encodeURIComponent(proxy.name)}`;
  }

  if (proxy.type === "ssr") {
    const main = [
      proxy.server,
      proxy.port,
      proxy.protocol || "origin",
      proxy.cipher || "aes-256-cfb",
      proxy.obfs || "plain",
      encodeBase64UrlText(String(proxy.password || "")),
    ].join(":");
    const params = new URLSearchParams();
    params.set("remarks", encodeBase64UrlText(proxy.name));
    if (proxy["protocol-param"]) params.set("protoparam", encodeBase64UrlText(String(proxy["protocol-param"])));
    if (proxy["obfs-param"]) params.set("obfsparam", encodeBase64UrlText(String(proxy["obfs-param"])));
    return `ssr://${encodeBase64UrlText(`${main}/?${params.toString()}`)}`;
  }

  if (proxy.type === "wireguard") {
    const params = new URLSearchParams();
    if (proxy.ip) params.set("ip", String(proxy.ip));
    if (proxy.ipv6) params.set("ipv6", String(proxy.ipv6));
    if (proxy["public-key"]) params.set("public-key", String(proxy["public-key"]));
    if (proxy["pre-shared-key"]) params.set("pre-shared-key", String(proxy["pre-shared-key"]));
    if (proxy.reserved) params.set("reserved", String(proxy.reserved));
    return `wireguard://${encodeURIComponent(String(proxy["private-key"] || ""))}@${formatUriHost(proxy.server)}:${proxy.port}?${params.toString()}#${encodeURIComponent(proxy.name)}`;
  }

  if (proxy.type === "vmess") {
    const transport = vmessTransportFields(proxy);
    return `vmess://${base64Utf8(
      JSON.stringify({
        v: "2",
        ps: proxy.name,
        add: proxy.server,
        port: String(proxy.port || ""),
        id: proxy.uuid,
        aid: String(proxy.alterId || 0),
        scy: proxy.cipher || "auto",
        tls: proxy.tls ? "tls" : "",
        sni: proxy.servername || "",
        alpn: formatAlpn(proxy.alpn),
        fp: proxy.tls ? String(proxy["client-fingerprint"] || "") : "",
        type: "none",
        ...transport,
      }),
    )}`;
  }

  return undefined;
}

/** Writes the `type`/`path`/`host`/`serviceName` URI parameters for vless and trojan links. */
function setUriTransportParams(params: URLSearchParams, proxy: ProxyNode) {
  const network = String(proxy.network || "tcp");
  if (network === "ws") {
    const wsOpts = proxy["ws-opts"] as { path?: unknown; headers?: Record<string, unknown>; "v2ray-http-upgrade"?: unknown } | undefined;
    params.set("type", wsOpts?.["v2ray-http-upgrade"] ? "httpupgrade" : "ws");
    if (wsOpts?.path) params.set("path", String(wsOpts.path));
    const host = wsHeaderHost(wsOpts);
    if (host) params.set("host", String(host));
  } else if (network === "grpc") {
    const grpcOpts = proxy["grpc-opts"] as Record<string, unknown> | undefined;
    params.set("type", "grpc");
    if (grpcOpts?.["grpc-service-name"]) params.set("serviceName", String(grpcOpts["grpc-service-name"]));
  } else if (network === "h2") {
    const h2Opts = proxy["h2-opts"] as { path?: unknown; host?: unknown } | undefined;
    params.set("type", "h2");
    if (h2Opts?.path) params.set("path", String(h2Opts.path));
    const host = Array.isArray(h2Opts?.host) ? h2Opts.host.join(",") : h2Opts?.host;
    if (host) params.set("host", String(host));
  } else {
    params.set("type", network);
  }
}

/** Maps the transport options of a vmess node onto the vmess:// JSON `net`/`host`/`path` fields. */
function vmessTransportFields(proxy: ProxyNode) {
  const network = String(proxy.network || "tcp");
  if (network === "ws") {
    const wsOpts = proxy["ws-opts"] as { path?: unknown; headers?: Record<string, unknown>; "v2ray-http-upgrade"?: unknown } | undefined;
    return { net: wsOpts?.["v2ray-http-upgrade"] ? "httpupgrade" : "ws", host: wsHeaderHost(wsOpts) || "", path: wsOpts?.path || "" };
  }
  if (network === "grpc") {
    const grpcOpts = proxy["grpc-opts"] as Record<string, unknown> | undefined;
    return { net: "grpc", host: "", path: grpcOpts?.["grpc-service-name"] || "" };
  }
  if (network === "h2") {
    const h2Opts = proxy["h2-opts"] as { path?: unknown; host?: unknown } | undefined;
    return { net: "h2", host: Array.isArray(h2Opts?.host) ? h2Opts.host.join(",") : h2Opts?.host || "", path: h2Opts?.path || "" };
  }
  return { net: network, host: "", path: "" };
}

/** Serializes ss plugin settings into the SIP002 `plugin` query value. */
function shadowsocksPluginParam(proxy: ProxyNode) {
  const pluginOpts = proxy["plugin-opts"] as Record<string, unknown> | undefined;
  if (!proxy.plugin || !pluginOpts) return undefined;
  if (proxy.plugin === "obfs") {
    return ["obfs-local", pluginOpts.mode ? `obfs=${pluginOpts.mode}` : "", pluginOpts.host ? `obfs-host=${pluginOpts.host}` : ""].filter(Boolean).join(";");
  }
  if (proxy.plugin === "v2ray-plugin") {
    return [
      "v2ray-plugin",
      pluginOpts.mode ? `mode=${pluginOpts.mode}` : "",
      pluginOpts.tls ? "tls" : "",
      pluginOpts.host ? `host=${pluginOpts.host}` : "",
      pluginOpts.path ? `path=${pluginOpts.path}` : "",
    ].filter(Boolean).join(";");
  }
  return undefined;
}

function normalizeProxy(input: unknown): ProxyNode | undefined {
  if (!input || typeof input !== "object") return undefined;
  const proxy = input as Record<string, unknown>;
  return stripUndefined({
    ...proxy,
    name: String(proxy.name || ""),
    type: String(proxy.type || ""),
    port: proxy.port === undefined ? undefined : Number(proxy.port),
  });
}

function isProxyNode(input: ProxyNode | undefined): input is ProxyNode {
  return Boolean(input?.name && input.type);
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function stripUndefined<T extends Record<string, unknown>>(input: T) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined && value !== "")) as T;
}

function boolParam(value: string | null) {
  const normalized = value?.toLowerCase();
  return normalized === "1" || normalized === "true";
}

function insecureParam(params: URLSearchParams) {
  return boolParam(params.get("allowInsecure") || params.get("insecure")) || undefined;
}

function safeDecodeURIComponent(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function uriName(url: URL, fallback: string) {
  return safeDecodeURIComponent(url.hash.slice(1) || fallback);
}

/** `URL.hostname` keeps the brackets of IPv6 literals; proxy configs need the bare address. */
function uriHostname(url: URL) {
  return url.hostname.replace(/^\[(.*)\]$/, "$1");
}

/** Adds the brackets IPv6 literals need inside `host:port` strings and URIs. */
function formatUriHost(server: unknown) {
  const host = String(server ?? "");
  return host.includes(":") && !host.startsWith("[") ? `[${host}]` : host;
}

function commaList(value: string | null) {
  if (!value) return undefined;
  const list = value.split(",").map((item) => item.trim()).filter(Boolean);
  return list.length > 0 ? list : undefined;
}

function numberOrUndefined(value: unknown) {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseWireGuardReserved(value: unknown) {
  if (Array.isArray(value)) return value.map(Number).filter(Number.isFinite);
  if (typeof value !== "string" || !value.trim()) return undefined;
  const list = value.split(",").map((item) => Number(item.trim())).filter(Number.isFinite);
  return list.length > 0 ? list : undefined;
}

function base64Utf8(input: string) {
  const bytes = new TextEncoder().encode(input);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function decodeBase64UrlText(input: string) {
  const normalized = input.replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/").replace(/=+$/g, "");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  try {
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return "";
  }
}

function encodeBase64UrlText(input: string) {
  return base64Utf8(input).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
