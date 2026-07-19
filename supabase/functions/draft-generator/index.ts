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

    const systemPrompt = `You are Atlas HQ Outreach Writer — a professional B2B copywriter specializing in highly personalized, low-friction, non-pitch first touch outreach messages.

Given a startup profile with the founder's stated thesis/problem (dominant constraint), company name, website, and raw content, your job is to:
1. Generate a first-touch outreach message following this strict formula:
   - Direct quote or close paraphrase of their stated problem (e.g. "I saw your note about [thesis]...")
   - Process/deliverable framing of how Atlas Relevance applies (e.g. "We focus on mapping [process]..." or "Here is what we see in similar setups...").
   - Low-friction, non-pitch call-to-action (e.g. "Happy to share a quick checklist if you're open to it" or "Would you like me to send over our findings?").
   - STRICT GUARDRAIL: Do NOT use outcome-promising language. Never say "I'll double your MRR", "this will increase conversion", "we will solve this for you", or "I guarantee we'll find X". Only describe the process/findings ("here's what we found", "happy to share what we see").
2. Resolve the Contact Channel:
   - Scan the input text/URLs/handles for a contact email first (e.g. founder@company.com or hello@company.com).
   - If not found, fall back to a Telegram handle (e.g. @tgname) or X handle (e.g. @xhandle) if found in text.
   - Otherwise, set the contact channel to "Contact channel not found — needs manual research".

Return ONLY a valid JSON object matching this schema:
{
  "draft_message": "string",
  "contact_channel": "string"
}`;

    const userPrompt = `Company: ${body.lead.company}
Prospect: ${body.lead.prospect}
Website: ${body.lead.website}
Founder Thesis/Problem: ${body.lead.founder_thesis}
Source: ${body.lead.source || ""}
Notes/Context: ${body.lead.notes || ""}
Additional Content (for contact details search): ${body.raw_text || ""}`;

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
      // Fallback fallback if AI keys fail completely (non-auth error)
      const mockChannel = body.lead.linkedin_url ? `LinkedIn message: ${body.lead.linkedin_url}` : "Contact channel not found — needs manual research";
      result = {
        draft_message: `Hi ${body.lead.prospect},\n\nI saw your note regarding the constraint: "${body.lead.founder_thesis}". We map growth bottlenecks and design custom scaling roadmaps. Happy to share what we see in startup diagnostics if you are open to checking it out.\n\nBest,\nAtlas growth team`,
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
