import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface DiagnosticFlag {
  flag: string;
  reason: string;
  severity: "low" | "medium" | "high";
}

interface DiagnoseRequest {
  map_id: string;
  manual_notes?: string;
  provider?: "openai" | "anthropic" | "google" | "perplexity" | "nvidia-nim";
}

interface TrajectoryMetric {
  metric: string;       // e.g. "Outreach Emails Sent", "GitHub Shipping Rate", "Stripe Charges"
  current: string;      // e.g. "0 emails", "1 commit/week", "$0 MRR"
  target: string;       // e.g. "20 emails/week", "5+ commits/week", "$5,000 MRR"
  gap_analysis: string; // one-sentence gap or "On track" if healthy
}

interface StrategicPath {
  name: string;        // e.g. "Direct Outreach Path", "Self-Serve Launch"
  description: string; // e.g. "Pause coding. Contact 10 potential users by calendar invite."
  workload: string;    // e.g. "15 hrs/week outreach, 0 lines of code"
}

interface DiagnoseResponse {
  constraint: string;
  evidence: string;
  move: string;
  confidence: "emerging" | "building" | "established";
  trajectory_summary: string;        // Brutal, quantitative paragraph assessing current path vs. goal
  metrics: TrajectoryMetric[];        // 2–4 goal-relevant metrics with current vs target
  alternative_paths: StrategicPath[]; // Exactly 2 alternative strategic routes
  prediction?: {
    predicted_signal_type: "github_commits" | "notion_updates" | "stripe_charges" | "slack_messages" | "meeting_hours" | "unclear";
    predicted_signal: string;
    predicted_direction: "up" | "down" | "flat";
    predicted_days_window: number;
  };
}

// ─── System Prompt ────────────────────────────────────────────────────────────

function buildSystemPrompt(): string {
  return `You are Atlas — a direct, quantitative diagnostic engine for early-stage founders. Your job is to identify the single constraint blocking a founder's stated goal and produce a brutally honest, metrics-driven audit of their current trajectory.

Voice rules (follow exactly):
- Never use exclamation points or emoji
- Never manufacture urgency — state facts plainly
- Never be condescending or falsely encouraging
- Phrase constraints as present facts: "No outreach attempts recorded this week" not "You need to hustle!"
- Phrase moves as concrete, specific actions with clear scope: "Send 10 direct messages to potential customers via LinkedIn this week" not "Do more sales"
- constraint and move must each be one sentence
- trajectory_summary must be 2–4 sentences: brutal, quantitative, no filler

Constraint Logic Rules:
- NEVER repeat or recommend a move that is listed in the "Completed Next Moves" section.
- Reason from the GOAL STATEMENT first. A goal of "get first 10 customers" means the key metrics are customer acquisition (outreach, signups, conversions, demos booked) — NOT commit velocity. A goal of "ship v2 API" means the key metrics are engineering throughput. Match your metrics to what actually moves the needle for THIS specific goal.
- If code velocity is healthy (50+ commits/week) but there is no customer or revenue signal, the constraint is NOT engineering — it is distribution, outreach, or customer validation.
- If no integration signals exist, reason from the goal and manual notes to infer the most likely constraint and produce estimated/target metrics.

Metrics rules:
- Generate 2–4 metrics that are DIRECTLY relevant to the stated goal — not a fixed template.
- For customer acquisition goals: outreach volume, demo calls booked, conversion rate, signups.
- For product/shipping goals: commit rate, open PRs, spec completeness, deployment frequency.
- For revenue goals: MRR, average customer value, churn rate, Stripe charge frequency.
- For documentation/knowledge goals: Notion pages updated, spec completeness, decision logs.
- Use the actual signal data provided. If a signal is not available, use "Not tracked" as current and set a reasonable target based on the goal.

Alternative Paths rules:
- Generate exactly 2 alternative strategic routes that are fundamentally different from each other and from the primary move.
- Each path must have a name, a 1–2 sentence description, and a workload estimate (e.g. "8 hrs/week, no coding").
- Paths should represent genuinely different resource bets: e.g. outreach-first vs. product-led growth, paid ads vs. community building.

Confidence tiers:
- "emerging": little data, mostly inferred (1–2 weak signals)
- "building": some real signal but incomplete picture (2–3 moderate signals)
- "established": strong, recent, multi-source signal (3+ clear signals)

Prediction rules:
- The "prediction" object describes a specific, measurable signal that is expected to change as a result of the recommended primary "move".
- predicted_signal_type must be one of:
  - "github_commits" (if predicting change in commit frequency)
  - "notion_updates" (if predicting change in product docs/spec editing activity)
  - "stripe_charges" (if predicting change in billing frequency/revenue)
  - "slack_messages" (if predicting change in team Slack communication activity)
  - "meeting_hours" (if predicting change in calendar meetings duration)
  - "unclear" (if the expected change cannot be measured programmatically through these integrations)
- predicted_signal must be a precise description of the expected change (e.g. "customer-facing commits per week" or "Notion product spec updates").
- predicted_direction must be "up", "down", or "flat".
- predicted_days_window must be an integer between 3 and 14 representing a reasonable window to check back (e.g., 7 for a week, 14 for two weeks, 5 for a few days).

Return ONLY valid JSON matching this exact shape — no markdown, no explanation:
{
  "constraint": "string",
  "evidence": "string",
  "move": "string",
  "confidence": "emerging" | "building" | "established",
  "trajectory_summary": "string",
  "metrics": [
    {
      "metric": "string",
      "current": "string",
      "target": "string",
      "gap_analysis": "string"
    }
  ],
  "alternative_paths": [
    {
      "name": "string",
      "description": "string",
      "workload": "string"
    },
    {
      "name": "string",
      "description": "string",
      "workload": "string"
    }
  ],
  "prediction": {
    "predicted_signal_type": "github_commits" | "notion_updates" | "stripe_charges" | "slack_messages" | "meeting_hours" | "unclear",
    "predicted_signal": "string",
    "predicted_direction": "up" | "down" | "flat",
    "predicted_days_window": number
  }
}`;
}

