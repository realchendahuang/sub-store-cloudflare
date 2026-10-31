import { SCRIPT_REGISTRY } from "../generated/script-registry";
import type { FilterRule, ProxyNode, SubscriptionTarget } from "../types";

export type ScriptKind = "filter" | "operator";
export type ScriptCompatibility = "free" | "personal";
export type ScriptParameter = {
  key: string;
  label: string;
  labelZh?: string;
  type: "string" | "number" | "boolean" | "string-list";
  required?: boolean;
  default?: unknown;
  placeholder?: string;
};
export type ScriptMetadata = {
  id: string;
  name: string;
  nameZh?: string;
  description: string;
  descriptionZh?: string;
  kind: ScriptKind;
  compatibility: ScriptCompatibility;
  parameters: ScriptParameter[];
};
export type ScriptRuntime = {
  arguments: Record<string, unknown>;
  options: Record<string, unknown>;
  targetPlatform: SubscriptionTarget;
  context: Record<string, unknown>;
  proxyUtils: typeof PROXY_UTILS;
  substore: { env: "Cloudflare" };
};
export type ScriptPlugin = {
  metadata: ScriptMetadata;
  run(proxies: ProxyNode[], runtime: ScriptRuntime): Promise<unknown>;
};

const MAX_SCRIPT_ACTIONS = 2;
const registry = new Map(SCRIPT_REGISTRY.map((script) => [script.metadata.id, script]));

export function listScriptMetadata() {
  return SCRIPT_REGISTRY.map((script) => script.metadata);
}

export function validateScriptActions(filters: FilterRule[]) {
  const scripts = filters.filter((filter) => filter.type === "script");
  if (scripts.length > MAX_SCRIPT_ACTIONS) return `At most ${MAX_SCRIPT_ACTIONS} script actions are allowed per source or collection`;
  for (const filter of scripts) {
    const scriptId = text(filter.scriptId);
    if (!scriptId) return "Script action requires scriptId";
    const script = registry.get(scriptId);
    if (!script) return `Unknown script: ${scriptId}`;
    if (filter.scriptKind && filter.scriptKind !== script.metadata.kind) return `Script ${scriptId} kind must be ${script.metadata.kind}`;
    const args = object(filter.arguments);
    for (const parameter of script.metadata.parameters) {
      const value = args[parameter.key] ?? parameter.default;
      if (parameter.required && (value === undefined || value === null || value === "")) {
        return `Script ${scriptId} requires argument: ${parameter.key}`;
      }
      if (value !== undefined && !matchesParameterType(value, parameter.type)) {
        return `Script ${scriptId} argument ${parameter.key} must be ${parameter.type}`;
      }
    }
  }
  return undefined;
}

export async function applyScriptAction(
  proxies: ProxyNode[],
  filter: FilterRule,
  targetPlatform: SubscriptionTarget,
  context: Record<string, unknown>,
) {
  const scriptId = text(filter.scriptId);
  const script = registry.get(scriptId);
  if (!script) throw new Error(`Script ${scriptId || "<missing>"} is not available in this deployment`);
  const input = proxies.map((proxy) => structuredClone(proxy));
  try {
    const output = await script.run(input, {
      arguments: withDefaults(object(filter.arguments), script.metadata.parameters),
      options: object(filter.options),
      targetPlatform,
      context: { ...context, scriptId },
      proxyUtils: PROXY_UTILS,
      substore: { env: "Cloudflare" },
    });
    if (script.metadata.kind === "filter") return applyFilterResult(proxies, output, scriptId);
    return validateOperatorResult(output, proxies.length, scriptId);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Script ${scriptId} failed: ${message}`);
  }
}

export function isIPv4(value: unknown) {
  const parts = String(value || "").split(".");
  return parts.length === 4 && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);
}

export function isIPv6(value: unknown) {
  return String(value || "").includes(":") && /^[0-9a-f:]+$/i.test(String(value || ""));
}

const PROXY_UTILS = Object.freeze({
  isIPv4,
  isIPv6,
  isIP(value: unknown) {
    return isIPv4(value) || isIPv6(value);
  },
  removeFlag(value: unknown) {
    return String(value || "").replace(/[\u{1F1E6}-\u{1F1FF}]{2}/gu, "").trim();
  },
  Base64: Object.freeze({
    encode(value: unknown) {
      const bytes = new TextEncoder().encode(String(value ?? ""));
      let binary = "";
      for (const byte of bytes) binary += String.fromCharCode(byte);
      return btoa(binary);
    },
    decode(value: unknown) {
      const binary = atob(String(value ?? ""));
      const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
      return new TextDecoder().decode(bytes);
    },
  }),
});

function applyFilterResult(proxies: ProxyNode[], output: unknown, scriptId: string) {
  if (!Array.isArray(output) || output.length !== proxies.length || output.some((value) => typeof value !== "boolean")) {
    throw new Error(`Script ${scriptId} filter must return one boolean per input node`);
  }
  return proxies.filter((_, index) => output[index]);
}

function validateOperatorResult(output: unknown, inputLength: number, scriptId: string) {
  if (!Array.isArray(output)) throw new Error(`Script ${scriptId} operator must return a node array`);
  if (output.length > inputLength) throw new Error(`Script ${scriptId} cannot increase the node count`);
  if (output.some((item) => !item || typeof item !== "object" || Array.isArray(item) || !text((item as Record<string, unknown>).name) || !text((item as Record<string, unknown>).type))) {
    throw new Error(`Script ${scriptId} returned an invalid node`);
  }
  return output as ProxyNode[];
}

function withDefaults(input: Record<string, unknown>, parameters: ScriptParameter[]) {
  return Object.fromEntries(parameters.map((parameter) => [parameter.key, input[parameter.key] ?? parameter.default]).filter(([, value]) => value !== undefined));
}

function matchesParameterType(value: unknown, type: ScriptParameter["type"]) {
  if (type === "string") return typeof value === "string";
  if (type === "number") return typeof value === "number" && Number.isFinite(value);
  if (type === "boolean") return typeof value === "boolean";
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
