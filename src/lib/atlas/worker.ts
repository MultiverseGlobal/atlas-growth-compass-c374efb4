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

import { supabase } from "@/integrations/supabase/client";

export async function executeAcquisitionRun(
  icpProfileId: string,
  onProgress?: (progress: RunProgress) => void
): Promise<any> {
  // Get ICP profile from DB (or we can assume we pass it in if it's already there)
  // For now, let's fetch it if it's in a table, or just pass a mock if needed.
  // We'll create the job and let the python worker handle the ICP fetching/scoring.
  
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error("Not authenticated");

  // Create job in Supabase
  const runId = crypto.randomUUID();
  const { error } = await supabase.table("atlas_background_jobs").insert({
    id: runId,
    user_id: userId,
    type: "sourcing_run",
    payload: { icp_profile_id: icpProfileId }
  });

  if (error) {
    throw new Error(`Failed to create job: ${error.message}`);
  }

  if (onProgress) {
    onProgress({
      runId,
      status: "running",
      itemsDiscovered: 0,
      itemsQualified: 0,
      current: 0,
      total: 5,
      message: "Job queued. Waiting for worker...",
      logs: ["Job queued in atlas_background_jobs"]
    });
  }

  return new Promise((resolve, reject) => {
    // Listen to changes on this specific job
    const channel = supabase
      .channel(`job-${runId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "atlas_background_jobs",
          filter: `id=eq.${runId}`
        },
        (payload) => {
          const job = payload.new;
          if (job.status === "completed") {
            if (onProgress) {
              onProgress({
                runId,
                status: "completed",
                itemsDiscovered: 5, // We can get this from result later
                itemsQualified: 5,
                current: 5,
                total: 5,
                message: "Run completed successfully.",
                logs: ["Run completed successfully."]
              });
            }
            supabase.removeChannel(channel);
            resolve(job);
          } else if (job.status === "failed") {
            if (onProgress) {
              onProgress({
                runId,
                status: "failed",
                itemsDiscovered: 0,
                itemsQualified: 0,
                current: 0,
                total: 5,
                message: `Failed: ${job.error}`,
                logs: [`Error: ${job.error}`]
              });
            }
            supabase.removeChannel(channel);
            reject(new Error(job.error));
          } else if (job.status === "processing") {
             if (onProgress) {
               onProgress({
                 runId,
                 status: "running",
                 itemsDiscovered: 1,
                 itemsQualified: 0,
                 current: 1,
                 total: 5,
                 message: "Worker is processing leads...",
                 logs: ["Processing..."]
               });
             }
          }
        }
      )
      .subscribe();
  });
}