function buildUserPrompt(
  goalStatement: string,
  flags: DiagnosticFlag[],
  manualNotes?: string,
  recentFeedbackNotes?: string[],
  statedContext?: string,
  completedMoves?: string[],
  healthySummaries?: string[]
): string {
  let flagLines = flags.length > 0
    ? flags.map(f => `- [${f.severity.toUpperCase()}] ${f.flag}: ${f.reason}`).join("\n")
    : "";

  if (healthySummaries && healthySummaries.length > 0) {
    if (flagLines) flagLines += "\n";
    flagLines += "Healthy tool signals (no warning flags needed):\n" + healthySummaries.map(s => `- [HEALTHY] ${s}`).join("\n");
  }

  if (!flagLines) {
    flagLines = "- No live integration signals available yet.";
  }

  const notesSection = manualNotes?.trim()
    ? `\nFounder notes:\n${manualNotes.trim()}`
    : "";

  const feedbackSection = recentFeedbackNotes && recentFeedbackNotes.length > 0
    ? `\nUser feedback logs from past recommendations (take this learning history into account):\n${recentFeedbackNotes.map(n => `- ${n}`).join("\n")}`
    : "";

  const statedContextSection = statedContext?.trim()
    ? `\nUser's previously stated context (from onboarding — treat as foundational background):\n${statedContext.trim()}`
    : "";

  const completedMovesSection = completedMoves && completedMoves.length > 0
    ? `\nCompleted Next Moves (DO NOT repeat these actions under any circumstances as the user has already successfully accomplished them):\n${completedMoves.map(m => `- ${m}`).join("\n")}`
    : "";

  return `Founder's stated goal: "${goalStatement}"

Deterministic signals from connected tools:
${flagLines}${statedContextSection}${notesSection}${feedbackSection}${completedMovesSection}

Based on the founder's goal, these specific signals, stated context, and past feedback history, identify the single constraint most likely blocking progress right now. If no live signals are available, reason from the stated goal and context to infer the most likely constraint. Consider the goal carefully — a commit velocity flag matters very differently for "get my first 10 customers" versus "ship the v2 API."`;
}

// ─── LLM Providers ───────────────────────────────────────────────────────────

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 25000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } finally {
    clearTimeout(id);
  }
}

async function callOpenAI(system: string, user: string, apiKey: string): Promise<DiagnoseResponse> {
  const res = await fetchWithTimeout("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "gpt-4o",
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI error: ${await res.text()}`);
  const data = await res.json();
  return JSON.parse(data.choices[0].message.content) as DiagnoseResponse;
}

async function callAnthropic(system: string, user: string, apiKey: string): Promise<DiagnoseResponse> {
  const res = await fetchWithTimeout("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-opus-4-5",
      max_tokens: 512,
      temperature: 0.3,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic error: ${await res.text()}`);
  const data = await res.json();
  const text = data.content[0].text;
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON found in Anthropic response");
  return JSON.parse(jsonMatch[0]) as DiagnoseResponse;
}

