## Plan: Fix Atlas onboarding flow and reposition the frontend around first-value Maps

### Goal
Make Google signup feel continuous and purposeful:

```text
Landing → Auth → Public page details → Guided setup → Integrations intent/setup → Maps dashboard
```

Atlas should read less like an evidence/product dashboard and more like a consulting-grade analysis firm that tells users what they need to know, what changed, and what to do next.

### 1. Audit the current frontend flow
- Review current routing, auth redirects, onboarding, integrations page, app shell, and dashboard pages.
- Identify exactly where users are being sent after Google signup and after public page setup.
- Keep the Google OAuth redirect behavior compatible with the auth system; the fix should happen in app routing/state, not by sending OAuth directly to a protected route.

### 2. Replace the post-signup destination logic
- After a new user finishes public page details, route them into a guided setup experience instead of dropping them into the app or integrations page.
- The guided setup should collect lightweight business context before integrations:
  - What they want Atlas to analyze
  - Main business function or operating area
  - Current priority or constraint
  - Available data sources
- Store only local/UI state for now unless existing profile fields already support it. This pass stays frontend-first.

### 3. Redesign onboarding as a consulting intake flow
- Build a polished multi-step onboarding screen with a clear progression:
  - Public presence
  - Business context
  - Data sources
  - Desired first outcome
- Use language around diagnosis, operating signals, constraints, decision maps, and action steps.
- Avoid presenting Atlas as mainly an evidence site.

### 4. Reframe integrations as “data sources” inside setup
- Users should understand they are connecting sources so Atlas can produce better analysis, not just visiting a generic integrations page.
- Show integration categories:
  - Google Workspace: Gmail, Drive, Docs, Calendar
  - Business tools: Slack, Notion, HubSpot, Stripe, analytics, etc.
  - GitHub: delivery/product signals
  - Manual upload / manual context: useful before backend integrations are complete
- Since the backend connector work is later, the frontend can show setup cards, selected states, and “coming next / prepare connection” states without pretending everything is live.

### 5. Build the first-value dashboard around “Maps”
- Rename/reframe the first dashboard experience as Maps.
- Create a strong empty/first-run state that immediately shows value even before real backend analysis:
  - Strategy Map
  - Identified Constraint
  - What changed / what matters
  - Recommended executable actions
- Make it clear which parts are based on connected data, selected context, or pending integrations.

### 6. Add a sample consulting-style first analysis
- On first dashboard entry, show a realistic starter analysis layout rather than a blank dashboard:
  - “Primary constraint” panel
  - “Operating signals” panel
  - “Action sequence” panel
  - “Map” view connecting goal → constraint → evidence → next action
- Use placeholder/sample content carefully so it feels like a product preview, not fake final analysis.

### 7. Visual and copy direction
- Premium consulting/product hybrid.
- Distinct from generic AI dashboards.
- Suggested design direction:
  - Dark executive workspace base with off-white panels and sharp grid structure
  - Accent colors: deep ink, muted gold, signal blue, status green, risk red
  - Typography: editorial but modern headings, clean UI body font
  - Motion: subtle progress transitions, map node reveals, action queue hover states
- Keep text practical and direct: “what happened,” “why it matters,” “what to do next.”

### 8. Technical scope for this implementation
- Frontend routing and UI only.
- No new live backend integrations yet.
- No new database schema unless existing onboarding state absolutely requires a small field and the current schema cannot support it.
- Keep auth secure and preserve the existing Google sign-in method.
- Do not implement full AI analysis yet; design the frontend so backend/AI can power it in v2.

### Expected result
After Google signup, users will no longer lose the integration/setup path. They will complete public page details, move through a guided consulting intake, select or prepare data sources, then land on a Maps dashboard that clearly explains the first strategic constraint and executable next actions.