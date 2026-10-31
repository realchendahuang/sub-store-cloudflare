import { afterEach, describe, expect, it, vi } from "vitest";
import { parse as parseYaml } from "yaml";
import {
  buildSubscription,
  buildSubscriptionResult,
  convertSubscriptionContent,
  validateSubscriptionContent,
} from "../src/lib/subscription";
import type { SubscriptionCollection, SubscriptionSource, SubscriptionTarget } from "../src/types";

type Node = Record<string, unknown>;

const UUID = "00000000-0000-4000-8000-000000000002";

describe("subscription decoding", () => {
  afterEach(() => vi.restoreAllMocks());

  const chineseLines = [
    // The first two keep raw UTF-8 in the fragment so a wrong base64 charset shows up as mojibake.
    "trojan://password@hk.example.com:443?sni=hk.example.com#香港 优质 01",
    "trojan://password@jp.example.com:443?sni=jp.example.com#日本 专线 02",
    `vless://${UUID}@us.example.com:443?security=tls&sni=us.example.com#%E7%BE%8E%E5%9B%BD%20%E6%B5%81%E5%AA%92%E4%BD%93`,
  ];
  const chineseNames = ["香港 优质 01", "日本 专线 02", "美国 流媒体"];

  it("decodes standard base64 subscriptions with Chinese node names, line wrapping and CRLF", () => {
    const encoded = toBase64(chineseLines.join("\n"));
    expect(encoded).toMatch(/[+/]/);
    for (const eol of ["\n", "\r\n"]) {
      const nodes = parseNodes(`\n  ${wrap(encoded, 40, eol)}${eol}`);
      expect(nodes.map((node) => node.name)).toEqual(chineseNames);
    }
  });

  it("decodes URL-safe base64 subscriptions without padding", () => {
    const encoded = toBase64Url(chineseLines.join("\n"));
    expect(encoded).toMatch(/[-_]/);
    expect(encoded).not.toContain("=");
    expect(parseNodes(wrap(encoded, 50, "\n")).map((node) => node.name)).toEqual(chineseNames);
  });

  it("decodes vmess links whose ps contains Chinese characters", () => {
    const payload = {
      v: "2",
      ps: "香港 vmess 节点",
      add: "vm.example.com",
      port: "443",
      id: UUID,
      aid: "0",
      net: "ws",
      host: "cdn.example.com",
      path: "/vm",
      tls: "tls",
      sni: "vm.example.com",
    };
    const line = `vmess://${toBase64(JSON.stringify(payload))}`;
    const [direct] = parseNodes(line);
    expect(direct).toMatchObject({
      name: "香港 vmess 节点",
      type: "vmess",
      server: "vm.example.com",
      port: 443,
      uuid: UUID,
      tls: true,
      network: "ws",
      "ws-opts": { path: "/vm", headers: { Host: "cdn.example.com" } },
    });
    // The same line inside a base64 subscription body.
    expect(parseNodes(toBase64(`${line}\n${chineseLines[0]}`)).map((node) => node.name)).toEqual(["香港 vmess 节点", "香港 优质 01"]);
  });

  it("decodes Chinese ss node names from legacy and SIP002 links", () => {
    const legacy = `ss://${toBase64Url("aes-256-gcm:secret@ss.example.com:8388")}#${encodeURIComponent("新加坡 SS")}`;
    const sip002 = `ss://${toBase64Url("aes-256-gcm:secret")}@ss2.example.com:8388#${encodeURIComponent("东京 SS")}`;
    const nodes = parseNodes(`${legacy}\n${sip002}`);
    expect(nodes.map((node) => node.name)).toEqual(["新加坡 SS", "东京 SS"]);
    expect(nodes[0]).toMatchObject({ server: "ss.example.com", port: 8388, cipher: "aes-256-gcm", password: "secret" });
  });

  it("renders a local source with base64 content", async () => {
    const output = await buildSubscription({
      source: {
        id: "b64-local",
        name: "B64 Local",
        type: "local",
        url: "",
        content: wrap(toBase64(chineseLines.join("\n")), 64, "\n"),
      },
      sources: [],
      requestUrl: new URL("https://example.com/download/source/b64-local/json"),
      target: "json",
    });
    const payload = JSON.parse(output) as { proxies: Node[] };
    expect(payload.proxies.map((proxy) => proxy.name)).toEqual(chineseNames);
  });

  it("still fetches the URL of a remote source that carries leftover content", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("trojan://password@remote.example.com:443#Remote%20Fresh"),
    );
    const output = await buildSubscription({
      source: {
        id: "leftover",
        name: "Leftover",
        type: "remote",
        url: "https://leftover.example/sub",
        content: "trojan://password@stale.example.com:443#Stale%20Local",
      },
      sources: [],
      requestUrl: new URL("https://example.com/download/source/leftover/json"),
      target: "json",
      settings: { remoteCacheTtl: 0 },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe("https://leftover.example/sub");
    expect(output).toContain("Remote Fresh");
    expect(output).not.toContain("Stale Local");
  });
});

