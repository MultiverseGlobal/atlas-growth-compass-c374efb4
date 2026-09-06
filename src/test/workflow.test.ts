import { describe, it, expect } from "vitest";
import {
  proposeIcp,
  approveIcp,
  getMorningFocus,
  getOpportunityDossier,
  generateOutreachDraft,
  confirmManualSend,
  recordDealOutcome,
} from "../lib/atlas/api";
import { executeAcquisitionRun, RunProgress } from "../lib/atlas/worker";

describe("Atlas End-to-End Strategic Workflow & Regression Verification", () => {
  it("proposes, approves, and executes acquisition feed with full defensive stability", async () => {
    // 1. Initial Morning Focus should return an array without crashing
    const initialFocus = await getMorningFocus();
    expect(Array.isArray(initialFocus)).toBe(true);

    // 2. Propose ICP (Search Thesis)
    const { objectiveId, icpDraft } = await proposeIcp({
      offerSummary: "AI operations automation to eliminate client delivery friction",
      targetHypothesis: "5–30 person digital agencies in the US and UK",
    });

    expect(objectiveId).toBeTruthy();
    expect(icpDraft.id).toBeTruthy();
    expect(icpDraft.disqualification_criteria).toBeDefined();
    expect(Array.isArray(icpDraft.disqualification_criteria)).toBe(true);
    expect(icpDraft.disqualification_criteria!.length).toBeGreaterThan(0);
    expect(Array.isArray(icpDraft.pain_signals)).toBe(true);
    expect(Array.isArray(icpDraft.target_geography)).toBe(true);

    // 3. Approve ICP
    const approval = await approveIcp({ icpId: icpDraft.id });
    expect(approval.version).toBe(1);
    expect(approval.status).toBe("approved");

    // 4. Execute Controlled Acquisition Run
    const progressReports: RunProgress[] = [];
    const run = await executeAcquisitionRun(icpDraft.id, (progress) => {
      expect(typeof progress.current).toBe("number");
      expect(typeof progress.total).toBe("number");
      expect(typeof progress.message).toBe("string");
      expect(Array.isArray(progress.logs)).toBe(true);
      progressReports.push({ ...progress });
    });

    expect(run.status).toBe("completed");
    expect(run.items_discovered).toBeGreaterThan(0);
    expect(run.items_qualified).toBeGreaterThan(0);
    expect(progressReports.length).toBeGreaterThan(0);

    // 5. Morning Focus should now return qualified opportunities
    const focusItems = await getMorningFocus();
    expect(focusItems.length).toBeGreaterThan(0);
    expect(focusItems.length).toBeLessThanOrEqual(3);

    const first = focusItems[0];
    expect(first.opportunity.fit_score).toBeGreaterThanOrEqual(60);
    expect(first.opportunity.organization_name).toBeTruthy();
    expect(first.opportunity.score_breakdown).toBeDefined();
    expect(first.primaryEvidence).toBeDefined();

    // 6. Inspect Dossier
    const dossier = await getOpportunityDossier(first.opportunity.id);
    expect(dossier).not.toBeNull();
    expect(Array.isArray(dossier!.evidence)).toBe(true);
    expect(Array.isArray(dossier!.contacts)).toBe(true);

    // 7. Grounded Outreach Synthesis
    const outreach = await generateOutreachDraft({
      opportunityId: first.opportunity.id,
      channel: "email",
    });
    expect(outreach.draft_subject).toContain(first.opportunity.organization_name);
    expect(outreach.draft_body.length).toBeGreaterThan(50);

    // 8. Manual Send Confirmation (+3 Business Days follow-up rule)
    const sendResult = await confirmManualSend(outreach.id, first.opportunity.id);
    expect(sendResult.outreach.status).toBe("manually_sent");
    expect(sendResult.opportunity.pipeline_stage).toBe("contacted");
    expect(sendResult.nextActionDueAt).toBeTruthy();

    // 9. Deal Won Outcome
    const wonDeal = await recordDealOutcome(first.opportunity.id, {
      stage: "closed_won",
      dealValueUsd: 4500,
      dealNotes: "Retainer signed for AI client delivery pipeline",
    });
    expect(wonDeal.pipeline_stage).toBe("closed_won");
    expect(wonDeal.deal_value_usd).toBe(4500);
  });
});
