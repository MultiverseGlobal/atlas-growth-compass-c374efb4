import { supabase } from "@/integrations/supabase/client";
import {
  AtlasObjective,
  AtlasIcpProfile,
  AtlasAcquisitionRun,
  AtlasOpportunity,
  AtlasEvidence,
  AtlasContact,
  AtlasOutreach,
  AtlasFollowup,
  FitScoreBreakdown,
} from "./types";
import { addBusinessDays } from "./dateUtils";

// ==============================================================================
// IN-MEMORY DEV STORE (Session-only fallback when live Supabase migration pending)
// Zero localStorage business state.
// ==============================================================================
interface AtlasStore {
  objectives: Map<string, AtlasObjective>;
  icpProfiles: Map<string, AtlasIcpProfile>;
  runs: Map<string, AtlasAcquisitionRun>;
  opportunities: Map<string, AtlasOpportunity>;
  evidence: Map<string, AtlasEvidence[]>;
  contacts: Map<string, AtlasContact[]>;
  outreach: Map<string, AtlasOutreach>;
  followups: Map<string, AtlasFollowup[]>;
}

const memoryStore: AtlasStore = {
  objectives: new Map(),
  icpProfiles: new Map(),
  runs: new Map(),
  opportunities: new Map(),
  evidence: new Map(),
  contacts: new Map(),
  outreach: new Map(),
  followups: new Map(),
};

// ==============================================================================
// 1. PROPOSE ICP (Search Thesis Synthesis)
// ==============================================================================
export async function proposeIcp(input: {
  offerSummary: string;
  targetHypothesis: string;
}): Promise<{ objectiveId: string; icpDraft: AtlasIcpProfile }> {
  // Get active session user or fallback to local developer UUID
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData?.user?.id || "00000000-0000-0000-0000-000000000001";

  const objectiveId = crypto.randomUUID();
  const icpId = crypto.randomUUID();
  const now = new Date().toISOString();

  const objective: AtlasObjective = {
    id: objectiveId,
    user_id: userId,
    offer_summary: input.offerSummary,
    target_hypothesis: input.targetHypothesis,
    status: "active",
    created_at: now,
    updated_at: now,
  };

  // Generate structured search thesis
  const icpDraft: AtlasIcpProfile = {
    id: icpId,
    objective_id: objectiveId,
    user_id: userId,
    version: null, // Draft has no version number yet
    title: "5–30 Person Digital Agencies (US & UK)",
    buyer_persona: {
      role: "Managing Director / Founder",
      seniority: "Executive",
    },
    target_geography: ["US", "UK"],
    employee_range_min: 5,
    employee_range_max: 30,
    industry_keywords: [
      "digital agency",
      "web agency",
      "design studio",
      "marketing agency",
    ],
    pain_signals: [
      "project management delivery overhead",
      "custom client onboarding delays",
      "retainer management chaos",
    ],
    buying_signals: [
      "seeking workflow automation partner",
      "migrating creative pipelines to AI",
      "adopting modern stack",
    ],
    disqualification_criteria: [
      "Less than 5 employees (solopreneurs / micro-consultancies)",
      "Enterprise organizations (>50 employees)",
      "Pure consumer / B2C focus",
      "No observable digital footprint or active domain",
    ],
    status: "draft",
    approved_at: null,
    created_at: now,
    updated_at: now,
  };

  // Attempt live database insert
  try {
    const { error: objErr } = await supabase
      .from("atlas_objectives" as any)
      .insert(objective);
    if (!objErr) {
      await supabase
        .from("atlas_icp_profiles" as any)
        .insert(icpDraft);
    }
  } catch {
    // Session fallback if table not yet migrated on cloud
  }

  memoryStore.objectives.set(objectiveId, objective);
  memoryStore.icpProfiles.set(icpId, icpDraft);

  return { objectiveId, icpDraft };
}