async function callGoogle(system: string, user: string, apiKey: string): Promise<DiagnoseResponse> {
  const res = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        generationConfig: { temperature: 0.3, responseMimeType: "application/json" },
        contents: [{ role: "user", parts: [{ text: `${system}\n\n${user}` }] }],
      }),
    }
  );
  if (!res.ok) throw new Error(`Google Gemini error: ${await res.text()}`);
  const data = await res.json();
  return JSON.parse(data.candidates[0].content.parts[0].text) as DiagnoseResponse;
}

async function callPerplexity(system: string, user: string, apiKey: string): Promise<DiagnoseResponse> {
  const res = await fetchWithTimeout("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "sonar-pro",
      temperature: 0.3,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Perplexity error: ${await res.text()}`);
  const data = await res.json();
  const text = data.choices[0].message.content;
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON found in Perplexity response");
  return JSON.parse(jsonMatch[0]) as DiagnoseResponse;
}

async function callNvidiaNim(system: string, user: string, apiKey: string): Promise<DiagnoseResponse> {
  const res = await fetchWithTimeout("https://integrate.api.nvidia.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "meta/llama-3.3-70b-instruct",
      temperature: 0.3,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) throw new Error(`NVIDIA NIM error: ${await res.text()}`);
  const data = await res.json();
  const text = data.choices[0].message.content;
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON found in NVIDIA NIM response");
  return JSON.parse(jsonMatch[0]) as DiagnoseResponse;
}

async function callGroq(system: string, user: string, apiKey: string): Promise<DiagnoseResponse> {
  const res = await fetchWithTimeout("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Groq error: ${await res.text()}`);
  const data = await res.json();
  return JSON.parse(data.choices[0].message.content) as DiagnoseResponse;
}

// ─── Router ───────────────────────────────────────────────────────────────────

async function route(
  goalStatement: string,
  flags: DiagnosticFlag[],
  manualNotes?: string,
  provider?: string,
  recentFeedbackNotes?: string[],
  statedContext?: string,
  completedMoves?: string[],
  healthySummaries?: string[]
): Promise<DiagnoseResponse> {
  const system = buildSystemPrompt();
  const user = buildUserPrompt(goalStatement, flags, manualNotes, recentFeedbackNotes, statedContext, completedMoves, healthySummaries);

  const selectedProvider = provider ?? "nvidia-nim";
  const chain: Array<{ name: string; fn: () => Promise<DiagnoseResponse> }> = [];

  // Helper to add providers if they have keys
  const addProvider = (p: string) => {
    if (p === "openai" && Deno.env.get("OPENAI_API_KEY")) {
      chain.push({ name: "OpenAI", fn: () => callOpenAI(system, user, Deno.env.get("OPENAI_API_KEY")!) });
    } else if (p === "anthropic" && Deno.env.get("ANTHROPIC_API_KEY")) {
      chain.push({ name: "Anthropic", fn: () => callAnthropic(system, user, Deno.env.get("ANTHROPIC_API_KEY")!) });
    } else if (p === "google" && Deno.env.get("GOOGLE_AI_API_KEY")) {
      chain.push({ name: "Gemini", fn: () => callGoogle(system, user, Deno.env.get("GOOGLE_AI_API_KEY")!) });
    } else if (p === "perplexity" && Deno.env.get("PERPLEXITY_API_KEY")) {
      chain.push({ name: "Perplexity", fn: () => callPerplexity(system, user, Deno.env.get("PERPLEXITY_API_KEY")!) });
    } else if (p === "nvidia-nim" && Deno.env.get("NVIDIA_NIM_API_KEY")) {
      chain.push({ name: "Nvidia NIM", fn: () => callNvidiaNim(system, user, Deno.env.get("NVIDIA_NIM_API_KEY")!) });
    } else if (p === "groq" && Deno.env.get("GROQ_API_KEY")) {
      chain.push({ name: "Groq", fn: () => callGroq(system, user, Deno.env.get("GROQ_API_KEY")!) });
    }
  };

  // 1. Add selected provider first
  addProvider(selectedProvider);

  // 2. Add fallbacks in order of preference (excluding the selected one to avoid double-adding)
  const defaultOrder = ["nvidia-nim", "groq", "openai", "anthropic", "google", "perplexity"];
  for (const p of defaultOrder) {
    if (p !== selectedProvider) {
      addProvider(p);
    }
  }

  if (chain.length === 0) {
    // Return structured error so client can show a specific message instead of silent fallback
    return new Response(JSON.stringify({ error: "no_llm_key", message: "No AI provider key is configured. Add an API key in Supabase Edge Function secrets to enable diagnosis." }), {
      status: 503,
      headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Content-Type": "application/json" },
    }) as unknown as DiagnoseResponse;
  }

  let lastError: Error | null = null;
  for (const item of chain) {
    try {
      console.log(`[diagnose-map] Trying LLM provider: ${item.name}...`);
      return await item.fn();
    } catch (e) {
      console.error(`[diagnose-map] Provider ${item.name} failed:`, e.message || e);
      lastError = e as Error;
    }
  }
  throw lastError ?? new Error("All LLM providers failed");
}

