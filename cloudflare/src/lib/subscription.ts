import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import type {
  AppSettings,
  FilterRule,
  RoutingTemplate,
  RoutingTemplateConfig,
  SubscriptionCollection,
  SubscriptionSource,
  SubscriptionTarget,
  TemplateProxyGroup,
} from "../types";

type ProxyNode = Record<string, unknown> & {
  name: string;
  type: string;
  server?: string;
  port?: number;
};

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
};

const TEST_URL = "https://www.gstatic.com/generate_204";

export function normalizeTarget(input: string | undefined, userAgent = ""): SubscriptionTarget {
  const value = String(input || "").toLowerCase();
  const ua = userAgent.toLowerCase();

  if (["sing-box", "singbox", "sfa", "karing"].includes(value) || ua.includes("sing-box") || ua.includes("singbox")) {
    return "sing-box";
  }
  if (["v2ray", "v2rayn", "v2rayng", "base64"].includes(value) || ua.includes("v2ray")) return "v2ray";
  if (["uri", "uris", "plain", "text"].includes(value)) return "uri";
  if (["json", "raw"].includes(value)) return "json";
  return "mihomo";
}

export function getTargetContentType(target: SubscriptionTarget) {
  if (target === "sing-box" || target === "json") return "application/json; charset=utf-8";
  if (target === "v2ray" || target === "uri") return "text/plain; charset=utf-8";
  return "text/yaml; charset=utf-8";
}

export async function buildSubscription(options: BuildOptions) {
  const proxies = await loadProxyNodes(options);
  if (proxies.length === 0) throw new Error("No available nodes found");

  if (options.target === "sing-box") return renderSingBoxJson(proxies);
  if (options.target === "v2ray") return base64Utf8(renderProxyUris(proxies));
  if (options.target === "uri") return renderProxyUris(proxies);
  if (options.target === "json") return JSON.stringify({ proxies }, null, 2);
  return renderMihomoYaml(proxies, options.requestUrl, options.template?.config);
}

export async function previewSubscription(options: Pick<BuildOptions, "source" | "collection" | "sources" | "settings">) {
  const sources = getSources({
    ...options,
    requestUrl: new URL("https://sub-store.local/preview"),
    target: "json",
  });
  const originalLists = await runWithConcurrency(
    sources.map((sub) => async () => parseProxies(await loadSubscriptionRaw(sub, options.settings))),
    getRequestConcurrency(options.settings),
    getRequestConcurrencyWait(options.settings),
  );
  const original = addPreviewIds(originalLists.flat());
  const processed = addPreviewIds(ensureUniqueProxyNames(applyFilters(originalLists.map((nodes, index) => {
    const source = sources[index];
    return applyFilters(nodes, getFilters(source));
  }).flat(), getFilters(options.collection))));

  return { original, processed };
}

