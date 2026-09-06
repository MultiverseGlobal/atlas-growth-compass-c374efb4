import { describe, it, expect, beforeEach } from "vitest";
import { 
  proposeIcp, 
  approveIcp, 
  getMorningFocus, 
  getOpportunityDossier, 
  generateOutreachDraft, 
  confirmManualSend, 
  recordDealOutcome,
  memoryStore 
} from "./api";
import { executeAcquisitionRun } from "./worker";

describe("Atlas V1 Vertical Slice — End-to-End Proof Journey", () => {
  beforeEach(() => {
    memoryStore.objectives.clear();
    memoryStore.icpProfiles.clear();
    memoryStore.runs.clear();
    memoryStore.opportunities.clear();
    memoryStore.evidence.clear();
    memoryStore.contacts.clear();
    memoryStore.outreach.clear();
    memoryStore.followups.clear();
  });

  it("completes the full founder loop: Intent -> Search Thesis -> Approval -> Ingestion -> Score -> Morning Focus -> Grounded Draft -> Manual Send -> Follow-up -> Deal Won", async () => {
    // 1. Founder inputs commercial intent
    const { objectiveId, icpDraft } = await proposeIcp({
      offerSummary: "AI operations automation eliminating delivery friction and reporting drag",
      targetHypothesis: "5-30 person digital/web agencies in US and UK",
    });

    expect(objectiveId).toBeDefined();
    expect(icpDraft.status).toBe("draft");
    expect(icpDraft.version).toBeNull(); // Draft has no version number yet
    expect(icpDraft.employee_range_min).toBe(5);
    expect(icpDraft.employee_range_max).toBe(30);

    // 2. Founder inspects and approves Search Thesis (Locks Version 1)
    const approvedResult = await approveIcp({ icpId: icpDraft.id });
    expect(approvedResult.version).toBe(1);
    expect(approvedResult.status).toBe("approved");

    // 3. Founder launches Acquisition Run against Controlled Agency Feed
    const run = await executeAcquisitionRun(icpDraft.id);
    expect(run.status).toBe("completed");
    expect(run.items_discovered).toBe(5);
    expect(run.items_qualified).toBe(4); // 4 digital agencies qualified, 1 enterprise disqualified

    // 4. Founder opens Morning Focus (Daily operational view)
    const morningFocus = await getMorningFocus();
    expect(morningFocus.length).toBe(3); // Exactly top 3

    // Verify all 3 have fit score >= 60 and complete breakdown
    for (const item of morningFocus) {
      expect(item.opportunity.fit_score).toBeGreaterThanOrEqual(60);
      expect(item.opportunity.score_breakdown).toBeDefined();
      expect(item.opportunity.score_breakdown.employeeFit.points).toBeGreaterThanOrEqual(0);
      expect(item.opportunity.score_breakdown.geoFit.points).toBe(15);
      expect(item.primaryEvidence).toBeDefined();
      expect(item.decisionMaker).toBeDefined();
    }

    // Top item should be highest score (e.g. 100/100 or 85/100)
    const topItem = morningFocus[0];
    expect(topItem.opportunity.fit_score).toBeGreaterThanOrEqual(85);

    // 5. Founder opens Opportunity Dossier for the top opportunity
    const dossier = await getOpportunityDossier(topItem.opportunity.id);
    expect(dossier).toBeDefined();
    expect(dossier?.opportunity.organization_name).toBe(topItem.opportunity.organization_name);
    // Evidence trail must contain immutable records
    expect(dossier?.evidence.length).toBeGreaterThanOrEqual(3);
    const painEv = dossier?.evidence.find((e) => e.signal_type === "pain_signal");
    expect(painEv).toBeDefined();
    expect(painEv?.source_url).toContain("http");

    // 6. Atlas generates grounded outreach pitch citing observed evidence
    const outreach = await generateOutreachDraft({
      opportunityId: topItem.opportunity.id,
      contactId: dossier?.contacts[0]?.id,
    });
    expect(outreach.status).toBe("draft");
    expect(outreach.draft_subject).toContain(topItem.opportunity.organization_name);
    // Copy must cite the pain snippet directly
    expect(outreach.draft_body).toContain(painEv?.raw_snippet);
    expect(outreach.draft_body).toContain(topItem.opportunity.industry.toLowerCase());

    // 7. Founder reviews, copies, sends via native mail client, and confirms manual send
    const sendConfirmation = await confirmManualSend(outreach.id, topItem.opportunity.id, {
      notes: "Founder sent email via native mail client to Marcus Vance",
    });

    expect(sendConfirmation.outreach.status).toBe("manually_sent");
    expect(sendConfirmation.followup.status).toBe("pending");
    expect(sendConfirmation.nextActionDueAt).toBeDefined();

    // 8. Verify Morning Focus updates: the contacted company is removed, and next qualified company enters!
    const refreshedFocus = await getMorningFocus();
    expect(refreshedFocus.length).toBe(3);
    // The previously contacted company should not be in the focus queue
    const stillInFocus = refreshedFocus.some((f) => f.opportunity.id === topItem.opportunity.id);
    expect(stillInFocus).toBe(false);

    // 9. Founder closes deal with the contacted agency and records commercial outcome
    const closedDeal = await recordDealOutcome(topItem.opportunity.id, {
      stage: "closed_won",
      dealValueUsd: 3500,
      dealNotes: "Signed 3-month automation retainer for $3,500/month",
    });

    expect(closedDeal.pipeline_stage).toBe("closed_won");
    expect(closedDeal.deal_value_usd).toBe(3500);
    expect(closedDeal.deal_notes).toContain("retainer");
  });
});