// ─── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const isTestMode = url.searchParams.get("test") === "true";

    const authHeader = req.headers.get("authorization");
    if (!authHeader && !isTestMode) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: DiagnoseRequest = await req.json();
    if (!body.map_id) {
      return new Response(JSON.stringify({ error: "map_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Initialize Supabase clients
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // If called with the service role key or in test mode, use an admin client
    // that bypasses RLS. Otherwise use the user-scoped client.
    const isServiceCall = isTestMode || (authHeader === `Bearer ${supabaseServiceKey}`);
    const userClient = isServiceCall
      ? createClient(supabaseUrl, supabaseServiceKey)
      : createClient(supabaseUrl, supabaseAnonKey, {
          global: { headers: { Authorization: authHeader! } },
        });

    // 1. Fetch map goal_statement
    const { data: map, error: mapError } = await userClient
      .from("maps")
      .select("goal_statement")
      .eq("id", body.map_id)
      .maybeSingle();

    if (mapError || !map) {
      return new Response(JSON.stringify({ error: "Map not found or unauthorized" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Fetch signals (last 14 days for activity; manual notes can be older)
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    const { data: signals, error: signalsError } = await userClient
      .from("signals")
      .select("title, occurred_at, payload")
      .eq("map_id", body.map_id)
      .order("occurred_at", { ascending: false });

    if (signalsError) {
      return new Response(JSON.stringify({ error: `Failed to fetch signals: ${signalsError.message}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Fetch existing waypoints for this map to use as stated context
    const { data: existingWaypoints } = await userClient
      .from("waypoints")
      .select("kind, title, confidence, completed_at")
      .eq("map_id", body.map_id)
      .order("position", { ascending: true });

    let statedContext = "";
    const completedMoves: string[] = [];
    if (existingWaypoints && existingWaypoints.length > 0) {
      const contextLines = existingWaypoints
        .filter(w => w.kind !== "goal") // goal is already in the prompt
        .map(w => {
          if (w.kind === "move" && w.completed_at) {
            completedMoves.push(w.title);
          }
          return `- ${w.kind}${w.completed_at ? " (Completed)" : ""}: ${w.title}`;
        })
        .join("\n");
      if (contextLines) {
        statedContext = contextLines;
      }
    }

    // 4. Compute Multi-Source Integration flags based on the last 14 days of signals
    const flags: DiagnosticFlag[] = [];
    const now = new Date();
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    // ─── GitHub ───
    const commitSignals = signals?.filter(
      (s) =>
        new Date(s.occurred_at) >= twoWeeksAgo &&
        (s.payload?.type === "commit" || s.title.startsWith("Commit:"))
    ) ?? [];

    const commitsThisWeek = commitSignals.filter(
      (c) => new Date(c.occurred_at) >= oneWeekAgo
    ).length;
    const commitsLastWeek = commitSignals.length - commitsThisWeek;

    const latestCommit = commitSignals[0] ?? null;
    const latestCommitDate = latestCommit ? new Date(latestCommit.occurred_at) : null;
    const daysSinceLastCommit = latestCommitDate
      ? Math.floor((now.getTime() - latestCommitDate.getTime()) / (1000 * 60 * 60 * 24))
      : 14;
    const lastCommitMessage = latestCommit
      ? (latestCommit.payload?.message || latestCommit.title.replace("Commit: ", ""))
      : "";

    if (daysSinceLastCommit > 7) {
      flags.push({
        flag: "No GitHub activity in over a week",
        reason: `Last commit was ${daysSinceLastCommit} days ago: "${lastCommitMessage}"`,
        severity: "high",
      });
    }
    if (commitsThisWeek === 0 && daysSinceLastCommit <= 7) {
      flags.push({
        flag: "Zero commits this week",
        reason: `${commitsLastWeek} commits last week, 0 this week.`,
        severity: "medium",
      });
    }
    if (commitsLastWeek > 0 && commitsThisWeek < commitsLastWeek * 0.5 && commitsThisWeek > 0) {
      const drop = Math.round(((commitsLastWeek - commitsThisWeek) / commitsLastWeek) * 100);
      flags.push({
        flag: "Commit velocity dropping",
        reason: `${commitsThisWeek} commits this week vs ${commitsLastWeek} last week — ${drop}% drop.`,
        severity: "medium",
      });
    }

    // ─── Stripe ───
    const stripeSignals = signals?.filter(
      (s) => new Date(s.occurred_at) >= twoWeeksAgo && s.payload?.type === "stripe"
    ) ?? [];
    const chargesThisWeek = stripeSignals.filter(
      (s) => new Date(s.occurred_at) >= oneWeekAgo
    ).length;
    const chargesLastWeek = stripeSignals.length - chargesThisWeek;

    if (stripeSignals.length > 0) {
      if (chargesThisWeek === 0) {
        flags.push({
          flag: "Zero Stripe charges this week",
          reason: `Had ${chargesLastWeek} charges last week, but none in the last 7 days.`,
          severity: "high",
        });
      } else if (chargesThisWeek < chargesLastWeek * 0.5) {
        flags.push({
          flag: "Customer billing frequency dropped",
          reason: `${chargesThisWeek} charges this week vs ${chargesLastWeek} last week.`,
          severity: "medium",
        });
      }
    }

    // ─── Notion ───
    const notionSignals = signals?.filter(
      (s) => new Date(s.occurred_at) >= twoWeeksAgo && s.payload?.type === "notion"
    ) ?? [];
    const updatesThisWeek = notionSignals.filter(
      (s) => new Date(s.occurred_at) >= oneWeekAgo
    ).length;

    if (notionSignals.length > 0 && updatesThisWeek === 0) {
      flags.push({
        flag: "No product docs or specs updated in Notion",
        reason: `Zero Notion document updates recorded in the last 7 days.`,
        severity: "medium",
      });
    }

    // ─── Slack ───
    const slackSignals = signals?.filter(
      (s) => new Date(s.occurred_at) >= twoWeeksAgo && s.payload?.type === "slack"
    ) ?? [];
    const slackThisWeek = slackSignals.filter(
      (s) => new Date(s.occurred_at) >= oneWeekAgo
    ).length;
    const slackLastWeek = slackSignals.length - slackThisWeek;

    if (slackSignals.length > 0) {
      if (slackThisWeek < slackLastWeek * 0.4) {
        flags.push({
          flag: "Team Slack chat activity dropped significantly",
          reason: `Only ${slackThisWeek} messages this week vs ${slackLastWeek} last week.`,
          severity: "medium",
        });
      }
    }

    // ─── Google Workspace ───
    const googleSignals = signals?.filter(
      (s) => new Date(s.occurred_at) >= twoWeeksAgo && s.payload?.type === "google"
    ) ?? [];
    const meetingMinutesThisWeek = googleSignals
      .filter((s) => new Date(s.occurred_at) >= oneWeekAgo)
      .reduce((acc, s) => acc + (s.payload?.duration_minutes || 0), 0);
    const meetingHours = Math.round(meetingMinutesThisWeek / 60);

    if (meetingHours > 15) {
      flags.push({
        flag: "Meeting overload detected in Calendar",
        reason: `Spent ${meetingHours} hours in calendar meetings this week. High shipping bottleneck risk.`,
        severity: "high",
      });
    }

    // Build healthy summaries to prevent false "no signals connected" LLM logic
    const healthySummaries: string[] = [];
    if (commitSignals.length > 0) {
      if (daysSinceLastCommit <= 7 && commitsThisWeek > 0) {
        healthySummaries.push(
          `GitHub active: ${commitsThisWeek} commits this week, last commit was ${daysSinceLastCommit} days ago.`
        );
      }
    }
    if (notionSignals.length > 0) {
      if (updatesThisWeek > 0) {
        healthySummaries.push(
          `Notion active: ${updatesThisWeek} document updates recorded this week.`
        );
      }
    }
    if (stripeSignals.length > 0 && chargesThisWeek > 0) {
      healthySummaries.push(`Stripe active: ${chargesThisWeek} charges recorded this week.`);
    }
    if (slackSignals.length > 0 && slackThisWeek > 0) {
      healthySummaries.push(`Slack active: ${slackThisWeek} team messages sent this week.`);
    }
    if (googleSignals.length > 0 && meetingHours <= 15) {
      healthySummaries.push(`Google Calendar active: ${meetingHours} hours of meetings (healthy load).`);
    }

    const hasSignals = flags.length > 0 || healthySummaries.length > 0;

    // 6. Fetch recent feedback logs for this map
    const { data: feedbackLogs } = await userClient
      .from("activity_logs")
      .select("action, meta")
      .eq("target_type", "map")
      .eq("target_id", body.map_id)
      .order("created_at", { ascending: false })
      .limit(10);

    const recentFeedbackNotes: string[] = [];
    if (feedbackLogs && feedbackLogs.length > 0) {
      feedbackLogs.forEach((log: any) => {
        const title = log.meta?.waypoint_text || "unspecified waypoint";
        const kind = log.meta?.waypoint_kind || "unspecified";
        if (log.action === "feedback_constraint_wrong") {
          recentFeedbackNotes.push(`The user marked the constraint "${title}" (${kind}) as WRONG/inaccurate.`);
        } else if (log.action === "feedback_move_done") {
          recentFeedbackNotes.push(`The user completed the recommended action: "${title}".`);
        } else if (log.action === "feedback_move_skipped") {
          recentFeedbackNotes.push(`The user chose to skip the recommended action: "${title}".`);
        }
      });
    }

    // 7. Resolve manual notes: check request body first, otherwise fall back to latest in DB
    const manualNoteSignal = signals?.find((s) => s.title === "__manual_note");
    const dbManualNote = manualNoteSignal?.payload?.note || "";
    const manualNotes = body.manual_notes ?? dbManualNote;

    // 8. Call the LLM chain
    const result = await route(map.goal_statement, flags, manualNotes, body.provider, recentFeedbackNotes, statedContext, completedMoves, healthySummaries);

    // If route() returned a Response (no_llm_key case), pass it through
    if (result instanceof Response) return result;

    // Build structured evidence_sources from deterministic flags and manual notes
    const evidenceSources = flags.map(f => {
      let src = "GitHub";
      const fl = f.flag.toLowerCase();
      let url: string | null = null;
      if (fl.includes("stripe")) {
        src = "Stripe";
      } else if (fl.includes("notion") || fl.includes("docs")) {
        src = "Notion";
        url = notionSignals?.[0]?.payload?.url || null;
      } else if (fl.includes("slack")) {
        src = "Slack";
      } else if (fl.includes("calendar") || fl.includes("meeting")) {
        src = "Google Workspace";
      } else {
        // GitHub
        url = latestCommit?.payload?.url || null;
      }
      return {
        source: src,
        detail: `${f.flag}: ${f.reason}`,
        url: url
      };
    });

    if (manualNotes && manualNotes.trim()) {
      evidenceSources.push({
        source: "Manual Notes",
        detail: manualNotes.trim(),
        url: null
      });
    }

    // Compute baseline value for prediction
    let baselineValue = "0";
    const sigType = result.prediction?.predicted_signal_type || "unclear";
    if (sigType === "github_commits") baselineValue = String(commitsThisWeek);
    else if (sigType === "notion_updates") baselineValue = String(updatesThisWeek);
    else if (sigType === "stripe_charges") baselineValue = String(chargesThisWeek);
    else if (sigType === "slack_messages") baselineValue = String(slackThisWeek);
    else if (sigType === "meeting_hours") baselineValue = String(meetingHours);
    else baselineValue = "unclear";

    // Compute check back date (YYYY-MM-DD)
    const checkBackDate = new Date();
    const days = result.prediction?.predicted_days_window || 7;
    checkBackDate.setDate(checkBackDate.getDate() + days);
    const checkBackStr = checkBackDate.toISOString().split("T")[0];

    const responseBody = {
      ...result,
      evidence_sources: evidenceSources,
      // Pass trajectory fields through explicitly so the client can store them in waypoint metadata
      trajectory_summary: result.trajectory_summary ?? null,
      metrics: result.metrics ?? [],
      alternative_paths: result.alternative_paths ?? [],
      // Prediction fields
      predicted_signal: result.prediction?.predicted_signal ?? null,
      predicted_direction: result.prediction?.predicted_direction ?? null,
      predicted_baseline_value: baselineValue,
      check_back_date: checkBackStr,
      result_status: "pending",
      result_summary: null,
      predicted_signal_type: sigType
    };

    return new Response(JSON.stringify(responseBody), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
