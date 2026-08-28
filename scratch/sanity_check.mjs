/**
 * sanity_check.mjs
 * Local simulation of the sourcing-machine's validateAndEvaluateLead function
 * so we can verify real output without a browser or live session.
 *
 * Test candidates:
 *   A) Wispr Flow  — known-bad: VC-funded, series A, 15 employees
 *   B) Jack Friks  — known-bad: ~3k Twitter followers (above 1000 threshold), some notoriety
 *   C) FeedCheck   — known-good: bootstrapped, small team, clear self-disclosed problem
 */

// Copied verbatim from the edge function (lines 295–399) — same logic, no mocking
function validateAndEvaluateLead(lead, sourceUrl) {
  const prospect = lead.founder_name || lead.prospect;
  const company  = lead.company_name || lead.company;
  const website  = lead.website || lead.company_url || sourceUrl;

  if (!prospect?.trim()) return { disqualified: true, reason: "Missing founder name" };
  if (!company?.trim())  return { disqualified: true, reason: "Missing company name" };
  if (!website?.trim() || !/^https?:\/\//i.test(website))
    return { disqualified: true, reason: "Missing or invalid working website/source URL" };

  const funding = (lead.funding_status || "").toLowerCase();
  if (
    (funding.includes("series a") || funding.includes("series b") || funding.includes("series c") ||
     funding.includes("vc-funded") || funding.includes("venture-funded") || funding.includes("funding round")) &&
    !funding.includes("pre-seed") && !funding.includes("pre seed") && !funding.includes("seed")
  ) {
    return { disqualified: true, reason: `Disqualified funding status: ${lead.funding_status} (VC-funded/Series A+)` };
  }

  const teamSize = lead.employee_count ?? 5;
  if (teamSize > 10) return { disqualified: true, reason: `Disqualified team size: ${teamSize} (> 10)` };

  const followers = lead.social_followers ?? 0;
  if (followers >= 1000) return { disqualified: true, reason: `Disqualified follower count: ${followers} (1000+ followers on socials)` };

  if (lead.has_major_press) return { disqualified: true, reason: "Disqualified due to prior major press coverage" };
  if (lead.ph_top_5)        return { disqualified: true, reason: "Disqualified due to Product Hunt top-5 daily feature history" };

  const thesis = lead.founder_thesis;
  if (!thesis?.trim()) return { disqualified: true, reason: "No self-disclosed dominant constraint/stated problem found" };

  const total = (lead.score_founder_active ?? 0) + (lead.score_buying_signal ?? 0) +
                (lead.score_icp_fit ?? 0) + (lead.score_reachable ?? 0) + (lead.score_atlas_relevance ?? 0);
  if (total < 10) return { disqualified: true, reason: `Disqualified ICP score: ${total}/15 (< 10)` };

  let priority = "Low";
  if (total >= 13) priority = "High";
  else if (total >= 11) priority = "Medium";

  return {
    disqualified: false,
    evaluatedLead: {
      prospect, company, website,
      founder_thesis: thesis,
      goal: lead.goal || "Scale operations",
      icp_score: total,
      next_action: lead.next_action || `Reach out regarding: "${thesis}"`,
      priority,
      source: sourceUrl,
      stage: "Sourced",
    }
  };
}

// ─────────────────────────────────────────────────────
// Test cases — these mirror what the AI would return after parsing raw text
// ─────────────────────────────────────────────────────

const candidates = [
  {
    label: "A — Wispr Flow (VC-funded, Series A, team=15)",
    sourceUrl: "https://wispr.flow",
    lead: {
      company_name: "Wispr Flow",
      founder_name: "Tanay Tandon",
      linkedin_url: "https://linkedin.com/in/tanaytandon",
      twitter_url: null,
      employee_count: 15,
      funding_status: "Series A",
      social_followers: 3500,
      has_major_press: true,
      ph_top_5: false,
      founder_thesis: null, // No self-disclosed constraint in marketing copy
      goal: "Launch desktop app next month",
      score_founder_active: 3,
      score_buying_signal: 2,
      score_icp_fit: 1,
      score_reachable: 2,
      score_atlas_relevance: 1,
    }
  },
  {
    label: "B — Jack Friks (bootstrapped BUT 3,200 Twitter followers)",
    sourceUrl: "https://jackfriks.com",
    lead: {
      company_name: "Supercreator",
      founder_name: "Jack Friks",
      linkedin_url: null,
      twitter_url: "@jackfriks",
      employee_count: 2,
      funding_status: "Bootstrapped",
      social_followers: 3200, // > 1000 threshold
      has_major_press: false,
      ph_top_5: false,
      founder_thesis: "doesn't know which content format drives the most subscriber growth",
      goal: "Hit $10k MRR",
      score_founder_active: 3,
      score_buying_signal: 2,
      score_icp_fit: 2,
      score_reachable: 2,
      score_atlas_relevance: 2,
    }
  },
  {
    label: "C — FeedCheck / Jane Doe (should PASS — clean bootstrapped ICP match)",
    sourceUrl: "https://feedcheck.co",
    lead: {
      company_name: "FeedCheck",
      founder_name: "Jane Doe",
      linkedin_url: "https://linkedin.com/in/janedoe",
      twitter_url: "@janedoe_biz",
      employee_count: 3,
      funding_status: "Bootstrapped",
      social_followers: 150,
      has_major_press: false,
      ph_top_5: false,
      founder_thesis: "churn eating growth — doesn't know how to retain users after trial",
      goal: "Reach $10k MRR",
      score_founder_active: 2,
      score_buying_signal: 3,
      score_icp_fit: 3,
      score_reachable: 2,
      score_atlas_relevance: 3,
    }
  },
  {
    label: "D — 'Vida' style empty/partial (should be DISQUALIFIED — missing founder + thesis)",
    sourceUrl: "https://vida-app.io",
    lead: {
      company_name: "Vida",
      founder_name: null, // AI couldn't find a name
      linkedin_url: null,
      twitter_url: null,
      employee_count: 5,
      funding_status: "Bootstrapped",
      social_followers: 0,
      has_major_press: false,
      ph_top_5: false,
      founder_thesis: null, // No stated problem found
      goal: null,
      score_founder_active: 0,
      score_buying_signal: 0,
      score_icp_fit: 2,
      score_reachable: 0,
      score_atlas_relevance: 1,
    }
  },
  {
    label: "E — Navia / ambiguous (pre-seed with press — borderline test)",
    sourceUrl: "https://navia.io",
    lead: {
      company_name: "Navia",
      founder_name: "Marcus Levi",
      linkedin_url: null,
      twitter_url: "@naviaio",
      employee_count: 4,
      funding_status: "Pre-seed",  // AI may detect this as disqualified or not
      social_followers: 480,
      has_major_press: true,       // Small TechCrunch mention
      ph_top_5: false,
      founder_thesis: "struggles to close enterprise deals without a demo environment",
      goal: "Close first 5 paying clients",
      score_founder_active: 2,
      score_buying_signal: 3,
      score_icp_fit: 3,
      score_reachable: 1,
      score_atlas_relevance: 2,
    }
  }
];

// ─────────────────────────────────────────────────────
// Run checks
// ─────────────────────────────────────────────────────
console.log("=".repeat(70));
console.log("  ATLAS HQ — SOURCING MACHINE SANITY CHECK");
console.log("=".repeat(70));
console.log("");

for (const c of candidates) {
  const result = validateAndEvaluateLead(c.lead, c.sourceUrl);
  const status = result.disqualified ? "❌  DISQUALIFIED" : "✅  QUALIFIED";
  console.log(`${status} — ${c.label}`);
  if (result.disqualified) {
    console.log(`   Reason: ${result.reason}`);
  } else {
    const l = result.evaluatedLead;
    console.log(`   Score:     ${l.icp_score}/15 → Priority: ${l.priority}`);
    console.log(`   Thesis:    "${l.founder_thesis}"`);
    console.log(`   Next:      ${l.next_action}`);
  }
  console.log("");
}
