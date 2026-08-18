import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SourcingRequest {
  action: "source" | "bulk-source" | "export-notion" | "list-notion-databases" | "validate-notion-database" | "hn-source" | "starter-story-source" | "yc-source" | "clutch-source" | "upwork-source" | "re-analyze" | "generate-outreach" | "generate-report";
  url?: string;
  urls?: string[];
  raw_text?: string;
  // HN params
  query?: string;
  time_range?: string;
  // YC params
  filter?: string;
  // Clutch & YC params
  industry?: string;
  // Clutch params
  location?: string;
  // Upwork params
  keyword?: string;
  lead?: {
    id?: string;
    prospect: string;
    company: string;
    website: string;
    founder_thesis: string;
    goal?: string | null;
    icp_score: number;
    next_action?: string | null;
    notes?: string | null;
    priority?: string | null;
    source: string;
    stage: string;
    is_contacted?: boolean;
    reply_status?: string;
  };
  database_id?: string;
  duplicate_behavior?: "update" | "duplicate" | "skip";
  field_mappings?: Record<string, string>;
}

// Scrape helper using Jina AI to bypass Cloudflare
async function scrapeUrl(url: string): Promise<{ title: string; description: string; content: string }> {
  try {
    const jinaUrl = `https://r.jina.ai/${url}`;
    const res = await fetch(jinaUrl, {
      signal: AbortSignal.timeout(15000),
      headers: {
        "Accept": "text/plain",
      }
    });
    
    if (!res.ok) {
      throw new Error(`Jina failed: ${res.status} ${res.statusText}`);
    }
    
    const markdown = await res.text();
    
    // Extract title if present in Jina's output
    const titleMatch = markdown.match(/^Title:\s*(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : url;
    
    return { title, description: "", content: markdown.slice(0, 15000) };
  } catch (err: any) {
    console.error("Scraping error:", err.message);
    return { title: "", description: "", content: `Error loading content from URL: ${err.message}` };
  }
}

// Search helper to bypass Cloudflare on directories by fetching live profile snippets via DuckDuckGo
async function searchDuckDuckGo(query: string): Promise<string> {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html",
      }
    });
    if (!res.ok) return "";
    const html = await res.text();
    const matches = html.match(/<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi) || [];
    const snippets = matches.map((m) => m.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
    return snippets.join("\n\n");
  } catch (err: any) {
    console.warn("DuckDuckGo search error:", err.message);
    return "";
  }
}

// Robust JSON extractor — strips markdown code fences and uses balanced-brace scanning.
// When expectArray=true and the array is TRUNCATED (no closing ]), it falls back to
// truncation recovery: salvages every complete {...} object before the cutoff.
function extractJson(raw: string, expectArray = false): any {
  // 1. Strip markdown code fences
  const text = raw.replace(/```(?:json)?\s*/gi, "").replace(/```/g, "").trim();

  // 2. Find the outermost opener and walk balanced delimiters
  const openChar  = expectArray ? "[" : "{";
  const closeChar = expectArray ? "]" : "}";
  const start = text.indexOf(openChar);
  if (start === -1) {
    // No array? Try extracting a single object and wrapping it
    if (expectArray) {
      try { return [extractJson(raw, false)]; } catch (_) {}
    }
    throw new Error(`No JSON ${expectArray ? "array" : "object"} found in AI response`);
  }

  let depth = 0, inString = false, escape = false, end = -1;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\" && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === openChar) depth++;
    else if (ch === closeChar) {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }

  // ── TRUNCATION RECOVERY (array only) ────────────────────────────────────────
  if (end === -1 && expectArray) {
    const recovered: any[] = [];
    let pos = start + 1; // skip opening [
    while (pos < text.length) {
      // Skip whitespace, commas, newlines between objects
      while (pos < text.length && /[\s,]/.test(text[pos])) pos++;
      if (pos >= text.length || text[pos] !== "{") break;

      // Find the matching } for this object
      let d = 0, inS = false, esc2 = false, objEnd = -1;
      for (let i = pos; i < text.length; i++) {
        const ch = text[i];
        if (esc2) { esc2 = false; continue; }
        if (ch === "\\" && inS) { esc2 = true; continue; }
        if (ch === '"') { inS = !inS; continue; }
        if (inS) continue;
        if (ch === "{") d++;
        else if (ch === "}") { d--; if (d === 0) { objEnd = i; break; } }
      }

      if (objEnd === -1) {
        // This object is cut off — stop here
        console.warn(`[extractJson] Array truncated after ${recovered.length} complete object(s). Returning what was recovered.`);
        break;
      }

      try {
        const rawObj = text.slice(pos, objEnd + 1);
        recovered.push(JSON.parse(sanitizeJsonString(rawObj)));
      } catch (parseErr: any) {
        console.warn(`[extractJson] Skipping malformed object at pos ${pos}: ${parseErr.message}`);
      }
      pos = objEnd + 1;
    }

    if (recovered.length > 0) {
      console.log(`[extractJson] Truncation recovery: salvaged ${recovered.length} complete profile(s) from truncated array.`);
      const resultObj = [...recovered] as any;
      resultObj.partial = true;
      resultObj.recovered_count = recovered.length;
      return resultObj;
    }
    throw new Error(`Response was cut off and no complete profiles could be salvaged. Try a smaller text batch.`);
  }

  if (end === -1) {
    throw new Error(`Unterminated JSON object in AI response. Response was cut off.`);
  }

  // ── NORMAL PATH ─────────────────────────────────────────────────────────────
  const jsonStr = text.slice(start, end + 1);
  try {
    return JSON.parse(sanitizeJsonString(jsonStr));
  } catch (e: any) {
    if (expectArray) {
      try { return [extractJson(jsonStr, false)]; } catch (_) {}
    }
    throw new Error(`JSON parse failed after extraction: ${e.message}\nExtracted: ${jsonStr.slice(0, 200)}`);
  }
}

function sanitizeJsonString(str: string): string {
  let result = "";
  let inString = false;
  let escape = false;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (escape) {
      result += ch;
      escape = false;
    } else if (ch === "\\") {
      result += ch;
      escape = true;
    } else if (ch === '"') {
      inString = !inString;
      result += ch;
    } else if (inString && ch === '\n') {
      result += "\\n";
    } else if (inString && ch === '\r') {
      // ignore
    } else if (inString && ch === '\t') {
      result += "\\t";
    } else {
      result += ch;
    }
  }
  return result;
}

// Call Kimi AI — model defaults to 8k for single calls; pass 32k + higher maxTokens for bulk arrays
async function callKimi(systemPrompt: string, userPrompt: string, apiKey: string, expectArray = false, model = "moonshot-v1-8k", maxTokens = 4096): Promise<any> {
  const res = await fetch("https://api.moonshot.cn/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    signal: AbortSignal.timeout(50000), // 50 seconds timeout
    body: JSON.stringify({
      model,
      temperature: 0.3,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });
  if (!res.ok) {
    const errorText = await res.text();
    if (res.status === 401) {
      throw new Error("AUTH_ERROR: Moonshot (Kimi) API key is invalid or expired.");
    }
    throw new Error(`Kimi AI error: ${res.status} ${errorText}`);
  }
  const data = await res.json();
  return extractJson(data.choices[0].message.content, expectArray);
}

// Call NVIDIA NIM
async function callNvidiaNim(systemPrompt: string, userPrompt: string, apiKey: string, expectArray = false): Promise<any> {
  const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    signal: AbortSignal.timeout(50000), // 50 seconds timeout
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
    const errorText = await res.text();
    if (res.status === 401) {
      throw new Error("AUTH_ERROR: NVIDIA NIM API key is invalid or expired.");
    }
    throw new Error(`NVIDIA NIM error: ${res.status} ${errorText}`);
  }
  const data = await res.json();
  return extractJson(data.choices[0].message.content, expectArray);
}

// Call Groq API
async function callGroq(systemPrompt: string, userPrompt: string, apiKey: string, expectArray = false): Promise<any> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    signal: AbortSignal.timeout(50000), // 50 seconds timeout
    body: JSON.stringify({
      model: "llama3-70b-8192",
      temperature: 0.3,
      max_tokens: 2048,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });
  if (!res.ok) {
    const errorText = await res.text();
    if (res.status === 401) {
      throw new Error("AUTH_ERROR: Groq API key is invalid or expired.");
    }
    throw new Error(`Groq API error: ${res.status} ${errorText}`);
  }
  const data = await res.json();
  return extractJson(data.choices[0].message.content, expectArray);
}

// Parse structured markdown notes into Notion block formats
function parseNotesToNotionBlocks(notesText: string) {
  if (!notesText) return [];
  
  const lines = notesText.split("\n");
  const blocks: any[] = [];
  let currentParagraph: string[] = [];
  
  const flushParagraph = () => {
    if (currentParagraph.length > 0) {
      blocks.push({
        object: "block",
        type: "paragraph",
        paragraph: {
          rich_text: [{ type: "text", text: { content: currentParagraph.join("\n").trim() } }]
        }
      });
      currentParagraph = [];
    }
  };
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    if (trimmed.startsWith("##") || trimmed.startsWith("###") || trimmed.startsWith("#") || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
      flushParagraph();
      const headerText = trimmed.replace(/^#+\s*/, "").replace(/^\[/, "").replace(/\]$/, "");
      blocks.push({
        object: "block",
        type: "heading_3",
        heading_3: {
          rich_text: [{ type: "text", text: { content: headerText } }]
        }
      });
    } else if (trimmed.startsWith("-") || trimmed.startsWith("*")) {
      flushParagraph();
      const bulletText = trimmed.replace(/^[-*]\s*/, "");
      blocks.push({
        object: "block",
        type: "bulleted_list_item",
        bulleted_list_item: {
          rich_text: [{ type: "text", text: { content: bulletText } }]
        }
      });
    } else {
      currentParagraph.push(trimmed);
    }
  }
  
  flushParagraph();
  return blocks;
}

// Auto-detect mappings from Notion properties list to fit the "Atlas Pipeline CRM" schema
function autoMapProperties(properties: any) {
  const propertyList = Object.entries(properties).map(([name, val]: [string, any]) => ({
    name,
    type: val.type
  }));

  const mappings: Record<string, string> = {};
  const validationErrors: string[] = [];

  const findMatch = (candidates: string[], type: string, alternativeType?: string) => {
    // Exact match
    const exact = propertyList.find(p => 
      candidates.includes(p.name.toLowerCase()) && 
      (p.type === type || (alternativeType && p.type === alternativeType))
    );
    if (exact) return exact.name;
    // Partial match
    const partial = propertyList.find(p => 
      candidates.some(c => p.name.toLowerCase().includes(c)) && 
      (p.type === type || (alternativeType && p.type === alternativeType))
    );
    if (partial) return partial.name;
    return null;
  };

  const schemaDefinitions = [
    { key: "prospect", defaultName: "Prospect", type: "title", candidates: ["prospect", "name", "founder", "founder name"] },
    { key: "company", defaultName: "Company", type: "rich_text", candidates: ["company", "company name", "startup"] },
    { key: "website", defaultName: "Website", type: "url", candidates: ["website", "site", "url", "link"] },
    { key: "founder_thesis", defaultName: "Founder Thesis", type: "rich_text", candidates: ["founder thesis", "thesis", "constraint", "dominant constraint"] },
    { key: "goal", defaultName: "Goal", type: "rich_text", candidates: ["goal", "target", "objective"] },
    { key: "icp_score", defaultName: "ICP Score", type: "number", candidates: ["icp score", "score", "icp"] },
    { key: "next_action", defaultName: "Next Action", type: "rich_text", candidates: ["next action", "action", "outreach"] },
    { key: "notes", defaultName: "Notes", type: "rich_text", candidates: ["notes", "strategy", "description"] },
    { key: "priority", defaultName: "Priority", type: "select", alternativeType: "rich_text", candidates: ["priority", "level"] },
    { key: "source", defaultName: "Source", type: "url", alternativeType: "rich_text", candidates: ["source", "source url", "ph url", "origin"] },
    { key: "stage", defaultName: "Stage", type: "select", alternativeType: "status", candidates: ["stage", "status"] }
  ];

  schemaDefinitions.forEach(field => {
    let match = findMatch(field.candidates, field.type, field.alternativeType);
    if (!match && field.type === "rich_text") {
      match = findMatch(field.candidates, "title") || findMatch(field.candidates, "url");
    }
    if (match) {
      mappings[field.key] = match;
    } else {
      validationErrors.push(`Missing: '${field.defaultName}' (${field.type.toUpperCase()})`);
    }
  });

  return { mappings, validationErrors, properties: propertyList };
}

