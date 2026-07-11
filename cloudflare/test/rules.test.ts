import { describe, expect, it } from "vitest";
import { convertRules, parseRules } from "../src/lib/rules";

describe("rule conversion", () => {
  it("normalizes common Surge, Mihomo, Loon, and Quantumult X rules", () => {
    const input = [
      "DOMAIN-SUFFIX,example.com,Proxy",
      "HOST,api.example.com,DIRECT",
      "IP-CIDR,1.1.1.0/24,Proxy,no-resolve",
      "FINAL,Proxy",
    ].join("\n");
    const parsed = parseRules(input);
    expect(parsed.rules).toHaveLength(4);

    const qx = convertRules(input, "qx");
    expect(qx.content).toContain("HOST-SUFFIX,example.com,Proxy");
    expect(qx.content).toContain("HOST,api.example.com,DIRECT");
    expect(qx.content).toContain("FINAL,Proxy");

    const mihomo = convertRules(input, "mihomo");
    expect(mihomo.content).toContain("MATCH,Proxy");
  });

  it("accepts provider payload YAML and reports unsupported lines", () => {
    const result = convertRules("payload:\n  - DOMAIN,example.com,DIRECT\n  - UNKNOWN,value", "surge");
    expect(result.emitted).toBe(1);
    expect(result.skipped).toBe(1);
  });
});