describe("URI parsers", () => {
  it("parses vless transports and security", () => {
    const base = `vless://${UUID}@v.example.com:443`;
    const [ws, grpc, h2, upgrade, reality] = parseNodes([
      `${base}?type=ws&path=%2Fws%3Fed%3D2048&host=cdn.example.com&security=tls&sni=v.example.com#ws`,
      `${base}?type=grpc&serviceName=my-svc&security=tls&sni=v.example.com#grpc`,
      `${base}?type=h2&path=%2Fh2&host=a.example.com,b.example.com&security=tls#h2`,
      `${base}?type=httpupgrade&path=%2Fup&host=up.example.com&security=tls#upgrade`,
      `${base}?security=reality&pbk=PUBKEY&sid=abcd1234&fp=firefox&sni=www.example.com&flow=xtls-rprx-vision#reality`,
    ].join("\n"));

    expect(ws).toMatchObject({
      network: "ws",
      tls: true,
      servername: "v.example.com",
      "ws-opts": { path: "/ws?ed=2048", headers: { Host: "cdn.example.com" } },
    });
    expect((ws["ws-opts"] as Node)["v2ray-http-upgrade"]).toBeUndefined();

    expect(grpc).toMatchObject({ network: "grpc", "grpc-opts": { "grpc-service-name": "my-svc" } });
    expect(h2).toMatchObject({ network: "h2", "h2-opts": { path: "/h2", host: ["a.example.com", "b.example.com"] } });
    expect(upgrade).toMatchObject({
      network: "ws",
      "ws-opts": { path: "/up", headers: { Host: "up.example.com" }, "v2ray-http-upgrade": true },
    });
    expect(reality).toMatchObject({
      tls: true,
      flow: "xtls-rprx-vision",
      servername: "www.example.com",
      "client-fingerprint": "firefox",
      "reality-opts": { "public-key": "PUBKEY", "short-id": "abcd1234" },
    });
  });

  it("derives vless tls from hints when security is missing", () => {
    const base = `vless://${UUID}@v.example.com:443`;
    const [plain, withSni, withFp, explicitNone, explicitTls] = parseNodes([
      `${base}?type=tcp#plain`,
      `${base}?sni=v.example.com#sni`,
      `${base}?fp=chrome#fp`,
      `${base}?security=none&sni=v.example.com#none`,
      `${base}?security=tls#tls`,
    ].join("\n"));

    expect(plain.tls).toBe(false);
    expect("client-fingerprint" in plain).toBe(false);
    expect("reality-opts" in plain).toBe(false);
    expect(withSni.tls).toBe(true);
    expect(withSni["client-fingerprint"]).toBe("chrome");
    expect(withFp.tls).toBe(true);
    expect(explicitNone.tls).toBe(false);
    expect("client-fingerprint" in explicitNone).toBe(false);
    expect(explicitTls.tls).toBe(true);
  });

  it("parses trojan websocket and grpc transports", () => {
    const [ws, grpc, tcp] = parseNodes([
      "trojan://pw@t.example.com:443?type=ws&path=%2Ftrojan&host=cdn.example.com&sni=t.example.com#ws",
      "trojan://pw@t.example.com:443?type=grpc&serviceName=tg&sni=t.example.com#grpc",
      "trojan://pw@t.example.com:443?sni=t.example.com#tcp",
    ].join("\n"));
    expect(ws).toMatchObject({
      type: "trojan",
      password: "pw",
      network: "ws",
      "ws-opts": { path: "/trojan", headers: { Host: "cdn.example.com" } },
    });
    expect(grpc).toMatchObject({ network: "grpc", "grpc-opts": { "grpc-service-name": "tg" } });
    expect(tcp.network).toBeUndefined();
  });

  it("parses ss SIP002 plugins and passwords containing colons", () => {
    const userInfo = toBase64Url("aes-256-gcm:secret");
    const [obfs, v2ray, colon, plainUserInfo, legacyColon] = parseNodes([
      `ss://${userInfo}@ss.example.com:8388/?plugin=${encodeURIComponent("obfs-local;obfs=http;obfs-host=cdn.example.com")}#obfs`,
      `ss://${userInfo}@ss.example.com:8388/?plugin=${encodeURIComponent("v2ray-plugin;mode=websocket;tls;host=cdn.example.com;path=/ray")}#v2ray`,
      `ss://${toBase64Url("aes-256-gcm:pa:ss:word")}@ss.example.com:8388#colon`,
      "ss://aes-256-gcm:pa%3Ass%3Aword@ss.example.com:8388#plain",
      `ss://${toBase64Url("aes-256-gcm:pa:ss:word@ss.example.com:8388")}#legacy`,
    ].join("\n"));

    expect(obfs).toMatchObject({ plugin: "obfs", "plugin-opts": { mode: "http", host: "cdn.example.com" } });
    expect(v2ray).toMatchObject({
      plugin: "v2ray-plugin",
      "plugin-opts": { mode: "websocket", tls: true, host: "cdn.example.com", path: "/ray" },
    });
    for (const node of [colon, plainUserInfo, legacyColon]) {
      expect(node).toMatchObject({ cipher: "aes-256-gcm", password: "pa:ss:word", server: "ss.example.com", port: 8388 });
    }
  });

  it("strips brackets from IPv6 servers when parsing and restores them in URI output", async () => {
    const lines = [
      `vless://${UUID}@[2001:db8::1]:443?security=tls&sni=v6.example.com#v6-vless`,
      "trojan://pw@[2001:db8::2]:443?sni=v6.example.com#v6-trojan",
      `ss://${toBase64Url("aes-256-gcm:secret")}@[2001:db8::3]:8388#v6-ss`,
      "hysteria2://pw@[2001:db8::4]:443?sni=v6.example.com#v6-hy2",
    ];
    const nodes = parseNodes(lines.join("\n"));
    expect(nodes.map((node) => node.server)).toEqual(["2001:db8::1", "2001:db8::2", "2001:db8::3", "2001:db8::4"]);

    const uri = (await convertSubscriptionContent({ content: lines.join("\n"), target: "uri" })).content;
    for (const host of ["[2001:db8::1]:443", "[2001:db8::2]:443", "[2001:db8::3]:8388", "[2001:db8::4]:443"]) {
      expect(uri).toContain(`@${host}`);
    }
    expect(parseNodes(uri)).toEqual(nodes);
  });

  it("parses hysteria2 port hopping and userinfo", () => {
    const [mport, hostForm, mportList, userPass, plain] = parseNodes([
      "hysteria2://pw@h.example.com:443?mport=20000-30000&sni=h.example.com#mport",
      "hysteria2://pw@h.example.com:443,20000-30000?sni=h.example.com#hostform",
      "hy2://pw@h.example.com:443?mport=20000-30000;40000-50000#list",
      "hysteria2://user:pass@h.example.com:443?sni=h.example.com#userpass",
      "hysteria2://pw@h.example.com:8443?sni=h.example.com#plain",
    ].join("\n"));

    expect(mport).toMatchObject({ port: 443, ports: "20000-30000", password: "pw" });
    expect(hostForm).toMatchObject({ server: "h.example.com", port: 443, ports: "443,20000-30000", password: "pw" });
    expect(mportList.ports).toBe("20000-30000,40000-50000");
    expect(userPass).toMatchObject({ password: "user:pass", port: 443 });
    expect(userPass.ports).toBeUndefined();
    expect(plain).toMatchObject({ port: 8443 });
    expect(plain.ports).toBeUndefined();
  });

  it("round-trips nodes through the uri target", async () => {
    const lines = [
      `vless://${UUID}@v.example.com:443?type=ws&path=%2Fws&host=cdn.example.com&security=tls&sni=v.example.com&alpn=h2,http/1.1#rt-ws`,
      `vless://${UUID}@v.example.com:443?type=grpc&serviceName=my-svc&security=tls&sni=v.example.com#rt-grpc`,
      `vless://${UUID}@v.example.com:443?type=httpupgrade&path=%2Fup&host=up.example.com&security=tls#rt-upgrade`,
      `vless://${UUID}@v.example.com:443?security=reality&pbk=PUBKEY&sid=abcd1234&fp=firefox&sni=www.example.com&flow=xtls-rprx-vision#rt-reality`,
      `vless://${UUID}@v.example.com:443?type=tcp#rt-plain`,
      `ss://${toBase64Url("aes-256-gcm:pa:ss")}@ss.example.com:8388/?plugin=${encodeURIComponent("obfs-local;obfs=http;obfs-host=cdn.example.com")}#rt-obfs`,
      `ss://${toBase64Url("aes-256-gcm:secret")}@ss.example.com:8388/?plugin=${encodeURIComponent("v2ray-plugin;mode=websocket;tls;host=cdn.example.com;path=/ray")}#rt-v2ray`,
      "trojan://pw@t.example.com:443?type=ws&path=%2Ft&host=cdn.example.com&sni=t.example.com#rt-trojan",
      "hysteria2://user:pass@h.example.com:443?mport=20000-30000&sni=h.example.com#rt-hy2",
    ];
    const original = parseNodes(lines.join("\n"));
    expect(original).toHaveLength(lines.length);

    const converted = await convertSubscriptionContent({ content: lines.join("\n"), target: "uri" });
    expect(converted.emitted).toBe(lines.length);
    expect(parseNodes(converted.content)).toEqual(original);
  });
});

