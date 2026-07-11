export type RuleTarget = "mihomo" | "surge" | "loon" | "qx";

type RuleKind =
  | "DOMAIN"
  | "DOMAIN-SUFFIX"
  | "DOMAIN-KEYWORD"
  | "IP-CIDR"
  | "IP-CIDR6"
  | "GEOIP"
  | "GEOSITE"
  | "PROCESS-NAME"
  | "DST-PORT"
  | "MATCH";

export type NormalizedRule = {
  kind: RuleKind;
  value?: string;
  policy?: string;
  options: string[];
};

const KIND_ALIASES: Record<string, RuleKind> = {
  HOST: "DOMAIN",
  DOMAIN: "DOMAIN",
  "HOST-SUFFIX": "DOMAIN-SUFFIX",
  "DOMAIN-SUFFIX": "DOMAIN-SUFFIX",
  "HOST-KEYWORD": "DOMAIN-KEYWORD",
  "DOMAIN-KEYWORD": "DOMAIN-KEYWORD",
  IP6CIDR: "IP-CIDR6",
  "IP-CIDR6": "IP-CIDR6",
  IPCIDR: "IP-CIDR",
  "IP-CIDR": "IP-CIDR",
  GEOIP: "GEOIP",
  GEOSITE: "GEOSITE",
  "PROCESS-NAME": "PROCESS-NAME",
  PROCESS: "PROCESS-NAME",
  "DEST-PORT": "DST-PORT",
  "DST-PORT": "DST-PORT",
  FINAL: "MATCH",
  MATCH: "MATCH",
};

export function convertRules(content: string, target: RuleTarget) {
  const parsed = parseRules(content);
  const lines = parsed.rules.map((rule) => produceRule(rule, target)).filter(Boolean) as string[];
  return {
    content: lines.join("\n"),
    parsed: parsed.rules.length,
    emitted: lines.length,
    skipped: parsed.skipped,
    warnings: parsed.warnings.slice(0, 20),
  };
}

export function parseRules(content: string) {
  const extracted = extractRuleLines(content);
  const rules: NormalizedRule[] = [];
  const warnings: string[] = [];
  let skipped = 0;
  extracted.forEach((line, index) => {
    const parsed = parseRuleLine(line);
    if (parsed) rules.push(parsed);
    else {
      skipped += 1;
      if (warnings.length < 20) warnings.push(`Line ${index + 1} is not a supported rule`);
    }
  });
  return { rules, skipped, warnings };
}

function extractRuleLines(content: string) {
  const text = content.trim();
  if (!text) return [];
  if (/^(payload|rules)\s*:/m.test(text)) {
    return text
      .split(/\r?\n/)
      .slice(1)
      .map((line) => line.replace(/^\s*-\s*/, "").trim())
      .filter((line) => line && !line.startsWith("#"));
  }
  return text
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^['"]|['"]$/g, ""))
    .filter((line) => line && !line.startsWith("#") && !line.startsWith(";"));
}

function parseRuleLine(line: string): NormalizedRule | undefined {
  const fields = splitCsv(line);
  if (fields.length === 0) return undefined;
  const kind = KIND_ALIASES[fields[0].toUpperCase()];
  if (!kind) return undefined;
  if (kind === "MATCH") {
    return {
      kind,
      policy: fields[1] || undefined,
      options: fields.slice(2).filter(Boolean),
    };
  }
  const value = fields[1]?.trim();
  if (!value) return undefined;
  const trailing = fields.slice(2).filter(Boolean);
  const policy = trailing.find((field) => !isRuleOption(field));
  return {
    kind,
    value,
    policy,
    options: trailing.filter((field) => field !== policy),
  };
}

function produceRule(rule: NormalizedRule, target: RuleTarget) {
  const kind = target === "qx" ? qxKind(rule.kind) : rule.kind;
  const fields = rule.kind === "MATCH"
    ? [target === "qx" ? "FINAL" : kind, rule.policy]
    : [kind, rule.value, rule.policy];
  const options = rule.options.filter((option) => {
    if (target === "qx") return option.toLowerCase() === "no-resolve";
    return true;
  });
  return [...fields.filter(Boolean), ...options].join(",");
}

function qxKind(kind: RuleKind) {
  const aliases: Partial<Record<RuleKind, string>> = {
    DOMAIN: "HOST",
    "DOMAIN-SUFFIX": "HOST-SUFFIX",
    "DOMAIN-KEYWORD": "HOST-KEYWORD",
    "IP-CIDR": "IP-CIDR",
    "IP-CIDR6": "IP6-CIDR",
    "PROCESS-NAME": "PROCESS-NAME",
    "DST-PORT": "DEST-PORT",
    MATCH: "FINAL",
  };
  return aliases[kind] || kind;
}

function isRuleOption(value: string) {
  return ["no-resolve", "extended-matching", "pre-matching"].includes(value.toLowerCase());
}

function splitCsv(line: string) {
  const output: string[] = [];
  let current = "";
  let quote = "";
  for (const char of line) {
    if ((char === "\"" || char === "'") && (!quote || quote === char)) {
      quote = quote ? "" : char;
      continue;
    }
    if (char === "," && !quote) {
      output.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  output.push(current.trim());
  return output;
}
