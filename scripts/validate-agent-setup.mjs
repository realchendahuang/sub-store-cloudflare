import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const [inputArg = "config/agent-setup.local.json"] = process.argv.slice(2).filter((arg) => arg !== "--");
const inputPath = resolve(inputArg);
const config = JSON.parse(readFileSync(inputPath, "utf8"));
const rulePresets = JSON.parse(readFileSync(resolve("config/rule-presets.json"), "utf8"));

const BUILTIN_TEMPLATE_IDS = new Set([
  "mihomo-basic",
  "acl4ssr-mihomo",
  "acl4ssr-mihomo-no-emoji",
  "loyalsoldier-whitelist",
  "loyalsoldier-blacklist",
  "ai-streaming-mihomo",
]);
const SUPPORTED_TARGETS = new Set(["mihomo", "stash", "surge", "surge-mac", "surfboard", "loon", "egern", "shadowrocket", "qx", "sing-box", "v2ray", "uri", "json"]);

const errors = [];
const warnings = [];

const sources = array(config.sources);
const collections = array(config.collections);
const templates = array(config.templates);
const filterPresetIds = new Set(array(rulePresets.filters).map((preset) => stringValue(preset.id)).filter(Boolean));

const sourceIds = new Set();
const templateIds = new Set(BUILTIN_TEMPLATE_IDS);

validateDeployment(config.deployment);
validateAccess(config.access);

for (const source of sources) {
  const id = idValue(source.id || source.name);
  if (!id) {
    errors.push("sources[].id is required");
    continue;
  }
  if (sourceIds.has(id)) errors.push(`duplicate source id: ${id}`);
  sourceIds.add(id);

  const type = source.type === "local" ? "local" : "remote";
  if (type === "remote" && !stringValue(source.url)) errors.push(`sources.${id}.url is required for remote sources`);
  if (type === "local" && !stringValue(source.content)) errors.push(`sources.${id}.content is required for local sources`);
  validateFilterPresetIds(source.filterPresetIds, `sources.${id}.filterPresetIds`);
  validateFilters(source.filters, `sources.${id}.filters`);
}

for (const template of templates) {
  const id = idValue(template.id || template.name);
  if (!id) {
    errors.push("templates[].id is required");
    continue;
  }
  if (BUILTIN_TEMPLATE_IDS.has(id)) warnings.push(`templates.${id} overrides a built-in template`);
  templateIds.add(id);
  if (!object(template.config)) errors.push(`templates.${id}.config must be an object`);
}

for (const collection of collections) {
  const id = idValue(collection.id || collection.name);
  if (!id) {
    errors.push("collections[].id is required");
    continue;
  }

  const ids = array(collection.sourceIds).map(String);
  if (ids.length === 0) warnings.push(`collections.${id}.sourceIds is empty; it will include all enabled sources at runtime only if left empty in Worker logic`);
  for (const sourceId of ids) {
    if (!sourceIds.has(sourceId)) errors.push(`collections.${id}.sourceIds references missing source: ${sourceId}`);
  }

  const templateId = stringValue(collection.templateId) || "acl4ssr-mihomo";
  if (!templateIds.has(templateId)) errors.push(`collections.${id}.templateId references missing template: ${templateId}`);
  validateFilterPresetIds(collection.filterPresetIds, `collections.${id}.filterPresetIds`);
  validateFilters(collection.filters, `collections.${id}.filters`);
}

const summary = {
  input: inputArg,
  sources: sources.length,
  collections: collections.length,
  customTemplates: templates.length,
  filterPresets: [...new Set([...sources, ...collections].flatMap((item) => array(item.filterPresetIds).map(String)))],
  sourceIds: [...sourceIds],
  collectionIds: collections.map((collection) => idValue(collection.id || collection.name)).filter(Boolean),
  errors,
  warnings,
};

console.log(JSON.stringify(summary, null, 2));

if (errors.length > 0) process.exit(1);