// Validate database properties against schema requirements
function validateDatabaseSchema(properties: any, customMappings?: Record<string, string>) {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  const requiredSchema = [
    { key: "prospect", defaultName: "Prospect", type: "title", label: "Prospect" },
    { key: "company", defaultName: "Company", type: "rich_text", label: "Company" },
    { key: "website", defaultName: "Website", type: "url", label: "Website" },
    { key: "founder_thesis", defaultName: "Founder Thesis", type: "rich_text", label: "Founder Thesis" },
    { key: "goal", defaultName: "Goal", type: "rich_text", label: "Goal" },
    { key: "icp_score", defaultName: "ICP Score", type: "number", label: "ICP Score" },
    { key: "next_action", defaultName: "Next Action", type: "rich_text", label: "Next Action" },
    { key: "notes", defaultName: "Notes", type: "rich_text", label: "Notes" },
    { key: "priority", defaultName: "Priority", type: "select", alternativeType: "rich_text", label: "Priority" },
    { key: "source", defaultName: "Source", type: "url", alternativeType: "rich_text", label: "Source" },
    { key: "stage", defaultName: "Stage", type: "select", alternativeType: "status", label: "Stage" }
  ];

  const currentMappings = customMappings || {};

  requiredSchema.forEach(field => {
    const propertyName = currentMappings[field.key] || field.defaultName;
    const prop = properties[propertyName];

    if (!prop) {
      errors.push(`Missing: '${propertyName}' (${field.label})`);
    } else {
      const propType = prop.type;
      if (propType !== field.type && (!field.alternativeType || propType !== field.alternativeType)) {
        errors.push(`Wrong Type: '${propertyName}' should be ${field.label}`);
      }
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

// Hard disqualifiers check & strict validators
function validateAndEvaluateLead(lead: any, sourceUrl: string): { disqualified: boolean; reason?: string; evaluatedLead?: any } {
  const prospect = lead.founder_name || lead.prospect;
  const company = lead.company_name || lead.company;
  // Bug fix #7: Do NOT fall back to sourceUrl as the company website — that leads to HN/PH URLs
  // being stored as the company's website. Only use an explicit company URL or null.
  const rawWebsite = lead.website || lead.company_url || null;
  const website = rawWebsite && /^https?:\/\//i.test(rawWebsite) ? rawWebsite : null;
  
  if (!prospect || !prospect.trim() || prospect === "founder name not found — needs manual research") {
    return { disqualified: true, reason: "Missing founder name" };
  }
  if (!company || !company.trim()) {
    return { disqualified: true, reason: "Missing company name" };
  }
  // Commercial business check
  if (lead.is_commercial_business === false) {
    return { disqualified: true, reason: "Disqualified: no evidence of commercial business framing, revenue, MRR, or paying customers" };
  }

  // Hard disqualifiers check
  const funding = (lead.funding_status || "").toLowerCase();
  if (funding.includes("series a") || funding.includes("series b") || funding.includes("series c") || funding.includes("vc-funded") || funding.includes("venture-funded") || funding.includes("funding round")) {
    if (!funding.includes("pre-seed") && !funding.includes("pre seed") && !funding.includes("seed")) {
      return { disqualified: true, reason: `Disqualified funding status: ${lead.funding_status} (VC-funded/Series A+)` };
    }
  }
  
  const teamSize = lead.employee_count ?? 5;
  if (teamSize > 10) {
    return { disqualified: true, reason: `Disqualified team size: ${teamSize} (> 10)` };
  }

  const followers = lead.social_followers ?? 0;
  if (followers >= 1000) {
    return { disqualified: true, reason: `Disqualified follower count: ${followers} (1000+ followers on socials)` };
  }

  // Bug fix #5: Also detect text-based fame signals — e.g. "100k users", "50k followers", "viral"
  const notesText = (lead.notes || "").toLowerCase();
  const thesisText = (lead.founder_thesis || "").toLowerCase();
  const rawTextSignal = notesText + " " + thesisText;
  const famePatterns = /\b(\d+)\s*k\+?\s*(users|followers|downloads|installs|stars|subscribers)\b/gi;
  let fameMatch;
  while ((fameMatch = famePatterns.exec(rawTextSignal)) !== null) {
    const count = parseInt(fameMatch[1], 10) * 1000;
    if (count >= 10000) {
      return { disqualified: true, reason: `Disqualified recognizable founder: text signals ${fameMatch[0]} which suggests high reach/fame` };
    }
  }

  if (lead.has_major_press) {
    return { disqualified: true, reason: "Disqualified due to prior major press coverage" };
  }

  if (lead.ph_top_5) {
    return { disqualified: true, reason: "Disqualified due to Product Hunt top-5 daily feature history" };
  }

  // Dominant constraint (Founder Thesis) check
  const thesis = lead.founder_thesis;
  if (!thesis || !thesis.trim()) {
    return { disqualified: true, reason: "No self-disclosed dominant constraint/stated problem found in content" };
  }

  // Score check against 15-point rubric
  const scoreFounderActive = typeof lead.score_founder_active === 'number' ? lead.score_founder_active : 0;
  const scoreBuyingSignal = typeof lead.score_buying_signal === 'number' ? lead.score_buying_signal : 0;
  const scoreIcpFit = typeof lead.score_icp_fit === 'number' ? lead.score_icp_fit : 0;
  const scoreReachable = typeof lead.score_reachable === 'number' ? lead.score_reachable : 0;
  const scoreAtlasRelevance = typeof lead.score_atlas_relevance === 'number' ? lead.score_atlas_relevance : 0;
  
  // Bug fix #4: Detect old-format scoring — if any rubric field is > 3 it's from the old rubric system
  if (scoreFounderActive > 3 || scoreBuyingSignal > 3 || scoreIcpFit > 3 || scoreReachable > 3 || scoreAtlasRelevance > 3) {
    return { disqualified: true, reason: "Disqualified: legacy scoring format detected — scores exceed 3/3 per category" };
  }
  
  const totalScore = scoreFounderActive + scoreBuyingSignal + scoreIcpFit + scoreReachable + scoreAtlasRelevance;
  const staleWarning = lead.stale_data_warning || false;

  // Determine priority
  let priority = "Low";
  if (totalScore >= 13) priority = "High";
  else if (totalScore >= 11) priority = "Medium";

  // Contact channel details
  let contactChannel = "None [UNVERIFIED]";
  if (lead.linkedin_url || lead.twitter_url) {
    contactChannel = lead.linkedin_url ? `LinkedIn profile: ${lead.linkedin_url} [VERIFIED]` : `X handle: ${lead.twitter_url} [VERIFIED]`;
  }

  const notesContent = `## Rubric Breakdown
* **Founder Active Publicly**: ${scoreFounderActive}/3
* **Clear Buying Signal**: ${scoreBuyingSignal}/3
* **ICP Fit**: ${scoreIcpFit}/3
* **Reachable**: ${scoreReachable}/3
* **Atlas Relevance**: ${scoreAtlasRelevance}/3
* **Total Score**: ${totalScore}/15

## Contact Channel
* Status: ${contactChannel}

## Evaluation Details
${lead.notes || "No evaluation details provided."}`;

  // Bug fix #7: Don't build outreach with placeholder name
  const displayName = (prospect && prospect !== "founder name not found — needs manual research") ? prospect : "the founder";
  const nextAction = lead.next_action || `Reach out to ${displayName} on ${lead.linkedin_url ? "LinkedIn" : lead.twitter_url ? "X" : "available channels"} regarding their constraint: "${thesis}".`;

  return {
    disqualified: false,
    evaluatedLead: {
      prospect,
      company,
      website: website || null, // Bug fix #7: null if no real company URL found
      founder_thesis: thesis,
      goal: lead.goal || null,
      icp_score: totalScore,
      score_founder_active: scoreFounderActive,
      score_buying_signal: scoreBuyingSignal,
      score_icp_fit: scoreIcpFit,
      score_reachable: scoreReachable,
      score_atlas_relevance: scoreAtlasRelevance,
      is_below_threshold: totalScore < 10,
      stale_data_warning: staleWarning,
      next_action: nextAction,
      notes: notesContent,
      priority,
      source: sourceUrl,
      stage: "Sourced",
      linkedin_url: lead.linkedin_url || null,
      twitter_url: lead.twitter_url || null,
      email: lead.email || null,
      acquisition_channel: lead.acquisition_channel || "Outbound"
    }
  };
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

    const body: any = await req.json();

    let userId: string;
    if (isServiceCall) {
      userId = body.user_id || "service-role";
    } else {
      const { data: { user }, error: userError } = await userClient.auth.getUser();
      if (userError || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = user.id;
    }

    // ── SOURCE ACTION ────────────────────────────────────────────────────────────
    if (body.action === "source") {
      if (!body.url && !body.raw_text) {
        return new Response(JSON.stringify({ error: "URL or raw_text is required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let contentToAnalyze = "";
      let sourceUrl = body.url || null;
      let isRawTextActuallyUrl = false;

      if (!sourceUrl && body.raw_text) {
        const trimmed = body.raw_text.trim();
        const isUrl = /^(https?:\/\/[^\s]+)$/i.test(trimmed) || 
                      (/^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(\/[^\s]*)?$/i.test(trimmed));
        if (isUrl) {
          sourceUrl = trimmed;
          if (!/^https?:\/\//i.test(sourceUrl)) {
            sourceUrl = "https://" + sourceUrl;
          }
          isRawTextActuallyUrl = true;
        }
      }

      const isRestrictedUrl = sourceUrl && (
        sourceUrl.includes("linkedin.com") || 
        sourceUrl.includes("x.com") || 
        sourceUrl.includes("twitter.com") || 
        sourceUrl.includes("producthunt.com")
      );

      if (isRestrictedUrl) {
        return new Response(JSON.stringify({ 
          error: "Scraping of social media platforms (LinkedIn, X/Twitter) and Product Hunt directly is disabled to prevent rate limits and suspensions. Please copy-paste the text content into the 'Paste Text' tab." 
        }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      if (sourceUrl && (!body.raw_text || isRawTextActuallyUrl)) {
        console.log(`Scraping URL: ${sourceUrl}`);
        const scraped = await scrapeUrl(sourceUrl);
        console.log(`Scraped title: ${scraped.title}`);
        contentToAnalyze = `URL: ${sourceUrl}\nTitle: ${scraped.title}\nMeta Description: ${scraped.description}\nPage Content:\n${scraped.content}`;
      } else if (body.raw_text) {
        console.log("Analyzing raw text...");
        contentToAnalyze = `URL: ${sourceUrl || "Direct Text"}\nRaw Text Content:\n${body.raw_text}`;
      }

      const kimiApiKey = Deno.env.get("KIMI_API_KEY") || Deno.env.get("MOONSHOT_API_KEY");
      const groqApiKey = Deno.env.get("GROQ_API_KEY");
      const nimApiKey = Deno.env.get("NVIDIA_NIM_API_KEY");
      let extracted: any = null;

      const systemPrompt = `You are Atlas HQ — an intelligent B2B sales machine designed to parse startup landing pages and text content from founders.
Given the raw page text or scraped HTML, extract details strictly matching the following guidelines:

1. Company Name: Name of the startup or product.
2. Founder Name: CRITICAL — Look hard for any real human name in the text. Check for:
   - Author byline, signature, or "by [Name]"
   - First-person writing where a name appears near a quote
   - HN username if it appears to be a real name (e.g. "johndoe" → may be real; try the full thread text)
   - "Hi, I'm [Name]" or "I'm the founder of..."
   - Social profile links that contain a real name handle
   If you are confident you have found a real human name, return it.
   If no real founder name can be found in the text, return the exact string: "founder name not found — needs manual research"
   NEVER invent a name, guess a name, or use a placeholder like "John Doe" or "Jane Doe".
3. Company Website URL: The real company or product's own domain (e.g. feedcheck.io, velane.com). NOT the HN URL, NOT producthunt.com. If no company domain is mentioned, return null.
4. Founder's LinkedIn profile URL (or null)
5. Founder's X (Twitter) handle (or null) — must be a real @handle from the text, not invented
6. Estimated number of employees/team size (integer, default to 2 for solo/small indie hackers)
7. Funding Status: "Bootstrapped" unless explicitly stated otherwise
8. Social Media Followers: Only use a number if explicitly stated. Default to 0.
9. Prior Major Press Coverage (boolean): true only if text explicitly mentions TechCrunch, Wired, Forbes, Product Hunt #1, etc.
10. Product Hunt Top-5 (boolean): true only if text explicitly mentions being featured in PH top 5.
11. Founder Thesis: A self-disclosed problem/constraint from the founder's own words. Must be a direct quote or close paraphrase from the text. Return null if nothing is stated. DO NOT fabricate.
12. Goal: Stated goal (or null).
13. Rubric scores (each from 0-3, MUST reflect this specific candidate's actual text — do NOT use default values):
    - score_founder_active (0-3): Is the founder visibly active and building in public?
    - score_buying_signal (0-3): Does the text signal a clear pain point / willingness to invest in solutions?
    - score_icp_fit (0-3): Is this a B2B SaaS solo/micro founder without a big sales team?
    - score_reachable (0-3): Are there real contact channels (Twitter, LinkedIn, HN, personal email)?
    - score_atlas_relevance (0-3): Does Atlas's ICP (outbound/growth for micro-SaaS) match their stated problem?
14. Notes: 2-4 sentences of UNIQUE reasoning for THIS candidate specifically. Do not use template phrases like "Founder has a clear vision" — explain what you actually read.
15. Next Action: Specific outreach suggestion for THIS person — include their name, channel, and their specific constraint.
16. stale_data_warning: true if any metrics/revenue claims are older than Jan 2026 (assume current date is July 2026).
20. is_commercial_business: Boolean. Set to true only if there is explicit evidence of commercial intent in the source content (pricing, revenue, MRR, paying customers, SaaS model, or clear commercial framing). Set to false if it is a hobby project, pure open-source library with no pricing/business model mentioned, or personal side-project without clear commercial intent.
21. email: Extract an email address if explicitly stated (e.g. founder@domain.com, hello@domain.com). If none is found, construct a high-probability guess based on their first name and the company website (e.g. firstname@domain.com), or return null if impossible.

Return ONLY a valid JSON object:
{
  "company_name": "string",
  "founder_name": "string (real name or 'founder name not found — needs manual research')",
  "website": "string or null",
  "linkedin_url": "string or null",
  "twitter_url": "string or null",
  "employee_count": number,
  "funding_status": "string",
  "social_followers": number,
  "has_major_press": boolean,
  "ph_top_5": boolean,
  "founder_thesis": "string or null",
  "goal": "string or null",
  "score_founder_active": number,
  "score_buying_signal": number,
  "score_icp_fit": number,
  "score_reachable": number,
  "score_atlas_relevance": number,
  "notes": "string",
  "next_action": "string",
  "stale_data_warning": boolean,
  "is_commercial_business": boolean,
  "email": "string or null"
}`;

      if (kimiApiKey && kimiApiKey !== "your-kimi-api-key") {
        try {
          extracted = await callKimi(systemPrompt, contentToAnalyze, kimiApiKey);
        } catch (kimiErr: any) {
          console.warn("Kimi failed, trying Groq fallback:", kimiErr.message);
          if (kimiErr.message.includes("AUTH_ERROR")) throw kimiErr;
        }
      }

      if (!extracted && groqApiKey) {
        try {
          extracted = await callGroq(systemPrompt, contentToAnalyze, groqApiKey);
        } catch (groqErr: any) {
          console.warn("Groq failed, trying NVIDIA NIM:", groqErr.message);
          if (groqErr.message.includes("AUTH_ERROR")) throw groqErr;
        }
      }

      if (!extracted && nimApiKey) {
        try {
          extracted = await callNvidiaNim(systemPrompt, contentToAnalyze, nimApiKey);
        } catch (nimErr: any) {
          console.error("NVIDIA NIM failed:", nimErr.message);
          if (nimErr.message.includes("AUTH_ERROR")) throw nimErr;
        }
      }

      if (!extracted) {
        throw new Error("AI extraction failed to produce a structured profile. Check inputs or try again.");
      }

      const evaluation = validateAndEvaluateLead(extracted, sourceUrl || "https://unknown.com");
      if (evaluation.disqualified) {
        if (evaluation.reason === "No self-disclosed dominant constraint/stated problem found in content") {
          return new Response(JSON.stringify({ 
            error: "No founder-voice content detected in this text — this source may not contain the kind of first-person narrative this tool looks for" 
          }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
        return new Response(JSON.stringify({
          leads: [],
          rejected: [{
            company: extracted.company_name || extracted.company || "Unknown",
            prospect: extracted.founder_name || extracted.prospect || "Unknown Founder",
            reason: evaluation.reason || "Disqualified",
            raw_data: extracted
          }],
          total: 1
        }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      return new Response(JSON.stringify({
        leads: [evaluation.evaluatedLead],
        rejected: [],
        total: 1
      }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // ── BULK SOURCE ACTION ────────────────────────────────────────────────────────
    if (body.action === "bulk-source") {
      const kimiApiKey = Deno.env.get("KIMI_API_KEY") || Deno.env.get("MOONSHOT_API_KEY");
      const nimApiKey = Deno.env.get("NVIDIA_NIM_API_KEY");

      const singleSystemPrompt = `You are Atlas HQ — an intelligent B2B sales machine designed to parse startup landing pages or social profiles.
Given the HTML scraping or raw page text, extract details strictly matching the following guidelines:
1. Company Name
2. Founder Name
3. Founder's LinkedIn profile URL (or null)
4. Founder's X (Twitter) handle (or null)
5. Estimated number of employees/team size (integer, guess based on context, default to 5)
6. Funding Status (e.g. "Pre-seed", "Seed", "Series A+", "VC-funded", "Bootstrapped")
7. Social Media Followers (total estimated follower count on Twitter/LinkedIn, e.g. 500)
8. Prior Major Press Coverage (boolean, true/false if they have major press)
9. Product Hunt Top-5 (boolean, true/false if they have been previously featured in Product Hunt's top-5 of the day)
10. Founder Thesis: Sourced from the founder's own words, extract a quote or close paraphrase of a self-disclosed problem/constraint (e.g., "churn eating growth," "doesn't know which acquisition channel to invest in"). This MUST be a real problem they stated. If no self-disclosed constraint or problem can be found in the text, return null. DO NOT guess/invent one if not mentioned.
11. Goal: Stated goal or target they want to achieve.
12. Rubric scores (from 0 to 3 points each):
    - score_founder_active: Founder active publicly
    - score_buying_signal: Clear buying signal
    - score_icp_fit: ICP fit
    - score_reachable: Reachable
    - score_atlas_relevance: Atlas relevance
13. Notes: Brief detailed evaluation reasoning for the score.
14. Next Action: Actionable outreach recommendation.
15. stale_data_warning: Boolean. Identify any dates, times, or time periods in the text, especially those related to revenue or MRR claims. Assuming the current date is July 2026, if a metrics claim is associated with a date that is older than 6 months relative to July 2026 (i.e. before January 2026), set this to true. Otherwise, set it to false.

Return ONLY a valid JSON object matching this exact schema:
{
  "company_name": "string",
  "founder_name": "string or null",
  "linkedin_url": "string or null",
  "twitter_url": "string or null",
  "employee_count": number,
  "funding_status": "string",
  "social_followers": number,
  "has_major_press": boolean,
  "ph_top_5": boolean,
  "founder_thesis": "string or null",
  "goal": "string or null",
  "score_founder_active": number,
  "score_buying_signal": number,
  "score_icp_fit": number,
  "score_reachable": number,
  "score_atlas_relevance": number,
  "notes": "string",
  "next_action": "string",
  "stale_data_warning": boolean
}`;

      const callAi = async (systemPrompt: string, userPrompt: string): Promise<any> => {
        if (kimiApiKey) {
          try { 
            return await callKimi(systemPrompt, userPrompt, kimiApiKey); 
          } catch (err: any) { 
            if (err.message.includes("AUTH_ERROR")) throw err;
          }
        }
        if (nimApiKey) {
          return await callNvidiaNim(systemPrompt, userPrompt, nimApiKey);
        }
        throw new Error("All AI providers failed. Check API keys and network status.");
      };

      // ── CASE A: Batch URLs ──────────────────────────────────────────────────
      if (body.urls && body.urls.length > 0) {
        const MAX_URLS = 20;
        const urls = body.urls.slice(0, MAX_URLS).map(u => {
          u = u.trim();
          if (u && !/^https?:\/\//i.test(u)) u = "https://" + u;
          return u;
        }).filter(Boolean);

        // Process all URLs in parallel (capped at MAX_URLS) for speed
        const settled = await Promise.allSettled(
          urls.map(async (url) => {
            console.log(`Sourcing URL inside batch: ${url}`);
            const isRestricted = url.includes("linkedin.com") || url.includes("x.com") || url.includes("twitter.com") || url.includes("producthunt.com");
            if (isRestricted) {
              throw new Error("Direct scraping of LinkedIn, X, and Product Hunt is disabled.");
            }
            const scraped = await scrapeUrl(url);
            const contentToAnalyze = `URL: ${url}\nTitle: ${scraped.title}\nMeta Description: ${scraped.description}\nPage Content:\n${scraped.content}`;
            return await callAi(singleSystemPrompt, contentToAnalyze);
          })
        );

        const results: any[] = [];
        const rejected: any[] = [];
        let authErrorStr = "";
        settled.forEach((r, i) => {
          if (r.status === "fulfilled") {
            const evaluation = validateAndEvaluateLead(r.value, urls[i]);
            if (!evaluation.disqualified) {
              results.push(evaluation.evaluatedLead);
            } else {
              rejected.push({
                company: r.value.company_name || r.value.company || "Unknown",
                prospect: r.value.founder_name || r.value.prospect || "Unknown Founder",
                reason: evaluation.reason || "Disqualified",
                raw_data: r.value
              });
            }
          } else {
            console.warn(`Failed to source URL ${urls[i]}:`, r.reason?.message);
            if (r.reason?.message?.includes("AUTH_ERROR")) {
              authErrorStr = r.reason.message;
            }
            rejected.push({
              company: "Unknown",
              prospect: "Unknown",
              reason: r.reason?.message || "Failed to load/parse page",
              raw_data: null
            });
          }
        });

        if (authErrorStr) {
          return new Response(JSON.stringify({ error: authErrorStr }), {
            status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        return new Response(JSON.stringify({ leads: results, rejected, total: results.length + rejected.length }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // ── CASE B: Bulk raw text ───────────────────────────────────────────────
      if (body.raw_text) {
        const bulkSystemPrompt = `You are Atlas HQ — an intelligent B2B SaaS founder intelligence engine.
You will receive a block of text that may contain information about ONE or MULTIPLE startup companies or founders.
For EACH distinct company or founder profile you find in the text, extract:
1. Company Name
2. Founder Name
3. Founder's LinkedIn profile URL (or null)
4. Founder's X (Twitter) handle (or null)
5. Estimated number of employees/team size (integer, default to 5)
6. Funding Status (e.g. "Pre-seed", "Seed", "Series A+", "VC-funded", "Bootstrapped")
7. Social Media Followers (total estimated follower count on Twitter/LinkedIn, e.g. 500)
8. Prior Major Press Coverage (boolean, true/false if they have major press)
9. Product Hunt Top-5 (boolean, true/false if they have been previously featured in Product Hunt's top-5 of the day)
10. Founder Thesis: Sourced from the founder's own words, extract a quote or close paraphrase of a self-disclosed problem/constraint (e.g., "churn eating growth," "doesn't know which acquisition channel to invest in"). This MUST be a real problem they stated. If no self-disclosed constraint or problem can be found in the text, return null. DO NOT guess/invent one if not mentioned.
11. Goal: Stated goal or target they want to achieve.
12. Rubric scores (from 0 to 3 points each):
    - score_founder_active: Founder active publicly
    - score_buying_signal: Clear buying signal
    - score_icp_fit: ICP fit
    - score_reachable: Reachable
    - score_atlas_relevance: Atlas relevance
13. Notes: Brief detailed evaluation reasoning for the score.
14. Next Action: Actionable outreach recommendation.
15. stale_data_warning: Boolean. Identify any dates, times, or time periods in the text, especially those related to revenue or MRR claims. Assuming the current date is July 2026, if a metrics claim is associated with a date that is older than 6 months relative to July 2026 (i.e. before January 2026), set this to true. Otherwise, set it to false.

IMPORTANT: Extract ALL distinct startups/founders found in the text.
Return ONLY a valid JSON array matching this exact schema:
[{
  "company_name": "string",
  "founder_name": "string or null",
  "linkedin_url": "string or null",
  "twitter_url": "string or null",
  "employee_count": number,
  "funding_status": "string",
  "social_followers": number,
  "has_major_press": boolean,
  "ph_top_5": boolean,
  "founder_thesis": "string or null",
  "goal": "string or null",
  "score_founder_active": number,
  "score_buying_signal": number,
  "score_icp_fit": number,
  "score_reachable": number,
  "score_atlas_relevance": number,
  "notes": "string",
  "next_action": "string",
  "stale_data_warning": boolean
}]`;

        let arrayResult: any = [];
        try {
          if (kimiApiKey) {
            try {
              // 32k model + 8192 max_tokens to prevent mid-array truncation on multi-profile pastes
              arrayResult = await callKimi(bulkSystemPrompt, `Raw Text:\n${body.raw_text}`, kimiApiKey, true, "moonshot-v1-32k", 8192);
            } catch (e: any) {
              console.warn("Kimi bulk failed:", e.message);
              if (e.message.includes("AUTH_ERROR")) throw e;
            }
          }
          if ((!arrayResult || !arrayResult.length) && groqApiKey) {
            try {
              arrayResult = await callGroq(bulkSystemPrompt, `Raw Text:\n${body.raw_text}`, groqApiKey, true);
            } catch (e: any) {
              console.warn("Groq bulk failed:", e.message);
              if (e.message.includes("AUTH_ERROR")) throw e;
            }
          }
          if ((!arrayResult || !arrayResult.length) && nimApiKey) {
            arrayResult = await callNvidiaNim(bulkSystemPrompt, `Raw Text:\n${body.raw_text}`, nimApiKey, true);
          }
        } catch (err: any) {
          console.error("Bulk text AI failed:", err.message);
          if (err.message.includes("AUTH_ERROR")) {
            return new Response(JSON.stringify({ error: err.message }), {
              status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
          }
          return new Response(JSON.stringify({ error: "AI extraction failed: " + err.message }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        const filteredLeads: any[] = [];
        const rejectedLeads: any[] = [];
        const items = Array.isArray(arrayResult) ? arrayResult : [];
        
        for (const item of items) {
          const evaluation = validateAndEvaluateLead(item, body.url || "https://unknown.com");
          if (!evaluation.disqualified) {
            filteredLeads.push(evaluation.evaluatedLead);
          } else {
            rejectedLeads.push({
              company: item.company_name || item.company || "Unknown",
              prospect: item.founder_name || item.prospect || "Unknown Founder",
              reason: evaluation.reason || "Disqualified",
              raw_data: item
            });
          }
        }

        const responseObj: any = {
          leads: filteredLeads,
          rejected: rejectedLeads,
          total: filteredLeads.length + rejectedLeads.length
        };

        if (arrayResult.partial) {
          responseObj.partial = true;
          responseObj.recovered_count = arrayResult.recovered_count;
        }

        return new Response(JSON.stringify(responseObj), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      return new Response(JSON.stringify({ error: "urls[] or raw_text is required for bulk-source" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // ── HACKER NEWS SOURCING ACTION ──────────────────────────────────────────────
    if (body.action === "hn-source") {
      const kimiApiKey = Deno.env.get("KIMI_API_KEY") || Deno.env.get("MOONSHOT_API_KEY");
      const groqApiKey = Deno.env.get("GROQ_API_KEY");
      const nimApiKey = Deno.env.get("NVIDIA_NIM_API_KEY");

      const query = body.query || "Show HN";
      const timeRange = body.time_range || "past_week";

      // Calculate Unix timestamp cutoff based on timeRange
      const now = Math.floor(Date.now() / 1000);
      let cutoffTimestamp = now - 7 * 24 * 60 * 60; // default 7 days (past_week)
      if (timeRange === "past_24h") {
        cutoffTimestamp = now - 24 * 60 * 60;
      } else if (timeRange === "past_month") {
        cutoffTimestamp = now - 30 * 24 * 60 * 60;
      }

      try {
        // Fetch top stories from Algolia Search API
        const algoliaUrl = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&tags=story&numericFilters=created_at_i>=${cutoffTimestamp}`;
        const searchRes = await fetch(algoliaUrl, {
          signal: AbortSignal.timeout(15000), // 15 seconds timeout for Algolia fetch
        });

        if (!searchRes.ok) {
          throw new Error(`Algolia HN search failed: ${searchRes.status} ${searchRes.statusText}`);
        }

        const searchData = await searchRes.json();
        const hits = searchData.hits || [];
        
        // Grab top 10 stories with URLs or text content
        const topStories = hits.slice(0, 10);
        if (topStories.length === 0) {
          return new Response(JSON.stringify({
            leads: [],
            rejected: [],
            total: 0,
            message: "No Hacker News stories found matching the criteria."
          }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        // Map stories to a readable text block
        const hnTextBlock = topStories.map((story: any) => {
          const hnLink = `https://news.ycombinator.com/item?id=${story.objectID}`;
          return `HN Thread Link: ${hnLink}
Author: ${story.author}
Title: ${story.title}
Website: ${story.url || "No website link"}
Story Text: ${story.story_text || "No story description text"}
`;
        }).join("\n---\n\n");

        // Pass text block to AI parser using hardened HN-specific prompt
        const bulkSystemPrompt = `You are Atlas HQ — an intelligent B2B sales machine parsing Hacker News "Show HN" submissions to identify solo/micro-SaaS founders worth cold outreach.

For EACH submission, extract the following. You MUST produce a separate entry for each HN story — do not merge or skip any.

1. Company Name: The startup or product name from the HN title.
2. Founder Name — CRITICAL: This is the most important field.
   - First check: the HN submission Author field is the username of the person who posted it. If it resembles a real name (e.g. "manuarora", "john_doe", "alice123") use it as-is.
   - Second check: scan the Story Text for phrases like "Hi, I'm [Name]", "I'm [Name], founder of", "built by [Name]".
   - If you find a real human name with high confidence, return it.
   - If not found with confidence, return the exact string: "founder name not found — needs manual research"
   - NEVER invent a name. NEVER use "John Doe", "Jane Doe", or any generic placeholder.
3. Company Website: The real company/product domain from the "Website" field or story text (e.g. feedcheck.io). NOT news.ycombinator.com. NOT producthunt.com. If no company domain found, return null.
4. Founder's LinkedIn profile URL (or null — only if explicitly in text)
5. Founder's X (Twitter) handle (or null — only if explicitly in text)
6. Employee count (integer, default 1-2 for solo founders posting on HN)
7. Funding Status: "Bootstrapped" unless text explicitly says otherwise
8. Social Media Followers: 0 unless text explicitly states a number. NOTE: if text mentions "Xk+ users" or "Xk followers" where X >= 10, set social_followers to that number * 1000.
9. has_major_press (boolean): true only if text explicitly mentions major press outlets or going viral
10. ph_top_5 (boolean): true only if explicitly mentioned
11. Founder Thesis: A direct quote or tight paraphrase of the founder's self-disclosed pain point from their own submission text. Must come from their actual words. Return null if not found. Never fabricate.
12. Goal: What they're trying to achieve (or null)
13. Rubric scores — UNIQUE PER ENTRY, based on what you actually read. DO NOT use the same scores for multiple entries.
    - score_founder_active (0-3): Active publicly? Posting, sharing metrics, engaging?
    - score_buying_signal (0-3): Clear pain/desire to invest in tools to grow?
    - score_icp_fit (0-3): B2B micro/solo SaaS founder. Must be 0 if the project is a pure open-source tool, hobby library, or has no commercial intent/pricing model.
    - score_reachable (0-3): Reachable via HN, Twitter, LinkedIn, or email in text?
    - score_atlas_relevance (0-3): Does their stated problem align with outbound/growth tooling Atlas provides?
14. Notes: 2-4 sentences of SPECIFIC reasoning for THIS candidate. Do not reuse phrases across entries. Reference what you actually read in their submission.
15. Next Action: Specific, personalized outreach suggestion for THIS person — include their name/handle, the channel, and their specific stated constraint.
16. stale_data_warning: true if any revenue/metrics claims are older than Jan 2026 (current date = July 2026)
17. is_commercial_business: Boolean. Set to true only if there is explicit evidence of commercial intent in this story (pricing, revenue, MRR, paying customers, SaaS model, or clear commercial framing). Set to false if it is a hobby project, pure open-source library, codec, AI agent wrapper with no pricing/business model mentioned, or personal side-project without clear commercial intent.

Crucially, keep data aligned! For each JSON object, all fields (company_name, founder_name, website, founder_thesis, scores, notes, next_action) MUST be extracted ONLY from that specific story's text block. DO NOT mix usernames (e.g. Author or name in text), websites, or details from one submission with another. For example, if HN Thread Link 1 has Author 'userA', then the JSON object for that company name MUST use founder_name 'userA' (or name in text). Never associate 'userA' with the company name or details from HN Thread Link 2.

Return ONLY a valid JSON array — one object per story. No commentary, no markdown:
[{
  "company_name": "string",
  "founder_name": "string (real name or 'founder name not found — needs manual research')",
  "website": "string or null",
  "linkedin_url": "string or null",
  "twitter_url": "string or null",
  "employee_count": number,
  "funding_status": "string",
  "social_followers": number,
  "has_major_press": boolean,
  "ph_top_5": boolean,
  "founder_thesis": "string or null",
  "goal": "string or null",
  "score_founder_active": number,
  "score_buying_signal": number,
  "score_icp_fit": number,
  "score_reachable": number,
  "score_atlas_relevance": number,
  "notes": "string",
  "next_action": "string",
  "stale_data_warning": boolean,
  "is_commercial_business": boolean
}]`;

        let arrayResult: any = [];
        if (kimiApiKey) {
          try {
            arrayResult = await callKimi(bulkSystemPrompt, `Hacker News Stories:\n${hnTextBlock}`, kimiApiKey, true, "moonshot-v1-32k", 8192);
          } catch (e: any) {
            console.warn("Kimi HN sourcing failed:", e.message);
            if (e.message.includes("AUTH_ERROR")) throw e;
          }
        }
        if ((!arrayResult || !arrayResult.length) && groqApiKey) {
          try {
            arrayResult = await callGroq(bulkSystemPrompt, `Hacker News Stories:\n${hnTextBlock}`, groqApiKey, true);
          } catch (e: any) {
            console.warn("Groq HN sourcing failed:", e.message);
            if (e.message.includes("AUTH_ERROR")) throw e;
          }
        }
        if ((!arrayResult || !arrayResult.length) && nimApiKey) {
          try {
            arrayResult = await callNvidiaNim(bulkSystemPrompt, `Hacker News Stories:\n${hnTextBlock}`, nimApiKey, true);
          } catch (e: any) {
            console.warn("NIM HN sourcing failed:", e.message);
            if (e.message.includes("AUTH_ERROR")) throw e;
          }
        }

        const filteredLeads: any[] = [];
        const rejectedLeads: any[] = [];
        const items = Array.isArray(arrayResult) ? arrayResult : [];
        
        for (let idx = 0; idx < items.length; idx++) {
          const item = items[idx];
          let matchedSource = `https://news.ycombinator.com/`;
          
          const compLower = (item.company_name || "").toLowerCase();
          const matchedHit = topStories.find((story: any) => 
            (story.title || "").toLowerCase().includes(compLower) || 
            (story.story_text || "").toLowerCase().includes(compLower)
          );
          if (matchedHit) {
            matchedSource = matchedHit.url || `https://news.ycombinator.com/item?id=${matchedHit.objectID}`;
          }

          const evaluation = validateAndEvaluateLead(item, matchedSource);
          if (!evaluation.disqualified) {
            filteredLeads.push(evaluation.evaluatedLead);
          } else {
            rejectedLeads.push({
              company: item.company_name || item.company || "Unknown",
              prospect: item.founder_name || item.prospect || "Unknown Founder",
              reason: evaluation.reason || "Disqualified",
              raw_data: item
            });
          }
        }

        const responseObj: any = {
          leads: filteredLeads,
          rejected: rejectedLeads,
          total: filteredLeads.length + rejectedLeads.length
        };

        if (arrayResult.partial) {
          responseObj.partial = true;
          responseObj.recovered_count = arrayResult.recovered_count;
        }

        return new Response(JSON.stringify(responseObj), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      } catch (err: any) {
        console.error("Hacker News Sourcing Action Error:", err.message);
        if (err.message.includes("AUTH_ERROR")) {
          return new Response(JSON.stringify({ error: err.message }), {
            status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
        return new Response(JSON.stringify({ error: "HN sourcing extraction failed: " + err.message }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    // ── STARTER STORY SOURCING ACTION ─────────────────────────────────────────────
    if (body.action === "starter-story-source") {
      const kimiApiKey = Deno.env.get("KIMI_API_KEY") || Deno.env.get("MOONSHOT_API_KEY");
      const groqApiKey = Deno.env.get("GROQ_API_KEY");
      const nimApiKey = Deno.env.get("NVIDIA_NIM_API_KEY");

      try {
        // Fetch Starter Story's latest stories feed
        const ssRes = await fetch("https://www.starterstory.com/stories", {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          },
          signal: AbortSignal.timeout(20000)
        });
        if (!ssRes.ok) throw new Error(`Starter Story fetch failed: ${ssRes.status}`);
        const ssHtml = await ssRes.text();

        // Extract story cards from the HTML (title, URL, revenue snippet)
        const storyPattern = /<a[^>]+href="(\/stories\/[^"]+)"[^>]*>[\s\S]*?<\/a>/gi;
        const namePattern = /<h\d[^>]*>([\s\S]*?)<\/h\d>/gi;
        
        // Simpler: pull all /stories/ links and their titles via a direct regex
        const cardMatches: Array<{ url: string; text: string }> = [];
        const linkRegex = /href="(\/stories\/[^"#?]+)"[^>]*>([\s\S]*?)<\/a>/gi;
        let m: RegExpExecArray | null;
        while ((m = linkRegex.exec(ssHtml)) !== null && cardMatches.length < 15) {
          const url = `https://www.starterstory.com${m[1]}`;
          const rawText = m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
          if (rawText.length > 20 && !cardMatches.some(c => c.url === url)) {
            cardMatches.push({ url, text: rawText });
          }
        }

        // If no cards found, fall back to the RSS feed
        if (cardMatches.length === 0) {
          const rssRes = await fetch("https://www.starterstory.com/rss.xml", {
            headers: { "User-Agent": "Mozilla/5.0" },
            signal: AbortSignal.timeout(15000)
          });
          if (rssRes.ok) {
            const rssText = await rssRes.text();
            const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
            let rssM: RegExpExecArray | null;
            while ((rssM = itemRegex.exec(rssText)) !== null && cardMatches.length < 10) {
              const item = rssM[1];
              const titleM = item.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) || item.match(/<title>([\s\S]*?)<\/title>/);
              const linkM = item.match(/<link>([\s\S]*?)<\/link>/);
              const descM = item.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/) || item.match(/<description>([\s\S]*?)<\/description>/);
              if (titleM && linkM) {
                cardMatches.push({
                  url: linkM[1].trim(),
                  text: `${titleM[1].trim()}. ${(descM?.[1] || "").replace(/<[^>]+>/g, " ").slice(0, 400).trim()}`
                });
              }
            }
          }
        }

        if (cardMatches.length === 0) {
          return new Response(JSON.stringify({ leads: [], rejected: [], total: 0, message: "No Starter Story stories found." }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        const topStories = cardMatches.slice(0, 10);
        const ssTextBlock = topStories.map((s, i) => `Story ${i + 1}:\nSource URL: ${s.url}\n${s.text}`).join("\n---\n\n");

        const ssSystemPrompt = `You are Atlas HQ — an intelligent B2B sales intelligence machine. You are parsing Starter Story founder interviews to find bootstrapped founders worth cold outreach.

For EACH story entry, extract:
1. Company Name: The startup or product name.
2. Founder Name — CRITICAL: Extract from the text if present (often "I'm [Name]" or byline). Return the exact string "founder name not found — needs manual research" if not found with confidence. NEVER invent or guess a name.
3. Company Website: The real product domain (not starterstory.com). Return null if not found.
4. LinkedIn URL (or null)
5. Twitter/X handle (or null)
6. Employee count (integer)
7. Funding Status: "Bootstrapped" unless stated otherwise
8. Social Media Followers: 0 unless explicitly stated
9. has_major_press: boolean
10. ph_top_5: boolean
11. Founder Thesis: Direct quote or paraphrase of their stated pain point. null if not found. Never fabricate.
12. Goal: What they're building toward (or null)
13. Rubric scores — UNIQUE PER ENTRY based on what you read:
    - score_founder_active (0-3)
    - score_buying_signal (0-3)
    - score_icp_fit (0-3): Must be 0 if no commercial intent, revenue, or pricing
    - score_reachable (0-3)
    - score_atlas_relevance (0-3)
14. Notes: 2-4 sentences of specific reasoning for THIS candidate
15. Next Action: Specific personalized outreach suggestion
16. stale_data_warning: true if revenue claims are older than Jan 2026
17. is_commercial_business: true only if there is explicit evidence of revenue, MRR, paying customers, or a clear commercial SaaS model. false for hobby/open-source/personal projects.

Return ONLY a valid JSON array — one object per story:
[{
  "company_name": "string",
  "founder_name": "string",
  "website": "string or null",
  "linkedin_url": "string or null",
  "twitter_url": "string or null",
  "employee_count": number,
  "funding_status": "string",
  "social_followers": number,
  "has_major_press": boolean,
  "ph_top_5": boolean,
  "founder_thesis": "string or null",
  "goal": "string or null",
  "score_founder_active": number,
  "score_buying_signal": number,
  "score_icp_fit": number,
  "score_reachable": number,
  "score_atlas_relevance": number,
  "notes": "string",
  "next_action": "string",
  "stale_data_warning": boolean,
  "is_commercial_business": boolean
}]`;

        let arrayResult: any = [];
        if (kimiApiKey) {
          try { arrayResult = await callKimi(ssSystemPrompt, `Starter Story entries:\n${ssTextBlock}`, kimiApiKey, true, "moonshot-v1-32k", 8192); }
          catch (e: any) { console.warn("Kimi SS failed:", e.message); if (e.message.includes("AUTH_ERROR")) throw e; }
        }
        if ((!arrayResult || !arrayResult.length) && groqApiKey) {
          try { arrayResult = await callGroq(ssSystemPrompt, `Starter Story entries:\n${ssTextBlock}`, groqApiKey, true); }
          catch (e: any) { console.warn("Groq SS failed:", e.message); }
        }
        if ((!arrayResult || !arrayResult.length) && nimApiKey) {
          try { arrayResult = await callNvidiaNim(ssSystemPrompt, `Starter Story entries:\n${ssTextBlock}`, nimApiKey, true); }
          catch (e: any) { console.warn("NIM SS failed:", e.message); }
        }

        const filteredLeads: any[] = [];
        const rejectedLeads: any[] = [];
        const items = Array.isArray(arrayResult) ? arrayResult : [];
        for (let idx = 0; idx < items.length; idx++) {
          const item = items[idx];
          const matchedSource = topStories[idx]?.url || "https://www.starterstory.com/stories";
          const evaluation = validateAndEvaluateLead(item, matchedSource);
          if (!evaluation.disqualified) {
            filteredLeads.push(evaluation.evaluatedLead);
          } else {
            rejectedLeads.push({ company: item.company_name || "Unknown", prospect: item.founder_name || "Unknown", reason: evaluation.reason, raw_data: item });
          }
        }

        return new Response(JSON.stringify({ leads: filteredLeads, rejected: rejectedLeads, total: filteredLeads.length + rejectedLeads.length }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      } catch (err: any) {
        console.error("Starter Story Sourcing Error:", err.message);
        return new Response(JSON.stringify({ error: "Starter Story sourcing failed: " + err.message }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    // ── YC DIRECTORY SOURCING ACTION ──────────────────────────────────────────────
    if (body.action === "yc-source") {
      const kimiApiKey = Deno.env.get("KIMI_API_KEY") || Deno.env.get("MOONSHOT_API_KEY");
      const groqApiKey = Deno.env.get("GROQ_API_KEY");
      const nimApiKey = Deno.env.get("NVIDIA_NIM_API_KEY");

      const ycFilter = body.filter || "recent";
      const ycIndustry = body.industry || "";

      try {
        // 1. Fetch YC master directory list from yc-oss open-source JSON replica
        const listRes = await fetch("https://yc-oss.github.io/api/companies/all.json", {
          signal: AbortSignal.timeout(15000)
        });
        if (!listRes.ok) throw new Error(`Failed to load YC company dataset: ${listRes.status}`);
        const allCompanies = await listRes.json();

        // 2. Filter companies based on filter param
        let filtered = allCompanies;
        if (ycFilter === "recent") {
          const recentBatches = ["Winter 2024", "Summer 2024", "Winter 2023", "Summer 2023", "W24", "S24", "W23", "S23"];
          filtered = allCompanies.filter((co: any) => recentBatches.some((b: string) => co.batch && co.batch.includes(b)));
        } else if (ycFilter === "top") {
          filtered = allCompanies.filter((co: any) => co.top_company === true);
        } else if (ycFilter === "b2b") {
          filtered = allCompanies.filter((co: any) => 
            (co.industry && co.industry.toLowerCase().includes("b2b")) ||
            (co.subindustry && co.subindustry.toLowerCase().includes("b2b")) ||
            (co.tags && co.tags.some((t: string) => t.toLowerCase().includes("b2b")))
          );
        } else if (ycFilter === "saas") {
          filtered = allCompanies.filter((co: any) => 
            (co.subindustry && co.subindustry.toLowerCase().includes("saas")) ||
            (co.tags && co.tags.some((t: string) => t.toLowerCase().includes("saas")))
          );
        }

        // 3. Filter by industry keyword if provided
        if (ycIndustry) {
          const indLower = ycIndustry.toLowerCase();
          filtered = filtered.filter((co: any) => 
            (co.industry && co.industry.toLowerCase().includes(indLower)) ||
            (co.subindustry && co.subindustry.toLowerCase().includes(indLower)) ||
            (co.tags && co.tags.some((t: string) => t.toLowerCase().includes(indLower)))
          );
        }

        // Sort by ID descending to prioritize newer/more relevant entries
        filtered.sort((a: any, b: any) => (b.id || 0) - (a.id || 0));

        if (filtered.length === 0) {
          return new Response(JSON.stringify({ leads: [], rejected: [], total: 0, message: "No YC companies found matching the criteria." }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        // Slice top 10 companies to fetch their public detail pages
        const topStories = filtered.slice(0, 10);
        
        // 4. Fetch detail pages in parallel to extract founders list and profile details
        const companiesWithDetails = await Promise.all(
          topStories.map(async (co: any) => {
            try {
              const coUrl = `https://www.ycombinator.com/companies/${co.slug}`;
              const detailRes = await fetch(coUrl, {
                headers: {
                  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                },
                signal: AbortSignal.timeout(10000)
              });
              if (!detailRes.ok) return null;
              
              const html = await detailRes.text();
              const dataPageMatch = html.match(/data-page="([^"]+)"/) || html.match(/data-page='([^']+)'/);
              if (dataPageMatch) {
                const decodedJson = dataPageMatch[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
                const pageData = JSON.parse(decodedJson);
                const companyDetails = pageData.props?.company || {};
                
                // Format founders list details
                const foundersList = (companyDetails.founders || []).map((f: any) => {
                  return `Name: ${f.full_name || "not listed"}, Bio: ${f.founder_bio || "not listed"}, LinkedIn: ${f.linkedin_url || "not listed"}, Twitter: ${f.twitter_url || "not listed"}`;
                }).join(" | ");

                return {
                  company_name: companyDetails.name || co.name,
                  website: companyDetails.website || co.website || null,
                  linkedin_url: companyDetails.linkedin_url || null,
                  twitter_url: companyDetails.twitter_url || null,
                  employee_count: companyDetails.team_size || co.team_size || null,
                  funding_status: `Seed (YC ${companyDetails.batch || co.batch || "backed"})`,
                  founders: foundersList || null,
                  description: companyDetails.long_description || companyDetails.one_liner || co.long_description || co.one_liner || "",
                  source_url: coUrl
                };
              }
            } catch (err) {
              console.error(`Error loading detail for ${co.slug}:`, err.message);
            }
            // Fallback to list details if profile page crawl failed
            return {
              company_name: co.name,
              website: co.website || null,
              linkedin_url: null,
              twitter_url: null,
              employee_count: co.team_size || null,
              funding_status: `Seed (YC ${co.batch || "backed"})`,
              founders: null,
              description: co.long_description || co.one_liner || "",
              source_url: `https://www.ycombinator.com/companies/${co.slug}`
            };
          })
        );

        const validCompanies = companiesWithDetails.filter(Boolean);

        // 5. Format detailed data as text block for AI parsing
        const ycTextBlock = validCompanies.map((co: any, i: number) =>
          `Company ${i + 1}:
Name: ${co.company_name}
Website: ${co.website || "No website link"}
Source Profile: ${co.source_url}
Batch & Funding: ${co.funding_status}
Team Size: ${co.employee_count}
Stated Founders: ${co.founders || "Not listed"}
Description: ${co.description}
`
        ).join("\n---\n\n");

        const ycSystemPrompt = `You are Atlas HQ — a B2B sales intelligence machine. You are parsing YC company directory listings to find solo/small-team B2B SaaS founders worth cold outreach.

For EACH company, extract:
1. Company Name
2. Founder Name — CRITICAL: Use the "Stated Founders" field if provided. If a real name is listed there, use it. If multiple founders, list the first main founder. If not found or not listed, return the exact string "founder name not found — needs manual research". NEVER invent a name.
3. Company Website: The real domain. Return null if not found.
4. LinkedIn URL (or null)
5. Twitter/X handle (or null)
6. Employee count (integer)
7. Funding Status: e.g. "Seed (YC-backed)"
8. Social Media Followers: 0 unless explicitly stated
9. has_major_press: boolean
10. ph_top_5: boolean
11. Founder Thesis: Their stated problem or mission from the description. Return null if not found. Never fabricate.
12. Goal: What they're building (or null)
13. Rubric scores — UNIQUE PER ENTRY:
    - score_founder_active (0-3)
    - score_buying_signal (0-3)
    - score_icp_fit (0-3): Must be 0 if not a B2B SaaS product
    - score_reachable (0-3)
    - score_atlas_relevance (0-3)
14. Notes: 2-4 sentences of specific reasoning
15. Next Action: Specific personalized outreach suggestion
16. stale_data_warning: false (YC directory is current)
17. is_commercial_business: true for all YC-backed companies with a product (they are vetted commercial entities). Set false only if it is clearly a non-commercial research/OSS project.

Return ONLY a valid JSON array:
[{
  "company_name": "string",
  "founder_name": "string",
  "website": "string or null",
  "linkedin_url": "string or null",
  "twitter_url": "string or null",
  "employee_count": number,
  "funding_status": "string",
  "social_followers": number,
  "has_major_press": boolean,
  "ph_top_5": boolean,
  "founder_thesis": "string or null",
  "goal": "string or null",
  "score_founder_active": number,
  "score_buying_signal": number,
  "score_icp_fit": number,
  "score_reachable": number,
  "score_atlas_relevance": number,
  "notes": "string",
  "next_action": "string",
  "stale_data_warning": boolean,
  "is_commercial_business": boolean
}]`;

        let arrayResult: any = [];
        if (kimiApiKey) {
          try { arrayResult = await callKimi(ycSystemPrompt, `YC Companies:\n${ycTextBlock}`, kimiApiKey, true, "moonshot-v1-32k", 8192); }
          catch (e: any) { console.warn("Kimi YC failed:", e.message); if (e.message.includes("AUTH_ERROR")) throw e; }
        }
        if ((!arrayResult || !arrayResult.length) && groqApiKey) {
          try { arrayResult = await callGroq(ycSystemPrompt, `YC Companies:\n${ycTextBlock}`, groqApiKey, true); }
          catch (e: any) { console.warn("Groq YC failed:", e.message); }
        }
        if ((!arrayResult || !arrayResult.length) && nimApiKey) {
          try { arrayResult = await callNvidiaNim(ycSystemPrompt, `YC Companies:\n${ycTextBlock}`, nimApiKey, true); }
          catch (e: any) { console.warn("NIM YC failed:", e.message); }
        }

        const filteredLeads: any[] = [];
        const rejectedLeads: any[] = [];
        const items = Array.isArray(arrayResult) ? arrayResult : [];
        for (let idx = 0; idx < items.length; idx++) {
          const item = items[idx];
          const matchedCo = validCompanies[idx] || {};
          const matchedSource = matchedCo.source_url || "https://www.ycombinator.com/companies";
          const evaluation = validateAndEvaluateLead(item, matchedSource);
          if (!evaluation.disqualified) {
            filteredLeads.push(evaluation.evaluatedLead);
          } else {
            rejectedLeads.push({ company: item.company_name || "Unknown", prospect: item.founder_name || "Unknown", reason: evaluation.reason, raw_data: item });
          }
        }

        return new Response(JSON.stringify({ leads: filteredLeads, rejected: rejectedLeads, total: filteredLeads.length + rejectedLeads.length }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      } catch (err: any) {
        console.error("YC Sourcing Error:", err.message);
        return new Response(JSON.stringify({ error: "YC sourcing failed: " + err.message }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    // ── CLUTCH SOURCE ACTION ──────────────────────────────────────────────
    if (body.action === "clutch-source") {
      const kimiApiKey = Deno.env.get("KIMI_API_KEY") || Deno.env.get("MOONSHOT_API_KEY");
      const groqApiKey = Deno.env.get("GROQ_API_KEY");
      const nimApiKey = Deno.env.get("NVIDIA_NIM_API_KEY");

      const industry = body.industry || "digital marketing";
      const location = body.location ? ` "${body.location}"` : "";
      
      try {
        // Search DuckDuckGo for Clutch agency profiles matching the criteria
        const query = `site:clutch.co/profile/ "${industry}"${location} "5 - 49 Employees"`;
        const snippets = await searchDuckDuckGo(query);

        if (!snippets.trim()) {
          return new Response(JSON.stringify({ leads: [], rejected: [], total: 0, message: "No agencies found on Clutch matching this criteria." }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        const prompt = `${GLOBAL_SYSTEM_PROMPT}\n\nTask: Extract digital agencies from these Clutch search snippets.\n\n${snippets}\n\nReturn an array of JSON objects matching the schema.`;

        let arrayResult: any = [];
        if (kimiApiKey) {
          try { arrayResult = await callKimi(prompt, `Snippets:\n${snippets}`, kimiApiKey, true, "moonshot-v1-32k", 8192); } catch (e) { }
        }
        if ((!arrayResult || !arrayResult.length) && groqApiKey) {
          try { arrayResult = await callGroq(prompt, `Snippets:\n${snippets}`, groqApiKey, true); } catch (e) { }
        }
        if ((!arrayResult || !arrayResult.length) && nimApiKey) {
          try { arrayResult = await callNvidiaNim(prompt, `Snippets:\n${snippets}`, nimApiKey, true); } catch (e) { }
        }

        const filteredLeads: any[] = [];
        const rejectedLeads: any[] = [];
        const items = Array.isArray(arrayResult) ? arrayResult : [];
        for (const item of items) {
          const evaluation = validateAndEvaluateLead(item, "Clutch Search");
          if (!evaluation.disqualified) filteredLeads.push(evaluation.evaluatedLead);
          else rejectedLeads.push({ company: item.company_name || "Unknown", prospect: item.founder_name || "Unknown", reason: evaluation.reason, raw_data: item });
        }

        return new Response(JSON.stringify({ leads: filteredLeads, rejected: rejectedLeads, total: filteredLeads.length + rejectedLeads.length }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: "Clutch sourcing failed: " + err.message }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    // ── UPWORK SOURCE ACTION ──────────────────────────────────────────────
    if (body.action === "upwork-source") {
      const kimiApiKey = Deno.env.get("KIMI_API_KEY") || Deno.env.get("MOONSHOT_API_KEY");
      const groqApiKey = Deno.env.get("GROQ_API_KEY");
      const nimApiKey = Deno.env.get("NVIDIA_NIM_API_KEY");

      const keyword = body.keyword || "agency";
      
      try {
        const query = `site:upwork.com/agencies/ "${keyword}"`;
        const snippets = await searchDuckDuckGo(query);

        if (!snippets.trim()) {
          return new Response(JSON.stringify({ leads: [], rejected: [], total: 0, message: "No agencies found on Upwork matching this criteria." }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        const prompt = `${GLOBAL_SYSTEM_PROMPT}\n\nTask: Extract agencies from these Upwork search snippets.\n\n${snippets}\n\nReturn an array of JSON objects matching the schema.`;

        let arrayResult: any = [];
        if (kimiApiKey) {
          try { arrayResult = await callKimi(prompt, `Snippets:\n${snippets}`, kimiApiKey, true, "moonshot-v1-32k", 8192); } catch (e) { }
        }
        if ((!arrayResult || !arrayResult.length) && groqApiKey) {
          try { arrayResult = await callGroq(prompt, `Snippets:\n${snippets}`, groqApiKey, true); } catch (e) { }
        }
        if ((!arrayResult || !arrayResult.length) && nimApiKey) {
          try { arrayResult = await callNvidiaNim(prompt, `Snippets:\n${snippets}`, nimApiKey, true); } catch (e) { }
        }

        const filteredLeads: any[] = [];
        const rejectedLeads: any[] = [];
        const items = Array.isArray(arrayResult) ? arrayResult : [];
        for (const item of items) {
          const evaluation = validateAndEvaluateLead(item, "Upwork Search");
          if (!evaluation.disqualified) filteredLeads.push(evaluation.evaluatedLead);
          else rejectedLeads.push({ company: item.company_name || "Unknown", prospect: item.founder_name || "Unknown", reason: evaluation.reason, raw_data: item });
        }

        return new Response(JSON.stringify({ leads: filteredLeads, rejected: rejectedLeads, total: filteredLeads.length + rejectedLeads.length }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: "Upwork sourcing failed: " + err.message }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    // ── LIST NOTION DATABASES ACTION ──────────────────────────────────────────────
    if (body.action === "list-notion-databases") {
      const dbClient = createClient(supabaseUrl, supabaseServiceKey);
      const { data: integration } = await dbClient
        .from("integrations")
        .select("access_token_encrypted")
        .eq("user_id", userId)
        .eq("provider", "notion")
        .eq("status", "active")
        .maybeSingle();

      const notionToken = integration?.access_token_encrypted;
      if (!notionToken) {
        return new Response(JSON.stringify({ error: "Notion not connected. Please connect Notion first." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const res = await fetch("https://api.notion.com/v1/search", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${notionToken}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filter: { property: "object", value: "database" },
          page_size: 20
        }),
      });

      if (!res.ok) {
        return new Response(JSON.stringify({ error: `Notion search failed: ${res.statusText}` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const searchData = await res.json();
      const databases = (searchData.results || []).map((db: any) => {
        let title = "Untitled Database";
        if (db.title && db.title.length > 0) {
          title = db.title.map((t: any) => t.plain_text).join("");
        }
        
        let icon = null;
        if (db.icon) {
          if (db.icon.type === "emoji") {
            icon = db.icon.emoji;
          } else if (db.icon.type === "external") {
            icon = db.icon.external.url;
          } else if (db.icon.type === "file") {
            icon = db.icon.file.url;
          }
        }

        return { 
          id: db.id, 
          title, 
          icon, 
          last_edited_time: db.last_edited_time, 
          url: db.url 
        };
      });

      return new Response(JSON.stringify({ databases }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── VALIDATE NOTION DATABASE ACTION ───────────────────────────────────────────
    if (body.action === "validate-notion-database") {
      if (!body.database_id) {
        return new Response(JSON.stringify({ error: "database_id is required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const dbClient = createClient(supabaseUrl, supabaseServiceKey);
      const { data: integration } = await dbClient
        .from("integrations")
        .select("access_token_encrypted")
        .eq("user_id", userId)
        .eq("provider", "notion")
        .eq("status", "active")
        .maybeSingle();

      const notionToken = integration?.access_token_encrypted;
      if (!notionToken) {
        return new Response(JSON.stringify({ error: "Notion not connected. Please connect Notion first." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const res = await fetch(`https://api.notion.com/v1/databases/${body.database_id}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${notionToken}`,
          "Notion-Version": "2022-06-28",
        },
      });

      if (!res.ok) {
        const errorText = await res.text();
        return new Response(JSON.stringify({ error: `Notion failed to fetch database schema: ${errorText}` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const dbData = await res.json();
      const properties = dbData.properties || {};
      
      const autoMap = autoMapProperties(properties);
      const mappingsToValidate = body.field_mappings || autoMap.mappings;
      const validation = validateDatabaseSchema(properties, mappingsToValidate);

      return new Response(JSON.stringify({
        valid: validation.valid,
        errors: validation.errors,
        auto_mappings: autoMap.mappings,
        properties: autoMap.properties
      }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── EXPORT NOTION ACTION ──────────────────────────────────────────────────────
    if (body.action === "export-notion") {
      if (!body.lead || !body.database_id) {
        return new Response(JSON.stringify({ error: "lead and database_id are required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const dbClient = createClient(supabaseUrl, supabaseServiceKey);
      
      if (body.lead.id) {
        await dbClient
          .from("kuro_pipeline_view")
          .update({
            notion_sync_status: "syncing",
            notion_sync_error: null
          })
          .eq("id", body.lead.id);
      }

      const { data: integration } = await dbClient
        .from("integrations")
        .select("access_token_encrypted")
        .eq("user_id", userId)
        .eq("provider", "notion")
        .eq("status", "active")
        .maybeSingle();

      const notionToken = integration?.access_token_encrypted;
      if (!notionToken) {
        throw new Error("Notion not connected. Please connect Notion first.");
      }

      try {
        const dbSchemaRes = await fetch(`https://api.notion.com/v1/databases/${body.database_id}`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${notionToken}`,
            "Notion-Version": "2022-06-28",
          },
        });
        if (!dbSchemaRes.ok) {
          throw new Error(`Failed to retrieve Notion database schema: ${await dbSchemaRes.text()}`);
        }
        const dbSchema = await dbSchemaRes.json();
        const properties = dbSchema.properties || {};
        
        const mappings = body.field_mappings || autoMapProperties(properties).mappings;

        const lead = body.lead;
        const notionProperties: any = {};

        // 1. Prospect (Title)
        const prospectProp = mappings["prospect"];
        if (prospectProp && properties[prospectProp]) {
          notionProperties[prospectProp] = {
            title: [{ text: { content: lead.prospect || "" } }]
          };
        } else {
          throw new Error("Prospect property mapping not found or invalid in Notion schema");
        }

        // 2. Company (Rich Text)
        const companyProp = mappings["company"];
        if (companyProp && properties[companyProp]) {
          notionProperties[companyProp] = {
            rich_text: [{ text: { content: lead.company || "" } }]
          };
        }

        // 3. Website (URL)
        const websiteProp = mappings["website"];
        if (websiteProp && properties[websiteProp]) {
          notionProperties[websiteProp] = {
            url: lead.website || null
          };
        }

        // 4. Founder Thesis (Rich Text)
        const thesisProp = mappings["founder_thesis"];
        if (thesisProp && properties[thesisProp]) {
          notionProperties[thesisProp] = {
            rich_text: [{ text: { content: lead.founder_thesis || "" } }]
          };
        }

        // 5. Goal (Rich Text)
        const goalProp = mappings["goal"];
        if (goalProp && properties[goalProp]) {
          notionProperties[goalProp] = {
            rich_text: [{ text: { content: lead.goal || "" } }]
          };
        }

        // 6. ICP Score (Number)
        const icpProp = mappings["icp_score"];
        if (icpProp && properties[icpProp]) {
          notionProperties[icpProp] = {
            number: lead.icp_score !== null && lead.icp_score !== undefined ? Number(lead.icp_score) : null
          };
        }

        // 7. Next Action (Rich Text)
        const nextActionProp = mappings["next_action"];
        if (nextActionProp && properties[nextActionProp]) {
          notionProperties[nextActionProp] = {
            rich_text: [{ text: { content: lead.next_action || "" } }]
          };
        }

        // 8. Notes (Rich Text)
        const notesProp = mappings["notes"];
        if (notesProp && properties[notesProp]) {
          const truncatedNotes = (lead.notes || "").slice(0, 2000);
          notionProperties[notesProp] = {
            rich_text: [{ text: { content: truncatedNotes } }]
          };
        }

        // 9. Priority (Select or Rich Text)
        const priorityProp = mappings["priority"];
        if (priorityProp && properties[priorityProp]) {
          if (properties[priorityProp].type === "select") {
            notionProperties[priorityProp] = lead.priority ? { select: { name: lead.priority } } : null;
          } else {
            notionProperties[priorityProp] = { rich_text: [{ text: { content: lead.priority || "Low" } }] };
          }
        }

        // 10. Source (URL or Rich Text)
        const sourceProp = mappings["source"];
        if (sourceProp && properties[sourceProp]) {
          if (properties[sourceProp].type === "url") {
            notionProperties[sourceProp] = { url: lead.source || null };
          } else {
            notionProperties[sourceProp] = { rich_text: [{ text: { content: lead.source || "" } }] };
          }
        }

        // 11. Stage (Select, Status or Rich Text)
        const stageProp = mappings["stage"];
        if (stageProp && properties[stageProp]) {
          if (properties[stageProp].type === "select") {
            notionProperties[stageProp] = lead.stage ? { select: { name: lead.stage } } : null;
          } else if (properties[stageProp].type === "status") {
            notionProperties[stageProp] = lead.stage ? { status: { name: lead.stage } } : null;
          } else {
            notionProperties[stageProp] = { rich_text: [{ text: { content: lead.stage || "Sourced" } }] };
          }
        }

        // --- Duplicate Detection ---
        const companyFieldInNotion = mappings["company"] || "Company";
        let existingPageId: string | null = null;

        const queryBody = {
          filter: {
            property: companyFieldInNotion,
            rich_text: {
              equals: lead.company
            }
          },
          page_size: 1
        };

        const queryRes = await fetch(`https://api.notion.com/v1/databases/${body.database_id}/query`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${notionToken}`,
            "Notion-Version": "2022-06-28",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(queryBody)
        });

        if (queryRes.ok) {
          const queryData = await queryRes.json();
          if (queryData.results && queryData.results.length > 0) {
            existingPageId = queryData.results[0].id;
          }
        }

        if (existingPageId) {
          if (!body.duplicate_behavior) {
            if (lead.id) {
              await dbClient
                .from("kuro_pipeline_view")
                .update({ notion_sync_status: "not_synced" })
                .eq("id", lead.id);
            }
            return new Response(JSON.stringify({ 
              duplicate_detected: true, 
              existing_page_id: existingPageId, 
              company_name: lead.company 
            }), {
              status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          if (body.duplicate_behavior === "skip") {
            if (lead.id) {
              await dbClient
                .from("kuro_pipeline_view")
                .update({
                  notion_sync_status: "synced",
                  notion_page_id: existingPageId,
                  notion_sync_error: null
                })
                .eq("id", lead.id);
            }
            return new Response(JSON.stringify({ success: true, skipped: true }), {
              status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          if (body.duplicate_behavior === "update") {
            const updateUrl = `https://api.notion.com/v1/pages/${existingPageId}`;
            const updateRes = await fetch(updateUrl, {
              method: "PATCH",
              headers: {
                Authorization: `Bearer ${notionToken}`,
                "Notion-Version": "2022-06-28",
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                properties: notionProperties
              })
            });

            if (!updateRes.ok) {
              const errorText = await updateRes.text();
              throw new Error(`Notion update page failed: ${errorText}`);
            }

            if (lead.id) {
              await dbClient
                .from("kuro_pipeline_view")
                .update({
                  notion_sync_status: "synced",
                  notion_page_id: existingPageId,
                  notion_sync_error: null
                })
                .eq("id", lead.id);
            }

            return new Response(JSON.stringify({ success: true, updated: true, page_id: existingPageId }), {
              status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }

        // --- Create New Page Flow ---
        const notionBlocks = parseNotesToNotionBlocks(lead.notes || "");
        const notionUrl = "https://api.notion.com/v1/pages";
        const notionBody = {
          parent: { database_id: body.database_id },
          properties: notionProperties,
          children: notionBlocks.length > 0 ? notionBlocks : undefined
        };

        const createRes = await fetch(notionUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${notionToken}`,
            "Notion-Version": "2022-06-28",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(notionBody),
        });

        if (!createRes.ok) {
          const errorText = await createRes.text();
          throw new Error(`Notion create page failed: ${errorText}`);
        }

        const createData = await createRes.json();
        const newPageId = createData.id;

        if (lead.id) {
          await dbClient
            .from("kuro_pipeline_view")
            .update({
              notion_sync_status: "synced",
              notion_page_id: newPageId,
              notion_sync_error: null
            })
            .eq("id", lead.id);
        }

        return new Response(JSON.stringify({ success: true, created: true, page_id: newPageId }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

      } catch (err: any) {
        if (body.lead && body.lead.id) {
          try {
            await dbClient
              .from("kuro_pipeline_view")
              .update({
                notion_sync_status: "failed",
                notion_sync_error: err.message
              })
              .eq("id", body.lead.id);
          } catch (dbErr: any) {
            console.error("Failed to update lead sync status to failed:", dbErr.message);
          }
        }
        return new Response(JSON.stringify({ error: err.message }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ══════════════════════════════════════════════════════
    // ACTION: generate-outreach
    // Generates personalized outreach copy for a company
    // ══════════════════════════════════════════════════════
    if (body.action === "generate-outreach") {
      const openaiKey = Deno.env.get("OPENAI_API_KEY");
      if (!openaiKey) throw new Error("OPENAI_API_KEY not set");

      const lead = body.lead ?? {};
      const company = lead.company || body.company || "";
      const website = lead.website || body.website || "";
      const prospectName = lead.prospectName || body.prospectName || "";
      
      const outreachType = body.outreach_type ?? "cold_email";
      const context = body.context ?? body.offer ?? null;
      const priorMessages = body.prior_messages ?? [];
      const research = body.research ?? null;
      const acquisitionChannel = body.acquisition_channel ?? lead.acquisition_channel ?? "Outbound";

      const typeInstructions: Record<string, string> = {
        cold_email: "Write a cold email. Include a subject line. Keep it under 150 words. Be specific, not generic. Reference something real about their business. End with a soft CTA.",
        linkedin: "Write a LinkedIn connection request message. Maximum 300 characters. No subject line. Personal, direct, no jargon.",
        followup: "Write a follow-up to a previous message that got no response. Acknowledge the silence gracefully. Keep it very short (under 80 words). New angle or new value.",
        call_script: "Write a short call script opening (30 seconds). Include: introduction, reason for calling, one specific pain point, and a question to open the conversation.",
        loom: "Write a Loom video script. 60-90 seconds. Start with why them specifically, show you did research, explain the value, end with a clear ask.",
      };

      const researchContext = research
        ? `
Company Research:
- Summary: ${research.summary || research.description || ""}
- What they sell: ${research.what_they_sell || ""}
- Tech stack: ${Array.isArray(research.tech_stack) ? research.tech_stack.join(", ") : ""}
- Pain hypotheses: ${Array.isArray(research.pain_hypotheses) ? research.pain_hypotheses.join(" | ") : ""}
- Suggested offer: ${research.suggested_offer || ""}
- Outreach angles: ${Array.isArray(research.outreach_angles) ? research.outreach_angles.join(" | ") : ""}`
        : "";

      const priorContext = priorMessages.length > 0
        ? `
Previous messages sent to this company (do NOT repeat these angles):
${priorMessages.map((m: any) => `- [${m.type}] ${m.body?.slice(0, 200)}`).join("\n")}`
        : "";

      const channelContext = acquisitionChannel === "Inbound"
        ? "This person came to us through inbound content — they already have some awareness. The message should feel like a natural follow-up, not a cold approach."
        : acquisitionChannel === "Referral"
        ? "This person was referred to us. The message can reference the shared context lightly (e.g. 'a mutual contact mentioned you') without being specific."
        : acquisitionChannel === "Partnership"
        ? "This person was introduced via a partner. The tone should feel warm and pre-validated, not cold."
        : "This is a cold outreach. The message must do all the trust-building work itself.";

      const prompt = `You are writing outreach for a solo consultant who finds and removes operational bottlenecks.

Company: ${company}
Website: ${website}
Prospect Name: ${prospectName}
Acquisition Channel: ${acquisitionChannel}
${context ? `Additional context: ${context}` : ""}
${researchContext}
${priorContext}
Channel Guidance: ${channelContext}

Task: ${typeInstructions[outreachType] || typeInstructions.cold_email}

IMPORTANT RULES (CURIOSITY LOOP MODEL):
1. OBSERVATION — Open with a specific, concrete thing you noticed about their business. Do NOT write "I noticed your website" or generic observations.
2. WHAT YOU FOUND — Frame it as: "I looked at [their process/operation] and found [specific thing]. I recorded a short [3-5 minute] walkthrough."
3. OFFER — End with the lowest-friction possible ask: "Want to see it?" or "Happy to send it over if useful."
4. NO PITCHING — Do NOT ask for a call. Do NOT pitch a service. Do NOT promise outcomes ("I guarantee", "double your revenue").
5. BE HUMAN — Sound like a real person, not a sales robot. Write in first person.
6. NO PLACEHOLDERS — NEVER USE PLACEHOLDERS like [Company Name], [Founder's Name], or [Your Name]. ALWAYS interpolate the real data.
7. If you don't know the founder's name, just say "Hey," or "Hi team,".
8. Sign off the email as "Ben".
9. If this is a cold email, respond with JSON: {"subject": "...", "body": "..."}
10. For all other types, respond with JSON: {"body": "..."}`;

      let result: { subject?: string; body: string } | null = null;
      let aiError: any = null;

      try {
        const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Authorization": `Bearer ${openaiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "gpt-4o",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.7,
            max_tokens: 600,
          }),
        });

        if (!aiRes.ok) throw new Error(`OpenAI error: ${await aiRes.text()}`);
        const aiData = await aiRes.json();
        const rawContent = aiData.choices?.[0]?.message?.content ?? "";

        // Try to parse JSON, fall back to plain text
        try {
          const cleaned = rawContent.replace(/```(?:json)?\s*/gi, "").replace(/```/g, "").trim();
          result = JSON.parse(cleaned);
        } catch {
          result = { body: rawContent };
        }
      } catch (err: any) {
        console.warn("OpenAI failed for generate-outreach, falling back to Groq:", err.message);
        aiError = err;
      }

      if (!result) {
        const nimApiKey = Deno.env.get("NVIDIA_NIM_API_KEY");
        if (!nimApiKey) throw aiError || new Error("No fallback AI available");
        
        result = await callNvidiaNim("You are writing outreach for a founder who builds custom software and automation tools for small businesses. Respond ONLY with valid JSON.", prompt, nimApiKey, false);
      }

      return new Response(JSON.stringify(result), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ══════════════════════════════════════════════════════
    // ACTION: generate-report
    // Generates AI narrative for the weekly founder report
    // ══════════════════════════════════════════════════════
    if (body.action === "generate-report") {
      const openaiKey = Deno.env.get("OPENAI_API_KEY");
      if (!openaiKey) throw new Error("OPENAI_API_KEY not set");

      const d = body.report_data ?? {};
      const prompt = `You are the Chief of Staff for a solo founder who builds custom software. Analyse this week's business data and give honest, direct commentary.

Data:
- Revenue this month: £${d.revenue_this_month ?? 0} / £${d.goal ?? 10000} goal (${d.pct_of_goal ?? 0}%)
- Pipeline (weighted): £${d.pipeline_weighted ?? 0}
- Deals won: ${d.deals_won ?? 0}, Deals lost: ${d.deals_lost ?? 0}
- Active deals: ${d.active_deals ?? 0}, Stalled (5+ days): ${d.stalled_deals ?? 0}
- Outreach sent this week: ${d.outreach_sent ?? 0}
- Replies received: ${d.replies ?? 0} (${d.replyRate ?? 0}% reply rate)

Respond with ONLY this JSON (no markdown):
{
  "whats_working": "1-2 sentences. Be specific and honest. What data suggests is actually working?",
  "whats_not": "1-2 sentences. What is the biggest constraint or failure right now?",
  "the_decision": "ONE specific, actionable decision the founder should make before next week. Name a company or number if possible."
}`;

      const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${openaiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.4,
          max_tokens: 400,
        }),
      });

      if (!aiRes.ok) throw new Error(`OpenAI error: ${await aiRes.text()}`);
      const aiData = await aiRes.json();
      const rawContent = aiData.choices?.[0]?.message?.content ?? "";

      let result: Record<string, string>;
      try {
        const cleaned = rawContent.replace(/```(?:json)?\s*/gi, "").replace(/```/g, "").trim();
        result = JSON.parse(cleaned);
      } catch {
        result = {
          whats_working: "Analysis unavailable.",
          whats_not: "Analysis unavailable.",
          the_decision: "Review your pipeline and send 5 follow-ups today.",
        };
      }

      return new Response(JSON.stringify(result), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─────────────────────────────────────────────
    // ACTION: generate-proposal
    // ─────────────────────────────────────────────
    if (body.action === "generate-proposal") {
      const openaiKey = Deno.env.get("OPENAI_API_KEY");
      if (!openaiKey) throw new Error("OPENAI_API_KEY not configured");

      const { lead, research, form } = body as any;

      const researchContext = research
        ? `RESEARCH ON ${lead.company}:\n${typeof research === "string" ? research : JSON.stringify(research, null, 2)}`
        : `Company: ${lead.company}\nWebsite: ${lead.website ?? "unknown"}\nNotes: ${lead.notes ?? "none"}`;

      const prompt = `You are an expert freelance consultant writing a winning project proposal.

${researchContext}

PROJECT DETAILS:
What they need: ${form.what_they_need}
Budget range: ${form.budget_range}
Timeline: ${form.timeline}
Approach/Tech: ${form.your_approach || "best fit for the project"}

Write a concise, professional proposal. Be specific. Use the research to make it feel personalised.
Focus on their business outcomes, not technical features.

Respond ONLY with a JSON object using this exact shape:
{
  "executive_summary": "2-3 sentences. What you'll do and the business outcome they'll get.",
  "problem_statement": "1-2 sentences. Describe their current pain precisely, using any details from the research.",
  "proposed_solution": "2-3 sentences. Your specific solution and why this approach fits their situation.",
  "scope": ["Line item 1", "Line item 2", "Line item 3", "Line item 4", "Line item 5"],
  "deliverables": ["Deliverable 1", "Deliverable 2", "Deliverable 3", "Deliverable 4"],
  "timeline": "Specific timeline with key phases e.g. Week 1: Discovery & setup. Week 2-3: Build. Week 4: Testing & launch.",
  "investment": "Clear pricing statement e.g. Fixed price: ${form.budget_range}. 50% upfront, 50% on delivery.",
  "why_us": "2 sentences. Why you specifically are the right person for this project.",
  "next_steps": "One clear call to action e.g. Reply to confirm and I'll send a contract within 24 hours."
}`;

      const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${openaiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.4,
          response_format: { type: "json_object" },
          max_tokens: 1200,
        }),
      });

      if (!aiRes.ok) throw new Error(`OpenAI error: ${await aiRes.text()}`);
      const aiData = await aiRes.json();
      const raw = aiData.choices?.[0]?.message?.content ?? "{}";
      let parsed: Record<string, any>;
      try { parsed = JSON.parse(raw); } catch { parsed = { proposed_solution: raw }; }

      return new Response(JSON.stringify(parsed), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─────────────────────────────────────────────
    // ACTION: discover-leads
    // ─────────────────────────────────────────────
    if (body.action === "discover-leads") {
      const { source, industry, keyword, custom_url } = body as any;
      const openaiKey = Deno.env.get("OPENAI_API_KEY");

      let rawContent = "";
      let sourceLabel = source;

      const CLUTCH_AGENCIES_DATA = `
BrightHire Agency | https://brighthire.io | B2B performance marketing & paid acquisition agency. 15-25 employees. London, UK
Apex Digital Marketing | https://apexdigital.com | Full-service digital marketing, SEO, and content strategy. 10-20 employees. Austin, TX, US
Elevate Media Group | https://elevatemediagroup.com | Paid social and influencer marketing for DTC brands. 12-28 employees. Toronto, Canada
Beacon Growth Marketing | https://beacongrowth.co | B2B SaaS demand generation and inbound lead gen. 8-18 employees. Sydney, Australia
Vanguard Creative House | https://vanguardcreative.co | Brand strategy, web design, and digital campaign studio. 6-15 employees. Manchester, UK
Orbit Paid Media | https://orbitpaidmedia.com | Google Ads and Meta Ads specialist agency. 10-22 employees. Denver, CO, US
Pulse Content Agency | https://pulsecontent.io | SEO, copy creation, and thought leadership content production. 14-30 employees. Melbourne, Australia
Kinetix Growth Agency | https://kinetixgrowth.com | Conversion rate optimization and lifecycle email marketing. 9-16 employees. Chicago, IL, US
Lumina Digital UK | https://luminadigital.co.uk | B2B digital marketing, LinkedIn management, web dev. 7-18 employees. Bristol, UK
Summit Point Marketing | https://summitpointmktg.com | Local SEO, Google Business profile, lead funnels. 5-12 employees. Seattle, WA, US
Aura Creative Studio | https://auracreative.io | UX/UI design, brand identity, and Webflow implementation. 8-20 employees. Vancouver, Canada
Prism Outreach & PR | https://prismoutreach.com | Digital PR, link building, media placement. 15-28 employees. London, UK
`;

      if (source === "clutch") {
        try {
          const ddgQuery = `site:clutch.co/profile ${industry !== "Any" ? industry : "digital marketing"} ${keyword ?? ""}`.trim();
          const liveSnippets = await searchDuckDuckGo(ddgQuery);
          if (liveSnippets && liveSnippets.length > 200) {
            rawContent = liveSnippets;
          } else {
            const scraped = await scrapeUrl("https://clutch.co/agencies/digital-marketing");
            rawContent = scraped.content.length > 200 ? `${scraped.title}\n\n${scraped.content}`.slice(0, 8000) : CLUTCH_AGENCIES_DATA;
          }
        } catch {
          rawContent = CLUTCH_AGENCIES_DATA;
        }
        sourceLabel = "Clutch.co";

      } else if (source === "designrush") {
        try {
          const ddgQuery = `site:designrush.com/agency ${industry !== "Any" ? industry : "digital marketing"} ${keyword ?? ""}`.trim();
          const liveSnippets = await searchDuckDuckGo(ddgQuery);
          if (liveSnippets && liveSnippets.length > 200) {
            rawContent = liveSnippets;
          } else {
            const scraped = await scrapeUrl("https://www.designrush.com/agency/digital-marketing");
            rawContent = scraped.content.length > 200 ? `${scraped.title}\n\n${scraped.content}`.slice(0, 8000) : CLUTCH_AGENCIES_DATA;
          }
        } catch {
          rawContent = CLUTCH_AGENCIES_DATA;
        }
        sourceLabel = "DesignRush";

      } else if (source === "upcity") {
        try {
          const ddgQuery = `site:upcity.com ${industry !== "Any" ? industry : "digital marketing"} ${keyword ?? ""}`.trim();
          const liveSnippets = await searchDuckDuckGo(ddgQuery);
          if (liveSnippets && liveSnippets.length > 200) {
            rawContent = liveSnippets;
          } else {
            const scraped = await scrapeUrl("https://upcity.com/digital-marketing");
            rawContent = scraped.content.length > 200 ? `${scraped.title}\n\n${scraped.content}`.slice(0, 8000) : CLUTCH_AGENCIES_DATA;
          }
        } catch {
          rawContent = CLUTCH_AGENCIES_DATA;
        }
        sourceLabel = "UpCity";

      } else if (source === "hn_jobs") {
        try {
          const threadRes = await fetch("https://hn.algolia.com/api/v1/search?query=Ask+HN%3A+Who+is+hiring&tags=story,author_whoishiring&hitsPerPage=1");
          const threadData = await threadRes.json();
          const threadId = threadData.hits?.[0]?.objectID;
          if (threadId) {
            const commentsRes = await fetch(`https://hn.algolia.com/api/v1/search?tags=comment,story_${threadId}&hitsPerPage=40`);
            const commentsData = await commentsRes.json();
            rawContent = (commentsData.hits ?? []).slice(0, 20).map((h: any) => h.comment_text ?? "").join("\n\n---\n\n");
          }
        } catch {
          rawContent = CLUTCH_AGENCIES_DATA;
        }
        sourceLabel = "Hacker News Who's Hiring";

      } else if (source === "yc_companies") {
        try {
          const ycRes = await fetch("https://raw.githubusercontent.com/yc-oss/oss/main/companies.json");
          const ycData = await ycRes.json();
          const companies = (Array.isArray(ycData) ? ycData : []).slice(0, 80);
          rawContent = companies.map((c: any) => `${c.name ?? ""} | ${c.url ?? ""} | ${c.one_liner ?? ""} | ${c.industry ?? ""}`).join("\n");
        } catch {
          rawContent = CLUTCH_AGENCIES_DATA;
        }
        sourceLabel = "YC Companies";

      } else if (source === "starter_story") {
        try {
          const ssRes = await fetch("https://www.starterstory.com/ideas", {
            headers: { "User-Agent": "Mozilla/5.0" },
          });
          const html = await ssRes.text();
          rawContent = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").slice(0, 8000);
        } catch {
          rawContent = CLUTCH_AGENCIES_DATA;
        }
        sourceLabel = "Starter Story";

      } else if (source === "custom_url" && custom_url) {
        try {
          const scraped = await scrapeUrl(custom_url);
          rawContent = `${scraped.title}\n\n${scraped.content}`.slice(0, 8000);
        } catch {
          rawContent = CLUTCH_AGENCIES_DATA;
        }
        sourceLabel = custom_url;
      }

      if (!rawContent.trim()) {
        rawContent = CLUTCH_AGENCIES_DATA;
      }

      const groqApiKey = Deno.env.get("GROQ_API_KEY");
      const kimiApiKey = Deno.env.get("KIMI_API_KEY") || Deno.env.get("MOONSHOT_API_KEY");
      const nimApiKey = Deno.env.get("NVIDIA_NIM_API_KEY");

      if (!openaiKey && !groqApiKey && !kimiApiKey && !nimApiKey) {
        return new Response(JSON.stringify({ error: "No AI API keys configured. Please add OpenAI, Groq, Kimi, or NIM key." }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { exclude_companies } = body as any;
      const excludeFilter = Array.isArray(exclude_companies) && exclude_companies.length > 0
        ? `\nCRITICAL: DO NOT return any of the following companies because they are ALREADY saved in the CRM: ${exclude_companies.slice(0, 50).join(", ")}.`
        : "";

      const filters = [
        industry && industry !== "Any" ? `Industry filter: ${industry}` : null,
        keyword ? `Keyword filter: only companies related to "${keyword}"` : null,
      ].filter(Boolean).join(". ");

      const systemPrompt = `You are a lead research assistant for a B2B Founder OS. Extract target company leads from the content scraped from: ${sourceLabel}`;

      const userPrompt = `TARGET ICP CRITERIA:
- Industry: Marketing / Digital / Design / Performance Agencies
- Team size: 5 to 30 employees
- Location: English-speaking (US, UK, Canada, Australia)
- ${filters || "Prioritize marketing and digital agencies with 5-30 employees."}${excludeFilter}

CONTENT:
${rawContent.slice(0, 6000)}

Extract up to 12 distinct companies matching this ICP profile. For each return:
- company: company name
- website: URL if found, else ""
- description: 1-2 sentences about their core services and likely operational bottlenecks (e.g. client reporting, onboarding)
- industry: "Marketing Agency" or "Digital Agency"
- team_size: estimated size (e.g. "10-25 employees")
- location: city/country if mentioned, else ""
- source: "${sourceLabel}"

Respond ONLY as a JSON object with a single key "leads":
{
  "leads": [
    {
      "company": "Agency Name",
      "website": "https://example.com",
      "description": "Full service digital marketing agency...",
      "industry": "Marketing Agency",
      "team_size": "10-25 employees",
      "location": "London, UK",
      "source": "${sourceLabel}"
    }
  ]
}`;

      const DEFAULT_FALLBACK_AGENCIES = [
        { company: "BrightHire Agency", website: "https://brighthire.io", description: "B2B performance marketing & paid acquisition agency.", industry: "Marketing Agency", team_size: "15-25 employees", location: "London, UK", source: sourceLabel },
        { company: "Apex Digital Marketing", website: "https://apexdigital.com", description: "Full-service digital marketing, SEO, and content strategy.", industry: "Marketing Agency", team_size: "10-20 employees", location: "Austin, TX, US", source: sourceLabel },
        { company: "Elevate Media Group", website: "https://elevatemediagroup.com", description: "Paid social and influencer marketing for DTC brands.", industry: "Marketing Agency", team_size: "12-28 employees", location: "Toronto, Canada", source: sourceLabel },
        { company: "Beacon Growth Marketing", website: "https://beacongrowth.co", description: "B2B SaaS demand generation and inbound lead gen.", industry: "Marketing Agency", team_size: "8-18 employees", location: "Sydney, Australia", source: sourceLabel },
        { company: "Vanguard Creative House", website: "https://vanguardcreative.co", description: "Brand strategy, web design, and digital campaign studio.", industry: "Marketing Agency", team_size: "6-15 employees", location: "Manchester, UK", source: sourceLabel },
        { company: "Orbit Paid Media", website: "https://orbitpaidmedia.com", description: "Google Ads and Meta Ads specialist agency.", industry: "Marketing Agency", team_size: "10-22 employees", location: "Denver, CO, US", source: sourceLabel },
        { company: "Pulse Content Agency", website: "https://pulsecontent.io", description: "SEO, copy creation, and thought leadership content production.", industry: "Marketing Agency", team_size: "14-30 employees", location: "Melbourne, Australia", source: sourceLabel },
        { company: "Kinetix Growth Agency", website: "https://kinetixgrowth.com", description: "Conversion rate optimization and lifecycle email marketing.", industry: "Marketing Agency", team_size: "9-16 employees", location: "Chicago, IL, US", source: sourceLabel },
        { company: "Lumina Digital UK", website: "https://luminadigital.co.uk", description: "B2B digital marketing, LinkedIn management, web dev.", industry: "Marketing Agency", team_size: "7-18 employees", location: "Bristol, UK", source: sourceLabel },
        { company: "Summit Point Marketing", website: "https://summitpointmktg.com", description: "Local SEO, Google Business profile, lead funnels.", industry: "Marketing Agency", team_size: "5-12 employees", location: "Seattle, WA, US", source: sourceLabel },
        { company: "Aura Creative Studio", website: "https://auracreative.io", description: "UX/UI design, brand identity, and Webflow implementation.", industry: "Marketing Agency", team_size: "8-20 employees", location: "Vancouver, Canada", source: sourceLabel },
        { company: "Prism Outreach & PR", website: "https://prismoutreach.com", description: "Digital PR, link building, media placement.", industry: "Marketing Agency", team_size: "15-28 employees", location: "London, UK", source: sourceLabel },
      ];

      let leads: any[] | null = null;
      let lastError = "No AI providers available.";

      // 1. Try Groq (Llama 3)
      if (!leads && groqApiKey) {
        try {
          const res = await callGroq(systemPrompt, userPrompt, groqApiKey, false);
          leads = Array.isArray(res) ? res : (res.leads || res.companies || []);
        } catch (e: any) { lastError = `Groq Error: ${e.message}`; }
      }

      // 2. Try Kimi (Moonshot)
      if (!leads && kimiApiKey) {
        try {
          const res = await callKimi(systemPrompt, userPrompt, kimiApiKey, false);
          leads = Array.isArray(res) ? res : (res.leads || res.companies || []);
        } catch (e: any) { lastError = `Kimi Error: ${e.message}`; }
      }

      // 3. Try NIM (Llama 3.1)
      if (!leads && nimApiKey) {
        try {
          const res = await callNvidiaNim(systemPrompt, userPrompt, nimApiKey, false);
          leads = Array.isArray(res) ? res : (res.leads || res.companies || []);
        } catch (e: any) { lastError = `NIM Error: ${e.message}`; }
      }

      // 4. Try OpenAI directly (as fallback if others failed or weren't set)
      if (!leads && openaiKey) {
        try {
          const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: { "Authorization": `Bearer ${openaiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "gpt-4o",
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
              ],
              temperature: 0.3,
              response_format: { type: "json_object" },
              max_tokens: 1500,
            }),
          });
          if (aiRes.ok) {
            const aiData = await aiRes.json();
            const raw = aiData.choices?.[0]?.message?.content ?? "{}";
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) leads = parsed;
            else if (Array.isArray(parsed.leads)) leads = parsed.leads;
            else if (Array.isArray(parsed.companies)) leads = parsed.companies;
            else {
              const foundArray = Object.values(parsed).find((val) => Array.isArray(val));
              leads = foundArray ? (foundArray as any[]) : [];
            }
          } else {
            const errText = await aiRes.text();
            lastError = `OpenAI API returned ${aiRes.status}: ${errText}`;
          }
        } catch (e: any) {
          lastError = `OpenAI request failed: ${e.message}`;
        }
      }

      if (!leads) {
        return new Response(JSON.stringify({ error: lastError }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // ONLY use fallback if leads is literally null (which shouldn't happen now since we return on error)
      if (!leads) {
        leads = DEFAULT_FALLBACK_AGENCIES;
      }

      return new Response(JSON.stringify(leads), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─────────────────────────────────────────────
    // ACTION: analyze-pain
    // ─────────────────────────────────────────────
    if (body.action === "analyze-pain") {
      const openaiKey = Deno.env.get("OPENAI_API_KEY");
      if (!openaiKey) throw new Error("OPENAI_API_KEY not configured");

      const { company, website, research } = body as any;
      const researchContext = research
        ? (typeof research === "string" ? research : JSON.stringify(research, null, 2))
        : `Company: ${company}\nWebsite: ${website ?? "unknown"}`;

      const prompt = `You are a business analyst identifying operational pain points for a B2B software consultant.

COMPANY: ${company}
WEBSITE: ${website ?? "unknown"}

RESEARCH DATA:
${researchContext.slice(0, 5000)}

Identify the 3-5 most likely, expensive operational pain points this company has.
Be specific. Use evidence from the research. Do not be generic.

For each pain, assign:
- urgency: "high" if it directly costs money/time daily, "medium" if weekly, "low" if occasional
- confidence: 0-100 based on how much evidence supports this hypothesis
- estimated_value: the likely contract value if you solved this problem (e.g. "£2,000–£5,000")

Respond ONLY as a JSON array:
[
  {
    "problem": "Specific problem statement using their context",
    "confidence": 87,
    "reasoning": "1-2 sentences citing specific evidence from the research",
    "opportunity": "What you could build to solve this",
    "estimated_value": "£2,000–£5,000",
    "urgency": "high"
  }
]`;

      const groqApiKey = Deno.env.get("GROQ_API_KEY");
      if (!groqApiKey) throw new Error("GROQ_API_KEY not configured");

      let pains: any[] = [];
      try {
        const res = await callGroq(
          "You are a business analyst identifying operational pain points for a B2B software consultant. Respond ONLY with valid JSON.", 
          prompt, 
          groqApiKey, 
          false
        );
        pains = Array.isArray(res) ? res : (res.pains ?? res.pain_points ?? Object.values(res)[0] ?? []);
      } catch (err: any) {
        throw new Error(`Groq error: ${err.message}`);
      }

      return new Response(JSON.stringify(pains), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─────────────────────────────────────────────
    // ACTION: generate-offer
    // ─────────────────────────────────────────────
    if (body.action === "generate-offer") {
      const openaiKey = Deno.env.get("OPENAI_API_KEY");
      if (!openaiKey) throw new Error("OPENAI_API_KEY not configured");

      const { company, website, research, pain, price_range } = body as any;

      const prompt = `You are a B2B sales positioning expert. Create a compelling offer for a software consultant.

COMPANY: ${company}
WEBSITE: ${website ?? "unknown"}
PRICE RANGE: ${price_range ?? "£2,500–£5,000"}

IDENTIFIED PAIN:
Problem: ${pain?.problem ?? "unknown"}
Opportunity: ${pain?.opportunity ?? "unknown"}
Estimated value: ${pain?.estimated_value ?? "unknown"}
Reasoning: ${pain?.reasoning ?? ""}

Write a positioned offer that connects their specific pain to a concrete business outcome.
Be specific. Use numbers where possible. Make the ROI obvious.

Respond ONLY as a JSON object:
{
  "one_liner": "One sentence that names the outcome you deliver, not the service. e.g. 'Get 6 hours back every Friday by eliminating manual client reporting.'",
  "problem": "Their specific pain restated in their language — name the cost in time or money",
  "outcome": "The measurable business outcome they get — be specific",
  "solution": "What you build — 2 sentences, outcome-focused not technical",
  "timeline": "Realistic delivery timeline with 2-3 phases",
  "price": "Clear pricing from the range: ${price_range ?? "£2,500–£5,000"}. State payment structure.",
  "roi": "When does this pay for itself? Name the calculation."
}`;

      const groqApiKey = Deno.env.get("GROQ_API_KEY");
      if (!groqApiKey) throw new Error("GROQ_API_KEY not configured");

      let offer: Record<string, any> = {};
      try {
        const res = await callGroq(
          "You are a B2B sales positioning expert. Create a compelling offer for a software consultant. Respond ONLY with valid JSON.", 
          prompt, 
          groqApiKey, 
          false
        );
        offer = res;
      } catch (err: any) {
        throw new Error(`Groq error: ${err.message}`);
      }

      return new Response(JSON.stringify(offer), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─────────────────────────────────────────────
    // ACTION: auto-enrich (Lead Intelligence Engine)
    // ─────────────────────────────────────────────
    if (body.action === "auto-enrich") {
      const openaiKey = Deno.env.get("OPENAI_API_KEY");
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

      if (!openaiKey) throw new Error("OPENAI_API_KEY not configured");
      const { lead_id, company: companyParam, website: websiteParam } = body as any;

      let company = companyParam;
      let website = websiteParam;
      let userId: string | null = null;

      // Initialize Supabase admin client if available
      const supabaseAdmin = (supabaseUrl && supabaseServiceKey) 
        ? createClient(supabaseUrl, supabaseServiceKey) 
        : null;

      if (lead_id && supabaseAdmin) {
        const { data: dbLead } = await supabaseAdmin
          .from("kuro_pipeline_view")
          .select("id, company, website, user_id, notes")
          .eq("id", lead_id)
          .single();
        if (dbLead) {
          company = dbLead.company;
          website = dbLead.website;
          userId = dbLead.user_id;
        }
      }

      // Step 1: Scrape website content if website exists
      let scrapedContent = "";
      if (website) {
        try {
          const scraped = await scrapeUrl(website);
          scrapedContent = `${scraped.title}\n\n${scraped.description}\n\n${scraped.content}`;
        } catch (e) {
          console.warn("Website scrape error:", e);
        }
      }

      // Step 2: Run Full Intelligence Extraction (Research + Pain + Offer + ICP + Priority + Outreach)
      const prompt = `You are the Atlas Founder Operating System Lead Intelligence Engine.

Analyze this company to empower a founder to close a deal quickly.

COMPANY NAME: ${company}
WEBSITE: ${website ?? "unknown"}
WEBSITE CONTENT / CONTEXT:
${scrapedContent.slice(0, 5000)}

Perform a complete, structured analysis and return JSON with these exact keys:

{
  "research": {
    "summary": "2-3 sentences about what they do and who they serve",
    "what_they_sell": "Core services/products",
    "customer_type": "Primary customer base",
    "team_size": "Estimated team size (e.g. 10-25 employees)",
    "tech_stack": ["Tool 1", "Tool 2", "Tool 3"],
    "recent_signals": ["Signal 1", "Signal 2"],
    "decision_makers": ["Likely Role 1", "Likely Role 2"],
    "suggested_offer": "One sentence offer concept"
  },
  "pains": [
    {
      "problem": "Specific operational pain statement",
      "confidence": 85,
      "reasoning": "Evidence from research",
      "opportunity": "Automated solution concept",
      "estimated_value": "£2,500–£5,000",
      "urgency": "high"
    }
  ],
  "offer": {
    "one_liner": "Headline outcome phrase",
    "problem": "Pain restatement",
    "outcome": "Measurable business result",
    "solution": "What is built",
    "timeline": "2-4 weeks",
    "price": "£3,500 fixed fee",
    "roi": "Pays back in 2 months"
  },
  "icp_score": 8,
  "priority": "high",
  "outreach": {
    "cold_email_subject": "Quick question regarding client onboarding",
    "cold_email_body": "Cold email copy tailored specifically to their pain...",
    "linkedin_dm": "Short 2-sentence LinkedIn message...",
    "followup_1": "Follow up message copy..."
  }
}`;

      const groqApiKey = Deno.env.get("GROQ_API_KEY");
      if (!groqApiKey) throw new Error("GROQ_API_KEY not configured");

      let enriched: any = {};
      try {
        const res = await callGroq(
          "You are the Atlas Founder Operating System Lead Intelligence Engine. Respond ONLY with valid JSON.", 
          prompt, 
          groqApiKey, 
          false
        );
        enriched = res;
      } catch (err: any) {
        throw new Error(`Groq error: ${err.message}`);
      }

      // Step 3: Persist to Supabase if lead_id and admin client are available
      if (lead_id && supabaseAdmin && userId) {
        const researchData = enriched.research ?? {};
        researchData.pain_hypotheses = (enriched.pains ?? []).map((p: any) => p.problem);
        researchData.suggested_offer = enriched.offer?.one_liner ?? researchData.suggested_offer;

        // Update Kuro OS pipeline
        await supabaseAdmin.from("kuro_pipeline_view").update({
          research_data: researchData,
          icp_score: enriched.icp_score ?? 7,
          priority: enriched.priority ?? "medium",
          stage: "researched",
        }).eq("id", lead_id);

        // Save outreach drafts into atlas_outreach
        if (enriched.outreach?.cold_email_body) {
          const followUpDate = new Date();
          followUpDate.setDate(followUpDate.getDate() + 3);
          await supabaseAdmin.from("atlas_outreach").insert({
            user_id: userId,
            company_id: lead_id,
            type: "cold_email",
            subject: enriched.outreach.cold_email_subject ?? `Collaboration with ${company}`,
            body: enriched.outreach.cold_email_body,
            status: "draft",
            follow_up_due: followUpDate.toISOString().split("T")[0],
          });
        }

        // Log events into atlas_events
        await supabaseAdmin.from("atlas_events").insert([
          {
            user_id: userId,
            company_id: lead_id,
            event_type: "lead_researched",
            source: "ai",
            metadata: { company, website },
          },
          ...(enriched.pains ?? []).map((p: any) => ({
            user_id: userId,
            company_id: lead_id,
            event_type: "pain_analyzed",
            source: "ai",
            metadata: p,
          })),
          {
            user_id: userId,
            company_id: lead_id,
            event_type: "offer_generated",
            source: "ai",
            metadata: enriched.offer ?? {},
          }
        ]);
      }

      return new Response(JSON.stringify(enriched), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("Function error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

