import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotionSyncRequest {
  action: "sync" | "graduate";
  database_id?: string;
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
    draft_message?: string | null;
    contact_channel?: string | null;
    stale_data_warning?: boolean;
    // Rubrics
    score_founder_active?: number;
    score_buying_signal?: number;
    score_icp_fit?: number;
    score_reachable?: number;
    score_atlas_relevance?: number;
  };
  leads?: any[];
  notion_page_id?: string;
  lead_id?: string; // fallback lookup for graduation
  duplicate_behavior?: "update" | "duplicate" | "skip";
  field_mappings?: Record<string, string>;
}

// Auto-detect Notion database mappings
function autoMapProperties(properties: any) {
  const propertyList = Object.entries(properties).map(([name, val]: [string, any]) => ({
    name,
    type: val.type
  }));

  const mappings: Record<string, string> = {};
  const validationErrors: string[] = [];

  const findMatch = (candidates: string[], type: string, alternativeType?: string) => {
    const exact = propertyList.find(p => 
      candidates.includes(p.name.toLowerCase()) && 
      (p.type === type || (alternativeType && p.type === alternativeType))
    );
    if (exact) return exact.name;
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
    { key: "stage", defaultName: "Stage", type: "select", alternativeType: "status", candidates: ["stage", "status"] },
    { key: "draft_message", defaultName: "Draft Message", type: "rich_text", candidates: ["draft message", "draft", "outreach message"] },
    { key: "contact_channel", defaultName: "Contact Channel", type: "rich_text", candidates: ["contact channel", "channel", "contact"] }
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

// Convert markdown/text to Notion block format
function parseNotesToNotionBlocks(notesText: string) {
  if (!notesText) return [];
  const lines = notesText.split("\n");
  const blocks: any[] = [];
  
  for (let line of lines) {
    line = line.trim();
    if (!line) continue;
    
    if (line.startsWith("## ")) {
      blocks.push({
        object: "block",
        type: "heading_2",
        heading_2: {
          rich_text: [{ type: "text", text: { content: line.slice(3) } }]
        }
      });
    } else if (line.startsWith("### ")) {
      blocks.push({
        object: "block",
        type: "heading_3",
        heading_3: {
          rich_text: [{ type: "text", text: { content: line.slice(4) } }]
        }
      });
    } else if (line.startsWith("* ") || line.startsWith("- ")) {
      blocks.push({
        object: "block",
        type: "bulleted_list_item",
        bulleted_list_item: {
          rich_text: [{ type: "text", text: { content: line.slice(2) } }]
        }
      });
    } else {
      blocks.push({
        object: "block",
        type: "paragraph",
        paragraph: {
          rich_text: [{ type: "text", text: { content: line } }]
        }
      });
    }
  }
  return blocks.slice(0, 100); // safety cap
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
    const dbClient = createClient(supabaseUrl, supabaseServiceKey);

    let userId: string;
    if (isServiceCall) {
      return new Response(JSON.stringify({ error: "Service role execution direct mapping not supported" }), {
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

    const body: NotionSyncRequest = await req.json();

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

    // ── GRADUATE ACTION ─────────────────────────────────────────────────────────
    if (body.action === "graduate") {
      let pageId = body.notion_page_id;
      let leadId = body.lead_id;

      if (!pageId && leadId) {
        // Look up in Supabase
        const { data: localLead } = await dbClient
          .from("pipeline_crm")
          .select("notion_page_id")
          .eq("id", leadId)
          .maybeSingle();
        pageId = localLead?.notion_page_id;
      }

      if (!pageId) {
        if (leadId) {
          // Prospect has not been pushed to Notion (table only lead). Graduate locally in database.
          await dbClient
            .from("pipeline_crm")
            .update({
              is_hq_dump: false,
              stage: "Sourced"
            })
            .eq("id", leadId);

          return new Response(JSON.stringify({ success: true, graduated: true, local_only: true }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        return new Response(JSON.stringify({ error: "notion_page_id or valid lead_id is required for graduation" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch the Notion Database Schema if database_id is provided, to locate the Stage field name
      let stagePropName = "Stage";
      if (body.database_id) {
        try {
          const dbSchemaRes = await fetch(`https://api.notion.com/v1/databases/${body.database_id}`, {
            headers: { Authorization: `Bearer ${notionToken}`, "Notion-Version": "2022-06-28" }
          });
          if (dbSchemaRes.ok) {
            const dbSchema = await dbSchemaRes.json();
            const mappings = body.field_mappings || autoMapProperties(dbSchema.properties).mappings;
            if (mappings["stage"]) stagePropName = mappings["stage"];
          }
        } catch (_) {}
      }

      // Update Notion Stage property to "Sourced"
      const updateRes = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${notionToken}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          properties: {
            [stagePropName]: { select: { name: "Sourced" } }
          }
        })
      });

      if (!updateRes.ok) {
        const errorText = await updateRes.text();
        return new Response(JSON.stringify({ error: `Notion graduation failed: ${errorText}` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // Update Supabase CRM table: graduate to Pipeline
      if (leadId) {
        await dbClient
          .from("pipeline_crm")
          .update({
            is_hq_dump: false,
            stage: "Sourced",
            notion_sync_status: "synced"
          })
          .eq("id", leadId);
      } else {
        // fallback match by notion page id
        await dbClient
          .from("pipeline_crm")
          .update({
            is_hq_dump: false,
            stage: "Sourced",
            notion_sync_status: "synced"
          })
          .eq("notion_page_id", pageId);
      }

      return new Response(JSON.stringify({ success: true, graduated: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // ── SYNC ACTION ─────────────────────────────────────────────────────────────
    if (body.action === "sync") {
      if (!body.lead || !body.database_id) {
        return new Response(JSON.stringify({ error: "lead and database_id are required for sync action" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const lead = body.lead;

      if (lead.id) {
        await dbClient
          .from("pipeline_crm")
          .update({ notion_sync_status: "syncing", notion_sync_error: null })
          .eq("id", lead.id);
      }

      // 1. Fetch database properties and map
      const dbSchemaRes = await fetch(`https://api.notion.com/v1/databases/${body.database_id}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${notionToken}`, "Notion-Version": "2022-06-28" }
      });
      if (!dbSchemaRes.ok) {
        throw new Error(`Failed to retrieve Notion database schema: ${await dbSchemaRes.text()}`);
      }
      const dbSchema = await dbSchemaRes.json();
      const properties = dbSchema.properties || {};
      const mappings = body.field_mappings || autoMapProperties(properties).mappings;

      // 2. Build Notion page properties
      const notionProperties: any = {};

      if (mappings["prospect"] && properties[mappings["prospect"]]) {
        notionProperties[mappings["prospect"]] = { title: [{ text: { content: lead.prospect || "" } }] };
      }
      if (mappings["company"] && properties[mappings["company"]]) {
        notionProperties[mappings["company"]] = { rich_text: [{ text: { content: lead.company || "" } }] };
      }
      if (mappings["website"] && properties[mappings["website"]]) {
        notionProperties[mappings["website"]] = { url: lead.website || null };
      }
      if (mappings["founder_thesis"] && properties[mappings["founder_thesis"]]) {
        notionProperties[mappings["founder_thesis"]] = { rich_text: [{ text: { content: lead.founder_thesis || "" } }] };
      }
      if (mappings["goal"] && properties[mappings["goal"]]) {
        notionProperties[mappings["goal"]] = { rich_text: [{ text: { content: lead.goal || "" } }] };
      }
      if (mappings["icp_score"] && properties[mappings["icp_score"]]) {
        notionProperties[mappings["icp_score"]] = { number: Number(lead.icp_score ?? 0) };
      }
      if (mappings["next_action"] && properties[mappings["next_action"]]) {
        notionProperties[mappings["next_action"]] = { rich_text: [{ text: { content: lead.next_action || "" } }] };
      }
      if (mappings["notes"] && properties[mappings["notes"]]) {
        notionProperties[mappings["notes"]] = { rich_text: [{ text: { content: (lead.notes || "").slice(0, 2000) } }] };
      }
      if (mappings["priority"] && properties[mappings["priority"]]) {
        if (properties[mappings["priority"]].type === "select") {
          notionProperties[mappings["priority"]] = lead.priority ? { select: { name: lead.priority } } : null;
        } else {
          notionProperties[mappings["priority"]] = { rich_text: [{ text: { content: lead.priority || "Low" } }] };
        }
      }
      if (mappings["source"] && properties[mappings["source"]]) {
        if (properties[mappings["source"]].type === "url") {
          notionProperties[mappings["source"]] = { url: lead.source || null };
        } else {
          notionProperties[mappings["source"]] = { rich_text: [{ text: { content: lead.source || "" } }] };
        }
      }
      if (mappings["draft_message"] && properties[mappings["draft_message"]]) {
        notionProperties[mappings["draft_message"]] = { rich_text: [{ text: { content: (lead.draft_message || "").slice(0, 2000) } }] };
      }
      if (mappings["contact_channel"] && properties[mappings["contact_channel"]]) {
        notionProperties[mappings["contact_channel"]] = { rich_text: [{ text: { content: lead.contact_channel || "" } }] };
      }

      // ── Stage logic (Default to "HQ Dump" on new pages) ──────────────────────────
      const stageProp = mappings["stage"];
      if (stageProp && properties[stageProp]) {
        // HQ Dump raw staging
        const defaultStage = "HQ Dump";
        if (properties[stageProp].type === "select") {
          notionProperties[stageProp] = { select: { name: defaultStage } };
        } else if (properties[stageProp].type === "status") {
          notionProperties[stageProp] = { status: { name: defaultStage } };
        } else {
          notionProperties[stageProp] = { rich_text: [{ text: { content: defaultStage } }] };
        }
      }

      // 3. Duplicate checks
      const companyFieldInNotion = mappings["company"] || "Company";
      let existingPageId: string | null = null;

      const queryRes = await fetch(`https://api.notion.com/v1/databases/${body.database_id}/query`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${notionToken}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filter: { property: companyFieldInNotion, rich_text: { equals: lead.company } },
          page_size: 1
        })
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
            await dbClient.from("pipeline_crm").update({ notion_sync_status: "not_synced" }).eq("id", lead.id);
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
                notion_sync_error: null,
                exported_to_notion: true
              })
              .eq("id", lead.id);
          }
          return new Response(JSON.stringify({ success: true, skipped: true }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (body.duplicate_behavior === "update") {
          const updateRes = await fetch(`https://api.notion.com/v1/pages/${existingPageId}`, {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${notionToken}`,
              "Notion-Version": "2022-06-28",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ properties: notionProperties })
          });

          if (!updateRes.ok) {
            throw new Error(`Notion update page failed: ${await updateRes.text()}`);
          }

          if (lead.id) {
            await dbClient
              .from("pipeline_crm")
              .update({
                notion_sync_status: "synced",
                notion_page_id: existingPageId,
                notion_sync_error: null,
                exported_to_notion: true
              })
              .eq("id", lead.id);
          }

          return new Response(JSON.stringify({ success: true, updated: true, page_id: existingPageId }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // ── Create page flow with layout prepending ────────────────────────────────────
      const introBlocks = [
        {
          object: "block",
          type: "heading_2",
          heading_2: {
            rich_text: [{ type: "text", text: { content: "Generated Outreach Draft" } }]
          }
        },
        {
          object: "block",
          type: "callout",
          callout: {
            rich_text: [{ type: "text", text: { content: lead.draft_message || "No outreach draft generated." } }],
            icon: { type: "emoji", emoji: "✉️" },
            color: "blue_background"
          }
        },
        {
          object: "block",
          type: "divider",
          divider: {}
        }
      ];

      const notesBlocks = parseNotesToNotionBlocks(lead.notes || "");
      const notionBlocks = [...introBlocks, ...notesBlocks];

      const createRes = await fetch("https://api.notion.com/v1/pages", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${notionToken}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          parent: { database_id: body.database_id },
          properties: notionProperties,
          children: notionBlocks
        })
      });

      if (!createRes.ok) {
        throw new Error(`Notion create page failed: ${await createRes.text()}`);
      }

      const createData = await createRes.json();
      const newPageId = createData.id;

      // Update Supabase DB with sync logs + staging status
      if (lead.id) {
        await dbClient
          .from("pipeline_crm")
          .update({
            notion_sync_status: "synced",
            notion_page_id: newPageId,
            notion_sync_error: null,
            exported_to_notion: true,
            is_hq_dump: true, // syncd to staging
            draft_message: lead.draft_message,
            contact_channel: lead.contact_channel,
            stale_data_warning: lead.stale_data_warning || false,
            score_founder_active: lead.score_founder_active || 0,
            score_buying_signal: lead.score_buying_signal || 0,
            score_icp_fit: lead.score_icp_fit || 0,
            score_reachable: lead.score_reachable || 0,
            score_atlas_relevance: lead.score_atlas_relevance || 0
          })
          .eq("id", lead.id);
      }

      return new Response(JSON.stringify({ success: true, created: true, page_id: newPageId }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("Function error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