function validateDeployment(deployment) {
  if (deployment === undefined) return;
  if (!object(deployment)) {
    errors.push("deployment must be an object");
    return;
  }

  if (deployment.workerName !== undefined && !stringValue(deployment.workerName)) errors.push("deployment.workerName cannot be empty");
  if (deployment.d1DatabaseName !== undefined && !stringValue(deployment.d1DatabaseName)) errors.push("deployment.d1DatabaseName cannot be empty");
  for (const target of array(deployment.downloadTargets)) {
    if (!SUPPORTED_TARGETS.has(String(target))) {
      errors.push(`deployment.downloadTargets contains unsupported target: ${target}`);
    }
  }
}

function validateAccess(access) {
  if (access === undefined) return;
  if (!object(access)) {
    errors.push("access must be an object");
    return;
  }

  if (access.enabled !== true) return;
  const scope = stringValue(access.scope) || "account";
  if (!["account", "zone"].includes(scope)) errors.push("access.scope must be account or zone");
  if (scope === "account" && !stringValue(access.accountId)) errors.push("access.accountId is required when access.enabled is true");
  if (scope === "zone" && !stringValue(access.zoneId)) errors.push("access.zoneId is required when access.scope is zone");
  if (!stringValue(access.adminHostname)) errors.push("access.adminHostname is required when access.enabled is true");

  const emailRules = array(access.allowedEmails);
  const domainRules = array(access.allowedEmailDomains);
  if (emailRules.length === 0 && domainRules.length === 0) {
    errors.push("access.allowedEmails or access.allowedEmailDomains is required when access.enabled is true");
  }

  for (const email of emailRules) {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(email))) errors.push(`access.allowedEmails contains invalid email: ${email}`);
  }
  for (const domain of domainRules) {
    const value = String(domain);
    if (!value || value.includes("@") || /\s/.test(value)) errors.push(`access.allowedEmailDomains contains invalid domain: ${domain}`);
  }
}

function validateFilterPresetIds(presetIds, label) {
  for (const presetId of array(presetIds).map(String)) {
    if (!filterPresetIds.has(presetId)) errors.push(`${label} references missing preset: ${presetId}`);
  }
}

function validateFilters(filters, label) {
  for (const [index, filter] of array(filters).entries()) {
    if (!object(filter)) {
      errors.push(`${label}[${index}] must be an object`);
      continue;
    }

    if (!["include", "exclude", "rename", "delete-field", "dedupe", "sort", "regex-sort", "flag", "quick"].includes(filter.type)) {
      errors.push(`${label}[${index}].type is unsupported: ${filter.type}`);
      continue;
    }

    if ((filter.type === "include" || filter.type === "exclude" || filter.type === "rename") && !stringValue(filter.pattern)) {
      errors.push(`${label}[${index}].pattern is required for ${filter.type}`);
    }
    if (filter.type === "delete-field" && !stringValue(filter.pattern) && array(filter.patterns).length === 0) {
      errors.push(`${label}[${index}] needs pattern or patterns for delete-field`);
    }
    if (filter.type === "dedupe" && array(filter.fields).length === 0 && !stringValue(filter.field)) {
      errors.push(`${label}[${index}] needs fields or field for dedupe`);
    }
    if (filter.type === "dedupe" && filter.action && !["delete", "rename"].includes(filter.action)) {
      errors.push(`${label}[${index}].action must be delete or rename`);
    }
    if (filter.type === "sort" && filter.direction && !["asc", "desc", "random"].includes(filter.direction)) {
      errors.push(`${label}[${index}].direction must be asc, desc or random`);
    }
    if (filter.type === "regex-sort" && array(filter.expressions).length === 0 && array(filter.patterns).length === 0 && !stringValue(filter.pattern)) {
      errors.push(`${label}[${index}] needs expressions, patterns or pattern for regex-sort`);
    }
    if (filter.type === "regex-sort" && filter.direction && !["asc", "desc", "original"].includes(filter.direction)) {
      errors.push(`${label}[${index}].direction must be asc, desc or original`);
    }
    if (filter.type === "flag" && filter.mode && !["add", "remove"].includes(filter.mode)) {
      errors.push(`${label}[${index}].mode must be add or remove`);
    }
  }
}

function stringValue(value) {
  if (typeof value === "string") return value.trim();
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function idValue(value) {
  return stringValue(value)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function object(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}
