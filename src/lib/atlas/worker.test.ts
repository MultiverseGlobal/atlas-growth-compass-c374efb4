import { describe, it, expect, beforeEach } from "vitest";
import { normalizeDomain, executeAcquisitionRun } from "./worker";
import { memoryStore } from "./api";
import { AtlasIcpProfile } from "./types";

describe("Worker & Normalization", () => {
  beforeEach(() => {
    memoryStore.opportunities.clear();
    memoryStore.evidence.clear();
    memoryStore.contacts.clear();
    memoryStore.runs.clear();
    memoryStore.icpProfiles.clear();
  });

  it("normalizes domains cleanly by removing protocol, path, and www", () => {
    expect(normalizeDomain("https://www.apexdigital.co.uk/about")).toBe("apexdigital.co.uk");
    expect(normalizeDomain("http://kiteandanchor.com?ref=google")).toBe("kiteandanchor.com");
    expect(normalizeDomain("WWW.FORMABRANDLABS.COM")).toBe("formabrandlabs.com");
  });

  it("processes controlled agency feed and qualifies matching agencies while disqualifying out-of-scope enterprise", async () => {
    const mockIcp: AtlasIcpProfile = {
      id: "icp-test-1",
      objective_id: "obj-test-1",
      user_id: "user-test-1",
      version: 1,
      title: "5-30 Person Agencies US/UK",
      buyer_persona: { role: "Managing Director", seniority: "Executive" },
      target_geography: ["US", "UK"],
      employee_range_min: 5,
      employee_range_max: 30,
      industry_keywords: ["digital agency", "web agency", "design studio", "marketing agency"],
      pain_signals: ["delivery overhead"],
      buying_signals: ["modern stack"],
      status: "approved",
      approved_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    memoryStore.icpProfiles.set(mockIcp.id, mockIcp);

    const run = await executeAcquisitionRun(mockIcp.id);

    expect(run.status).toBe("completed");
    expect(run.items_discovered).toBe(5);
    // 4 agencies meet criteria (5-30 employees, US/UK, agency), 1 enterprise (Hyperion 280 emp) disqualified
    expect(run.items_qualified).toBe(4);

    // Verify opportunities created
    expect(memoryStore.opportunities.size).toBe(5);

    // Verify Apex Digital Studio is qualified
    let apexOpp = null;
    for (const opp of memoryStore.opportunities.values()) {
      if (opp.primary_domain === "apexdigital.co.uk") {
        apexOpp = opp;
      }
    }
    expect(apexOpp).toBeDefined();
    expect(apexOpp?.pipeline_stage).toBe("qualified");
    expect(apexOpp?.fit_score).toBeGreaterThanOrEqual(80);

    // Verify Hyperion is disqualified
    let hyperionOpp = null;
    for (const opp of memoryStore.opportunities.values()) {
      if (opp.primary_domain === "hyperionglobal.com") {
        hyperionOpp = opp;
      }
    }
    expect(hyperionOpp).toBeDefined();
    expect(hyperionOpp?.pipeline_stage).toBe("disqualified");
    expect(hyperionOpp?.fit_score).toBeLessThan(60);

    // Verify immutable evidence attached to Apex
    const apexEvidence = memoryStore.evidence.get(apexOpp!.id);
    expect(apexEvidence).toBeDefined();
    expect(apexEvidence!.length).toBeGreaterThanOrEqual(3);

    // Verify contact attached to Apex with provenance tier
    const apexContacts = memoryStore.contacts.get(apexOpp!.id);
    expect(apexContacts).toBeDefined();
    expect(apexContacts![0].full_name).toBe("Marcus Vance");
    expect(apexContacts![0].verification_tier).toBe("email_domain_valid");
  });
});
