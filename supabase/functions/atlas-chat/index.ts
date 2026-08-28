import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─────────────────────────────────────────────
// ATLAS HQ SYSTEM PROMPT — Founder Revenue OS
// ─────────────────────────────────────────────
const ATLAS_SYSTEM_PROMPT = `You are Atlas.

You are NOT a chatbot.
You are NOT a general-purpose AI assistant.
You are Benjamin's private Founder Operating System.

Your mission is singular:
Maximize Benjamin's probability of building a profitable company by helping him acquire customers, close deals, deliver projects, and discover repeatable business opportunities.

Your success is measured only by outcomes. Every recommendation should move one or more of these metrics:
- Revenue
- Customer conversations
- Qualified leads
- Deals won
- Time saved
- Knowledge accumulated
- Decision quality

If a task does not improve one of these metrics, it is low priority.

---

OPERATING PHILOSOPHY

You behave like a Chief of Staff, Head of Sales, Research Analyst, Product Strategist, and Operations Manager combined.

You think before responding.

You always consider:
- Current revenue vs the £10,000 goal
- Active pipeline and deal stages
- Outreach volume and reply rate
- Which deals have stalled
- Follow-ups overdue
- Current bottleneck

Every response must be contextual. Use the live data provided below.

---

PRIMARY DECISION FRAMEWORK

Before answering any request, silently work through:

STEP 1 — Identify the current bottleneck:
Possible bottlenecks: Not enough leads | Low reply rate | Weak offer | Poor positioning | Stalled pipeline | Pricing issues | Product uncertainty | No follow-up discipline | Cash flow

STEP 2 — Prioritise solving the bottleneck with highest expected revenue impact.

STEP 3 — Recommend the smallest action that creates measurable progress. Never recommend unnecessary complexity.

---

DAILY RESPONSIBILITIES

When asked "What should I do today?" or similar, always answer:
1. Which prospect deserves attention RIGHT NOW
2. Which deal is closest to closing
3. Who needs a follow-up (name them)
4. What single task creates the highest leverage today
5. What should be ignored

---

COMMUNICATION STYLE

- Be concise and direct. No waffle.
- Be analytical. Challenge assumptions respectfully.
- Do not flatter. Do not invent certainty.
- Separate: Facts | Evidence | Assumptions | Recommendations
- Every recommendation should include a brief rationale.
- No emojis. No exclamation marks. No motivational filler.
- Respond in plain prose or numbered lists. Never markdown headers unless specifically helpful.

---

GOLDEN PRINCIPLE

Benjamin's scarcest resources are time and attention. Protect them relentlessly.

If a proposed task does not increase revenue, improve customer understanding, strengthen delivery, or create strategic knowledge — recommend against it.

Atlas exists to transform activity into measurable progress. Its purpose is not to help Benjamin build more software. Its purpose is to help Benjamin build a business.

---

RESPONSE FORMAT

Respond as a JSON object with this exact shape:
{
  "reply": "Your response here. Plain text. Concise. Revenue-focused.",
  "action": null
}

The "action" field is reserved for future tool use. Always set it to null for now.
Do not include markdown fences or any text outside the JSON object.`;

// ─────────────────────────────────────────────
// LLM Providers
// ─────────────────────────────────────────────
interface AtlasResponse {
  reply: string;
  action: null;
}