describe("target renderers", () => {
  const content = [
    `vless://${UUID}@v.example.com:443?type=ws&path=%2Fws&host=cdn.example.com&security=tls&sni=v.example.com#vless-ws`,
    `vless://${UUID}@v.example.com:443?type=grpc&serviceName=my-svc&security=tls&sni=v.example.com#vless-grpc`,
    `vless://${UUID}@v.example.com:443?type=httpupgrade&path=%2Fup&host=up.example.com&security=tls&sni=v.example.com#vless-upgrade`,
    `vless://${UUID}@v.example.com:443?type=h2&path=%2Fh2&host=h2.example.com&security=tls&sni=v.example.com#vless-h2`,
    `vless://${UUID}@v.example.com:443?security=reality&pbk=PUBKEY&sid=abcd1234&fp=firefox&sni=www.example.com#vless-reality`,
    "trojan://pw@t.example.com:443?type=ws&path=%2Ft&host=cdn.example.com&sni=t.example.com#trojan-ws",
    "hysteria2://pw@h.example.com:443?mport=20000-30000&sni=h.example.com#hy2-range",
    "hysteria2://pw@h.example.com:443,20000-30000?sni=h.example.com#hy2-hostform",
    "hysteria2://pw@h.example.com:443?mport=443&sni=h.example.com#hy2-single",
    "hysteria2://pw@h.example.com:8443?sni=h.example.com#hy2-plain",
  ].join("\n");

  it("emits sing-box transports, a sniff route action and no block outbound", async () => {
    const result = await convertSubscriptionContent({ content, target: "sing-box" });
    const config = JSON.parse(result.content) as {
      inbounds: Node[];
      outbounds: Node[];
      route: { rules: Node[] };
    };
    const outbound = (tag: string) => {
      const found = config.outbounds.find((item) => item.tag === tag);
      if (!found) throw new Error(`Missing outbound ${tag}`);
      return found;
    };

    expect(config.outbounds.some((item) => item.network === "ws" || item.network === "grpc" || item.network === "h2")).toBe(false);
    expect(outbound("vless-ws").transport).toEqual({ type: "ws", path: "/ws", headers: { Host: "cdn.example.com" } });
    expect(outbound("vless-grpc").transport).toEqual({ type: "grpc", service_name: "my-svc" });
    expect(outbound("vless-upgrade").transport).toEqual({ type: "httpupgrade", path: "/up", host: "up.example.com" });
    expect(outbound("vless-h2").transport).toEqual({ type: "http", path: "/h2", host: ["h2.example.com"] });
    expect(outbound("trojan-ws").transport).toEqual({ type: "ws", path: "/t", headers: { Host: "cdn.example.com" } });
    expect(outbound("vless-reality").tls).toMatchObject({
      enabled: true,
      server_name: "www.example.com",
      utls: { enabled: true, fingerprint: "firefox" },
      reality: { enabled: true, public_key: "PUBKEY", short_id: "abcd1234" },
    });

    for (const inbound of config.inbounds) expect("sniff" in inbound).toBe(false);
    expect(config.route.rules[0]).toEqual({ action: "sniff" });
    expect(config.outbounds.some((item) => item.type === "block")).toBe(false);
    expect(result.content).not.toContain('"block"');
  });

  it("emits sing-box server_ports for port hopping and server_port otherwise", async () => {
    const result = await convertSubscriptionContent({ content, target: "sing-box" });
    const outbounds = (JSON.parse(result.content) as { outbounds: Node[] }).outbounds;
    const byTag = (tag: string) => outbounds.find((item) => item.tag === tag) as Node;

    expect(byTag("hy2-range").server_ports).toEqual(["20000:30000"]);
    expect("server_port" in byTag("hy2-range")).toBe(false);
    expect(byTag("hy2-hostform").server_ports).toEqual(["443:443", "20000:30000"]);
    expect("server_port" in byTag("hy2-hostform")).toBe(false);
    expect(byTag("hy2-single").server_ports).toEqual(["443:443"]);
    expect("server_port" in byTag("hy2-single")).toBe(false);
    expect(byTag("hy2-plain").server_port).toBe(8443);
    expect("server_ports" in byTag("hy2-plain")).toBe(false);
  });

  it("emits mihomo transport options", async () => {
    const result = await convertSubscriptionContent({ content, target: "mihomo" });
    const document = parseYaml(result.content) as { proxies: Node[] };
    const proxy = (name: string) => document.proxies.find((item) => item.name === name) as Node;

    expect(proxy("vless-ws")).toMatchObject({ network: "ws", "ws-opts": { path: "/ws", headers: { Host: "cdn.example.com" } } });
    expect(proxy("vless-grpc")).toMatchObject({ network: "grpc", "grpc-opts": { "grpc-service-name": "my-svc" } });
    expect(proxy("vless-upgrade")).toMatchObject({ network: "ws", "ws-opts": { path: "/up", "v2ray-http-upgrade": true } });
    expect(proxy("vless-h2")).toMatchObject({ network: "h2", "h2-opts": { path: "/h2", host: ["h2.example.com"] } });
    expect(proxy("vless-reality")["reality-opts"]).toMatchObject({ "public-key": "PUBKEY", "short-id": "abcd1234" });
    expect(proxy("trojan-ws")).toMatchObject({ network: "ws", "ws-opts": { path: "/t" } });
    expect(proxy("hy2-range").ports).toBe("20000-30000");
  });
});

