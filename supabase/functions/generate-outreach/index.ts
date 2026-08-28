// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

declare const Deno: any;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── JSON extraction utility (same pattern as sourcing-machine) ──────────────
function extractJson(raw: string): any {
  const text = raw.replace(/```(?:json)?\s*/gi, "").replace(/```/g, "").trim();
  const start = text.indexOf("{");
  if (start === -1) throw new Error("No JSON object found in AI response");
  let depth = 0, inString = false, escape = false, end = -1;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\" && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "{") depth++;
    else if (ch === "}") { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end === -1) throw new Error("Unterminated JSON object in AI response");
  return JSON.parse(text.slice(start, end + 1));
}

// ── Call Kimi AI (primary LLM) ───────────────────────────────────────────────
async function callKimi(systemPrompt: string, userPrompt: string, apiKey: string): Promise<any> {
  const res = await fetch("https://api.moonshot.cn/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    signal: AbortSignal.timeout(45000),
    body: JSON.stringify({
      model: "moonshot-v1-8k",
      temperature: 0.4,
      max_tokens: 2048,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Kimi error: ${res.status} ${err}`);
  }
  const data = await res.json();
  return extractJson(data.choices[0].message.content);
}

// ── Call Groq (fallback LLM) ─────────────────────────────────────────────────
async function callGroq(systemPrompt: string, userPrompt: string, apiKey: string): Promise<any> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    signal: AbortSignal.timeout(45000),
    body: JSON.stringify({
      model: "llama3-70b-8192",
      temperature: 0.4,
      max_tokens: 2048,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq error: ${res.status} ${err}`);
  }
  const data = await res.json();
  return extractJson(data.choices[0].message.content);
}

// ── Build a hard fallback if LLM fails ──────────────────────────────────────
function buildFallback(company: string, founderName: string, bottleneckArea: string, hypothesis: string) {
  const first = founderName && !founderName.toLowerCase().includes("founder") ? founderName.split(" ")[0] : "there";
  return {
    email: {
      subject: `Quick question on ${company}'s operations`,
      body: `Hi ${first},\n\nI came across ${company} while researching how growing agencies handle ${bottleneckArea}.\n\n${hypothesis}\n\nI'm curious — is that still handled manually, or have you found a way to systematise it?\n\nI'm researching where agencies lose time to repetitive operational work. Not pitching anything yet, just trying to understand where the actual bottlenecks are.\n\nBest,\nBen`,
    },
    linkedin_dm: `Hey ${first} — I came across ${company} and noticed you're scaling a solid operation. Quick question: how are you currently handling ${bottleneckArea}? Researching where agencies are still losing time to manual work. Happy to share what I've found if it's useful.`,
    loom_script: `Hi ${first}, recording this quick 60-second breakdown for ${company}.\n\nI looked into how your team handles ${bottleneckArea}. Here's what I found and what I think the specific bottleneck is: ${hypothesis}\n\nIn this video I'll walk through:\n1. Where I think the manual work is happening\n2. A specific workflow that could be automated\n3. What that would look like in practice\n\nLet me know if this is interesting and I can put together a proper proposal.`,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      company,
      founder_name,
      founder_role,
      team_size,
      research_data,
      bottleneck,
      approach_angle,
      sender_name = "Ben",
    } = body;

    if (!company) {
      return new Response(JSON.stringify({ error: "company is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Extract context from research_data flexibly ──────────────────────────
    const rd = research_data || {};
    const bt = bottleneck || rd.bottleneck || rd[0] || {};

    const bottleneckArea = bt.area || bt.problem || "operational workflow";
    const bottleneckObs  = bt.observation || bt.reasoning || "";
    const hypothesis     = bt.hypothesis  || bt.opportunity || `Manual work around ${bottleneckArea} is likely costing time and money`;
    const approachAngle  = approach_angle || rd.approach_angle || `Ask about their ${bottleneckArea} process`;
    const founderName    = founder_name || rd.founder?.name || "the founder";
    const founderRole    = founder_role || rd.founder?.role || "Founder";
    const teamSize       = team_size    || rd.team_size    || "growing team";

    const kimiApiKey = Deno.env.get("KIMI_API_KEY") || Deno.env.get("MOONSHOT_API_KEY");
    const groqApiKey = Deno.env.get("GROQ_API_KEY");

    const systemPrompt = `You are an expert B2B sales copywriter for an AI automation agency.
Your job is to write outreach messages that sound like a curious, intelligent human — NOT a sales robot.

Core rules (non-negotiable):
- Lead with a specific, real observation from their business — not a generic compliment
- Ask ONE diagnostic question only
- Be genuinely curious, not promotional
- The tone is: peer-to-peer, direct, brief, warm
- Never use: "unlock", "empower", "synergy", "seamless", "leverage", "game-changer"
- Never pitch a product or price in the first message
- For email: max 120 words in the body
- For LinkedIn DM: max 60 words — casual, conversational
- For Loom script: write what ${sender_name} will SAY in a 60-second personalised video — punchy, specific, visual

The sender's name is ${sender_name}.`;

    const userPrompt = `Generate outreach for this prospect:

Company: ${company}
Founder: ${founderName} (${founderRole})
Team size: ${teamSize}
Pain signal: ${bottleneckObs}
Bottleneck area: ${bottleneckArea}
Hypothesis: ${hypothesis}
Approach angle: ${approachAngle}

Return ONLY this JSON (no markdown, no explanation):
{
  "email": {
    "subject": "compelling, specific subject line (max 8 words)",
    "body": "the full email body (plain text, no HTML, max 120 words)"
  },
  "linkedin_dm": "the full LinkedIn DM (max 60 words, casual tone)",
  "loom_script": "what ${sender_name} says in the 60-second Loom video (spoken word style, specific to their bottleneck)"
}`;

    let result: any = null;

    if (kimiApiKey) {
      try {
        result = await callKimi(systemPrompt, userPrompt, kimiApiKey);
      } catch (e: any) {
        console.warn("Kimi failed:", e.message);
      }
    }

    if (!result && groqApiKey) {
      try {
        result = await callGroq(systemPrompt, userPrompt, groqApiKey);
      } catch (e: any) {
        console.warn("Groq failed:", e.message);
      }
    }

    // Hard fallback — always return something usable
    if (!result || !result.email) {
      console.warn("Both LLMs failed — using fallback templates");
      result = buildFallback(company, founderName, bottleneckArea, hypothesis);
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("generate-outreach error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
