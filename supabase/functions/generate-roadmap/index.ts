import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface GenerateRoadmapRequest {
  map_id: string;
  provider?: "openai" | "anthropic" | "google" | "perplexity" | "nvidia-nim";
}

interface LLMMilestone {
  title: string;
  description: string;
  estimate_range: string; // e.g. "2–3 weeks"
  min_weeks: number;
  max_weeks: number;
}

interface GenerateRoadmapResponse {
  milestones: LLMMilestone[];
}

// ─── System Prompt ────────────────────────────────────────────────────────────

function buildSystemPrompt(): string {
  return `You are Atlas — a direct, quantitative strategic planner for early-stage founders. Your job is to generate a sequence of 3 to 6 high-level milestones from the current moment leading up to the founder's stated goal.

Reasoning rules (follow exactly):
- Never use exclamation points or emoji.
- Never manufacture urgency — state facts plainly.
- Reason from the overall GOAL STATEMENT first. If the goal is "get first 10 customers", milestones must focus on market validation, setting up outreach, landing the first pilot, and scaling to 10. If the goal is "ship v2 API", milestones must focus on specification, architecture, building, testing, and deployment.
- Avoid false precision. Do NOT give exact dates like "March 14th". Instead, give weekly range estimates (e.g. "Est. 2–3 weeks", "Est. 1–2 weeks"). Use plain language to describe uncertainty: e.g. "2–3 weeks depending on customer feedback rate".
- Each milestone must have a short, punchy title and a one-sentence description explaining what it accomplishes.
- Output a structured milestones list where each milestone has a Title, a Description, a weekly range description (estimate_range), and a min and max integer count of weeks (min_weeks, max_weeks).
- Return ONLY valid JSON matching this exact shape — no markdown, no explanation:
{
  "milestones": [
    {
      "title": "string",
      "description": "string",
      "estimate_range": "string",
      "min_weeks": number,
      "max_weeks": number
    }
  ]
}`;
}

function buildUserPrompt(goalStatement: string, manualNotes?: string): string {
  const notesSection = manualNotes?.trim()
    ? `\nFounder notes/context:\n${manualNotes.trim()}`
    : "";

  return `Founder's overall goal: "${goalStatement}"
${notesSection}

Based on this goal and any manual notes context, generate a sequence of 3 to 6 logical milestones leading to completion. Return the JSON structure containing milestones with range estimates.`;
}

// ─── LLM Providers ───────────────────────────────────────────────────────────

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 25000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

async function callOpenAI(system: string, user: string, apiKey: string): Promise<GenerateRoadmapResponse> {
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
  return JSON.parse(data.choices[0].message.content) as GenerateRoadmapResponse;
}