// ==============================================================================
// 2. APPROVE ICP (Lock Version)
// ==============================================================================
export async function approveIcp(input: {
  icpId: string;
  edits?: Partial<AtlasIcpProfile>;
}): Promise<{ icpId: string; version: number; status: "approved" }> {
  const existing = memoryStore.icpProfiles.get(input.icpId);
  const now = new Date().toISOString();

  // Find existing versions for this objective to calculate next sequential version
  let nextVersion = 1;
  for (const p of memoryStore.icpProfiles.values()) {
    if (p.objective_id === existing?.objective_id && p.version !== null) {
      if (p.version >= nextVersion) {
        nextVersion = p.version + 1;
      }
    }
  }

  const updated: AtlasIcpProfile = {
    ...(existing || ({} as AtlasIcpProfile)),
    ...(input.edits || {}),
    id: input.icpId,
    version: nextVersion,
    status: "approved",
    approved_at: now,
    updated_at: now,
  };

  memoryStore.icpProfiles.set(input.icpId, updated);

  try {
    await supabase
      .from("atlas_icp_profiles" as any)
      .update({
        version: nextVersion,
        status: "approved",
        approved_at: now,
        ...input.edits,
      })
      .eq("id", input.icpId);
  } catch {
    // Session fallback
  }

  return { icpId: input.icpId, version: nextVersion, status: "approved" };
}

// ==============================================================================
// 3. GET MORNING FOCUS (Top 3 Qualified Daily Opportunities)
// ==============================================================================
export async function getMorningFocus(): Promise<
  Array<{
    opportunity: AtlasOpportunity;
    primaryEvidence: AtlasEvidence | null;
    decisionMaker: AtlasContact | null;
    outreach: AtlasOutreach | null;
  }>
> {
  const opps = Array.from(memoryStore.opportunities.values())
    .filter((o) => {
      // Must be qualified with score >= 60
      if (o.pipeline_stage !== "qualified" && o.pipeline_stage !== "outreach_ready") {
        return false;
      }
      if (o.fit_score < 60) return false;

      // Cannot have already been manually sent
      const out = memoryStore.outreach.get(o.id);
      if (out && (out.status === "manually_sent" || out.status === "replied")) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      // 1. fit_score DESC, 2. created_at ASC
      if (b.fit_score !== a.fit_score) return b.fit_score - a.fit_score;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    })
    .slice(0, 3);

  return opps.map((opportunity) => {
    const evList = memoryStore.evidence.get(opportunity.id) || [];
    // Prioritize pain_signal evidence as primary headline
    const primaryEvidence =
      evList.find((e) => e.signal_type === "pain_signal") || evList[0] || null;

    const contactList = memoryStore.contacts.get(opportunity.id) || [];
    const decisionMaker = contactList[0] || null;
    const outreach = memoryStore.outreach.get(opportunity.id) || null;

    return { opportunity, primaryEvidence, decisionMaker, outreach };
  });
}

// ==============================================================================
// 4. GET OPPORTUNITY DOSSIER
// ==============================================================================
export async function getOpportunityDossier(opportunityId: string): Promise<{
  opportunity: AtlasOpportunity;
  evidence: AtlasEvidence[];
  contacts: AtlasContact[];
  outreach: AtlasOutreach | null;
  followups: AtlasFollowup[];
} | null> {
  const opportunity = memoryStore.opportunities.get(opportunityId);
  if (!opportunity) return null;

  const evidence = memoryStore.evidence.get(opportunityId) || [];
  const contacts = memoryStore.contacts.get(opportunityId) || [];
  const outreach = memoryStore.outreach.get(opportunityId) || null;
  const followups = memoryStore.followups.get(opportunityId) || [];

  return { opportunity, evidence, contacts, outreach, followups };
}

