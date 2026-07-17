const SUPABASE_PROJECT_ID = "sqthvliapkauoxieiwfb";
const SUPABASE_URL = `https://${SUPABASE_PROJECT_ID}.supabase.co`;

// State references
let sessionToken = "";
let notionDbId = "";
let notionDbName = "";
let autoNotion = false;

// DOM Elements
const statusDot = document.getElementById("status-dot");
const statusText = document.getElementById("status-text");
const btnSyncSession = document.getElementById("btn-sync-session");
const tabTitleEl = document.getElementById("tab-title");
const notionDbTitleEl = document.getElementById("notion-db-title");
const btnPush = document.getElementById("btn-push");
const footerMsg = document.getElementById("footer-msg");

// Load stored session details on popup open
chrome.storage.local.get(["token", "notion_db_id", "notion_db_name", "auto_notion"], (data) => {
  if (data.token) {
    sessionToken = data.token;
    statusDot.className = "status-dot status-connected";
    statusText.innerText = "Connected";
    footerMsg.innerText = "Ready to parse profile text.";
  }
  
  if (data.notion_db_id) {
    notionDbId = data.notion_db_id;
    notionDbName = data.notion_db_name || "Notion Database";
    notionDbTitleEl.innerText = notionDbName;
  }
  
  autoNotion = !!data.auto_notion;
  
  checkActiveTab();
});

// Function to check if active tab is LinkedIn or X/Twitter
async function checkActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;

  tabTitleEl.innerText = tab.title || "Unknown Page";

  const isSupported = tab.url && (
    tab.url.includes("linkedin.com") || 
    tab.url.includes("x.com") || 
    tab.url.includes("twitter.com")
  );

  if (isSupported && sessionToken) {
    btnPush.removeAttribute("disabled");
  } else {
    btnPush.setAttribute("disabled", "true");
    if (!sessionToken) {
      footerMsg.innerText = "Please click 'Sync Active Session' first.";
    } else {
      footerMsg.innerText = "Navigate to a LinkedIn/X profile to scrape.";
    }
  }
}

// Sync session from localhost:5173 or Vercel hosted domain
btnSyncSession.addEventListener("click", async () => {
  const tabs = await chrome.tabs.query({});
  const atlasTab = tabs.find(t => t.url && (t.url.includes("localhost:5173") || t.url.includes("atlas-scale.vercel.app")));

  if (!atlasTab) {
    alert("Please open https://atlas-scale.vercel.app/hq (or http://localhost:5173/hq) in a tab first, log in, and retry.");
    return;
  }

  // Inject script to extract auth token and local storage settings
  chrome.scripting.executeScript({
    target: { tabId: atlasTab.id },
    func: () => {
      const authKey = `sb-sqthvliapkauoxieiwfb-auth-token`;
      const sessionDataRaw = localStorage.getItem(authKey);
      const defaultDb = localStorage.getItem("atlas.sourcing.default_notion_db") || "";
      const autoNotion = localStorage.getItem("atlas.sourcing.auto_notion") === "true";
      
      let token = "";
      if (sessionDataRaw) {
        try {
          const parsed = JSON.parse(sessionDataRaw);
          token = parsed.access_token || "";
        } catch (_) {}
      }
      
      return { token, defaultDb, autoNotion };
    }
  }, (results) => {
    if (results && results[0] && results[0].result) {
      const { token, defaultDb, autoNotion } = results[0].result;
      if (!token) {
        alert("Found Atlas tab, but you are not logged in. Please log in and retry.");
        return;
      }
      
      // Store token and settings
      chrome.storage.local.set({
        token: token,
        notion_db_id: defaultDb,
        notion_db_name: defaultDb ? "Loaded from Atlas HQ" : "None selected",
        auto_notion: autoNotion
      }, () => {
        sessionToken = token;
        notionDbId = defaultDb;
        notionDbTitleEl.innerText = defaultDb ? "Loaded from Atlas HQ" : "None selected";
        statusDot.className = "status-dot status-connected";
        statusText.innerText = "Connected";
        footerMsg.innerText = "Session synchronized successfully! 🎉";
        checkActiveTab();
      });
    } else {
      alert("Failed to read session details. Make sure you are on the Atlas HQ dashboard.");
    }
  });
});

