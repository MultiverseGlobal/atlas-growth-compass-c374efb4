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

interface DiagnoseResponse {
  constraint: string;
  evidence: string;
  move: string;
  confidence: "emerging" | "building" | "established";
}

// ─── System Prompt ────────────────────────────────────────────────────────────

function buildSystemPrompt(): string {
  return `You are Atlas — a calm, direct diagnostic tool for early-stage founders. Your job is to identify the single constraint most likely blocking a founder's stated goal, based on real signals from their connected tools.

Voice rules (follow these exactly):
- Never use exclamation points or emoji
- Never manufacture urgency — state facts plainly
- Never be condescending or falsely encouraging
- Phrase constraints as present facts: "Commit velocity has dropped 60% week-over-week" not "Your velocity is tanking!"
- Phrase moves as concrete actions, not vague suggestions: "Merge the open PR blocking the onboarding path" not "Fix technical debt"
- Keep all text short — constraint and move should each be one sentence

Confidence tiers:
- "emerging": little data, mostly inferred (1–2 weak signals)
- "building": some real signal but incomplete picture (2–3 moderate signals)
- "established": strong, recent, multi-source signal (3+ clear signals)

Return ONLY valid JSON matching this exact shape:
{
  "constraint": "string",
  "evidence": "string",
  "move": "string",
  "confidence": "emerging" | "building" | "established"
}`;
}

function buildUserPrompt(
  goalStatement: string,
  flags: DiagnosticFlag[],
  manualNotes?: string,
  recentFeedbackNotes?: string[]
): string {
  const flagLines = flags.length > 0
    ? flags.map(f => `- [${f.severity.toUpperCase()}] ${f.flag}: ${f.reason}`).join("\n")
    : "- No GitHub signals available yet.";

  const notesSection = manualNotes?.trim()
    ? `\nFounder notes:\n${manualNotes.trim()}`
    : "";

  const feedbackSection = recentFeedbackNotes && recentFeedbackNotes.length > 0
    ? `\nUser feedback logs from past recommendations (take this learning history into account):\n${recentFeedbackNotes.map(n => `- ${n}`).join("\n")}`
    : "";

  return `Founder's stated goal: "${goalStatement}"

Deterministic signals from connected tools:
${flagLines}${notesSection}${feedbackSection}

Based on the founder's goal, these specific signals, and past feedback history, identify the single constraint most likely blocking progress right now. Consider the goal carefully — a commit velocity flag matters very differently for "get my first 10 customers" versus "ship the v2 API."`;
}

// ─── LLM Providers ───────────────────────────────────────────────────────────

async function callOpenAI(system: string, user: string, apiKey: string): Promise<DiagnoseResponse> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
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
  const res = await fetch("https://api.anthropic.com/v1/messages", {
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
  const res = await fetch(
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
  const res = await fetch("https://api.perplexity.ai/chat/completions", {
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
  const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
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

// ─── Router ───────────────────────────────────────────────────────────────────

async function route(
  goalStatement: string,
  flags: DiagnosticFlag[],
  manualNotes?: string,
  provider?: string,
  recentFeedbackNotes?: string[]
): Promise<DiagnoseResponse> {
  const system = buildSystemPrompt();
  const user = buildUserPrompt(goalStatement, flags, manualNotes, recentFeedbackNotes);

  const selectedProvider = provider ?? "openai";
  const chain: Array<() => Promise<DiagnoseResponse>> = [];

  if (selectedProvider === "openai" && Deno.env.get("OPENAI_API_KEY")) {
    chain.push(() => callOpenAI(system, user, Deno.env.get("OPENAI_API_KEY")!));
  }
  if (selectedProvider === "anthropic" && Deno.env.get("ANTHROPIC_API_KEY")) {
    chain.push(() => callAnthropic(system, user, Deno.env.get("ANTHROPIC_API_KEY")!));
  }
  if (selectedProvider === "google" && Deno.env.get("GOOGLE_AI_API_KEY")) {
    chain.push(() => callGoogle(system, user, Deno.env.get("GOOGLE_AI_API_KEY")!));
  }
  if (selectedProvider === "perplexity" && Deno.env.get("PERPLEXITY_API_KEY")) {
    chain.push(() => callPerplexity(system, user, Deno.env.get("PERPLEXITY_API_KEY")!));
  }
  if (selectedProvider === "nvidia-nim" && Deno.env.get("NVIDIA_NIM_API_KEY")) {
    chain.push(() => callNvidiaNim(system, user, Deno.env.get("NVIDIA_NIM_API_KEY")!));
  }

  // Fallbacks
  if (selectedProvider !== "openai" && Deno.env.get("OPENAI_API_KEY")) {
    chain.push(() => callOpenAI(system, user, Deno.env.get("OPENAI_API_KEY")!));
  }
  if (selectedProvider !== "anthropic" && Deno.env.get("ANTHROPIC_API_KEY")) {
    chain.push(() => callAnthropic(system, user, Deno.env.get("ANTHROPIC_API_KEY")!));
  }
  if (selectedProvider !== "google" && Deno.env.get("GOOGLE_AI_API_KEY")) {
    chain.push(() => callGoogle(system, user, Deno.env.get("GOOGLE_AI_API_KEY")!));
  }
  if (selectedProvider !== "perplexity" && Deno.env.get("PERPLEXITY_API_KEY")) {
    chain.push(() => callPerplexity(system, user, Deno.env.get("PERPLEXITY_API_KEY")!));
  }
  if (selectedProvider !== "nvidia-nim" && Deno.env.get("NVIDIA_NIM_API_KEY")) {
    chain.push(() => callNvidiaNim(system, user, Deno.env.get("NVIDIA_NIM_API_KEY")!));
  }

  if (chain.length === 0) {
    throw new Error("No LLM API keys configured. Add at least one key to Supabase Edge Function secrets.");
  }

  let lastError: Error | null = null;
  for (const fn of chain) {
    try {
      return await fn();
    } catch (e) {
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
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
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

    // If called with the service role key (e.g. from daily-sync-cron), use an admin client
    // that bypasses RLS. Otherwise use the user-scoped client.
    const isServiceCall = authHeader === `Bearer ${supabaseServiceKey}`;
    const userClient = isServiceCall
      ? createClient(supabaseUrl, supabaseServiceKey)
      : createClient(supabaseUrl, supabaseAnonKey, {
          global: { headers: { Authorization: authHeader } },
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

    // 3. Compute GitHub flags based on the last 14 days of signals
    const commitSignals = signals?.filter(
      (s) =>
        new Date(s.occurred_at) >= twoWeeksAgo &&
        (s.payload?.type === "commit" || s.title.startsWith("Commit:"))
    ) ?? [];

    const now = new Date();
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

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

    const flags: DiagnosticFlag[] = [];
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
    if (commitsThisWeek >= commitsLastWeek && commitsThisWeek > 0) {
      flags.push({
        flag: "Development velocity is stable or increasing",
        reason: `${commitsThisWeek} commits this week vs ${commitsLastWeek} last week.`,
        severity: "low",
      });
    }

    // 4. Fetch recent feedback logs for this map
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

    // 5. Resolve manual notes: check request body first, otherwise fall back to latest in DB
    const manualNoteSignal = signals?.find((s) => s.title === "__manual_note");
    const dbManualNote = manualNoteSignal?.payload?.note || "";
    const manualNotes = body.manual_notes ?? dbManualNote;

    // 6. Call the LLM chain
    const result = await route(map.goal_statement, flags, manualNotes, body.provider, recentFeedbackNotes);

    return new Response(JSON.stringify(result), {
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
