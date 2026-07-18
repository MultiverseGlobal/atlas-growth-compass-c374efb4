import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SourcingRequest {
  action: "source" | "bulk-source" | "export-notion" | "list-notion-databases" | "validate-notion-database";
  url?: string;
  urls?: string[];
  raw_text?: string;
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

// Scrape helper
async function scrapeUrl(url: string): Promise<{ title: string; description: string; content: string }> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      }
    });
    
    if (!res.ok) {
      throw new Error(`Failed to fetch URL: ${res.status} ${res.statusText}`);
    }
    
    const html = await res.text();
    
    // Parse title
    const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : "";
    
    // Parse meta description
    const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i) ||
                      html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']*)["']/i);
    const description = descMatch ? descMatch[1].trim() : "";
    
    // Strip body content
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    const rawContent = bodyMatch ? bodyMatch[1] : html;
    
    const content = rawContent
      .replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, "")
      .replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, "")
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 8000);
    
    return { title, description, content };
  } catch (err: any) {
    console.error("Scraping error:", err.message);
    return { title: "", description: "", content: `Error loading content from URL: ${err.message}` };
  }
}

// Robust JSON extractor — strips markdown code fences and uses balanced-brace scanning
// to avoid the "Unexpected non-whitespace character" error caused by greedy regex.
// When expectArray=true it locates the outermost [ ... ] instead of { ... }.
function extractJson(raw: string, expectArray = false): any {
  // 1. Strip markdown code fences (```json ... ``` or ``` ... ```)
  let text = raw.replace(/```(?:json)?\s*/gi, "").replace(/```/g, "").trim();

  // 2. Find the outermost opener ({ or [) and walk balanced delimiters
  const openChar  = expectArray ? "[" : "{";
  const closeChar = expectArray ? "]" : "}";
  const start = text.indexOf(openChar);
  if (start === -1) throw new Error(`No JSON ${expectArray ? "array" : "object"} found in AI response`);

  let depth = 0;
  let inString = false;
  let escape = false;
  let end = -1;

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

  if (end === -1) throw new Error(`Unterminated JSON ${expectArray ? "array" : "object"} in AI response`);

  const jsonStr = text.slice(start, end + 1);
  try {
    return JSON.parse(jsonStr);
  } catch (e: any) {
    // If array parse fails, attempt fallback to object parse
    if (expectArray) {
      try { return [extractJson(jsonStr, false)]; } catch (_) {}
    }
    throw new Error(`JSON parse failed after extraction: ${e.message}\nExtracted: ${jsonStr.slice(0, 200)}`);
  }
}