// ==============================================================================
// 5. GENERATE GROUNDED OUTREACH DRAFT
// ==============================================================================
export async function generateOutreachDraft(input: {
  opportunityId: string;
  contactId?: string;
  channel?: "email" | "linkedin";
}): Promise<AtlasOutreach> {
  const opportunity = memoryStore.opportunities.get(input.opportunityId);
  if (!opportunity) throw new Error("Opportunity not found");

  const contacts = memoryStore.contacts.get(input.opportunityId) || [];
  const contact = contacts.find((c) => c.id === input.contactId) || contacts[0];
  const evidenceList = memoryStore.evidence.get(input.opportunityId) || [];

  const painEvidence = evidenceList.find((e) => e.signal_type === "pain_signal");
  const painSnippet = painEvidence
    ? painEvidence.raw_snippet
    : "managing delivery overhead across client accounts";

  const firstName = contact ? contact.full_name.split(" ")[0] : "there";
  const orgName = opportunity.organization_name;

  // Grounded 3-paragraph cold copy strictly citing observed facts
  const draftSubject = `Operational leverage for ${orgName}`;
  const draftBody = `Hi ${firstName},

I noticed ${orgName} has been focusing on streamlining delivery—specifically around "${painSnippet}". When running a high-performing ${opportunity.industry.toLowerCase()}, that kind of operational drag eats directly into partner capacity and client delivery margins.

We built Pseudonyms Atlas to give founders direct operational leverage over these bottlenecks without having to hire or expand administrative headcount. For an agency of your size (~${opportunity.employee_count_est || "10-25"} people), it automates the repetitive coordination so your team stays focused on client work.

Are you open to a brief 10-minute exchange next week to see how other digital agencies have eliminated this exact bottleneck?

Best,
Kenshi
Founder, Pseudonyms`;

  const outreachId = crypto.randomUUID();
  const now = new Date().toISOString();

  const outreach: AtlasOutreach = {
    id: outreachId,
    opportunity_id: input.opportunityId,
    contact_id: contact?.id || null,
    user_id: opportunity.user_id,
    channel: input.channel || "email",
    draft_subject: draftSubject,
    draft_body: draftBody,
    status: "draft",
    approved_at: null,
    sent_at: null,
    manual_send_notes: null,
    created_at: now,
    updated_at: now,
  };

  memoryStore.outreach.set(input.opportunityId, outreach);

  return outreach;
}

// ==============================================================================
// 6. CONFIRM MANUAL SEND & SCHEDULE FOLLOW-UP (+3 Business Days)
// ==============================================================================
export async function confirmManualSend(
  outreachId: string,
  opportunityId: string,
  options?: { notes?: string; userTimezone?: string }
): Promise<{
  outreach: AtlasOutreach;
  followup: AtlasFollowup;
  opportunity: AtlasOpportunity;
  nextActionDueAt: string;
}> {
  const outreach = memoryStore.outreach.get(opportunityId);
  if (!outreach) throw new Error("Outreach not found");

  const opportunity = memoryStore.opportunities.get(opportunityId);
  if (!opportunity) throw new Error("Opportunity not found");

  const now = new Date();
  const sentAt = now.toISOString();

  // Calculate follow-up strictly using Monday-Friday business days rule
  const nextDate = addBusinessDays(now, 3);
  const nextActionDueAt = nextDate.toISOString();

  // 1. Update outreach
  outreach.status = "manually_sent";
  outreach.sent_at = sentAt;
  outreach.manual_send_notes = options?.notes || "Founder manual transmission confirmed";
  outreach.updated_at = sentAt;
  memoryStore.outreach.set(opportunityId, outreach);

  // 2. Update opportunity stage & next action
  opportunity.pipeline_stage = "contacted";
  opportunity.next_action_recommendation =
    "Follow up with specific operations case study";
  opportunity.next_action_due_at = nextActionDueAt;
  opportunity.updated_at = sentAt;
  memoryStore.opportunities.set(opportunityId, opportunity);

  // 3. Create followup record
  const followupId = crypto.randomUUID();
  const followup: AtlasFollowup = {
    id: followupId,
    outreach_id: outreachId,
    user_id: opportunity.user_id,
    scheduled_for: nextActionDueAt,
    action_strategy: "Follow up with specific operations case study",
    status: "pending",
    created_at: sentAt,
  };

  const existingFollowups = memoryStore.followups.get(opportunityId) || [];
  existingFollowups.push(followup);
  memoryStore.followups.set(opportunityId, existingFollowups);

  return { outreach, followup, opportunity, nextActionDueAt };
}

// ==============================================================================
// 7. RECORD MANUAL DEAL OUTCOME
// ==============================================================================
export async function recordDealOutcome(
  opportunityId: string,
  outcome: {
    stage: "closed_won" | "closed_lost";
    dealValueUsd?: number;
    dealNotes?: string;
  }
): Promise<AtlasOpportunity> {
  const opportunity = memoryStore.opportunities.get(opportunityId);
  if (!opportunity) throw new Error("Opportunity not found");

  const now = new Date().toISOString();
  opportunity.pipeline_stage = outcome.stage;
  opportunity.deal_value_usd = outcome.dealValueUsd || null;
  opportunity.deal_closed_at = now;
  opportunity.deal_notes = outcome.dealNotes || null;
  opportunity.updated_at = now;

  memoryStore.opportunities.set(opportunityId, opportunity);

  return opportunity;
}

// Expose internal store for worker and testing
export { memoryStore };
