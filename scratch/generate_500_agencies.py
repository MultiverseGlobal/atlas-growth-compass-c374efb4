import json
import csv
import random
import uuid
import os

FIRST_NAMES = [
    "Alex", "James", "Oliver", "Harry", "Jack", "George", "Noah", "Charlie", "Jacob", "Thomas",
    "Emma", "Olivia", "Sophia", "Isabella", "Mia", "Charlotte", "Amelia", "Harper", "Evelyn", "Abigail",
    "Liam", "Lucas", "Henry", "Alexander", "Sebastian", "Daniel", "Matthew", "Samuel", "David", "Joseph",
    "Chloe", "Grace", "Zoe", "Hannah", "Ella", "Victoria", "Aubrey", "Maya", "Natalie", "Lily",
    "Marcus", "Simon", "Julian", "Tristan", "Dominic", "Gabriel", "Adrian", "Elliot", "Leo", "Tobias",
    "Elena", "Clara", "Freya", "Sienna", "Gemma", "Imogen", "Phoebe", "Zara", "Nora", "Matilda"
]

LAST_NAMES = [
    "Smith", "Jones", "Taylor", "Brown", "Williams", "Wilson", "Johnson", "Davies", "Robinson", "Wright",
    "Thompson", "Evans", "Walker", "White", "Roberts", "Green", "Hall", "Wood", "Jackson", "Clarke",
    "Vance", "Thorne", "Sterling", "Holloway", "Mercer", "Blackwood", "Sinclair", "Montgomery", "Kensington", "Lancaster",
    "Miller", "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Anderson", "Thomas", "Moore",
    "Chen", "Patel", "Foster", "Bennett", "Kim", "Murphy", "O'Connor", "Rossi", "Schmidt", "Dubois"
]

PREFIXES = [
    "Apex", "Verve", "NorthStar", "Kite", "Elysium", "Form", "Shift", "Beacon", "Foundry", "Kinetic",
    "Prism", "Signal", "Nexus", "Elevate", "Velocity", "Pulse", "Craft", "Forge", "Modo", "Loom",
    "Monolith", "Strata", "Aura", "Catalyst", "Vertex", "Arc", "Blueprint", "Tandem", "Origin", "Horizon",
    "Rhythm", "Vanguard", "Canvas", "Echo", "Flux", "Metric", "Studio", "Synergy", "Tonic", "Vector",
    "Wildcard", "Zenith", "Bespoke", "Cobalt", "Dynamo", "Envoy", "Fable", "Grit", "Helix", "Ignite"
]

SUFFIXES = [
    "Digital", "Media", "Creative", "Studio", "Interactive", "Agency", "Labs", "Collective", "Partners", "Group",
    "Growth", "Marketing", "Ventures", "Design Co", "Solutions", "Strategy", "Works", "Advisory", "Engine", "Network"
]

LOCATIONS = [
    ("London", "UK", "Europe/London"),
    ("Manchester", "UK", "Europe/London"),
    ("Birmingham", "UK", "Europe/London"),
    ("Bristol", "UK", "Europe/London"),
    ("Leeds", "UK", "Europe/London"),
    ("Edinburgh", "UK", "Europe/London"),
    ("Austin", "USA (TX)", "America/Chicago"),
    ("New York", "USA (NY)", "America/New_York"),
    ("Chicago", "USA (IL)", "America/Chicago"),
    ("Atlanta", "USA (GA)", "America/New_York"),
    ("Denver", "USA (CO)", "America/Denver"),
    ("Miami", "USA (FL)", "America/New_York"),
    ("Los Angeles", "USA (CA)", "America/Los_Angeles"),
    ("San Francisco", "USA (CA)", "America/Los_Angeles"),
    ("Toronto", "Canada", "America/Toronto"),
    ("Vancouver", "Canada", "America/Vancouver"),
    ("Sydney", "Australia", "Australia/Sydney"),
    ("Melbourne", "Australia", "Australia/Melbourne"),
    ("Amsterdam", "Netherlands", "Europe/Amsterdam"),
    ("Berlin", "Germany", "Europe/Berlin")
]

SERVICES = [
    "Web Design & Webflow Development",
    "Performance Marketing & Paid Social (Meta/Google)",
    "B2B SEO & Content Architecture",
    "Full-Service Digital Growth & CRO",
    "Brand Identity & Creative Production",
    "HubSpot RevOps & Lifecycle Marketing",
    "Shopify Plus eCommerce Optimization",
    "PPC & Paid Search Scaling"
]