export function previewSourceContent(source: SubscriptionSource) {
  const original = parseProxies(decodeMaybeBase64(source.content || source.url || ""));
  if (original.length === 0) throw new Error(formatInvalidLocalContentError(source.content || source.url || ""));
  const processed = ensureUniqueProxyNames(applyFilters(original, getFilters(source)));
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

async function loadProxyNodes(options: BuildOptions) {
  const sources = getSources(options).filter((sub) => sub.enabled !== false);
  if (sources.length === 0) return [];

  const tasks = sources.map((sub) => async () => applyFilters(parseProxies(await loadSubscriptionRaw(sub, options.settings)), getFilters(sub)));
  const proxyLists = options.collection?.ignoreFailed
    ? (await runSettledWithConcurrency(tasks, getRequestConcurrency(options.settings), getRequestConcurrencyWait(options.settings))).flatMap((result) =>
        result.status === "fulfilled" ? [result.value] : [],
      )
    : await runWithConcurrency(tasks, getRequestConcurrency(options.settings), getRequestConcurrencyWait(options.settings));

  return ensureUniqueProxyNames(applyFilters(proxyLists.flat(), getFilters(options.collection)));
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

async function loadSubscriptionRaw(sub: SubscriptionSource, settings?: AppSettings) {
  if (sub.type === "local" || sub.content) return String(sub.content || sub.url || "");

  const urls = splitSourceUrls(sub.url);
  if (urls.length === 0) throw new Error(`Remote source ${sub.name} has no valid URL`);

  const contents = await runWithConcurrency(
    urls.map((url) => async () => fetchSubscriptionUrl(url, sub, settings)),
    getRequestConcurrency(settings),
    getRequestConcurrencyWait(settings),
  );
  return contents.map(decodeMaybeBase64).join("\n");
}

function splitSourceUrls(raw: string) {
  return String(raw || "")
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter((item) => /^https?:\/\//i.test(item));
}

async function fetchSubscriptionUrl(url: string, sub: SubscriptionSource, settings?: AppSettings) {
  const controller = new AbortController();
  const timeout = getRequestTimeout(settings);
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      headers: { "user-agent": getSourceUserAgent(sub, settings) },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Remote source ${sub.name} failed: ${response.status}`);
    return response.text();
  } finally {
    clearTimeout(timeoutId);
  }
}

function getSourceUserAgent(sub: SubscriptionSource, settings?: AppSettings) {
  return (
    stringSetting(sub.meta?.ua)
    || stringSetting(sub.meta?.userAgent)
    || stringSetting(settings?.defaultUserAgent)
    || "clash.meta/v1.19.24"
  );
}

function getRequestTimeout(settings?: AppSettings) {
  return numberSetting(settings?.defaultTimeout, 30000, 1000, 120000);
}

function getRequestConcurrency(settings?: AppSettings) {
  return numberSetting(settings?.backendRequestConcurrency, 3, 1, 12);
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

  try {
    const decoded = atob(text.replace(/\s+/g, ""));
    if (looksLikeStructuredSubscription(decoded.trim())) return decoded;
  } catch {
    // Non-base64 subscriptions are parsed as-is.
  }
  return raw;
}

function looksLikeStructuredSubscription(text: string) {
  return /^[a-z][a-z0-9+.-]*:\/\//im.test(text) || /^\s*(proxies|proxy-groups|rules)\s*:/m.test(text) || /^\s*[\[{]/.test(text);
}

function parseProxies(raw: string): ProxyNode[] {
  const text = raw.trim();
  if (!text) return [];
  if (/^\s*[\[{]/.test(text)) return parseJsonProxies(text);
  if (/^\s*proxies\s*:/m.test(text)) return parseYamlProxies(text);
  return parseProxyUris(text);
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
    const payload = JSON.parse(raw);
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

function parseProxyUris(raw: string) {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => parseProxyUri(line, index))
    .filter(isProxyNode);
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
  const security = params.get("security") || (publicKey ? "reality" : "tls");

  return stripUndefined({
    name: decodeURIComponent(url.hash.slice(1) || `vless-${index + 1}`),
    type: "vless",
    server: url.hostname,
    port: Number(url.port || 443),
    uuid: decodeURIComponent(url.username),
    udp: true,
    flow: params.get("flow") || undefined,
    network: params.get("type") || "tcp",
    tls: security !== "none",
    servername: params.get("sni") || undefined,
    encryption: params.get("encryption") || "none",
    "client-fingerprint": params.get("fp") || "chrome",
    "reality-opts": publicKey ? stripUndefined({ "public-key": publicKey, "short-id": shortId, "spider-x": params.get("spx") || "/" }) : undefined,
  });
}

function parseAnytls(line: string, index: number): ProxyNode {
  const url = new URL(line);
  const params = url.searchParams;
  return stripUndefined({
    name: decodeURIComponent(url.hash.slice(1) || `anytls-${index + 1}`),
    type: "anytls",
    server: url.hostname,
    port: Number(url.port || 443),
    password: decodeURIComponent(url.username),
    sni: params.get("sni") || params.get("peer") || undefined,
    "skip-cert-verify": boolParam(params.get("insecure") || params.get("allowInsecure")),
    "client-fingerprint": params.get("fp") || "chrome",
  });
}

function parseHysteria2(line: string, index: number): ProxyNode {
  const url = new URL(line.replace(/^hy2:\/\//, "hysteria2://"));
  const params = url.searchParams;
  return stripUndefined({
    name: decodeURIComponent(url.hash.slice(1) || `hysteria2-${index + 1}`),
    type: "hysteria2",
    server: url.hostname,
    port: Number(url.port || 443),
    password: decodeURIComponent(url.username),
    sni: params.get("sni") || params.get("peer") || undefined,
    "skip-cert-verify": boolParam(params.get("insecure") || params.get("allowInsecure")),
    obfs: params.get("obfs") || undefined,
    "obfs-password": params.get("obfs-password") || params.get("salamander-password") || undefined,
  });
}

function parseHysteria(line: string, index: number): ProxyNode {
  const url = new URL(line.replace(/^hy:\/\//, "hysteria://"));
  const params = url.searchParams;
  return stripUndefined({
    name: decodeURIComponent(url.hash.slice(1) || `hysteria-${index + 1}`),
    type: "hysteria",
    server: url.hostname,
    port: Number(url.port || 443),
    auth_str: decodeURIComponent(url.username || params.get("auth") || params.get("auth_str") || ""),
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
  return stripUndefined({
    name: decodeURIComponent(url.hash.slice(1) || `trojan-${index + 1}`),
    type: "trojan",
    server: url.hostname,
    port: Number(url.port || 443),
    password: decodeURIComponent(url.username),
    sni: url.searchParams.get("sni") || url.searchParams.get("peer") || undefined,
    "skip-cert-verify": boolParam(url.searchParams.get("allowInsecure")),
    udp: true,
  });
}

function parseVmess(line: string, index: number): ProxyNode | undefined {
  try {
    const payload = JSON.parse(atob(line.slice("vmess://".length)));
    return stripUndefined({
      name: payload.ps || `vmess-${index + 1}`,
      type: "vmess",
      server: payload.add,
      port: Number(payload.port),
      uuid: payload.id,
      alterId: Number(payload.aid || 0),
      cipher: payload.scy || "auto",
      tls: payload.tls === "tls",
      servername: payload.sni || payload.host || undefined,
      network: payload.net || "tcp",
      "ws-opts": payload.net === "ws" ? { path: payload.path || "/", headers: { Host: payload.host } } : undefined,
      udp: true,
    });
  } catch {
    return undefined;
  }
}

function parseShadowsocks(line: string, index: number): ProxyNode | undefined {
  try {
    const withoutScheme = line.slice("ss://".length);
    const [main, hash = ""] = withoutScheme.split("#");
    const decodedMain = main.includes("@") ? main : atob(main);
    const [userInfo, hostInfo] = decodedMain.split("@");
    const decodedUserInfo = userInfo.includes(":") ? userInfo : decodeBase64UrlText(userInfo);
    const [cipher, password] = decodedUserInfo.split(":");
    const lastColon = hostInfo.lastIndexOf(":");
    return stripUndefined({
      name: decodeURIComponent(hash || `ss-${index + 1}`),
      type: "ss",
      server: hostInfo.slice(0, lastColon),
      port: Number(hostInfo.slice(lastColon + 1).split("?")[0]),
      cipher,
      password,
      udp: true,
    });
  } catch {
    return undefined;
  }
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
    name: decodeURIComponent(url.hash.slice(1) || `socks5-${index + 1}`),
    type: "socks5",
    server: url.hostname,
    port: Number(url.port),
    username: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    tls: line.startsWith("socks5+tls://") || boolParam(url.searchParams.get("tls")),
    udp: true,
  });
}

function parseHttpProxy(line: string, index: number): ProxyNode | undefined {
  const url = new URL(line);
  if (!url.port) return undefined;
  return stripUndefined({
    name: decodeURIComponent(url.hash.slice(1) || `${url.protocol === "https:" ? "https" : "http"}-${index + 1}`),
    type: "http",
    server: url.hostname,
    port: Number(url.port),
    username: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    tls: url.protocol === "https:",
  });
}

function parseTuic(line: string, index: number): ProxyNode {
  const url = new URL(line);
  const params = url.searchParams;
  return stripUndefined({
    name: decodeURIComponent(url.hash.slice(1) || `tuic-${index + 1}`),
    type: "tuic",
    server: url.hostname,
    port: Number(url.port || 443),
    uuid: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
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
    name: decodeURIComponent(url.hash.slice(1) || `wireguard-${index + 1}`),
    type: "wireguard",
    server: url.hostname,
    port: Number(url.port || 51820),
    ip: params.get("ip") || params.get("address") || undefined,
    ipv6: params.get("ipv6") || undefined,
    "private-key": decodeURIComponent(url.username || params.get("private-key") || params.get("privatekey") || ""),
    "public-key": params.get("public-key") || params.get("publickey") || params.get("peer-public-key") || undefined,
    "pre-shared-key": params.get("pre-shared-key") || params.get("presharedkey") || params.get("psk") || undefined,
    reserved: params.get("reserved") || undefined,
    udp: true,
  });
}

function applyFilters(proxies: ProxyNode[], filters: FilterRule[]) {
  return filters.reduce((current, filter) => {
    if (!filter || typeof filter !== "object") return current;
    if (filter.type === "include") return matchFilter(current, filter, true);
    if (filter.type === "exclude") return matchFilter(current, filter, false);
    if (filter.type === "rename") return renameProxies(current, filter);
    if (filter.type === "delete-field") return deleteFieldMatches(current, filter);
    if (filter.type === "dedupe") return handleDuplicateProxies(current, filter);
    if (filter.type === "sort") return sortProxies(current, filter.direction || "asc");
    if (filter.type === "regex-sort") return regexSortProxies(current, filter);
    if (filter.type === "flag") return flagProxies(current, filter);
    if (filter.type === "quick") return applyQuickSettings(current, filter);
    return current;
  }, proxies);
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
  return proxies.map((proxy) => {
    const next = { ...proxy };
    const value = patterns.reduce((name, pattern) => name.replace(compileRegex(String(pattern), "g"), ""), String(getByPath(next, field) || ""));
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
  return fields.map((field) => String(getByPath(proxy, field) || "-")).join("\n");
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
  return [...proxies].sort((a, b) => {
    const result = a.name.localeCompare(b.name, "zh-Hans-CN");
    return direction === "desc" ? -result : result;
  });
}

function regexSortProxies(proxies: ProxyNode[], filter: FilterRule) {
  const expressions = (filter.expressions || filter.patterns || (filter.pattern ? [filter.pattern] : []))
    .map(String)
    .filter(Boolean)
    .map((pattern) => compileRegex(pattern));
  const direction = filter.direction || "asc";
  if (expressions.length === 0) return sortProxies(proxies, direction);

  return [...proxies].sort((a, b) => {
    const left = regexOrder(expressions, a.name);
    const right = regexOrder(expressions, b.name);
    if (left && !right) return -1;
    if (right && !left) return 1;
    if (left && right) return left - right;
    if (direction === "original") return 0;
    return sortProxies([a, b], direction)[0] === a ? -1 : 1;
  });
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
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[randomIndex]] = [next[randomIndex], next[index]];
  }
  return next;
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

function detectFlag(name: string) {
  const text = name.toLowerCase();
  const rules: Array<[RegExp, string]> = [
    [/香港|港|hong\s*kong|\bhk\b/, "🇭🇰"],
    [/台湾|台灣|taiwan|\btw\b/, "🇹🇼"],
    [/新加坡|狮城|獅城|singapore|\bsg\b/, "🇸🇬"],
    [/日本|东京|東京|大阪|japan|tokyo|osaka|\bjp\b/, "🇯🇵"],
    [/美国|美國|洛杉矶|洛杉磯|纽约|紐約|united\s*states|los\s*angeles|new\s*york|\bus\b|\busa\b/, "🇺🇸"],
    [/英国|英國|伦敦|倫敦|united\s*kingdom|london|\buk\b/, "🇬🇧"],
    [/德国|德國|法兰克福|法蘭克福|germany|frankfurt|\bde\b/, "🇩🇪"],
    [/韩国|韓國|首尔|首爾|korea|seoul|\bkr\b/, "🇰🇷"],
  ];
  return rules.find(([pattern]) => pattern.test(text))?.[1] || "🏳️";
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
  const seen = new Map<string, number>();
  return proxies.map((proxy) => {
    const count = seen.get(proxy.name) || 0;
    seen.set(proxy.name, count + 1);
    return count === 0 ? proxy : { ...proxy, name: `${proxy.name}-${count + 1}` };
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
  const document = {
    "mixed-port": config.mixedPort ?? 7890,
    "allow-lan": config.allowLan ?? false,
    mode: config.mode || "rule",
    "log-level": config.logLevel || "info",
    ...(config.dns ? { dns: config.dns } : {}),
    ...(config.sniffer ? { sniffer: config.sniffer } : {}),
    proxies: proxies.map(stripUndefined),
    "proxy-groups": renderTemplateProxyGroups(proxies, config.proxyGroups || defaultProxyGroups()),
    ...(config.ruleProviders ? { "rule-providers": config.ruleProviders } : {}),
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
  const rawGroups = groupTemplates.map((group) => ({
    ...group,
    proxies: expandGroupProxies(group, nodeNames),
  }));
  const includedGroupNames = new Set(rawGroups.filter((group) => group.proxies.length > 0).map((group) => group.name));
  const allowedLiterals = new Set(["DIRECT", "REJECT"]);

  return rawGroups
    .map((group) => {
      const proxyEntries = group.proxies.filter(
        (name) => nodeNames.includes(name) || includedGroupNames.has(name) || allowedLiterals.has(name),
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
    { type: "block", tag: "REJECT" },
  ];

  return JSON.stringify(
    {
      log: { level: "info" },
      inbounds: [{ type: "mixed", tag: "mixed-in", listen: "127.0.0.1", listen_port: 7890, sniff: true }],
      outbounds,
      route: { auto_detect_interface: true, final: "PROXY" },
    },
    null,
    2,
  );
}

function toSingBoxOutbound(proxy: ProxyNode): SingBoxOutbound | undefined {
  if (proxy.type === "vless") {
    const realityOpts = proxy["reality-opts"] as Record<string, unknown> | undefined;
    return stripUndefined({
      type: "vless",
      tag: proxy.name,
      server: proxy.server,
      server_port: proxy.port,
      uuid: proxy.uuid,
      flow: proxy.flow,
      network: proxy.network || "tcp",
      packet_encoding: "xudp",
      tls: proxy.tls
        ? stripUndefined({
            enabled: true,
            server_name: proxy.servername,
            utls: { enabled: true, fingerprint: proxy["client-fingerprint"] || "chrome" },
            reality: realityOpts
              ? stripUndefined({ enabled: true, public_key: realityOpts["public-key"], short_id: realityOpts["short-id"] })
              : undefined,
          })
        : undefined,
    });
  }

  if (proxy.type === "hysteria2") {
    return stripUndefined({
      type: "hysteria2",
      tag: proxy.name,
      server: proxy.server,
      server_port: proxy.port,
      password: proxy.password,
      obfs: proxy.obfs ? { type: proxy.obfs, password: proxy["obfs-password"] } : undefined,
      tls: { enabled: true, server_name: proxy.sni, insecure: Boolean(proxy["skip-cert-verify"]) },
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
      tls: { enabled: true, server_name: proxy.sni, insecure: Boolean(proxy["skip-cert-verify"]) },
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
      tls: proxy.tls ? { enabled: true, server_name: proxy.servername } : undefined,
      transport:
        proxy.network === "ws"
          ? {
              type: "ws",
              path: (proxy["ws-opts"] as { path?: unknown } | undefined)?.path || "/",
              headers: (proxy["ws-opts"] as { headers?: unknown } | undefined)?.headers,
            }
          : undefined,
    });
  }

  return undefined;
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
    if (realityOpts?.["public-key"]) params.set("pbk", String(realityOpts["public-key"]));
    if (realityOpts?.["short-id"]) params.set("sid", String(realityOpts["short-id"]));
    if (realityOpts?.["public-key"]) params.set("spx", String(realityOpts["spider-x"] || "/"));
    params.set("type", String(proxy.network || "tcp"));
    if (proxy.flow) params.set("flow", String(proxy.flow));
    return `vless://${encodeURIComponent(String(proxy.uuid))}@${proxy.server}:${proxy.port}?${params.toString()}#${encodeURIComponent(proxy.name)}`;
  }

  if (proxy.type === "hysteria2") {
    const params = new URLSearchParams();
    if (proxy.sni) params.set("sni", String(proxy.sni));
    if (proxy["skip-cert-verify"]) params.set("insecure", "1");
    if (proxy.obfs) params.set("obfs", String(proxy.obfs));
    if (proxy["obfs-password"]) params.set("obfs-password", String(proxy["obfs-password"]));
    return `hysteria2://${encodeURIComponent(String(proxy.password))}@${proxy.server}:${proxy.port}?${params.toString()}#${encodeURIComponent(proxy.name)}`;
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
    return `hysteria://${encodeURIComponent(String(proxy.auth_str || ""))}@${proxy.server}:${proxy.port}?${params.toString()}#${encodeURIComponent(proxy.name)}`;
  }

  if (proxy.type === "anytls") {
    const params = new URLSearchParams();
    if (proxy.sni || proxy.servername) params.set("sni", String(proxy.sni || proxy.servername));
    if (proxy["skip-cert-verify"]) params.set("insecure", "1");
    if (proxy["client-fingerprint"]) params.set("fp", String(proxy["client-fingerprint"]));
    return `anytls://${encodeURIComponent(String(proxy.password))}@${proxy.server}:${proxy.port}?${params.toString()}#${encodeURIComponent(proxy.name)}`;
  }

  if (proxy.type === "tuic") {
    const params = new URLSearchParams();
    if (proxy.sni) params.set("sni", String(proxy.sni));
    if (proxy["skip-cert-verify"]) params.set("allow_insecure", "1");
    if (proxy["disable-sni"]) params.set("disable_sni", "1");
    if (proxy["reduce-rtt"]) params.set("reduce_rtt", "1");
    if (proxy["udp-relay-mode"]) params.set("udp_relay_mode", String(proxy["udp-relay-mode"]));
    if (proxy["congestion-controller"]) params.set("congestion_control", String(proxy["congestion-controller"]));
    return `tuic://${encodeURIComponent(String(proxy.uuid))}:${encodeURIComponent(String(proxy.password))}@${proxy.server}:${proxy.port}?${params.toString()}#${encodeURIComponent(proxy.name)}`;
  }

  if (proxy.type === "trojan") {
    const params = new URLSearchParams();
    if (proxy.sni) params.set("sni", String(proxy.sni));
    if (proxy["skip-cert-verify"]) params.set("allowInsecure", "1");
    return `trojan://${encodeURIComponent(String(proxy.password))}@${proxy.server}:${proxy.port}?${params.toString()}#${encodeURIComponent(proxy.name)}`;
  }

  if (proxy.type === "socks5") {
    const params = new URLSearchParams();
    if (proxy.tls) params.set("tls", "1");
    const auth = proxy.username ? `${encodeURIComponent(String(proxy.username))}:${encodeURIComponent(String(proxy.password || ""))}@` : "";
    const scheme = proxy.tls ? "socks5+tls" : "socks5";
    return `${scheme}://${auth}${proxy.server}:${proxy.port}${params.size > 0 ? `?${params.toString()}` : ""}#${encodeURIComponent(proxy.name)}`;
  }

  if (proxy.type === "http") {
    const auth = proxy.username ? `${encodeURIComponent(String(proxy.username))}:${encodeURIComponent(String(proxy.password || ""))}@` : "";
    const scheme = proxy.tls ? "https" : "http";
    return `${scheme}://${auth}${proxy.server}:${proxy.port}#${encodeURIComponent(proxy.name)}`;
  }

  if (proxy.type === "ss") {
    const userInfo = base64Utf8(`${proxy.cipher}:${proxy.password}@${proxy.server}:${proxy.port}`);
    return `ss://${userInfo}#${encodeURIComponent(proxy.name)}`;
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
    return `wireguard://${encodeURIComponent(String(proxy["private-key"] || ""))}@${proxy.server}:${proxy.port}?${params.toString()}#${encodeURIComponent(proxy.name)}`;
  }

  if (proxy.type === "vmess") {
    const wsOpts = proxy["ws-opts"] as { path?: unknown; headers?: { Host?: unknown } } | undefined;
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
        net: proxy.network || "tcp",
        type: "none",
        host: wsOpts?.headers?.Host || "",
        path: wsOpts?.path || "",
      }),
    )}`;
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
  return value === "1" || value === "true";
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
  const padded = input.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(input.length / 4) * 4, "=");
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
