// ==============================================================================
// PSEUDONYMS ATLAS V1 — DOMAIN TYPES
// Strictly aligned with canonical atlas_* database schema
// ==============================================================================

export type AtlasObjectiveStatus = "draft" | "active" | "archived";
export type AtlasIcpStatus = "draft" | "approved" | "archived";
export type AtlasRunStatus = "queued" | "running" | "completed" | "failed";
export type AtlasPipelineStage = 
  | "discovered" 
  | "qualified" 
  | "outreach_ready" 
  | "contacted" 
  | "engaged" 
  | "closed_won" 
  | "closed_lost" 
  | "disqualified";

export type AtlasSignalType = 
  | "employee_fit" 
  | "geo_fit" 
  | "industry_fit" 
  | "pain_signal" 
  | "buying_signal" 
  | "decision_maker";

export type AtlasContactVerificationTier = 
  | "email_discovered" 
  | "email_domain_valid" 
  | "email_verified" 
  | "person_email_verified" 
  | "user_provided";

export type AtlasOutreachStatus = 
  | "draft" 
  | "approved" 
  | "manually_sent" 
  | "replied" 
  | "declined";

export type AtlasFollowupStatus = "pending" | "completed" | "cancelled";

export interface AtlasObjective {
  id: string;
  user_id: string;
  offer_summary: string;
  target_hypothesis: string;
  status: AtlasObjectiveStatus;
  created_at: string;
  updated_at: string;
}

export interface AtlasIcpProfile {
  id: string;
  objective_id: string;
  user_id: string;
  version: number | null; // null for draft, 1, 2, ... when approved
  title: string;
  buyer_persona: {
    role: string;
    seniority: string;
  };
  target_geography: string[];
  employee_range_min: number;
  employee_range_max: number;
  industry_keywords: string[];
  pain_signals: string[];
  buying_signals: string[];
  status: AtlasIcpStatus;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AtlasAcquisitionRun {
  id: string;
  icp_profile_id: string;
  icp_version_snapshot: number;
  icp_snapshot: AtlasIcpProfile;
  user_id: string;
  source_connector: string;
  status: AtlasRunStatus;
  items_discovered: number;
  items_qualified: number;
  run_telemetry: Record<string, unknown>;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface FitScoreBreakdown {
  employeeFit: { points: number; observed: number | null };
  geoFit: { points: number; observed: string | null };
  industryFit: { points: number; observed: string };
  painSignal: { points: number; snippet?: string; sourceUrl?: string };
  buyingSignal: { points: number; snippet?: string; sourceUrl?: string };
  decisionMaker: { points: number; name?: string; title?: string };
}

export interface AtlasOpportunity {
  id: string;
  run_id: string;
  user_id: string;
  organization_name: string;
  primary_domain: string;
  industry: string;
  employee_count_est: number | null;
  country: string | null;
  pipeline_stage: AtlasPipelineStage;
  fit_score: number;
  score_breakdown: FitScoreBreakdown;
  next_action_recommendation: string | null;
  next_action_due_at: string | null;
  deal_value_usd: number | null;
  deal_closed_at: string | null;
  deal_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AtlasEvidence {
  id: string;
  opportunity_id: string;
  user_id: string;
  signal_type: AtlasSignalType;
  raw_snippet: string;
  source_url: string;
  observed_at: string;
  created_at: string;
}

export interface AtlasContact {
  id: string;
  opportunity_id: string;
  user_id: string;
  full_name: string;
  job_title: string;
  email: string | null;
  linkedin_url: string | null;
  verification_tier: AtlasContactVerificationTier;
  provenance_source: string;
  verified_at: string | null;
  created_at: string;
}

export interface AtlasOutreach {
  id: string;
  opportunity_id: string;
  contact_id: string | null;
  user_id: string;
  channel: "email" | "linkedin";
  draft_subject: string;
  draft_body: string;
  status: AtlasOutreachStatus;
  approved_at: string | null;
  sent_at: string | null;
  manual_send_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AtlasFollowup {
  id: string;
  outreach_id: string;
  user_id: string;
  scheduled_for: string;
  action_strategy: string;
  status: AtlasFollowupStatus;
  created_at: string;
}

// Feed item input
export interface AgencyFeedItem {
  organization_name: string;
  domain: string;
  country: string;
  employee_count: number;
  industry: string;
  source_url: string;
  pain_signal: string | null;
  pain_source_url: string | null;
  buying_signal: string | null;
  buying_source_url: string | null;
  contact_name: string | null;
  contact_title: string | null;
  contact_email: string | null;
  contact_source_url: string | null;
  contact_verification_tier: AtlasContactVerificationTier;
}