async function callAnthropic(system: string, user: string, apiKey: string): Promise<GenerateRoadmapResponse> {
  const res = await fetchWithTimeout("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-opus-4-5",
      max_tokens: 1024,
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
  return JSON.parse(jsonMatch[0]) as GenerateRoadmapResponse;
}

async function callGoogle(system: string, user: string, apiKey: string): Promise<GenerateRoadmapResponse> {
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
  return JSON.parse(data.candidates[0].content.parts[0].text) as GenerateRoadmapResponse;
}

async function callPerplexity(system: string, user: string, apiKey: string): Promise<GenerateRoadmapResponse> {
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
  return JSON.parse(jsonMatch[0]) as GenerateRoadmapResponse;
}

async function callNvidiaNim(system: string, user: string, apiKey: string): Promise<GenerateRoadmapResponse> {
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
  return JSON.parse(jsonMatch[0]) as GenerateRoadmapResponse;
}

async function callGroq(system: string, user: string, apiKey: string): Promise<GenerateRoadmapResponse> {
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
  return JSON.parse(data.choices[0].message.content) as GenerateRoadmapResponse;
}

// ─── Router ───────────────────────────────────────────────────────────────────

async function route(
  goalStatement: string,
  manualNotes?: string,
  provider?: string
): Promise<GenerateRoadmapResponse> {
  const system = buildSystemPrompt();
  const user = buildUserPrompt(goalStatement, manualNotes);

  const selectedProvider = provider ?? "nvidia-nim";
  const chain: Array<{ name: string; fn: () => Promise<GenerateRoadmapResponse> }> = [];

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

  addProvider(selectedProvider);

  const defaultOrder = ["nvidia-nim", "groq", "openai", "anthropic", "google", "perplexity"];
  for (const p of defaultOrder) {
    if (p !== selectedProvider) {
      addProvider(p);
    }
  }

  if (chain.length === 0) {
    throw new Error("No AI provider key is configured.");
  }

  let lastError: Error | null = null;
  for (const item of chain) {
    try {
      console.log(`[generate-roadmap] Trying LLM provider: ${item.name}...`);
      return await item.fn();
    } catch (e) {
      console.error(`[generate-roadmap] Provider ${item.name} failed:`, e.message || e);
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

    const body: GenerateRoadmapRequest = await req.json();
    if (!body.map_id) {
      return new Response(JSON.stringify({ error: "map_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Fetch map Details
    const { data: map, error: mapError } = await supabase
      .from("maps")
      .select("goal_statement, user_id, metadata")
      .eq("id", body.map_id)
      .maybeSingle();

    if (mapError || !map) {
      return new Response(JSON.stringify({ error: "Map not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const campaignIndex = (map.metadata as any)?.current_campaign_index || 1;

    // 2. Fetch latest manual notes to inject context
    const { data: noteSignal } = await supabase
      .from("signals")
      .select("payload")
      .eq("map_id", body.map_id)
      .eq("title", "__manual_note")
      .order("occurred_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const manualNotes = noteSignal?.payload?.note || "";

    // 3. Generate milestones sequence from LLM Router
    const response = await route(map.goal_statement, manualNotes, body.provider);

    if (!response.milestones || response.milestones.length === 0) {
      throw new Error("Failed to generate milestones.");
    }

    // 4. Sequentially calculate dates
    let currentDate = new Date();
    const insertedMilestones = [];

    // Clear existing milestones for this campaign index (in case of re-generation)
    await supabase
      .from("milestones")
      .delete()
      .eq("map_id", body.map_id)
      .filter("metadata->>campaign_index", "eq", campaignIndex.toString());

    for (let i = 0; i < response.milestones.length; i++) {
      const ms = response.milestones[i];
      const minWeeks = ms.min_weeks || 1;
      const maxWeeks = ms.max_weeks || 2;
      const durationDays = maxWeeks * 7;

      const estimatedStart = new Date(currentDate);
      const estimatedComplete = new Date(currentDate);
      estimatedComplete.setDate(estimatedComplete.getDate() + durationDays);

      const status = i === 0 ? "active" : "pending";

      const milestoneRow = {
        map_id: body.map_id,
        title: ms.title,
        description: ms.description,
        sequence: i,
        status,
        estimated_start: estimatedStart.toISOString().split("T")[0],
        estimated_complete: estimatedComplete.toISOString().split("T")[0],
        is_reforecast: false,
        metadata: {
          estimate_range: ms.estimate_range || `${minWeeks}–${maxWeeks} weeks`,
          min_weeks: minWeeks,
          max_weeks: maxWeeks,
          original_duration_days: durationDays,
          campaign_index: campaignIndex
        }
      };

      insertedMilestones.push(milestoneRow);
      // Next milestone starts where this one completes
      currentDate = estimatedComplete;
    }

    // Write milestones
    const { data: dbMilestones, error: insertError } = await supabase
      .from("milestones")
      .insert(insertedMilestones)
      .select();

    if (insertError) {
      throw new Error(`Database error saving milestones: ${insertError.message}`);
    }

    return new Response(JSON.stringify({ ok: true, milestones: dbMilestones }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
