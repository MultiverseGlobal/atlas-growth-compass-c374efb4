import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TimeWorthRequest {
  url: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { url } = await req.json() as TimeWorthRequest;
    if (!url) {
      throw new Error("Missing URL");
    }

    // 1. Fetch content via Jina Reader
    const jinaRes = await fetch(`https://r.jina.ai/${url}`, {
      headers: {
        "Accept": "text/plain"
      }
    });
    const markdownContent = await jinaRes.text();

    // 2. Call Gemini
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("Missing GEMINI_API_KEY");
    }

    const systemInstruction = `You are Orion's "Time Worth Check" feature. 
Your goal is to determine if the user should spend time consuming the provided content.
You must output ONLY valid JSON matching this schema:
{
  "score": "WORTH YOUR TIME" | "MAYBE" | "NOT WORTH YOUR TIME",
  "about": "What it is actually about, stripping away clickbait",
  "reality": "Fact check against claims made, identifying exaggeration",
  "useful_part": "The core useful takeaway",
  "source": "The original source (e.g. Official Docs, Research Paper, N/A)",
  "time_saved": "e.g. '15 min read -> 30 sec summary'",
  "verdict": "e.g. Skip the article. Read the source."
}

Do NOT wrap the JSON in markdown blocks like \`\`\`json. Just output the raw JSON.`;

    const promptText = `Analyze the following content from URL: ${url}\n\nContent:\n${markdownContent.substring(0, 30000)}`;

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemInstruction }] },
          contents: [{ role: "user", parts: [{ text: promptText }] }],
          generationConfig: {
            temperature: 0.2,
          }
        }),
      }
    );

    const geminiData = await geminiRes.json();
    if (geminiData.error) {
      throw new Error(geminiData.error.message || "Gemini Error");
    }

    const textOutput = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    
    let parsedResult;
    try {
      parsedResult = JSON.parse(textOutput.trim());
    } catch (e) {
      // fallback in case of markdown wrapping
      const cleaned = textOutput.replace(/```json/g, "").replace(/```/g, "").trim();
      parsedResult = JSON.parse(cleaned);
    }

    return new Response(JSON.stringify(parsedResult), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