describe("response metadata and naming", () => {
  afterEach(() => vi.restoreAllMocks());

  async function localMetadata(meta: Record<string, unknown>) {
    const result = await buildSubscriptionResult({
      source: {
        id: "meta-local",
        name: "Meta Local",
        type: "local",
        url: "",
        content: "trojan://password@example.com:443#Meta%20Node",
        meta,
      },
      sources: [],
      requestUrl: new URL("https://example.com/download/source/meta-local/json"),
      target: "json",
    });
    return result.metadata;
  }

  it("turns a Chinese filename into an ASCII fallback plus filename*", async () => {
    const extended = await localMetadata({ contentDisposition: "attachment; filename*=UTF-8''%E8%AE%A2%E9%98%85.yaml" });
    expect(extended.contentDisposition).toBe("attachment; filename=\"__.yaml\"; filename*=UTF-8''%E8%AE%A2%E9%98%85.yaml");

    const quoted = await localMetadata({ contentDisposition: 'attachment; filename="订阅 配置.yaml"' });
    expect(quoted.contentDisposition).toMatch(/^attachment; filename="[\x20-\x7e]+"; filename\*=UTF-8''/);
    expect(quoted.contentDisposition).toContain(`filename*=UTF-8''${encodeURIComponent("订阅 配置.yaml")}`);
    expect(await localMetadata({ contentDisposition: "attachment" })).toMatchObject({ contentDisposition: undefined });
  });

  it("drops response header values that are not valid ByteStrings instead of throwing", async () => {
    const metadata = await localMetadata({
      subUserinfo: "upload=1; download=2; total=10; plan=套餐",
      profileWebPageUrl: "https://example.com/订阅",
      profileUpdateInterval: "12",
    });
    expect(metadata.subscriptionUserinfo).toBeUndefined();
    expect(metadata.profileWebPageUrl).toBeUndefined();
    expect(metadata.profileUpdateInterval).toBe("12");
  });

  it("keeps upstream headers with a Chinese filename usable", async () => {
    const headers = new Headers({
      "content-disposition": "attachment; filename*=UTF-8''%E8%AE%A2%E9%98%85.yaml",
      "subscription-userinfo": "upload=1; download=2; total=10",
    });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("trojan://password@example.com:443#Upstream", { headers }));
    const result = await buildSubscriptionResult({
      source: { id: "cd-remote", name: "CD Remote", type: "remote", url: "https://cd-remote.example/sub", content: "" },
      sources: [],
      requestUrl: new URL("https://example.com/download/source/cd-remote/json"),
      target: "json",
      settings: { remoteCacheTtl: 0 },
    });
    expect(result.metadata.contentDisposition).toContain("filename*=UTF-8''%E8%AE%A2%E9%98%85.yaml");
    expect(result.metadata.contentDisposition).toMatch(/^attachment; filename="[\x20-\x7e]+";/);
    expect(result.metadata.subscriptionUserinfo).toBe("upload=1; download=2; total=10");
  });

  it("makes duplicate names unique without colliding with existing suffixed names", async () => {
    const result = await convertSubscriptionContent({
      content: [
        "trojan://password@a1.example.com:443#A",
        "trojan://password@a2.example.com:443#A",
        "trojan://password@a3.example.com:443#A-2",
      ].join("\n"),
      target: "json",
    });
    const names = (JSON.parse(result.content) as { proxies: Node[] }).proxies.map((proxy) => String(proxy.name));
    expect(new Set(names).size).toBe(3);
    expect(names).toContain("A");
    expect(names).toContain("A-2");
    // The third node keeps its name and the second one is renumbered around it.
    expect(names[2]).toBe("A-2");
    expect(names[1]).not.toBe("A-2");
  });

  it("does not merge nodes in a dedupe filter when a port is 0 versus missing", async () => {
    const proxies = [
      { name: "zero", type: "trojan", server: "dedupe.example.com", port: 0, password: "pw" },
      { name: "missing", type: "trojan", server: "dedupe.example.com", password: "pw" },
      { name: "real", type: "trojan", server: "dedupe.example.com", port: 443, password: "pw" },
      { name: "real-copy", type: "trojan", server: "dedupe.example.com", port: 443, password: "pw" },
    ];
    const result = await convertSubscriptionContent({
      content: JSON.stringify({ proxies }),
      target: "json",
      filters: [{ type: "dedupe", fields: ["server", "port"] }],
    });
    const names = (JSON.parse(result.content) as { proxies: Node[] }).proxies.map((proxy) => proxy.name);
    expect(names).toEqual(["zero", "missing", "real"]);
  });
});

