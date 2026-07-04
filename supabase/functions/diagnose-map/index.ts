import "jsr:@supabase/functions-js/edge-runtime.d.ts";

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
  goal_statement: string;
  flags: DiagnosticFlag[];
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

function buildUserPrompt(req: DiagnoseRequest): string {
  const flagLines = req.flags.length > 0
    ? req.flags.map(f => `- [${f.severity.toUpperCase()}] ${f.flag}: ${f.reason}`).join("\n")
    : "- No GitHub signals available yet.";

  const notesSection = req.manual_notes?.trim()
    ? `\nFounder notes:\n${req.manual_notes.trim()}`
    : "";

  return `Founder's stated goal: "${req.goal_statement}"

Deterministic signals from connected tools:
${flagLines}${notesSection}

Based on the founder's goal and these specific signals, identify the single constraint most likely blocking progress right now. Consider the goal carefully — a commit velocity flag matters very differently for "get my first 10 customers" versus "ship the v2 API."`;
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
  // NVIDIA NIM uses an OpenAI-compatible API
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

async function route(req: DiagnoseRequest): Promise<DiagnoseResponse> {
  const system = buildSystemPrompt();
  const user = buildUserPrompt(req);

  const provider = req.provider ?? "openai";

  // Try requested provider first, then fall back down the chain
  const chain: Array<() => Promise<DiagnoseResponse>> = [];

  if (provider === "openai" && Deno.env.get("OPENAI_API_KEY")) {
    chain.push(() => callOpenAI(system, user, Deno.env.get("OPENAI_API_KEY")!));
  }
  if (provider === "anthropic" && Deno.env.get("ANTHROPIC_API_KEY")) {
    chain.push(() => callAnthropic(system, user, Deno.env.get("ANTHROPIC_API_KEY")!));
  }
  if (provider === "google" && Deno.env.get("GOOGLE_AI_API_KEY")) {
    chain.push(() => callGoogle(system, user, Deno.env.get("GOOGLE_AI_API_KEY")!));
  }
  if (provider === "perplexity" && Deno.env.get("PERPLEXITY_API_KEY")) {
    chain.push(() => callPerplexity(system, user, Deno.env.get("PERPLEXITY_API_KEY")!));
  }
  if (provider === "nvidia-nim" && Deno.env.get("NVIDIA_NIM_API_KEY")) {
    chain.push(() => callNvidiaNim(system, user, Deno.env.get("NVIDIA_NIM_API_KEY")!));
  }

  // Add fallbacks from other available providers
  if (provider !== "openai" && Deno.env.get("OPENAI_API_KEY")) {
    chain.push(() => callOpenAI(system, user, Deno.env.get("OPENAI_API_KEY")!));
  }
  if (provider !== "anthropic" && Deno.env.get("ANTHROPIC_API_KEY")) {
    chain.push(() => callAnthropic(system, user, Deno.env.get("ANTHROPIC_API_KEY")!));
  }
  if (provider !== "google" && Deno.env.get("GOOGLE_AI_API_KEY")) {
    chain.push(() => callGoogle(system, user, Deno.env.get("GOOGLE_AI_API_KEY")!));
  }
  if (provider !== "perplexity" && Deno.env.get("PERPLEXITY_API_KEY")) {
    chain.push(() => callPerplexity(system, user, Deno.env.get("PERPLEXITY_API_KEY")!));
  }
  if (provider !== "nvidia-nim" && Deno.env.get("NVIDIA_NIM_API_KEY")) {
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
    const body: DiagnoseRequest = await req.json();

    if (!body.goal_statement) {
      return new Response(JSON.stringify({ error: "goal_statement is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await route(body);

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
