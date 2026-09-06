import {
  AtlasAcquisitionRun,
  AtlasOpportunity,
  AtlasEvidence,
  AtlasContact,
  AgencyFeedItem,
  AtlasIcpProfile,
} from "./types";
import { calculateFitScore } from "./scoring";
import { memoryStore } from "./api";
import feedData from "../../../data/fixtures/controlled_agency_feed.json";

export interface RunProgress {
  runId: string;
  status: "running" | "completed" | "failed";
  itemsDiscovered: number;
  itemsQualified: number;
  current: number;
  total: number;
  message: string;
  logs: string[];
}

/**
 * Normalizes domain by lowercasing and stripping www. or common subdomains
 */
export function normalizeDomain(rawDomain: string): string {
  if (!rawDomain) return "";
  let clean = rawDomain.toLowerCase().trim();
  // Strip protocol if present
  clean = clean.replace(/^(?:https?:\/\/)?/i, "");
  // Strip path or query
  clean = clean.split("/")[0].split("?")[0];
  // Strip leading www.
  clean = clean.replace(/^www\./i, "");
  return clean;
}

/**
 * Executes a controlled acquisition run over the agency feed fixture
 */
export async function executeAcquisitionRun(
  icpProfileId: string,
  onProgress?: (progress: RunProgress) => void
): Promise<AtlasAcquisitionRun> {
  const icp = memoryStore.icpProfiles.get(icpProfileId);
  if (!icp) {
    throw new Error(`Approved ICP profile ${icpProfileId} not found`);
  }

  const runId = crypto.randomUUID();
  const now = new Date().toISOString();

  // Snapshot the exact approved search thesis immutably
  const runRecord: AtlasAcquisitionRun = {
    id: runId,
    icp_profile_id: icp.id,
    icp_version_snapshot: icp.version || 1,
    icp_snapshot: JSON.parse(JSON.stringify(icp)),
    user_id: icp.user_id,
    source_connector: "controlled_agency_feed",
    status: "running",
    items_discovered: 0,
    items_qualified: 0,
    run_telemetry: { step: "ingestion", started: now },
    error_message: null,
    started_at: now,
    completed_at: null,
    created_at: now,
  };

  memoryStore.runs.set(runId, runRecord);

  const logs: string[] = [];
  const feed: AgencyFeedItem[] = feedData as AgencyFeedItem[];

  logs.push(`Loaded ${feed.length} prospect records from controlled agency feed.`);

  let discoveredCount = 0;
  let qualifiedCount = 0;

  for (const item of feed) {
    const primaryDomain = normalizeDomain(item.domain);

    // Check deduplication
    let alreadyExists = false;
    for (const opp of memoryStore.opportunities.values()) {
      if (
        opp.user_id === icp.user_id &&
        opp.primary_domain === primaryDomain
      ) {
        alreadyExists = true;
        break;
      }
    }

    if (alreadyExists) {
      logs.push(`Skipping duplicate domain: ${primaryDomain}`);
      continue;
    }

    discoveredCount++;
    const oppId = crypto.randomUUID();
    const itemTimestamp = new Date().toISOString();

    // 1. Evaluate deterministic fit score
    const scoring = calculateFitScore(item, icp);
    const stage = scoring.isQualified ? "qualified" : "disqualified";
    if (scoring.isQualified) {
      qualifiedCount++;
    }

    // 2. Insert opportunity record
    const opportunity: AtlasOpportunity = {
      id: oppId,
      run_id: runId,
      user_id: icp.user_id,
      organization_name: item.organization_name,
      primary_domain: primaryDomain,
      industry: item.industry,
      employee_count_est: item.employee_count,
      country: item.country,
      pipeline_stage: stage,
      fit_score: scoring.fitScore,
      score_breakdown: scoring.scoreBreakdown,
      next_action_recommendation: scoring.isQualified
        ? "Inspect evidence dossier and generate outreach draft"
        : null,
      next_action_due_at: null,
      deal_value_usd: null,
      deal_closed_at: null,
      deal_notes: null,
      created_at: itemTimestamp,
      updated_at: itemTimestamp,
    };

    memoryStore.opportunities.set(oppId, opportunity);

    // 3. Insert immutable evidence records (append-only)
    const evRecords: AtlasEvidence[] = [];

    // Employee fit evidence
    evRecords.push({
      id: crypto.randomUUID(),
      opportunity_id: oppId,
      user_id: icp.user_id,
      signal_type: "employee_fit",
      raw_snippet: `Observed ${item.employee_count} team members across delivery and operations.`,
      source_url: item.source_url,
      observed_at: itemTimestamp,
      created_at: itemTimestamp,
    });

    // Geo fit evidence
    evRecords.push({
      id: crypto.randomUUID(),
      opportunity_id: oppId,
      user_id: icp.user_id,
      signal_type: "geo_fit",
      raw_snippet: `Registered and operating within ${item.country}.`,
      source_url: item.source_url,
      observed_at: itemTimestamp,
      created_at: itemTimestamp,
    });

    // Industry fit evidence
    evRecords.push({
      id: crypto.randomUUID(),
      opportunity_id: oppId,
      user_id: icp.user_id,
      signal_type: "industry_fit",
      raw_snippet: `Core client offerings categorized under ${item.industry}.`,
      source_url: item.source_url,
      observed_at: itemTimestamp,
      created_at: itemTimestamp,
    });

    // Pain signal evidence (if present)
    if (item.pain_signal) {
      evRecords.push({
        id: crypto.randomUUID(),
        opportunity_id: oppId,
        user_id: icp.user_id,
        signal_type: "pain_signal",
        raw_snippet: item.pain_signal,
        source_url: item.pain_source_url || item.source_url,
        observed_at: itemTimestamp,
        created_at: itemTimestamp,
      });
    }

    // Buying signal evidence (if present)
    if (item.buying_signal) {
      evRecords.push({
        id: crypto.randomUUID(),
        opportunity_id: oppId,
        user_id: icp.user_id,
        signal_type: "buying_signal",
        raw_snippet: item.buying_signal,
        source_url: item.buying_source_url || item.source_url,
        observed_at: itemTimestamp,
        created_at: itemTimestamp,
      });
    }

    memoryStore.evidence.set(oppId, evRecords);

    // 4. Insert contact with provenance tier (if present)
    if (item.contact_name) {
      const contact: AtlasContact = {
        id: crypto.randomUUID(),
        opportunity_id: oppId,
        user_id: icp.user_id,
        full_name: item.contact_name,
        job_title: item.contact_title || "Managing Director",
        email: item.contact_email,
        linkedin_url: null,
        verification_tier: item.contact_verification_tier,
        provenance_source: item.contact_source_url || item.source_url,
        verified_at: itemTimestamp,
        created_at: itemTimestamp,
      };
      memoryStore.contacts.set(oppId, [contact]);
    }

    logs.push(
      `Discovered ${item.organization_name} (${primaryDomain}) → Fit Score: ${scoring.fitScore}/100 (${stage})`
    );

    if (onProgress) {
      onProgress({
        runId,
        status: "running",
        itemsDiscovered: discoveredCount,
        itemsQualified: qualifiedCount,
        current: discoveredCount,
        total: feed.length,
        message: `Evaluating ${item.organization_name}...`,
        logs: [...logs],
      });
    }
  }

  const completedAt = new Date().toISOString();
  runRecord.status = "completed";
  runRecord.items_discovered = discoveredCount;
  runRecord.items_qualified = qualifiedCount;
  runRecord.completed_at = completedAt;
  runRecord.run_telemetry = {
    step: "completed",
    discovered: discoveredCount,
    qualified: qualifiedCount,
    completedAt,
  };

  memoryStore.runs.set(runId, runRecord);

  if (onProgress) {
    onProgress({
      runId,
      status: "completed",
      itemsDiscovered: discoveredCount,
      itemsQualified: qualifiedCount,
      current: feed.length,
      total: feed.length,
      message: `Completed: ${qualifiedCount} qualified out of ${feed.length}`,
      logs: [...logs, `Run completed successfully. Qualified: ${qualifiedCount}/${discoveredCount}`],
    });
  }

  return runRecord;
}