describe("resolve filter and subrequest budget", () => {
  afterEach(() => vi.restoreAllMocks());

  const DOH_PREFIX = "https://cloudflare-dns.com/dns-query";

  function mockDoh(addresses: Record<string, string> = {}) {
    return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = new URL(requestUrl(input));
      const address = addresses[url.searchParams.get("name") || ""] || "203.0.113.7";
      return Response.json({ Answer: [{ type: 1, data: address }] });
    });
  }

  function dohCalls(fetchMock: ReturnType<typeof mockDoh>) {
    return fetchMock.mock.calls.filter(([input]) => requestUrl(input).startsWith(DOH_PREFIX));
  }

  it("resolves a hostname shared by many nodes with a single DoH request", async () => {
    const fetchMock = mockDoh();
    const content = Array.from({ length: 6 }, (_, index) =>
      `trojan://pw@${index % 2 === 0 ? "Shared.Example.com" : "shared.example.com"}:${443 + index}?sni=front.example.com#shared-${index}`,
    ).join("\n");
    const result = await convertSubscriptionContent({
      content,
      target: "json",
      filters: [{ type: "resolve", provider: "Cloudflare", recordType: "A", filter: "disabled" }],
    });
    expect(dohCalls(fetchMock)).toHaveLength(1);
    const proxies = (JSON.parse(result.content) as { proxies: Node[] }).proxies;
    expect(proxies).toHaveLength(6);
    expect(proxies.every((proxy) => proxy.server === "203.0.113.7")).toBe(true);
  });

  it("resolves each distinct hostname once", async () => {
    const fetchMock = mockDoh({ "a.example.com": "203.0.113.1", "b.example.com": "203.0.113.2" });
    const content = [
      "trojan://pw@a.example.com:443#a1",
      "trojan://pw@a.example.com:444#a2",
      "trojan://pw@b.example.com:443#b1",
      "trojan://pw@b.example.com:444#b2",
      "trojan://pw@198.51.100.9:443#ip",
    ].join("\n");
    const result = await convertSubscriptionContent({
      content,
      target: "json",
      filters: [{ type: "resolve", provider: "Cloudflare", recordType: "A", filter: "disabled" }],
    });
    expect(dohCalls(fetchMock)).toHaveLength(2);
    const servers = (JSON.parse(result.content) as { proxies: Node[] }).proxies.map((proxy) => proxy.server);
    expect(servers).toEqual(["203.0.113.1", "203.0.113.1", "203.0.113.2", "203.0.113.2", "198.51.100.9"]);
  });

  function budgetFixture(count: number) {
    const sources: SubscriptionSource[] = Array.from({ length: count }, (_, index) => ({
      id: `budget-${index}`,
      name: `budget-${index}`,
      type: "remote",
      url: `https://budget.example/${index}`,
      content: "",
      enabled: true,
    }));
    const collection: SubscriptionCollection = {
      id: "budget-collection",
      name: "Budget Collection",
      sourceIds: [],
      ignoreFailed: true,
      enabled: true,
    };
    const mockUpstream = () => vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const index = new URL(requestUrl(input)).pathname.slice(1);
      return new Response(`trojan://pw@h${index}.example.com:443#Budget%20${index}`);
    });
    const build = (settings: Record<string, unknown>, target: SubscriptionTarget = "json") => buildSubscriptionResult({
      collection,
      sources,
      requestUrl: new URL("https://example.com/download/collection/budget-collection/json"),
      target,
      settings,
    });
    return { build, mockUpstream };
  }

  it("fails loudly when the subrequest budget runs out even with ignoreFailed", async () => {
    const { build, mockUpstream } = budgetFixture(14);
    const fetchMock = mockUpstream();
    await expect(build({ subrequestLimit: 10, remoteCacheTtl: 0 })).rejects.toThrow("Subrequest budget exhausted (10)");
    expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(10);
  });

  it("applies no app-level subrequest cap without subrequestLimit", async () => {
    const { build, mockUpstream } = budgetFixture(14);
    const fetchMock = mockUpstream();
    const result = await build({ remoteCacheTtl: 0 });
    expect(fetchMock).toHaveBeenCalledTimes(14);
    expect(result.nodes).toBe(14);
  });

  it("still tolerates ordinary source failures with ignoreFailed", async () => {
    const { build } = budgetFixture(3);
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const index = new URL(requestUrl(input)).pathname.slice(1);
      if (index === "1") return new Response("nope", { status: 500 });
      return new Response(`trojan://pw@h${index}.example.com:443#Budget%20${index}`);
    });
    const result = await build({ subrequestLimit: 50, remoteCacheTtl: 0 });
    expect(result.nodes).toBe(2);
  });
});

