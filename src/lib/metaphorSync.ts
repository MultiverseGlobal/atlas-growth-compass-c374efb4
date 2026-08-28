/**
 * metaphorSync.ts
 * Pushes Atlas business events into Metaphor OS as graph context nodes.
 * Uses Metaphor's MCP sync_chat_drop tool via the REST API.
 */

const METAPHOR_API = import.meta.env.VITE_METAPHOR_API_URL || "http://localhost:8000/api/v1";
const METAPHOR_TOKEN_KEY = "metaphor_access_token";

function getToken(): string | null {
  try {
    return localStorage.getItem(METAPHOR_TOKEN_KEY);
  } catch {
    return null;
  }
}

interface MetaphorDrop {
  source_model: string;
  summary: string;
  session_title?: string;
  context_payload?: Record<string, unknown>;
}

async function pushToMetaphor(drop: MetaphorDrop): Promise<void> {
  const token = getToken();
  if (!token) return; // Silently skip if not connected to Metaphor

  try {
    await fetch(`${METAPHOR_API}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: Date.now(),
        method: "tools/call",
        params: {
          name: "sync_chat_drop",
          arguments: {
            source_model: "atlas",
            ...drop,
          },
        },
      }),
    });
  } catch {
    // Non-critical — never block Atlas UI on Metaphor failures
    console.debug("[Atlas → Metaphor] Sync skipped:", drop.session_title);
  }
}

// ── Public sync functions ──────────────────────────────────────────

export function syncLeadCreated(lead: { company?: string; name?: string; stage?: string }) {
  pushToMetaphor({
    source_model: "atlas",
    session_title: `Lead Created: ${lead.company || lead.name || "Unknown"}`,
    summary: `New lead added to Atlas pipeline: ${lead.company || lead.name}. Stage: ${lead.stage || "Prospect"}.`,
    context_payload: { event: "lead_created", lead },
  });
}

export function syncLeadStageChanged(lead: { company?: string; name?: string; fromStage?: string; toStage?: string }) {
  pushToMetaphor({
    source_model: "atlas",
    session_title: `Pipeline Update: ${lead.company || lead.name}`,
    summary: `${lead.company || lead.name} moved from ${lead.fromStage || "Unknown"} to ${lead.toStage || "Unknown"} in Atlas pipeline.`,
    context_payload: { event: "lead_stage_changed", lead },
  });
}

export function syncDealClosed(lead: { company?: string; name?: string; value?: number; stage?: string }) {
  pushToMetaphor({
    source_model: "atlas",
    session_title: `Deal Closed: ${lead.company || lead.name}`,
    summary: `Atlas closed a deal with ${lead.company || lead.name}${lead.value ? ` (£${lead.value.toLocaleString()})` : ""}. Stage: ${lead.stage}.`,
    context_payload: { event: "deal_closed", lead },
  });
}

export function syncNoteAdded(lead: { company?: string; name?: string }, note: string) {
  pushToMetaphor({
    source_model: "atlas",
    session_title: `Note on ${lead.company || lead.name}`,
    summary: `New note on ${lead.company || lead.name}: "${note.substring(0, 200)}"`,
    context_payload: { event: "note_added", lead, note },
  });
}
