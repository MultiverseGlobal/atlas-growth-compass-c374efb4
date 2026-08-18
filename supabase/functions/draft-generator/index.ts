import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DraftGeneratorRequest {
  lead: {
    prospect: string;
    company: string;
    website: string;
    founder_thesis: string;
    source?: string;
    linkedin_url?: string | null;
    twitter_url?: string | null;
    email?: string | null;
    acquisition_channel?: string | null;
    notes?: string | null;
  };
  raw_text?: string;
}

// Balanced-brace JSON scanner
function extractJson(raw: string): any {
  const text = raw.replace(/```(?:json)?\s*/gi, "").replace(/```/g, "").trim();
  const start = text.indexOf("{");
  if (start === -1) {
    throw new Error("No JSON object found in AI response");
  }
  let depth = 0, inString = false, escape = false, end = -1;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\" && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }
  if (end === -1) {
    throw new Error("Unterminated JSON object in AI response");
  }
  return JSON.parse(text.slice(start, end + 1));
}

async function callKimi(systemPrompt: string, userPrompt: string, apiKey: string): Promise<any> {
  const res = await fetch("https://api.moonshot.cn/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    signal: AbortSignal.timeout(50000), // 50s timeout
    body: JSON.stringify({
      model: "moonshot-v1-8k",
      temperature: 0.3,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    if (res.status === 401) throw new Error("AUTH_ERROR: Moonshot (Kimi) API key is invalid/expired.");
    throw new Error(`Kimi AI error: ${res.status} ${text}`);
  }
  const data = await res.json();
  return extractJson(data.choices[0].message.content);
}

async function callNvidiaNim(systemPrompt: string, userPrompt: string, apiKey: string): Promise<any> {
  const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    signal: AbortSignal.timeout(50000), // 50s timeout
    body: JSON.stringify({
      model: "meta/llama-3.1-8b-instruct",
      temperature: 0.3,
      max_tokens: 2048,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    if (res.status === 401) throw new Error("AUTH_ERROR: NVIDIA NIM API key is invalid/expired.");
    throw new Error(`NVIDIA NIM error: ${res.status} ${text}`);
  }
  const data = await res.json();
  return extractJson(data.choices[0].message.content);
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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const isServiceCall = authHeader === `Bearer ${supabaseServiceKey}`;
    const userClient = isServiceCall
      ? createClient(supabaseUrl, supabaseServiceKey)
      : createClient(supabaseUrl, supabaseAnonKey, {
          global: { headers: { Authorization: authHeader } },
        });

    if (!isServiceCall) {
      const { data: { user }, error: userError } = await userClient.auth.getUser();
      if (userError || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const body: DraftGeneratorRequest = await req.json();
    if (!body.lead) {
      return new Response(JSON.stringify({ error: "lead object is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const kimiApiKey = Deno.env.get("KIMI_API_KEY") || Deno.env.get("MOONSHOT_API_KEY");
    const nimApiKey = Deno.env.get("NVIDIA_NIM_API_KEY");

    const acquisitionChannel = body.lead.acquisition_channel || "Outbound";

    // Tailor the framing based on the channel this lead came from
    const channelContext = acquisitionChannel === "Inbound"
      ? "This person came to us through inbound content — they already have some awareness. The message should feel like a natural follow-up, not a cold approach."
      : acquisitionChannel === "Referral"
      ? "This person was referred to us. The message can reference the shared context lightly (e.g. 'a mutual contact mentioned you') without being specific."
      : acquisitionChannel === "Partnership"
      ? "This person was introduced via a partner. The tone should feel warm and pre-validated, not cold."
      : "This is a cold outreach. The message must do all the trust-building work itself.";

    const systemPrompt = `You are a B2B outreach writer for a solo consultant who finds and removes operational bottlenecks costing small agencies 10+ hours a week.

Your job is to write a first-touch message following the CURIOSITY LOOP model:

## The Model
1. OBSERVATION — Open with a specific, concrete thing you noticed about their business or their stated problem. This must reference their actual founder thesis / stated constraint. Do NOT write "I noticed your website" or generic observations.
2. WHAT YOU FOUND — Frame it as: "I looked at [their process/operation] and found [specific thing]. I recorded a short [3-5 minute] walkthrough."
3. OFFER — End with the lowest-friction possible ask: "Want to see it?" or "Happy to send it over if useful."

## Rules
- Do NOT ask for a call. Do NOT pitch a service. Do NOT promise outcomes.
- Do NOT use phrases like: "I'd love to connect", "I'd be happy to help", "Let me know if you're interested", "I guarantee", "double your revenue", "scale your business".
- The message should feel like it was written by a human who actually looked at their business, not by a template.
- Subject line must be specific to THEM — no generic subjects like "Quick question" or "Following up".
- Total body length: 4-6 sentences max. Short. Punchy. Confident.
- Write in first person, no sign-off needed (they will add it).

## Channel Context
${channelContext}

## Contact Channel Resolution
- Use the provided email if present. If not, use LinkedIn URL. If not, use Twitter handle.
- Format as: "email: [address]", "linkedin: [url]", or "twitter: [handle]".
- If none available, return: "Contact channel not found — needs manual research".

Return ONLY a valid JSON object:
{
  "subject": "string",
  "draft_message": "string",
  "contact_channel": "string"
}`;

    const userPrompt = `Company: ${body.lead.company}
Prospect: ${body.lead.prospect}
Website: ${body.lead.website}
Founder's Stated Problem (Thesis): ${body.lead.founder_thesis}
Acquisition Channel: ${body.lead.acquisition_channel || "Outbound"}
Known Email: ${body.lead.email || "not found"}
LinkedIn: ${body.lead.linkedin_url || "not found"}
Twitter/X: ${body.lead.twitter_url || "not found"}
Source: ${body.lead.source || ""}
Context & Notes: ${body.lead.notes || ""}
Additional Raw Content: ${body.raw_text || ""}`;

    let result: any = null;
    let errToThrow: any = null;

    if (kimiApiKey && kimiApiKey !== "your-kimi-api-key") {
      try {
        result = await callKimi(systemPrompt, userPrompt, kimiApiKey);
      } catch (err: any) {
        console.warn("Kimi failed in draft-generator:", err.message);
        if (err.message.includes("AUTH_ERROR")) {
          errToThrow = err;
        }
      }
    }

    if (!result && nimApiKey && !errToThrow) {
      try {
        result = await callNvidiaNim(systemPrompt, userPrompt, nimApiKey);
      } catch (err: any) {
        console.error("Nvidia Nim failed in draft-generator:", err.message);
        if (err.message.includes("AUTH_ERROR")) {
          errToThrow = err;
        }
      }
    }

    if (errToThrow) {
      return new Response(JSON.stringify({ error: errToThrow.message }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (!result) {
      // Hard fallback if all AI keys fail
      const mockChannel = body.lead.email
        ? `email: ${body.lead.email}`
        : body.lead.linkedin_url
        ? `linkedin: ${body.lead.linkedin_url}`
        : body.lead.twitter_url
        ? `twitter: ${body.lead.twitter_url}`
        : "Contact channel not found — needs manual research";
      result = {
        subject: `Quick observation on ${body.lead.company}`,
        draft_message: `Hi ${body.lead.prospect},\n\nI was looking at ${body.lead.company} and noticed something about the constraint you mentioned: "${body.lead.founder_thesis}". I put together a short 4-minute walkthrough of where I'd look first.\n\nWant me to send it over?`,
        contact_channel: mockChannel
      };
    }

    return new Response(JSON.stringify(result), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    if (err.name === "TimeoutError" || err.message.includes("timeout")) {
      return new Response(JSON.stringify({ error: "AI provider request timed out (50s exceeded). Try again or check provider status." }), {
        status: 504, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