// Call Kimi AI — 50 s timeout via AbortSignal.timeout (Deno-native, no timer leak)
async function callKimi(systemPrompt: string, userPrompt: string, apiKey: string, expectArray = false): Promise<any> {
  const res = await fetch("https://api.moonshot.cn/v1/chat/completions", {
    signal: AbortSignal.timeout(50_000),
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "moonshot-v1-8k",
      temperature: 0.3,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Kimi AI error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return extractJson(data.choices[0].message.content, expectArray);
}

// Call NVIDIA NIM — 50 s timeout via AbortSignal.timeout
async function callNvidiaNim(systemPrompt: string, userPrompt: string, apiKey: string, expectArray = false): Promise<any> {
  const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
    signal: AbortSignal.timeout(50_000),
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "meta/llama-3.1-70b-instruct",
      temperature: 0.3,
      max_tokens: 1024,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });
  if (!res.ok) throw new Error(`NVIDIA NIM error: ${res.status} ${await res.text()}`);
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
  const website = lead.website || lead.company_url || sourceUrl;
  
  if (!prospect || !prospect.trim()) {
    return { disqualified: true, reason: "Missing founder name" };
  }
  if (!company || !company.trim()) {
    return { disqualified: true, reason: "Missing company name" };
  }
  if (!website || !website.trim() || !/^https?:\/\//i.test(website)) {
    return { disqualified: true, reason: "Missing or invalid working website/source URL" };
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
  const scoreFounderActive = lead.score_founder_active ?? 0;
  const scoreBuyingSignal = lead.score_buying_signal ?? 0;
  const scoreIcpFit = lead.score_icp_fit ?? 0;
  const scoreReachable = lead.score_reachable ?? 0;
  const scoreAtlasRelevance = lead.score_atlas_relevance ?? 0;
  
  const totalScore = scoreFounderActive + scoreBuyingSignal + scoreIcpFit + scoreReachable + scoreAtlasRelevance;
  
  if (totalScore < 10) {
    return { disqualified: true, reason: `Disqualified ICP score: ${totalScore}/15 (< 10)` };
  }

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

  const nextAction = lead.next_action || `Reach out on ${lead.linkedin_url ? "LinkedIn" : lead.twitter_url ? "X" : "available channels"} regarding their constraint: "${thesis}".`;

  return {
    disqualified: false,
    evaluatedLead: {
      prospect,
      company,
      website,
      founder_thesis: thesis,
      goal: lead.goal || "Scale operations",
      icp_score: totalScore,
      next_action: nextAction,
      notes: notesContent,
      priority,
      source: sourceUrl,
      stage: "Sourced",
      linkedin_url: lead.linkedin_url || null,
      twitter_url: lead.twitter_url || null
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

    let userId: string;
    if (isServiceCall) {
      return new Response(JSON.stringify({ error: "Service role direct execution not supported" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      const { data: { user }, error: userError } = await userClient.auth.getUser();
      if (userError || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = user.id;
    }

    const body: SourcingRequest = await req.json();

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

      const isSocialMedia = sourceUrl && (
        sourceUrl.includes("linkedin.com") || 
        sourceUrl.includes("x.com") || 
        sourceUrl.includes("twitter.com")
      );

      if (sourceUrl && (!body.raw_text || isRawTextActuallyUrl || !isSocialMedia)) {
        console.log(`Scraping URL: ${sourceUrl}`);
        const scraped = await scrapeUrl(sourceUrl);
        console.log(`Scraped title: ${scraped.title}`);
        contentToAnalyze = `URL: ${sourceUrl}\nTitle: ${scraped.title}\nMeta Description: ${scraped.description}\nPage Content:\n${scraped.content}`;
      } else if (body.raw_text) {
        console.log("Analyzing raw text...");
        contentToAnalyze = `URL: ${sourceUrl || "Direct Text"}\nRaw Text Content:\n${body.raw_text}`;
      }

      const kimiApiKey = Deno.env.get("KIMI_API_KEY") || Deno.env.get("MOONSHOT_API_KEY");
      const nimApiKey = Deno.env.get("NVIDIA_NIM_API_KEY");
      let extracted: any = null;

      const systemPrompt = `You are Atlas HQ — an intelligent B2B sales machine designed to parse startup landing pages or social profiles.
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
  "next_action": "string"
}`;

      if (kimiApiKey && kimiApiKey !== "your-kimi-api-key") {
        try {
          extracted = await callKimi(systemPrompt, contentToAnalyze, kimiApiKey);
        } catch (kimiErr: any) {
          console.warn("Kimi failed, trying NVIDIA NIM:", kimiErr.message);
        }
      }

      if (!extracted && nimApiKey) {
        try {
          extracted = await callNvidiaNim(systemPrompt, contentToAnalyze, nimApiKey);
        } catch (nimErr: any) {
          console.error("NVIDIA NIM failed:", nimErr.message);
        }
      }

      // Falls back to mock if AI key is missing or fails
      if (!extracted) {
        console.log("Using smart mock fallback parser...");
        extracted = {
          company_name: "MockStartup",
          founder_name: "Jane Doe",
          linkedin_url: "https://linkedin.com/in/mockfounder",
          twitter_url: "@mockfounder",
          employee_count: 5,
          funding_status: "Bootstrapped",
          social_followers: 250,
          has_major_press: false,
          ph_top_5: false,
          founder_thesis: "doesn't know which acquisition channel to invest in to scale consistently",
          goal: "Get first 10 customers",
          score_founder_active: 2,
          score_buying_signal: 3,
          score_icp_fit: 3,
          score_reachable: 2,
          score_atlas_relevance: 2,
          notes: "Mock fallback parsed data.",
          next_action: "Send direct message with diagnostic roadmap."
        };
      }

      const evaluation = validateAndEvaluateLead(extracted, sourceUrl || "https://unknown.com");
      if (evaluation.disqualified) {
        return new Response(JSON.stringify({ disqualified: true, reason: evaluation.reason }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      return new Response(JSON.stringify(evaluation.evaluatedLead), {
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
  "next_action": "string"
}`;

      const callAi = async (systemPrompt: string, userPrompt: string): Promise<any> => {
        if (kimiApiKey) {
          try { return await callKimi(systemPrompt, userPrompt, kimiApiKey); } catch (_) {}
        }
        if (nimApiKey) {
          return await callNvidiaNim(systemPrompt, userPrompt, nimApiKey);
        }
        throw new Error("All AI providers failed");
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
            const isSocial = url.includes("linkedin.com") || url.includes("x.com") || url.includes("twitter.com");
            let contentToAnalyze = "";
            if (!isSocial) {
              const scraped = await scrapeUrl(url);
              contentToAnalyze = `URL: ${url}\nTitle: ${scraped.title}\nMeta Description: ${scraped.description}\nPage Content:\n${scraped.content}`;
            } else {
              contentToAnalyze = `URL: ${url}\nNote: Social media profile — extract from URL patterns only.`;
            }
            return callAi(singleSystemPrompt, contentToAnalyze);
          })
        );

        const results: any[] = [];
        settled.forEach((r, i) => {
          if (r.status === "fulfilled") {
            const evaluation = validateAndEvaluateLead(r.value, urls[i]);
            if (!evaluation.disqualified) results.push(evaluation.evaluatedLead);
          } else {
            console.warn(`Failed to source URL ${urls[i]}:`, r.reason?.message);
          }
        });

        return new Response(JSON.stringify({ leads: results, total: results.length }), {
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
  "next_action": "string"
}]`;

        let arrayResult: any[] = [];
        try {
          // Use the same robust extractJson with expectArray=true — handles fences and balanced brackets
          if (kimiApiKey) {
            try {
              arrayResult = await callKimi(bulkSystemPrompt, `Raw Text:\n${body.raw_text}`, kimiApiKey, true);
            } catch (e: any) {
              console.warn("Kimi bulk failed:", e.message);
            }
          }
          if (!arrayResult.length && nimApiKey) {
            arrayResult = await callNvidiaNim(bulkSystemPrompt, `Raw Text:\n${body.raw_text}`, nimApiKey, true);
          }
        } catch (err: any) {
          console.error("Bulk text AI failed:", err.message);
          return new Response(JSON.stringify({ error: "AI extraction failed: " + err.message }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        const filteredLeads: any[] = [];
        for (const item of arrayResult) {
          const evaluation = validateAndEvaluateLead(item, body.url || "https://unknown.com");
          if (!evaluation.disqualified) {
            filteredLeads.push(evaluation.evaluatedLead);
          }
        }

        return new Response(JSON.stringify({ leads: filteredLeads, total: filteredLeads.length }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      return new Response(JSON.stringify({ error: "urls[] or raw_text is required for bulk-source" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
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
          .from("pipeline_crm")
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
                .from("pipeline_crm")
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
                .from("pipeline_crm")
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
                .from("pipeline_crm")
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
            .from("pipeline_crm")
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
              .from("pipeline_crm")
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
