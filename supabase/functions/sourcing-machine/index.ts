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
    company_name: string;
    founder_name?: string | null;
    linkedin_url?: string | null;
    twitter_url?: string | null;
    employee_count?: number | null;
    is_b2b_saas: boolean;
    icp_score: number;
    notes?: string | null;
    is_contacted?: boolean;
    reply_status?: string;
    product_hunt_url?: string | null;
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

// Call Kimi AI
async function callKimi(systemPrompt: string, userPrompt: string, apiKey: string): Promise<any> {
  const res = await fetch("https://api.moonshot.cn/v1/chat/completions", {
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

  if (!res.ok) {
    throw new Error(`Kimi AI error: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  const text = data.choices[0].message.content;
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("No JSON object found in Kimi AI response");
  }
  return JSON.parse(jsonMatch[0]);
}

// Call NVIDIA NIM (OpenAI-compatible, llama-3.1-70b-instruct)
async function callNvidiaNim(systemPrompt: string, userPrompt: string, apiKey: string): Promise<any> {
  const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
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

  if (!res.ok) {
    throw new Error(`NVIDIA NIM error: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  const text = data.choices[0].message.content;
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("No JSON object found in NVIDIA NIM response");
  }
  return JSON.parse(jsonMatch[0]);
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

// Auto-detect mappings from Notion properties list
function autoMapProperties(properties: any) {
  const propertyList = Object.entries(properties).map(([name, val]: [string, any]) => ({
    name,
    type: val.type
  }));

  const mappings: Record<string, string> = {};
  const validationErrors: string[] = [];

  const findMatch = (candidates: string[], type: string) => {
    // Exact match
    const exact = propertyList.find(p => candidates.includes(p.name.toLowerCase()) && p.type === type);
    if (exact) return exact.name;
    // Partial match
    const partial = propertyList.find(p => candidates.some(c => p.name.toLowerCase().includes(c)) && p.type === type);
    if (partial) return partial.name;
    return null;
  };

  // 1. Company (Title)
  const companyCandidates = ["company", "company name", "name", "title", "startup"];
  let companyField = findMatch(companyCandidates, "title");
  if (!companyField) {
    const anyTitle = propertyList.find(p => p.type === "title");
    if (anyTitle) companyField = anyTitle.name;
  }
  if (companyField) mappings["company_name"] = companyField;
  else validationErrors.push("Missing property: 'Company' (Title)");

  // 2. Founder (Rich Text)
  const founderCandidates = ["founder", "founder name", "foundername", "contact", "ceo"];
  const founderField = findMatch(founderCandidates, "rich_text");
  if (founderField) mappings["founder_name"] = founderField;
  else validationErrors.push("Missing property: 'Founder' (Rich Text)");

  // 3. LinkedIn (URL)
  const linkedinCandidates = ["linkedin", "linkedin url", "social"];
  const linkedinField = findMatch(linkedinCandidates, "url");
  if (linkedinField) mappings["linkedin_url"] = linkedinField;
  else validationErrors.push("Missing property: 'LinkedIn' (URL)");

  // 4. X (URL/Rich Text)
  const xCandidates = ["x", "twitter", "twitter handle", "twitter url", "x url"];
  let xField = findMatch(xCandidates, "url") || findMatch(xCandidates, "rich_text");
  if (xField) mappings["twitter_url"] = xField;
  else validationErrors.push("Missing property: 'X' (URL/Rich Text)");

  // 5. ICP Score (Number)
  const icpCandidates = ["icp score", "icp", "score", "icp index"];
  const icpField = findMatch(icpCandidates, "number");
  if (icpField) mappings["icp_score"] = icpField;
  else validationErrors.push("Missing property: 'ICP Score' (Number)");

  // 6. Notes (Rich Text)
  const notesCandidates = ["notes", "outreach notes", "strategy", "description"];
  const notesField = findMatch(notesCandidates, "rich_text");
  if (notesField) mappings["notes"] = notesField;
  else validationErrors.push("Missing property: 'Notes' (Rich Text)");

  return { mappings, validationErrors, properties: propertyList };
}

// Validate database properties against schema requirements
function validateDatabaseSchema(properties: any, customMappings?: Record<string, string>) {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  const requiredSchema = [
    { key: "company_name", defaultName: "Company", type: "title", label: "Company" },
    { key: "founder_name", defaultName: "Founder", type: "rich_text", label: "Founder" },
    { key: "linkedin_url", defaultName: "LinkedIn", type: "url", label: "LinkedIn" },
    { key: "twitter_url", defaultName: "X", type: "url", alternativeType: "rich_text", label: "X" },
    { key: "icp_score", defaultName: "ICP Score", type: "number", label: "ICP Score" },
    { key: "notes", defaultName: "Notes", type: "rich_text", label: "Notes" },
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
        errors.push(`Wrong Type: '${propertyName}' should be ${field.label === "X" ? "URL or Rich Text" : field.type === "rich_text" ? "Rich Text" : field.type.toUpperCase()}`);
      }
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings
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

    // Get current user details if not service call
    let userId: string;
    if (isServiceCall) {
      // For service calls we need to get user_id from context if available, otherwise reject
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

    if (body.action === "source") {
      if (!body.url && !body.raw_text) {
        return new Response(JSON.stringify({ error: "URL or raw_text is required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let contentToAnalyze = "";
      let sourceUrl = body.url || null;
      let isRawTextActuallyUrl = false;

      // Smart check: if user pasted a single URL in the raw text scraper, treat it as a URL
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

      // Check if URL is a social profile (which block Deno fetch crawlers)
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
        console.log("Analyzing provided raw text (using raw_text instead of scraping)...");
        contentToAnalyze = `URL: ${sourceUrl || "Direct Text"}\nRaw Text Page Content:\n${body.raw_text}`;
      } else {
        return new Response(JSON.stringify({ error: "URL or raw_text is required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Build the shared system prompt for all AI providers
      const kimiApiKey = Deno.env.get("KIMI_API_KEY") || Deno.env.get("MOONSHOT_API_KEY");
      const nimApiKey = Deno.env.get("NVIDIA_NIM_API_KEY");
      let leadResult: any = null;
      let aiProvider = "none";

      const systemPrompt = `You are Atlas HQ — an intelligent sales machine designed to identify early-stage B2B SaaS founders.
Given the HTML scraping or raw page text of a website, extract or infer the following details:
1. Company Name (e.g. "River" or "AnySearch")
2. Founder Name (e.g. "Jane Doe")
3. Founder's LinkedIn profile URL (if listed, or guess if safe, or return null)
4. Founder's X (Twitter) handle (or return null)
5. Estimated number of employees/team size (integer, e.g. 5. If unclear, guess based on context, default to 5)
6. Whether it is a B2B SaaS product (boolean, true/false)
7. ICP (Ideal Customer Profile) score from 1 to 10. Criteria:
   - Is it B2B SaaS? (If yes, +4 points)
   - Is the team size under 15? (If yes, +3 points)
   - Does the founder still make day-to-day decisions? (If yes, +3 points)
8. Summary notes about their product and what they do. Return the notes in this structured markdown format with these exact headings:
## Summary
[Summary of what they do]
## ICP Reasoning
[Brief point-by-point reasons for the ICP score]
## Founder Signals
[Any signals about the founder's background/tech/social presence]
## Recommended Outreach
[Outreach strategies and talking points]

Return ONLY a valid JSON object matching this exact schema:
{
  "company_name": "string",
  "founder_name": "string or null",
  "linkedin_url": "string or null",
  "twitter_url": "string or null",
  "employee_count": number or null,
  "is_b2b_saas": boolean,
  "icp_score": number,
  "notes": "string"
}`;

      // 1️⃣ Try Kimi (Moonshot) first
      if (kimiApiKey && kimiApiKey !== "your-kimi-api-key") {
        try {
          console.log("Calling Kimi AI (Moonshot)...");
          leadResult = await callKimi(systemPrompt, contentToAnalyze, kimiApiKey);
          aiProvider = "kimi";
          console.log("Kimi AI succeeded.");
        } catch (kimiErr: any) {
          console.warn("Kimi AI failed, trying NVIDIA NIM fallback:", kimiErr.message);
        }
      }

      // 2️⃣ Fallback: NVIDIA NIM
      if (!leadResult && nimApiKey) {
        try {
          console.log("Calling NVIDIA NIM (llama-3.1-70b-instruct)...");
          leadResult = await callNvidiaNim(systemPrompt, contentToAnalyze, nimApiKey);
          aiProvider = "nvidia-nim";
          console.log("NVIDIA NIM succeeded.");
        } catch (nimErr: any) {
          console.error("NVIDIA NIM also failed:", nimErr.message);
          return new Response(JSON.stringify({
            error: `All AI providers failed. Kimi: check MOONSHOT_API_KEY. NIM: ${nimErr.message}.`
          }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // 3️⃣ Neither key configured
      if (!leadResult && !kimiApiKey && !nimApiKey) {
        return new Response(JSON.stringify({
          error: "No AI API key configured. Please set MOONSHOT_API_KEY or NVIDIA_NIM_API_KEY in Supabase secrets."
        }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log(`AI extraction completed via: ${aiProvider}`);


      // Fallback Mock if key is missing or call failed
      if (!leadResult) {
        console.log("Using smart fallback parser/mock...");
        
        // 1. Get Title and URL
        const titleLine = contentToAnalyze.match(/^Title:\s*(.*)$/m);
        const pageTitle = titleLine ? titleLine[1].trim() : "";
        const urlLine = contentToAnalyze.match(/^URL:\s*(.*)$/m);
        const pageUrl = urlLine ? urlLine[1].trim() : (sourceUrl || "");

        // 2. Parse Founder Name
        let founder = "";
        
        // Try to parse from Title (typically: "Name (@handle) / X", "Name | LinkedIn", "Name - Profile")
        if (pageTitle) {
          if (pageTitle.includes("(@")) {
            founder = pageTitle.split("(@")[0].trim();
          } else if (pageTitle.includes(" / X")) {
            founder = pageTitle.split(" / X")[0].trim();
          } else if (pageTitle.includes("| LinkedIn")) {
            founder = pageTitle.split("| LinkedIn")[0].trim();
          } else if (pageTitle.includes("- LinkedIn")) {
            founder = pageTitle.split("- LinkedIn")[0].trim();
          } else if (pageTitle.includes(" - ")) {
            founder = pageTitle.split(" - ")[0].trim();
          } else if (pageTitle.includes(" | ")) {
            founder = pageTitle.split(" | ")[0].trim();
          }
        }

        // Clean up founder name if it contains noise (like "Log in or sign up")
        if (founder && (founder.toLowerCase().includes("log in") || founder.toLowerCase().includes("sign up") || founder.toLowerCase().includes("twitter") || founder.toLowerCase().includes("linkedin"))) {
          founder = "";
        }

        // If title parsing failed, look for common profile title patterns in content text
        if (!founder) {
          const firstLine = (body.raw_text || "").split("\n")[0] || "";
          if (firstLine && firstLine.length < 40 && !firstLine.includes("http")) {
            founder = firstLine.trim();
          } else {
            founder = "Founder / Lead";
          }
        }

        // 3. Parse Company Name
        let company = "Startup";
        
        // Try to extract from URL hostname
        if (pageUrl) {
          try {
            const parsed = new URL(pageUrl);
            const host = parsed.hostname.replace("www.", "");
            if (host.includes("linkedin.com") || host.includes("x.com") || host.includes("twitter.com")) {
              // It's a social profile. Check for company keywords in content
              const companyRegexes = [
                /(?:founder|co-founder|ceo|creator)\s+(?:of|at)\s+([a-zA-Z0-9_\-\.]+)/i,
                /building\s+([a-zA-Z0-9_\-\.]+)/i,
                /(?:founder|co-founder)\s+@\s*([a-zA-Z0-9_\-\.]+)/i
              ];
              for (const regex of companyRegexes) {
                const match = contentToAnalyze.match(regex);
                if (match && match[1]) {
                  const cleaned = match[1].replace(/[\.,\s]+$/, "").trim();
                  if (cleaned && cleaned.length > 2 && !["the", "a", "my", "our", "new", "this"].includes(cleaned.toLowerCase())) {
                    company = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
                    break;
                  }
                }
              }
            } else {
              // Direct company website URL: e.g. stripe.com -> Stripe
              const parts = host.split(".");
              company = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
            }
          } catch (_) {}
        }

        // 4. Parse Social URLs
        let linkedinUrl = null;
        let twitterUrl = null;

        if (pageUrl.includes("linkedin.com")) {
          linkedinUrl = pageUrl;
        } else if (pageUrl.includes("x.com") || pageUrl.includes("twitter.com")) {
          twitterUrl = pageUrl;
        }

        // Search in text for the other social link
        if (!linkedinUrl) {
          const match = contentToAnalyze.match(/https?:\/\/(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9\-\_]+/i);
          if (match) linkedinUrl = match[0];
        }
        if (!twitterUrl) {
          const match = contentToAnalyze.match(/https?:\/\/(?:www\.)?(?:x\.com|twitter\.com)\/[a-zA-Z0-9\-\_]+/i);
          if (match) twitterUrl = match[0];
        }

        // 5. Deduce B2B SaaS status & Employee count
        const contentLower = contentToAnalyze.toLowerCase();
        const isB2B = contentLower.includes("b2b") || 
                      contentLower.includes("saas") || 
                      contentLower.includes("business") || 
                      contentLower.includes("workflow") || 
                      contentLower.includes("api") || 
                      contentLower.includes("tool") || 
                      contentLower.includes("platform") || 
                      contentLower.includes("software") ||
                      contentLower.includes("enterprise");

        // Parse employee count or team size
        let empCount = 5; // default
        const empMatches = contentLower.match(/(?:team size|employees|team of|size of|staff of)\s*[:\-\s]*\s*(\d+)/i);
        if (empMatches && empMatches[1]) {
          empCount = parseInt(empMatches[1]);
        } else {
          if (contentLower.includes("solopreneur") || contentLower.includes("indie hacker") || contentLower.includes("individual builder")) {
            empCount = 1;
          }
        }

        // 6. Compute ICP Score
        let score = 0;
        if (isB2B) score += 4;
        if (empCount < 15) score += 3;
        
        const isFounderDecisionMaker = empCount < 50 && !contentLower.includes("enterprise corporate");
        if (isFounderDecisionMaker) score += 3;

        // 7. Notes Generation
        const notes = `## Summary
Parsed profile data for **${founder}** at **${company}**.

## ICP Reasoning
* B2B SaaS Fit: ${isB2B ? "Yes (+4 points)" : "No (+0 points)"}
* Estimated Team Size: ${empCount} (${empCount < 15 ? "Under 15 (+3 points)" : "Over 15 (+0 points)"})
* Founder Decision Maker: ${isFounderDecisionMaker ? "Yes (+3 points)" : "No (+0 points)"}
* **Total ICP Score**: ${score}/10

## Founder Signals
* Scraped from: ${pageUrl || "Direct Text"}
* ${linkedinUrl ? `LinkedIn: ${linkedinUrl}` : "LinkedIn profile not detected in text"}
* ${twitterUrl ? `X/Twitter: ${twitterUrl}` : "X/Twitter handle not detected in text"}

## Recommended Outreach
* Connect via social accounts and introduce Atlas workflow solutions optimized for team sizes around ${empCount}.`;

        leadResult = {
          company_name: company,
          founder_name: founder,
          linkedin_url: linkedinUrl,
          twitter_url: twitterUrl,
          employee_count: empCount,
          is_b2b_saas: isB2B,
          icp_score: score,
          notes: notes,
        };
      }

      // Add product_hunt_url field
      leadResult.product_hunt_url = sourceUrl;

      return new Response(JSON.stringify(leadResult), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── BULK SOURCE ──────────────────────────────────────────────────────────────
    if (body.action === "bulk-source") {
      const kimiApiKey = Deno.env.get("KIMI_API_KEY") || Deno.env.get("MOONSHOT_API_KEY");
      const nimApiKey = Deno.env.get("NVIDIA_NIM_API_KEY");

      if (!kimiApiKey && !nimApiKey) {
        return new Response(JSON.stringify({
          error: "No AI API key configured. Please set MOONSHOT_API_KEY or NVIDIA_NIM_API_KEY in Supabase secrets."
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

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

        const singleSystemPrompt = `You are Atlas HQ — an intelligent sales machine designed to identify early-stage B2B SaaS founders.
Given the HTML scraping or raw page text of a website, extract or infer the following details:
1. Company Name
2. Founder Name (or null)
3. Founder's LinkedIn profile URL (or null)
4. Founder's X (Twitter) handle (or null)
5. Estimated number of employees (integer, default 5 if unclear)
6. Whether it is a B2B SaaS product (boolean)
7. ICP score 1–10: B2B SaaS = +4, team <15 = +3, founder decision-maker = +3
8. Notes in structured markdown with headings: ## Summary, ## ICP Reasoning, ## Founder Signals, ## Recommended Outreach

Return ONLY a valid JSON object:
{ "company_name": "string", "founder_name": "string or null", "linkedin_url": "string or null", "twitter_url": "string or null", "employee_count": number or null, "is_b2b_saas": boolean, "icp_score": number, "notes": "string" }`;

        const results: any[] = [];
        for (const url of urls) {
          try {
            const isSocial = url.includes("linkedin.com") || url.includes("x.com") || url.includes("twitter.com");
            let contentToAnalyze = "";
            if (!isSocial) {
              const scraped = await scrapeUrl(url);
              contentToAnalyze = `URL: ${url}\nTitle: ${scraped.title}\nMeta Description: ${scraped.description}\nPage Content:\n${scraped.content}`;
            } else {
              contentToAnalyze = `URL: ${url}\nNote: Social media profile — extract from URL patterns only.`;
            }
            const lead = await callAi(singleSystemPrompt, contentToAnalyze);
            lead.product_hunt_url = url;
            results.push(lead);
          } catch (err: any) {
            console.warn(`Failed to source URL ${url}:`, err.message);
            results.push({
              company_name: new URL(url).hostname.replace("www.", ""),
              founder_name: null,
              linkedin_url: null,
              twitter_url: null,
              employee_count: 5,
              is_b2b_saas: false,
              icp_score: 1,
              notes: `## Summary\nFailed to extract data from ${url}.\n\n## ICP Reasoning\nNo data available.\n\n## Founder Signals\nN/A\n\n## Recommended Outreach\nVisit the site manually.`,
              product_hunt_url: url,
              _error: err.message
            });
          }
        }

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
2. Founder Name (or null)
3. Founder's LinkedIn URL (or null)
4. Founder's X/Twitter handle or URL (or null)
5. Estimated employee count (integer, default 5)
6. Whether it is B2B SaaS (boolean)
7. ICP score 1–10: B2B SaaS = +4, team <15 = +3, founder decision-maker = +3
8. Notes in structured markdown: ## Summary, ## ICP Reasoning, ## Founder Signals, ## Recommended Outreach

IMPORTANT: If the text mentions multiple companies/founders, extract ALL of them.
Return ONLY a valid JSON array (even if there is only one result):
[{ "company_name": "string", "founder_name": "string or null", "linkedin_url": "string or null", "twitter_url": "string or null", "employee_count": number or null, "is_b2b_saas": boolean, "icp_score": number, "notes": "string" }]`;

        let parsed: any[] = [];
        try {
          const raw = await callAi(bulkSystemPrompt, `Raw Text:\n${body.raw_text}`);
          // callAi extracts first JSON object — but we need an array, so re-parse
          // The helpers use regex /{...}/ — override with array detection
          parsed = Array.isArray(raw) ? raw : [raw];
        } catch (_) {
          // Try to extract JSON array directly
          try {
            const aiRaw = body.raw_text; // fallback placeholder
            const arrMatch = aiRaw.match(/\[[\s\S]*\]/);
            if (arrMatch) parsed = JSON.parse(arrMatch[0]);
          } catch (_2) {}
        }

        // Fix: callAi helpers return first {} match — redo with array-aware version
        // We call the AI models directly here for array support
        let arrayResult: any[] = [];
        try {
          const callWithArraySupport = async (apiUrl: string, authKey: string, model: string, maxTokens?: number): Promise<any[]> => {
            const reqBody: any = {
              model,
              temperature: 0.3,
              messages: [
                { role: "system", content: bulkSystemPrompt },
                { role: "user", content: `Raw Text:\n${body.raw_text}` }
              ]
            };
            if (maxTokens) reqBody.max_tokens = maxTokens;
            const res = await fetch(apiUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${authKey}` },
              body: JSON.stringify(reqBody)
            });
            if (!res.ok) throw new Error(`AI error ${res.status}`);
            const data = await res.json();
            const text = data.choices[0].message.content;
            // Try to find JSON array first, then fall back to single object
            const arrMatch = text.match(/\[[\s\S]*\]/);
            if (arrMatch) return JSON.parse(arrMatch[0]);
            const objMatch = text.match(/\{[\s\S]*\}/);
            if (objMatch) return [JSON.parse(objMatch[0])];
            throw new Error("No JSON found in response");
          };

          if (kimiApiKey) {
            try {
              arrayResult = await callWithArraySupport("https://api.moonshot.cn/v1/chat/completions", kimiApiKey, "moonshot-v1-8k");
            } catch (e: any) {
              console.warn("Kimi bulk failed:", e.message);
            }
          }
          if (!arrayResult.length && nimApiKey) {
            arrayResult = await callWithArraySupport("https://integrate.api.nvidia.com/v1/chat/completions", nimApiKey, "meta/llama-3.1-70b-instruct", 2048);
          }
        } catch (err: any) {
          console.error("Bulk text AI failed:", err.message);
          return new Response(JSON.stringify({ error: "AI extraction failed: " + err.message }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        return new Response(JSON.stringify({ leads: arrayResult, total: arrayResult.length }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      return new Response(JSON.stringify({ error: "urls[] or raw_text is required for bulk-source" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

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

    if (body.action === "export-notion") {
      if (!body.lead || !body.database_id) {
        return new Response(JSON.stringify({ error: "lead and database_id are required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const dbClient = createClient(supabaseUrl, supabaseServiceKey);
      
      // Optimistic/Immediate status change to syncing if lead ID is provided
      if (body.lead.id) {
        await dbClient
          .from("leads")
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
        // Fetch database properties schema
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
        
        // Match properties mapping
        const mappings = body.field_mappings || autoMapProperties(properties).mappings;

        const lead = body.lead;
        const notionProperties: any = {};

        // 1. Company Name
        const compPropName = mappings["company_name"];
        if (compPropName && properties[compPropName]) {
          notionProperties[compPropName] = {
            title: [{ text: { content: lead.company_name } }]
          };
        } else {
          throw new Error("Company Name property mapping not found or invalid in Notion schema");
        }

        // 2. Founder Name
        const founderPropName = mappings["founder_name"];
        if (founderPropName && properties[founderPropName]) {
          notionProperties[founderPropName] = {
            rich_text: [{ text: { content: lead.founder_name || "" } }]
          };
        }

        // 3. LinkedIn URL
        const linkedinPropName = mappings["linkedin_url"];
        if (linkedinPropName && properties[linkedinPropName]) {
          notionProperties[linkedinPropName] = {
            url: lead.linkedin_url || null
          };
        }

        // 4. X / Twitter
        const xPropName = mappings["twitter_url"];
        if (xPropName && properties[xPropName]) {
          const xVal = lead.twitter_url 
            ? (lead.twitter_url.startsWith("http") ? lead.twitter_url : `https://x.com/${lead.twitter_url.replace("@", "")}`) 
            : null;
          if (properties[xPropName].type === "url") {
            notionProperties[xPropName] = { url: xVal };
          } else {
            notionProperties[xPropName] = { rich_text: [{ text: { content: lead.twitter_url || "" } }] };
          }
        }

        // 5. ICP Score
        const icpPropName = mappings["icp_score"];
        if (icpPropName && properties[icpPropName]) {
          notionProperties[icpPropName] = {
            number: lead.icp_score !== null && lead.icp_score !== undefined ? Number(lead.icp_score) : null
          };
        }

        // 6. Notes Column
        const notesPropName = mappings["notes"];
        if (notesPropName && properties[notesPropName]) {
          const truncatedNotes = (lead.notes || "").slice(0, 2000);
          notionProperties[notesPropName] = {
            rich_text: [{ text: { content: truncatedNotes } }]
          };
        }

        // --- Duplicate Detection ---
        const companyProp = mappings["company_name"] || "Company";
        let existingPageId: string | null = null;

        const queryBody = {
          filter: {
            property: companyProp,
            title: {
              equals: lead.company_name
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
          // If no choice was provided, report conflict to client
          if (!body.duplicate_behavior) {
            if (lead.id) {
              await dbClient
                .from("leads")
                .update({ notion_sync_status: "not_synced" })
                .eq("id", lead.id);
            }
            return new Response(JSON.stringify({ 
              duplicate_detected: true, 
              existing_page_id: existingPageId, 
              company_name: lead.company_name 
            }), {
              status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          if (body.duplicate_behavior === "skip") {
            if (lead.id) {
              await dbClient
                .from("leads")
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
                .from("leads")
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
            .from("leads")
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
              .from("leads")
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
