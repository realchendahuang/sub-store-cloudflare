import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MAX_REMOTE_SOURCE_RESPONSE_BYTES,
  MAX_REMOTE_SOURCE_URLS,
} from "../src/lib/limits";
import { readResponseText } from "../src/lib/read";
import { buildSubscription, buildSubscriptionResult, convertSubscriptionContent, normalizeTargetAlias, validateSubscriptionContent } from "../src/lib/subscription";

describe("subscription parsing and limits", () => {
  afterEach(() => vi.restoreAllMocks());

  it("normalizes target aliases and parses URI subscriptions", () => {
    expect(normalizeTargetAlias("clash-meta")).toBe("mihomo");
    expect(normalizeTargetAlias("singbox")).toBe("sing-box");
    expect(normalizeTargetAlias("surge-mac")).toBe("surge-mac");
    const nodes = validateSubscriptionContent(
      "vless://00000000-0000-4000-8000-000000000002@example.com:443?security=tls#Parsed%20Node",
    );
    expect(nodes).toHaveLength(1);
    expect(nodes[0].name).toBe("Parsed Node");
  });

  it("renders every advertised target", async () => {
    const targets = ["mihomo", "stash", "surge", "surge-mac", "surfboard", "loon", "egern", "shadowrocket", "qx", "sing-box", "v2ray", "uri", "json"] as const;
    for (const target of targets) {
      const output = await buildSubscription({
        source: {
          id: "target-smoke",
          name: "Target Smoke",
          type: "local",
          url: "",
          content: "trojan://password@example.com:443?sni=example.com#Target%20Node",
        },
        sources: [],
        requestUrl: new URL(`https://example.com/download/source/target-smoke/${target}`),
        target,
      });
      expect(output.length, `${target} output`).toBeGreaterThan(0);
    }
  });

  it("parses JSON5 and converts Surge Mac-only node types", async () => {
    const json5 = `{
      // compatible comment
      proxies: [
        { name: 'Snell Node', type: 'snell', server: 'example.com', port: 443, psk: 'secret', },
      ],
    }`;
    expect(validateSubscriptionContent(json5)).toHaveLength(1);
    const converted = await convertSubscriptionContent({ content: json5, target: "surge-mac" });
    expect(converted.content).toContain("Snell Node=snell,example.com,443");
    expect(converted.emitted).toBe(1);
  });

  it("captures allowlisted remote response metadata", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(
      "trojan://password@example.com:443#Remote%20Node",
      {
        headers: {
          "subscription-userinfo": "upload=1; download=2; total=10",
          "profile-web-page-url": "https://example.com/dashboard",
          "profile-update-interval": "12",
        },
      },
    ));
    const result = await buildSubscriptionResult({
      source: { id: "remote-meta", name: "Remote Meta", type: "remote", url: "https://example.com/sub", content: "" },
      sources: [],
      requestUrl: new URL("https://example.com/download/source/remote-meta/json"),
      target: "json",
      settings: { remoteCacheTtl: 0 },
    });
    expect(result.metadata.subscriptionUserinfo).toContain("total=10");
    expect(result.metadata.profileWebPageUrl).toBe("https://example.com/dashboard");
    expect(result.metadata.profileUpdateInterval).toBe("12");
  });

  it("uses a hashed Cache API key for repeat remote fetches", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(
      "trojan://password@cache.example.com:443#Cached%20Node",
      { headers: { etag: '"cache-v1"' } },
    ));
    const options = {
      source: { id: "remote-cache", name: "Remote Cache", type: "remote" as const, url: "https://private.example/sub?token=secret-value", content: "" },
      sources: [],
      requestUrl: new URL("https://example.com/download/source/remote-cache/json"),
      target: "json" as const,
      settings: { remoteCacheTtl: 300 },
    };
    await buildSubscriptionResult(options);
    const cached = await buildSubscriptionResult(options);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(cached.metadata.cacheStatus).toBe("hit");
  });

  it("renders a JSON target from a local source", async () => {
    const output = await buildSubscription({
      source: {
        id: "local",
        name: "Local",
        type: "local",
        url: "",
        content: "trojan://password@example.com:443?sni=example.com#Trojan%20Node",
      },
      sources: [],
      requestUrl: new URL("https://example.com/download/source/local/json"),
      target: "json",
    });
    const payload: unknown = JSON.parse(output);
    expect(payload && typeof payload === "object" ? Reflect.get(payload, "proxies") : undefined).toHaveLength(1);
  });

  it("runs build-time script operators with arguments", async () => {
    const output = await buildSubscription({
      source: {
        id: "script-operator",
        name: "Script Operator",
        type: "local",
        url: "",
        content: "trojan://password@example.com:443?sni=example.com#Script%20Node",
        filters: [{
          type: "script",
          scriptId: "tls-fingerprint",
          scriptKind: "operator",
          arguments: { fingerprint: "firefox" },
        }],
      },
      sources: [],
      requestUrl: new URL("https://example.com/download/source/script-operator/json"),
      target: "json",
    });
    const payload = JSON.parse(output) as { proxies: Array<Record<string, unknown>> };
    expect(payload.proxies[0]["tls-fingerprint"]).toBe("firefox");
  });

  it("runs build-time script filters and rejects unavailable scripts", async () => {
    const source = {
      id: "script-filter",
      name: "Script Filter",
      type: "local" as const,
      url: "",
      content: [
        "trojan://password@example.com:443#HK%20Node",
        "trojan://password@example.net:443#US%20Node",
      ].join("\n"),
      filters: [{
        type: "script",
        scriptId: "name-regex-filter",
        scriptKind: "filter" as const,
        arguments: { pattern: "^HK", keep: true },
      }],
    };
    const output = await buildSubscription({
      source,
      sources: [],
      requestUrl: new URL("https://example.com/download/source/script-filter/json"),
      target: "json",
    });
    expect(output).toContain("HK Node");
    expect(output).not.toContain("US Node");

    await expect(buildSubscription({
      source: { ...source, filters: [{ type: "script", scriptId: "missing-script" }] },
      sources: [],
      requestUrl: new URL("https://example.com/download/source/script-filter/json"),
      target: "json",
    })).rejects.toThrow("Unknown script: missing-script");
  });

  it("limits script actions per processing stage", async () => {
    await expect(buildSubscription({
      source: {
        id: "too-many-scripts",
        name: "Too Many Scripts",
        type: "local",
        url: "",
        content: "trojan://password@example.com:443#Node",
        filters: Array.from({ length: 3 }, () => ({
          type: "script",
          scriptId: "tls-fingerprint",
          scriptKind: "operator" as const,
          arguments: { fingerprint: "chrome" },
        })),
      },
      sources: [],
      requestUrl: new URL("https://example.com/download/source/too-many-scripts/json"),
      target: "json",
    })).rejects.toThrow("At most 2 script actions");
  });

  it("rejects sources with too many remote URLs before fetching", async () => {
    const urls = Array.from({ length: MAX_REMOTE_SOURCE_URLS + 1 }, (_, index) => `https://example.com/${index}`).join("\n");
    await expect(buildSubscription({
      source: { id: "remote", name: "Remote", type: "remote", url: urls, content: "" },
      sources: [],
      requestUrl: new URL("https://example.com/download/source/remote/json"),
      target: "json",
    })).rejects.toThrow(`${MAX_REMOTE_SOURCE_URLS} URL limit`);
  });

  it("stops reading oversized remote responses", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("x".repeat(MAX_REMOTE_SOURCE_RESPONSE_BYTES + 1), { status: 200 }),
    );
    await expect(buildSubscription({
      source: { id: "remote", name: "Remote", type: "remote", url: "https://example.com/sub", content: "" },
      sources: [],
      requestUrl: new URL("https://example.com/download/source/remote/json"),
      target: "json",
    })).rejects.toThrow("2 MiB limit");
  });

  it("honors Content-Length before consuming a response stream", async () => {
    const response = new Response("small", { headers: { "content-length": "999" } });
    await expect(readResponseText(response, 10, "Test response")).rejects.toThrow("10 byte limit");
  });
});