// Push profile payload to Supabase & Notion
btnPush.addEventListener("click", async () => {
  btnPush.setAttribute("disabled", "true");
  btnPush.innerHTML = `<span class="spinner"></span> Parsing profile...`;
  footerMsg.innerText = "Analyzing visible page structure via AI...";

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) throw new Error("No active tab found");

    // Grab text from content script
    const response = await new Promise((resolve) => {
      chrome.tabs.sendMessage(tab.id, { action: "extract_profile" }, (res) => {
        resolve(res || { success: false, error: "Content script not responding. Please refresh the tab." });
      });
    });

    if (!response.success) {
      throw new Error(response.error || "Failed to grab profile text.");
    }

    footerMsg.innerText = "Running AI constraints extractor...";

    // 1. Call sourcing-machine Edge Function
    const aiRes = await fetch(`${SUPABASE_URL}/functions/v1/sourcing-machine`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${sessionToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        action: "source",
        raw_text: response.text,
        url: response.url
      })
    });

    if (!aiRes.ok) {
      throw new Error(`AI Extraction failed (${aiRes.status}): ${await aiRes.text()}`);
    }

    const leadInfo = await aiRes.json();
    if (leadInfo.error) {
      throw new Error(leadInfo.error);
    }

    footerMsg.innerText = "Inserting prospect into pipeline...";

    // 2. Insert lead into Supabase leads table via REST API
    const anonKey = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxdGh2bGlhcGthdW94aWVpd2ZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMxNzA5ODgsImV4cCI6MjA5ODc0Njk4OH0.gHFtw1hTFnMaFduW-fmM3E2Vmjl6JeGwPft6uNvgl9Y`;
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/leads`, {
      method: "POST",
      headers: {
        "apikey": anonKey,
        "Authorization": `Bearer ${sessionToken}`,
        "Content-Type": "application/json",
        "Prefer": "return=representation"
      },
      body: JSON.stringify({
        company_name: leadInfo.company_name,
        founder_name: leadInfo.founder_name,
        linkedin_url: leadInfo.linkedin_url || (response.url.includes("linkedin.com") ? response.url : null),
        twitter_url: leadInfo.twitter_url || (response.url.includes("x.com") || response.url.includes("twitter.com") ? response.url : null),
        employee_count: leadInfo.employee_count,
        is_b2b_saas: leadInfo.is_b2b_saas,
        icp_score: leadInfo.icp_score,
        product_hunt_url: response.url,
        notes: leadInfo.notes,
        is_contacted: false,
        reply_status: "No Response"
      })
    });

    if (!insertRes.ok) {
      throw new Error(`Failed to save prospect record: ${await insertRes.text()}`);
    }

    const insertedRows = await insertRes.json();
    const newLead = insertedRows[0];

    // 3. Optional Notion Auto-Push
    if (autoNotion && notionDbId && notionDbId !== "none") {
      footerMsg.innerText = "Pushing record to Notion Workspace...";
      const notionRes = await fetch(`${SUPABASE_URL}/functions/v1/sourcing-machine`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${sessionToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          action: "export-notion",
          lead: newLead,
          database_id: notionDbId
        })
      });
      
      const notionData = await notionRes.json();
      if (notionData.error) {
        throw new Error(`Saved to pipeline, but Notion sync failed: ${notionData.error}`);
      }
    }

    btnPush.innerHTML = `✓ Sourced!`;
    btnPush.style.backgroundColor = "var(--success)";
    btnPush.style.color = "#ffffff";
    footerMsg.innerText = `Added ${leadInfo.company_name} to Atlas HQ successfully! 🎉`;

    setTimeout(() => {
      btnPush.innerHTML = `Push to Atlas HQ`;
      btnPush.style.backgroundColor = "var(--primary)";
      btnPush.style.color = "#0f0f11";
      checkActiveTab();
    }, 3000);

  } catch (err) {
    btnPush.removeAttribute("disabled");
    btnPush.innerHTML = "Push to Atlas HQ";
    footerMsg.innerText = `Error: ${err.message}`;
    console.error(err);
  }
});
