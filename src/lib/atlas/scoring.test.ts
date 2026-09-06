import { describe, it, expect } from "vitest";
import { calculateFitScore } from "./scoring";
import { AtlasIcpProfile, AgencyFeedItem } from "./types";

const mockIcp: AtlasIcpProfile = {
  id: "icp-1",
  objective_id: "obj-1",
  user_id: "user-1",
  version: 1,
  title: "5-30 Person Digital Agencies US/UK",
  buyer_persona: { role: "Managing Director / Founder", seniority: "Executive" },
  target_geography: ["US", "UK"],
  employee_range_min: 5,
  employee_range_max: 30,
  industry_keywords: ["digital agency", "web agency", "design studio", "marketing agency"],
  pain_signals: ["delivery overhead", "retainer management chaos"],
  buying_signals: ["scaling operations", "tech stack adoption"],
  status: "approved",
  approved_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe("calculateFitScore", () => {
  it("scores a perfect matching agency at 100/100", () => {
    const perfectAgency: AgencyFeedItem = {
      organization_name: "Apex Digital Studio",
      domain: "apexdigital.co.uk",
      country: "UK",
      employee_count: 14,
      industry: "Digital Agency",
      source_url: "https://apexdigital.co.uk/about",
      pain_signal: "Struggling with delivery overhead",
      pain_source_url: "https://apexdigital.co.uk/careers",
      buying_signal: "Adopting modern tool stack",
      buying_source_url: "https://apexdigital.co.uk/blog",
      contact_name: "Marcus Vance",
      contact_title: "Managing Director",
      contact_email: "marcus@apexdigital.co.uk",
      contact_source_url: "https://apexdigital.co.uk/contact",
      contact_verification_tier: "email_domain_valid",
    };

    const result = calculateFitScore(perfectAgency, mockIcp);
    expect(result.fitScore).toBe(100);
    expect(result.isQualified).toBe(true);
    expect(result.scoreBreakdown.employeeFit.points).toBe(25);
    expect(result.scoreBreakdown.geoFit.points).toBe(15);
    expect(result.scoreBreakdown.industryFit.points).toBe(15);
    expect(result.scoreBreakdown.painSignal.points).toBe(20);
    expect(result.scoreBreakdown.buyingSignal.points).toBe(15);
    expect(result.scoreBreakdown.decisionMaker.points).toBe(10);
  });

  it("scores an agency without buying signal at 85/100 (still qualified)", () => {
    const agencyNoBuying: AgencyFeedItem = {
      organization_name: "Strata Growth Partners",
      domain: "stratagrowth.co.uk",
      country: "UK",
      employee_count: 18,
      industry: "Marketing Agency",
      source_url: "https://stratagrowth.co.uk",
      pain_signal: "Data ingestion bottlenecks",
      pain_source_url: "https://stratagrowth.co.uk/careers",
      buying_signal: null,
      buying_source_url: null,
      contact_name: "David Alcott",
      contact_title: "Managing Director",
      contact_email: "david@stratagrowth.co.uk",
      contact_source_url: "https://stratagrowth.co.uk/team",
      contact_verification_tier: "email_verified",
    };

    const result = calculateFitScore(agencyNoBuying, mockIcp);
    // 25 + 15 + 15 + 20 + 0 + 10 = 85
    expect(result.fitScore).toBe(85);
    expect(result.isQualified).toBe(true);
    expect(result.scoreBreakdown.buyingSignal.points).toBe(0);
  });

  it("disqualifies an out-of-scope enterprise company (280 employees, wrong industry)", () => {
    const enterpriseOrg: AgencyFeedItem = {
      organization_name: "Hyperion Enterprise Global",
      domain: "hyperionglobal.com",
      country: "US",
      employee_count: 280,
      industry: "IT Outsourcing",
      source_url: "https://hyperionglobal.com",
      pain_signal: null,
      pain_source_url: null,
      buying_signal: null,
      buying_source_url: null,
      contact_name: "Robert Sterling",
      contact_title: "VP Procurement",
      contact_email: "rsterling@hyperionglobal.com",
      contact_source_url: "https://hyperionglobal.com/leadership",
      contact_verification_tier: "email_domain_valid",
    };

    const result = calculateFitScore(enterpriseOrg, mockIcp);
    // 0 (emp) + 15 (US) + 0 (IT Outsourcing) + 0 (pain) + 0 (buying) + 10 (contact) = 25
    expect(result.fitScore).toBe(25);
    expect(result.isQualified).toBe(false);
  });
});