async function callOpenAI(system: string, messages: any[], apiKey: string): Promise<AtlasResponse> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "gpt-4o",
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: system }, ...messages],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI error: ${await res.text()}`);
  const data = await res.json();
  return JSON.parse(data.choices[0].message.content) as AtlasResponse;
}

async function callAnthropic(system: string, messages: any[], apiKey: string): Promise<AtlasResponse> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
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
      messages,
    }),
  });
  if (!res.ok) throw new Error(`Anthropic error: ${await res.text()}`);
  const data = await res.json();
  const text = data.content[0].text;
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON in Anthropic response");
  return JSON.parse(match[0]) as AtlasResponse;
}

async function callGroq(system: string, messages: any[], apiKey: string): Promise<AtlasResponse> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: system }, ...messages],
    }),
  });
  if (!res.ok) throw new Error(`Groq error: ${await res.text()}`);
  const data = await res.json();
  return JSON.parse(data.choices[0].message.content) as AtlasResponse;
}

async function route(messages: any[]): Promise<AtlasResponse> {
  const system = ATLAS_SYSTEM_PROMPT;

  const providers: Array<{ name: string; fn: () => Promise<AtlasResponse> }> = [];

  if (Deno.env.get("OPENAI_API_KEY")) {
    providers.push({ name: "OpenAI gpt-4o", fn: () => callOpenAI(system, messages, Deno.env.get("OPENAI_API_KEY")!) });
  }
  if (Deno.env.get("ANTHROPIC_API_KEY")) {
    providers.push({ name: "Anthropic claude-3.5", fn: () => callAnthropic(system, messages, Deno.env.get("ANTHROPIC_API_KEY")!) });
  }
  if (Deno.env.get("GROQ_API_KEY")) {
    providers.push({ name: "Groq llama-3.3", fn: () => callGroq(system, messages, Deno.env.get("GROQ_API_KEY")!) });
  }

  if (providers.length === 0) throw new Error("No AI provider key configured.");

  let lastError: Error | null = null;
  for (const p of providers) {
    try {
      console.log(`[atlas-chat] Trying: ${p.name}`);
      return await p.fn();
    } catch (e: any) {
      console.error(`[atlas-chat] ${p.name} failed:`, e.message);
      lastError = e;
    }
  }
  throw lastError ?? new Error("All providers failed");
}

// ─────────────────────────────────────────────
// Context builder: compile live HQ data
// ─────────────────────────────────────────────
async function buildContext(supabase: any, userId: string): Promise<string> {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString();
  const fiveDaysAgo = new Date(now.getTime() - 5 * 86400000).toISOString();
  const today = now.toISOString().split("T")[0];
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [revRes, dealsRes, outRecentRes, fuRes, leadsRes] = await Promise.all([
    // Revenue summary view
    supabase.from("atlas_revenue_summary").select("*").eq("user_id", userId).maybeSingle(),
    // Active deals
    supabase.from("atlas_deals")
      .select("company_name, stage, value, probability, next_action, next_action_due, updated_at")
      .eq("user_id", userId)
      .not("stage", "in", "(won,lost)")
      .order("updated_at", { ascending: false })
      .limit(10),
    // Outreach this week
    supabase.from("atlas_outreach")
      .select("company_id, type, status, created_at")
      .eq("user_id", userId)
      .gte("created_at", weekAgo),
    // Follow-ups overdue
    supabase.from("atlas_outreach")
      .select("company_id, type, follow_up_due, status")
      .eq("user_id", userId)
      .lte("follow_up_due", today)
      .in("status", ["sent", "draft"])
      .order("follow_up_due", { ascending: true })
      .limit(5),
    // Recent leads (for context)
    supabase.from("kuro_pipeline_view")
      .select("company, stage, icp_score, is_contacted, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const rev = revRes.data ?? {};
  const deals = (dealsRes.data ?? []) as any[];
  const outThisWeek = (outRecentRes.data ?? []) as any[];
  const followUps = (fuRes.data ?? []) as any[];
  const recentLeads = (leadsRes.data ?? []) as any[];

  const revenueThisMonth = Number(rev.revenue_this_month ?? 0);
  const pipelineWeighted = Number(rev.pipeline_weighted ?? 0);
  const goal = 10000;
  const pct = Math.round((revenueThisMonth / goal) * 100);

  const sentThisWeek = outThisWeek.filter((o: any) => o.status !== "draft").length;
  const repliesThisWeek = outThisWeek.filter((o: any) => ["replied", "booked"].includes(o.status)).length;
  const replyRate = sentThisWeek > 0 ? Math.round((repliesThisWeek / sentThisWeek) * 100) : 0;

  const stalledDeals = deals.filter((d: any) => {
    const days = Math.floor((now.getTime() - new Date(d.updated_at).getTime()) / 86400000);
    return days >= 5;
  });

  // Enrich follow-up company names
  let fuCompanyMap: Record<string, string> = {};
  const fuCompanyIds = [...new Set(followUps.map((f: any) => f.company_id))];
  if (fuCompanyIds.length > 0) {
    const { data: comps } = await supabase.from("kuro_pipeline_view").select("id, company").in("id", fuCompanyIds);
    (comps ?? []).forEach((c: any) => { fuCompanyMap[c.id] = c.company; });
  }

  const ctx: string[] = [];

  ctx.push(`=== LIVE BUSINESS DATA (${now.toISOString().split("T")[0]}) ===`);
  ctx.push(`\nREVENUE`);
  ctx.push(`- This month: £${revenueThisMonth.toLocaleString()} / £${goal.toLocaleString()} goal (${pct}%)`);
  ctx.push(`- Pipeline (weighted): £${pipelineWeighted.toLocaleString()}`);
  ctx.push(`- Active deals: ${deals.length}`);
  ctx.push(`- Won this month: ${rev.deals_won_this_month ?? 0} deals | Lost: ${rev.deals_lost_this_month ?? 0}`);
  ctx.push(`- Avg deal size: £${Number(rev.avg_deal_size ?? 0).toLocaleString()}`);

  ctx.push(`\nOUTREACH (last 7 days)`);
  ctx.push(`- Sent: ${sentThisWeek} | Replies: ${repliesThisWeek} | Reply rate: ${replyRate}%`);

  if (followUps.length > 0) {
    ctx.push(`\nOVERDUE FOLLOW-UPS (${followUps.length})`);
    followUps.forEach((f: any) => {
      const company = fuCompanyMap[f.company_id] ?? "Unknown";
      const days = Math.floor((now.getTime() - new Date(f.follow_up_due).getTime()) / 86400000);
      ctx.push(`- ${company} — ${f.type?.replace("_", " ")} — ${days > 0 ? `${days}d overdue` : "due today"}`);
    });
  } else {
    ctx.push(`\nFOLLOW-UPS: None overdue`);
  }

  if (deals.length > 0) {
    ctx.push(`\nACTIVE PIPELINE`);
    deals.forEach((d: any) => {
      const days = Math.floor((now.getTime() - new Date(d.updated_at).getTime()) / 86400000);
      const stall = days >= 5 ? ` [STALLED ${days}d]` : "";
      ctx.push(`- ${d.company_name} | ${d.stage} | £${Number(d.value ?? 0).toLocaleString()} | ${d.probability ?? 0}% | Next: ${d.next_action ?? "none"}${stall}`);
    });
  } else {
    ctx.push(`\nACTIVE PIPELINE: No active deals.`);
  }

  if (recentLeads.length > 0) {
    ctx.push(`\nRECENT LEADS (last added)`);
    recentLeads.forEach((l: any) => {
      ctx.push(`- ${l.company} | Stage: ${l.stage} | ICP: ${l.icp_score ?? 5}/10 | Contacted: ${l.is_contacted ? "Yes" : "No"}`);
    });
  }

  if (stalledDeals.length > 0) {
    ctx.push(`\nKEY ALERT: ${stalledDeals.length} deals stalled 5+ days — ${stalledDeals.map((d: any) => d.company_name).join(", ")}`);
  }

  return ctx.join("\n");
}

// ─────────────────────────────────────────────
// Edge Function Handler
// ─────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const message: string = body.message;
    const conversationHistory: Array<{ role: string; content: string }> = body.history ?? [];

    if (!message) {
      return new Response(JSON.stringify({ error: "message is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid user token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build live business context
    const context = await buildContext(supabase, user.id);

    // Build message thread for the LLM
    // Inject context as the first user turn so all providers support it
    const llmMessages: any[] = [];

    // Prior conversation (last 10 turns)
    const recentHistory = conversationHistory.slice(-10);
    if (recentHistory.length > 0) {
      for (const turn of recentHistory) {
        llmMessages.push({ role: turn.role, content: turn.content });
      }
    }

    // Append the live context + new message
    llmMessages.push({
      role: "user",
      content: `${context}\n\n=== MESSAGE ===\n${message}`,
    });

    // Call the LLM
    const response = await route(llmMessages);

    // Save to chat_messages (using map_id = user.id as the HQ chat room)
    await supabase.from("chat_messages").insert([
      { map_id: user.id, user_id: user.id, role: "user", content: message },
      { map_id: user.id, user_id: user.id, role: "assistant", content: response.reply },
    ]);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("[atlas-chat] Error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