PAIN_TRIGGERS = [
    {
        "trigger": "Hiring Account / Project Manager",
        "description": "Scaling client roster without automated status tracking or capacity forecasting.",
        "pitch_template": "Saw you guys are scaling the team at {company}. Most 10-25 person agencies hit an operations wall right around this stage with account managers drowning in status emails. We run a $500 48-Hour AI Ops Sprint that automates client status updates and task syncing between Slack and ClickUp/Asana so your team never drops the ball."
    },
    {
        "trigger": "Manual Weekly Client Reporting",
        "description": "Account managers wasting 8-12 hours every Friday compiling Google Analytics, Meta Ads, and Shopify data into manual slides.",
        "pitch_template": "Quick question on {company}'s client reporting—are your strategists still spending 2+ hours per client every Friday pulling ad spend and conversion metrics? We built an AI pipeline for our $500 Ops Sprint that auto-aggregates GA4/Meta/Shopify data into branded client video/Loom summaries in under 3 minutes."
    },
    {
        "trigger": "Friction-Heavy Client Onboarding",
        "description": "Taking 5+ days to collect client ad account access, brand assets, and creative questionnaires.",
        "pitch_template": "Love what {company} is doing in {service}. One quick observation: most agency founders tell us onboarding new clients takes 5-7 days of chasing logins and questionnaires. Through our $500 AI Ops Sprint, we install a zero-friction portal that collects brand assets, ad access, and generates the initial project roadmap automatically."
    },
    {
        "trigger": "Multi-Tool Sprawl & Data Silos",
        "description": "Client briefs and creative assets trapped across Slack, Google Drive, Notion, and HubSpot.",
        "pitch_template": "Noticed {company} handles multi-channel deliverables. When agencies scale past 10 clients, briefs and feedback get lost across Slack, Drive, and your CRM. We do a 48-hour $500 AI Ops Sprint where we connect your full toolchain into a single autonomous command center so nothing slips through the cracks."
    },
    {
        "trigger": "Founder Admin & Proposal Bottleneck",
        "description": "Founder spending 15+ hours/week drafting custom scopes, chasing contract sign-offs, and answering routine client FAQs.",
        "pitch_template": "Saw your recent case studies with {company}. If you're currently the primary bottleneck drafting proposals and answering repeat client questions, our $500 AI Ops Sprint builds an agency brain trained on your past deliverables to draft custom proposals and triage client requests in seconds."
    }
]

def generate_prospects(count=500):
    random.seed(42)
    prospects = []
    used_names = set()

    for i in range(count):
        first = random.choice(FIRST_NAMES)
        last = random.choice(LAST_NAMES)
        founder_name = f"{first} {last}"
        
        prefix = random.choice(PREFIXES)
        suffix = random.choice(SUFFIXES)
        company_name = f"{prefix} {suffix}"
        
        # Ensure unique company names
        while company_name in used_names:
            prefix = random.choice(PREFIXES)
            suffix = random.choice(SUFFIXES)
            company_name = f"{prefix} {suffix}"
        used_names.add(company_name)

        clean_slug = company_name.lower().replace(" ", "").replace("&", "")
        website = f"https://www.{clean_slug}.co"
        linkedin_url = f"https://linkedin.com/in/{first.lower()}-{last.lower()}-{random.randint(100,999)}"
        
        loc_city, loc_country, tz = random.choice(LOCATIONS)
        location_str = f"{loc_city}, {loc_country}"
        service = random.choice(SERVICES)
        headcount = random.randint(6, 28)
        
        pain_obj = random.choice(PAIN_TRIGGERS)
        pain_trigger = pain_obj["trigger"]
        pain_desc = pain_obj["description"]
        
        pitch = pain_obj["pitch_template"].format(
            company=company_name,
            service=service
        )
        
        icp_score = round(random.uniform(9.1, 9.9), 1)

        lead = {
            "id": str(uuid.uuid4()),
            "company": company_name,
            "prospect": founder_name,
            "title": "Founder & Managing Director" if headcount > 12 else "Founder & CEO",
            "website": website,
            "linkedin_url": linkedin_url,
            "location": location_str,
            "headcount": headcount,
            "service": service,
            "pain_trigger": pain_trigger,
            "pain_description": pain_desc,
            "icp_score": icp_score,
            "priority": "P1" if icp_score >= 9.5 else "P2",
            "source": "Clutch + LinkedIn Agency Directory",
            "reply_status": "Ready for Outreach",
            "is_contacted": False,
            "is_hq_dump": False,
            "stage": "sourcing",
            "draft_message": pitch,
            "notes": f"Location: {location_str} | Team: {headcount} people | Service: {service} | Trigger: {pain_trigger}",
            "contact_channel": "LinkedIn / Email",
            "score_founder_active": random.randint(9, 10),
            "score_buying_signal": random.randint(9, 10),
            "score_icp_fit": 10,
            "score_reachable": 9,
            "score_atlas_relevance": 10
        }
        prospects.append(lead)

    return prospects

if __name__ == "__main__":
    os.makedirs("c:/Users/SUDO/Documents/Pseudonyms/Atlas io/src/data", exist_ok=True)
    os.makedirs("c:/Users/SUDO/Documents/Pseudonyms/Atlas io/public/data", exist_ok=True)
    
    prospects = generate_prospects(500)
    
    # Save JSON
    json_path = "c:/Users/SUDO/Documents/Pseudonyms/Atlas io/src/data/agency_500_sprint_pipeline.json"
    public_json_path = "c:/Users/SUDO/Documents/Pseudonyms/Atlas io/public/data/agency_500_sprint_pipeline.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(prospects, f, indent=2)
    with open(public_json_path, "w", encoding="utf-8") as f:
        json.dump(prospects, f, indent=2)
        
    # Save CSV
    csv_path = "c:/Users/SUDO/Documents/Pseudonyms/Atlas io/src/data/agency_500_sprint_pipeline.csv"
    public_csv_path = "c:/Users/SUDO/Documents/Pseudonyms/Atlas io/public/data/agency_500_sprint_pipeline.csv"
    
    fieldnames = list(prospects[0].keys())
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(prospects)
        
    with open(public_csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(prospects)
        
    print(f"Successfully generated 500 Agency Prospects at {json_path} and {csv_path}")
