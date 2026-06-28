import type { SubscriptionTarget } from "../types";

const TARGET_ALIASES: Record<string, SubscriptionTarget> = {
  clash: "mihomo",
  clashmeta: "mihomo",
  "clash-meta": "mihomo",
  meta: "mihomo",
  mihomo: "mihomo",
  stash: "stash",
  surge: "surge",
  "surge-mac": "surge-mac",
  surgemac: "surge-mac",
  surfboard: "surfboard",
  loon: "loon",
  egern: "egern",
  shadowrocket: "shadowrocket",
  sr: "shadowrocket",
  qx: "qx",
  quanx: "qx",
  quantumult: "qx",
  quantumultx: "qx",
  "quantumult-x": "qx",
  singbox: "sing-box",
  "sing-box": "sing-box",
  sfa: "sing-box",
  karing: "sing-box",
  v2ray: "v2ray",
  v2rayn: "v2ray",
  v2rayng: "v2ray",
  base64: "v2ray",
  uri: "uri",
  uris: "uri",
  plain: "uri",
  text: "uri",
  json: "json",
  raw: "json",
};

export function normalizeTarget(input: string | undefined, userAgent = ""): SubscriptionTarget {
  const value = String(input || "").toLowerCase();
  const ua = userAgent.toLowerCase();

  if (TARGET_ALIASES[value]) return TARGET_ALIASES[value];
  if (ua.includes("sing-box") || ua.includes("singbox")) return "sing-box";
  if (ua.includes("v2ray")) return "v2ray";
  if (ua.includes("surge")) return "surge";
  if (ua.includes("loon")) return "loon";
  if (ua.includes("egern")) return "egern";
  if (ua.includes("shadowrocket")) return "shadowrocket";
  if (ua.includes("quantumult")) return "qx";
  if (ua.includes("stash")) return "stash";
  return "mihomo";
}

export function normalizeTargetAlias(input: unknown): SubscriptionTarget | undefined {
  if (input === undefined || input === null || String(input) === "") return undefined;
  return TARGET_ALIASES[String(input).toLowerCase()];
}
