import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const SUPPORTED_TARGETS = ["mihomo", "stash", "surge", "surge-mac", "surfboard", "loon", "egern", "shadowrocket", "qx", "sing-box", "v2ray", "uri", "json"];
const RETAINED_FRONTEND_ROUTES = new Set(["/", "/subs", "/tools", "/my", "/preview", "/edit/:editType(subs|collections)/:id", "/404", "/:pathMatch(.*)"]);

const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z", "cloudflare/src"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean)
  .filter((file) => existsSync(file));

const forbidden = [
  [/StoredSubscription/g, "old stored subscription type"],
  [/StoredCollection/g, "old stored collection type"],
  [/getStoredSubscriptions/g, "old stored subscription accessor"],
  [/getStoredCollection/g, "old stored collection accessor"],
  [/allSubs/g, "old aggregate subscription field"],
  [/magicPath/g, "old frontend backend path behavior"],
  [/SUB_STORE_FRONTEND_BACKEND_PATH/g, "old frontend backend path env"],
  [/\/api\/subs\b/g, "old subscriptions API route"],
  [/\/api\/sub\//g, "old single subscription API route"],
];

const findings = [];

for (const file of files) {
  const text = readFileSync(file, "utf8");
  const lines = text.split(/\r?\n/);
  for (const [index, line] of lines.entries()) {
    for (const [pattern, label] of forbidden) {
      pattern.lastIndex = 0;
      if (pattern.test(line)) {
        findings.push(`${file}:${index + 1}: ${label}: ${line.trim()}`);
      }
    }
  }
}

if (findings.length > 0) {
  console.error(findings.join("\n"));
  process.exit(1);
}

assertTargetCoverage();
assertFrontendRoutes();

console.log("Worker contract scan passed.");

function assertTargetCoverage() {
  const checks = [
    {
      file: "cloudflare/src/types.ts",
      label: "SubscriptionTarget union",
      matcher: (target) => new RegExp(`["']${escapeRegExp(target)}["']`).test(readFileSync("cloudflare/src/types.ts", "utf8")),
    },
    {
      file: "config/agent-setup.schema.json",
      label: "deployment downloadTargets schema",
      matcher: (target) => downloadTargetsSchema().includes(target),
    },
    {
      file: "scripts/validate-agent-setup.mjs",
      label: "deployment target validator",
      matcher: (target) => new RegExp(`["']${escapeRegExp(target)}["']`).test(readFileSync("scripts/validate-agent-setup.mjs", "utf8")),
    },
    {
      file: "frontend/src/constants/subscriptionTargets.ts",
      label: "preview platform list",
      matcher: (target) => new RegExp(`value:\\s*["']${escapeRegExp(target)}["']`).test(readFileSync("frontend/src/constants/subscriptionTargets.ts", "utf8")),
    },
  ];

  const targetFindings = [];
  for (const target of SUPPORTED_TARGETS) {
    for (const check of checks) {
      if (!check.matcher(target)) {
        targetFindings.push(`${check.file}: missing ${target} in ${check.label}`);
      }
    }
  }

  if (targetFindings.length > 0) {
    console.error(targetFindings.join("\n"));
    process.exit(1);
  }
}

function downloadTargetsSchema() {
  const schema = JSON.parse(readFileSync("config/agent-setup.schema.json", "utf8"));
  return schema?.properties?.deployment?.properties?.downloadTargets?.items?.enum || [];
}

function escapeRegExp(input) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function assertFrontendRoutes() {
  const routerPath = "frontend/src/router/index.ts";
  if (!existsSync(routerPath)) return;
  const text = readFileSync(routerPath, "utf8");
  const routePathPattern = /\bpath:\s*["']([^"']+)["']/g;
  const routes = [...text.matchAll(routePathPattern)].map((match) => match[1]);
  const routeFindings = routes
    .filter((route) => !RETAINED_FRONTEND_ROUTES.has(route))
    .map((route) => `${routerPath}: route ${route} is outside the retained product scope`);

  if (routeFindings.length > 0) {
    console.error(routeFindings.join("\n"));
    process.exit(1);
  }
}
