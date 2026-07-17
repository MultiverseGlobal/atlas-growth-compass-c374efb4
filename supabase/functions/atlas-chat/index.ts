import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ChatRequest {
  map_id: string;
  message: string;
  provider?: "openai" | "anthropic" | "google" | "perplexity" | "nvidia-nim";
}

interface ChatResponse {
  reply: string;
  action: null | {
    type: "mark_commitment_done" | "mark_commitment_not_done" | "add_manual_note" | "trigger_sync_and_diagnose";
    note?: string;
  };
}

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

async function callOpenAI(system: string, user: string, apiKey: string): Promise<ChatResponse> {
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
  return JSON.parse(data.choices[0].message.content) as ChatResponse;
}

async function callAnthropic(system: string, user: string, apiKey: string): Promise<ChatResponse> {
  const res = await fetchWithTimeout("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-3-5-sonnet-20241022",
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
  return JSON.parse(jsonMatch[0]) as ChatResponse;
}

async function callGoogle(system: string, user: string, apiKey: string): Promise<ChatResponse> {
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
  return JSON.parse(data.candidates[0].content.parts[0].text) as ChatResponse;
}

async function callPerplexity(system: string, user: string, apiKey: string): Promise<ChatResponse> {
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
  return JSON.parse(jsonMatch[0]) as ChatResponse;
}

async function callNvidiaNim(system: string, user: string, apiKey: string): Promise<ChatResponse> {
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
  return JSON.parse(jsonMatch[0]) as ChatResponse;
}

async function callGroq(system: string, user: string, apiKey: string): Promise<ChatResponse> {
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
  return JSON.parse(data.choices[0].message.content) as ChatResponse;
}

async function route(
  systemPrompt: string,
  userPrompt: string,
  provider?: string
): Promise<ChatResponse> {
  const selectedProvider = provider ?? "nvidia-nim";
  const chain: Array<{ name: string; fn: () => Promise<ChatResponse> }> = [];

  const addProvider = (p: string) => {
    if (p === "openai" && Deno.env.get("OPENAI_API_KEY")) {
      chain.push({ name: "OpenAI", fn: () => callOpenAI(systemPrompt, userPrompt, Deno.env.get("OPENAI_API_KEY")!) });
    } else if (p === "anthropic" && Deno.env.get("ANTHROPIC_API_KEY")) {
      chain.push({ name: "Anthropic", fn: () => callAnthropic(systemPrompt, userPrompt, Deno.env.get("ANTHROPIC_API_KEY")!) });
    } else if (p === "google" && Deno.env.get("GOOGLE_AI_API_KEY")) {
      chain.push({ name: "Gemini", fn: () => callGoogle(systemPrompt, userPrompt, Deno.env.get("GOOGLE_AI_API_KEY")!) });
    } else if (p === "perplexity" && Deno.env.get("PERPLEXITY_API_KEY")) {
      chain.push({ name: "Perplexity", fn: () => callPerplexity(systemPrompt, userPrompt, Deno.env.get("PERPLEXITY_API_KEY")!) });
    } else if (p === "nvidia-nim" && Deno.env.get("NVIDIA_NIM_API_KEY")) {
      chain.push({ name: "Nvidia NIM", fn: () => callNvidiaNim(systemPrompt, userPrompt, Deno.env.get("NVIDIA_NIM_API_KEY")!) });
    } else if (p === "groq" && Deno.env.get("GROQ_API_KEY")) {
      chain.push({ name: "Groq", fn: () => callGroq(systemPrompt, userPrompt, Deno.env.get("GROQ_API_KEY")!) });
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
    throw new Error("No AI provider key is configured. Add secrets to Supabase Edge Functions.");
  }

  let lastError: Error | null = null;
  for (const item of chain) {
    try {
      console.log(`[atlas-chat] Trying LLM provider: ${item.name}...`);
      return await item.fn();
    } catch (e) {
      console.error(`[atlas-chat] Provider ${item.name} failed:`, e.message || e);
      lastError = e as Error;
    }
  }
  throw lastError ?? new Error("All LLM providers failed");
}

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

    const body: ChatRequest = await req.json();
    if (!body.map_id || !body.message) {
      return new Response(JSON.stringify({ error: "map_id and message are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    // Use service role client to bypass user RLS for full context compilation
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Fetch user ID from authentication header
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid user token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;

    // 2. Fetch Map details
    const { data: map } = await supabase
      .from("maps")
      .select("goal_statement, confidence, name")
      .eq("id", body.map_id)
      .eq("user_id", userId)
      .maybeSingle();

    if (!map) {
      return new Response(JSON.stringify({ error: "Map not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Fetch Active Milestone
    const { data: milestone } = await supabase
      .from("milestones")
      .select("title, description")
      .eq("map_id", body.map_id)
      .eq("status", "active")
      .maybeSingle();

    // 4. Fetch Recent connected tool signals (last 14 days)
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    const { data: signals } = await supabase
      .from("signals")
      .select("title, occurred_at, score, payload")
      .eq("map_id", body.map_id)
      .gte("occurred_at", fourteenDaysAgo.toISOString())
      .order("occurred_at", { ascending: false })
      .limit(30);

    // 5. Fetch Active waypoints (completed_at is null)
    const { data: activeWaypoints } = await supabase
      .from("waypoints")
      .select("id, kind, title, confidence, metadata")
      .eq("map_id", body.map_id)
      .is("completed_at", null)
      .order("position", { ascending: true });

    // 6. Fetch Recent commitments (last 14 days)
    const { data: commitments } = await supabase
      .from("commitments")
      .select("date, status, note")
      .eq("map_id", body.map_id)
      .gte("date", fourteenDaysAgo.toISOString().split("T")[0])
      .order("date", { ascending: false });

    // 7. Calculate history length (resolved commitments + prediction results)
    const { count: resolvedCommitments } = await supabase
      .from("commitments")
      .select("id", { count: "exact", head: true })
      .eq("map_id", body.map_id)
      .in("status", ["done", "not_done"]);

    const { count: resolvedPredictions } = await supabase
      .from("waypoints")
      .select("id", { count: "exact", head: true })
      .eq("map_id", body.map_id)
      .in("result_status", ["held", "missed"]);

    const historySize = (resolvedCommitments ?? 0) + (resolvedPredictions ?? 0);
    const isEarlyHistory = historySize < 5;

    // 8. Fetch Recent chat conversation history (last 10 messages)
    const { data: conversation } = await supabase
      .from("chat_messages")
      .select("role, content")
      .eq("map_id", body.map_id)
      .order("created_at", { ascending: true })
      .limit(10);

    // Assemble the System Prompt
    const systemPrompt = `You are Atlas — an execution accountability AI for early-stage founders. You help them stick to their core commitments and analyze obstacles plainly, without gamification, streaks, or judgment.

Voice guidelines:
- Calm, direct, and plain.
- No exclamation marks, no emojis.
- Never use warning language, moralizing, or guilt-tripping.
- Font styling rules: In the app, your text is styled directly in a clean monospace/serif layout. Match this simplicity.

Tone based on History track record:
${isEarlyHistory 
  ? `- Because the founder is early in their history (resolved events: ${historySize} < 5), your tone should be EXPLORATORY and QUESTIONING. Avoid declarative verdicts. Use phrases like "has something changed, or is this drift?" rather than flat judgments.` 
  : `- You have earned a real track record (resolved events: ${historySize} >= 5). You can give confident, blunt pushback when there is a clear pattern of drift or excuses, but stay objective and fact-based.`}

Move Deprioritization Rule:
- If the founder proposes abandoning, skipping, or deprioritizing their current committed Move, you MUST surface the original reasoning (evidence/constraint) before agreeing or disagreeing. Remind them of the constraint they previously identified as blocking their goal, and ask them to explain what has changed. Do not simply comply nor flatly refuse.

Callable actions / tools:
You can take real actions on behalf of the user by including an "action" block in your JSON response. The available actions are:
1. {"type": "mark_commitment_done"}
   - Marks today's daily commitment as "done" and completes the active move waypoint.
2. {"type": "mark_commitment_not_done", "note": "Reason why it wasn't done"}
   - Marks today's daily commitment as "not_done" and stores the obstacle note.
3. {"type": "add_manual_note", "note": "Content of the note"}
   - Adds a manual note to the founder's integration signals context.
4. {"type": "trigger_sync_and_diagnose"}
   - Triggers a fresh data sync and regenerates the map's constraint and move waypoints.

Format your output STRICTLY as a single JSON object. Do not include markdown codeblocks, prefix text, or explanations outside the JSON structure.

JSON Response Shape:
{
  "reply": "Your written reply to the founder here, utilizing clean formatting.",
  "action": null | {
    "type": "mark_commitment_done" | "mark_commitment_not_done" | "add_manual_note" | "trigger_sync_and_diagnose",
    "note": "Optional parameter mapping to the arguments above"
  }
}`;

    // Assemble User Prompt with compiled context
    const currentGoal = map.goal_statement;
    const currentMilestone = milestone 
      ? `Active Milestone: "${milestone.title}" — Description: "${milestone.description || "None"}"` 
      : `No active milestones mapped yet. Stated Goal: "${currentGoal}"`;

    const recentSignalsText = signals && signals.length > 0
      ? signals.map(s => `- [${new Date(s.occurred_at).toISOString().split("T")[0]}] ${s.title}`).join("\n")
      : "- No tool signals logged in the last 14 days.";

    const waypointsText = activeWaypoints && activeWaypoints.length > 0
      ? activeWaypoints.map(w => `- [${w.kind.toUpperCase()}] ${w.title}`).join("\n")
      : "- No active waypoints.";

    const commitmentsText = commitments && commitments.length > 0
      ? commitments.map(c => `- [${c.date}] ${c.status.toUpperCase()} ${c.note ? `— "${c.note}"` : ""}`).join("\n")
      : "- No commitments recorded recently.";

    const chatHistoryText = conversation && conversation.length > 0
      ? conversation.map(c => `${c.role.toUpperCase()}: ${c.content}`).join("\n")
      : "No previous messages.";

    const userPrompt = `GOAL & CONTEXT:
Goal: "${currentGoal}"
Map Name: "${map.name || "Default"}"
${currentMilestone}

ACTIVE DIAGNOSTIC TRAIL:
${waypointsText}

RECENT SIGNALS (Last 14 days):
${recentSignalsText}

RECENT COMMITMENT HISTORY:
${commitmentsText}

RECENT CONVERSATION HISTORY:
${chatHistoryText}

NEW USER MESSAGE:
USER: "${body.message}"`;

    // 9. Call the LLM
    const llmResponse = await route(systemPrompt, userPrompt, body.provider);

    // 10. Execute the LLM Action server-side (if requested)
    if (llmResponse.action) {
      const { type, note } = llmResponse.action;
      const todayStr = new Date().toISOString().split("T")[0];

      if (type === "mark_commitment_done") {
        // Find user's today commitment
        const { data: todayCommit } = await supabase
          .from("commitments")
          .select("id, waypoint_id")
          .eq("map_id", body.map_id)
          .eq("date", todayStr)
          .maybeSingle();

        if (todayCommit) {
          await supabase
            .from("commitments")
            .update({ status: "done" })
            .eq("id", todayCommit.id);

          await supabase
            .from("waypoints")
            .update({ completed_at: new Date().toISOString() })
            .eq("id", todayCommit.waypoint_id);
        }
      } else if (type === "mark_commitment_not_done") {
        const { data: todayCommit } = await supabase
          .from("commitments")
          .select("id")
          .eq("map_id", body.map_id)
          .eq("date", todayStr)
          .maybeSingle();

        if (todayCommit) {
          await supabase
            .from("commitments")
            .update({ status: "not_done", note: note || "No reason provided." })
            .eq("id", todayCommit.id);
        }
      } else if (type === "add_manual_note" && note) {
        await supabase
          .from("signals")
          .insert({
            map_id: body.map_id,
            user_id: userId,
            title: "__manual_note",
            score: 0,
            occurred_at: new Date().toISOString(),
            payload: { note: note },
          });
      } else if (type === "trigger_sync_and_diagnose") {
        // Trigger diagnose-map background trigger async
        fetch(`${supabaseUrl}/functions/v1/diagnose-map`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({ map_id: body.map_id }),
        }).catch(err => console.error("[atlas-chat] Trigger sync error:", err));
      }
    }

    // 11. Save Assistant reply to Chat Messages table
    await supabase
      .from("chat_messages")
      .insert({
        map_id: body.map_id,
        user_id: userId,
        role: "assistant",
        content: llmResponse.reply,
      });

    return new Response(JSON.stringify(llmResponse), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[atlas-chat] Error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