describe("remote cache revalidation", () => {
  afterEach(() => vi.restoreAllMocks());

  const NODE = "trojan://password@cache.example.com:443#Cache%20Node";

  function options(url: string, settings: Record<string, unknown> = {}) {
    return {
      source: { id: "cache-source", name: "Cache Source", type: "remote" as const, url, content: "" },
      sources: [],
      requestUrl: new URL("https://example.com/download/source/cache-source/json"),
      target: "json" as const,
      settings: { remoteCacheTtl: 60, ...settings },
    };
  }

  function headerOf(call: Parameters<typeof fetch>, name: string) {
    return new Headers(call[1]?.headers).get(name);
  }

  it("revalidates an expired entry with If-None-Match and reuses it on 304", async () => {
    const url = "https://cache-304.example/sub";
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(NODE, { headers: { etag: '"v1"' } }))
      .mockResolvedValueOnce(new Response(null, { status: 304 }));

    const first = await buildSubscriptionResult(options(url));
    expect(first.metadata.cacheStatus).toBe("miss");

    const realNow = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(realNow + 120_000);
    const second = await buildSubscriptionResult(options(url));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(headerOf(fetchMock.mock.calls[1], "if-none-match")).toBe('"v1"');
    expect(second.metadata.cacheStatus).toBe("refresh");
    expect(second.body).toContain("Cache Node");

    // The 304 renews the entry, so the next request is a plain hit.
    const third = await buildSubscriptionResult(options(url));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(third.metadata.cacheStatus).toBe("hit");
  });

  it("serves the stale entry when the upstream fails after the TTL", async () => {
    const url = "https://cache-stale.example/sub";
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(NODE))
      .mockRejectedValueOnce(new TypeError("network down"))
      .mockResolvedValueOnce(new Response("server error", { status: 502 }));

    await buildSubscriptionResult(options(url));
    const realNow = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(realNow + 120_000);

    const networkFailure = await buildSubscriptionResult(options(url));
    expect(networkFailure.metadata.cacheStatus).toBe("stale");
    expect(networkFailure.body).toContain("Cache Node");

    const badStatus = await buildSubscriptionResult(options(url));
    expect(badStatus.metadata.cacheStatus).toBe("stale");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("does not serve stale content when remoteCacheStaleOnError is false", async () => {
    const url = "https://cache-nostale.example/sub";
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(NODE))
      .mockRejectedValueOnce(new TypeError("network down"));

    await buildSubscriptionResult(options(url, { remoteCacheStaleOnError: false }));
    const realNow = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(realNow + 120_000);
    await expect(buildSubscriptionResult(options(url, { remoteCacheStaleOnError: false }))).rejects.toThrow("network down");
  });

  it("replaces an expired entry with fresh upstream content on 200", async () => {
    const url = "https://cache-200.example/sub";
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(NODE, { headers: { etag: '"v1"' } }))
      .mockResolvedValueOnce(new Response("trojan://password@cache.example.com:443#Cache%20Updated", { headers: { etag: '"v2"' } }));

    await buildSubscriptionResult(options(url));
    const realNow = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(realNow + 120_000);
    const second = await buildSubscriptionResult(options(url));
    expect(second.metadata.cacheStatus).toBe("miss");
    expect(second.body).toContain("Cache Updated");
    expect(second.body).not.toContain("Cache Node");
  });
});

function parseNodes(raw: string): Node[] {
  return validateSubscriptionContent(raw).map(({ id: _id, ...node }) => node);
}

function requestUrl(input: Parameters<typeof fetch>[0]) {
  if (typeof input === "string") return input;
  return input instanceof URL ? input.toString() : input.url;
}

function toBase64(text: string) {
  let binary = "";
  for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function toBase64Url(text: string) {
  return toBase64(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function wrap(text: string, width: number, eol: string) {
  return (text.match(new RegExp(`.{1,${width}}`, "g")) || []).join(eol);
}
