// Deterministic Starter map generator — no LLM, no auth required.
// Turns a stated goal into Goal → Constraint → Evidence → Move waypoints
// at Emerging confidence.

export type WaypointType = "goal" | "constraint" | "evidence" | "move";
export type Confidence = "emerging" | "building" | "established";

export interface Waypoint {
  type: WaypointType;
  label: string;      // eyebrow (mono, uppercase)
  title: string;      // Fraunces headline
  description: string;// Inter body
  confidence: Confidence;
  lastUpdatedDays?: number | null;
}

export interface StarterMap {
  id: "starter";
  goalStatement: string;
  createdAt: string;
  waypoints: Waypoint[];
}

const STORAGE_KEY = "atlas.starterMap";

// Very small heuristic dictionary — deterministic, no external calls.
const patterns: Array<{
  match: RegExp;
  constraint: { title: string; description: string };
  evidence: { title: string; description: string };
  move: { title: string; description: string };
}> = [
  {
    match: /(customer|user|sign[- ]?up|revenue|sales|paying|mrr|arr)/i,
    constraint: {
      title: "You don't yet have a repeatable way people find out about it.",
      description:
        "Before conversion or pricing matters, someone has to arrive. Right now that channel is unspecified.",
    },
    evidence: {
      title: "Traffic sources, referrer data, and any launch surface.",
      description:
        "Connect analytics or a growth tool so Atlas can see where attention is coming from — or confirm there's none yet.",
    },
    move: {
      title: "Pick one channel this week and post something concrete.",
      description:
        "One post, one place, one call to action. The point is to generate a first data point, not to launch.",
    },
  },
  {
    match: /(ship|launch|release|build|feature|mvp|beta)/i,
    constraint: {
      title: "Scope is likely wider than the time available.",
      description:
        "Most first launches slip because the definition of 'done' keeps expanding. Cutting scope now is cheaper than cutting it under pressure.",
    },
    evidence: {
      title: "Commit cadence, open issues, and a real target date.",
      description:
        "Connect GitHub and Linear so Atlas can compare planned scope against actual movement week by week.",
    },
    move: {
      title: "Write one sentence describing the smallest shippable version.",
      description:
        "If it's more than one sentence, it's too big. Anything not in that sentence gets deferred.",
    },
  },
  {
    match: /(hire|team|recruit|founder|cofounder)/i,
    constraint: {
      title: "The role isn't defined tightly enough to attract the right person.",
      description:
        "Vague roles attract vague candidates. The constraint is usually the job spec, not the market.",
    },
    evidence: {
      title: "The written role, its scope, and who it reports to.",
      description:
        "Upload the current draft or paste it in. Atlas will compare it against outcomes you want in the first 90 days.",
    },
    move: {
      title: "Write three outcomes this person must produce in 90 days.",
      description:
        "Outcomes, not responsibilities. If you can't name three, you're not ready to hire yet.",
    },
  },
  {
    match: /(fund|raise|invest|round|pitch|seed|angel)/i,
    constraint: {
      title: "The story of momentum isn't yet legible from outside.",
      description:
        "Investors don't fund what's real; they fund what's visibly moving. Right now that signal is scattered.",
    },
    evidence: {
      title: "Revenue trend, product commits, and user activity in one view.",
      description:
        "Connect Stripe, GitHub, and any analytics so Atlas can produce a single defensible trajectory chart.",
    },
    move: {
      title: "Draft one paragraph naming your last 30 days of movement.",
      description:
        "Numbers, ships, conversations — concrete only. If you can't fill it, the constraint is doing the work, not pitching it.",
    },
  },
];

const fallback = {
  constraint: {
    title: "The goal is stated, but the bottleneck isn't yet named.",
    description:
      "Every goal has one thing slowing it more than the others. Atlas needs a source or two to identify which.",
  },
  evidence: {
    title: "Any real data about how the work is currently going.",
    description:
      "GitHub, Stripe, Linear, or a document describing current state. Manual notes work too — the point is to ground the map.",
  },
  move: {
    title: "Write one sentence describing what would count as progress this week.",
    description:
      "If you can name it in a sentence, Atlas can track whether it happened. If you can't, that's the first thing to fix.",
  },
};

export function generateStarterMap(goalStatement: string): StarterMap {
  const goal = goalStatement.trim();
  const pattern = patterns.find((p) => p.match.test(goal)) ?? { ...fallback, match: /./ };

  return {
    id: "starter",
    goalStatement: goal,
    createdAt: new Date().toISOString(),
    waypoints: [
      {
        type: "goal",
        label: "Goal",
        title: goal || "Name what you're trying to do",
        description: "Stated by you. This is what every other waypoint on the map points back to.",
        confidence: "established",
      },
      {
        type: "constraint",
        label: "Likely constraint",
        title: pattern.constraint.title,
        description: pattern.constraint.description,
        confidence: "emerging",
      },
      {
        type: "evidence",
        label: "Evidence to gather",
        title: pattern.evidence.title,
        description: pattern.evidence.description,
        confidence: "emerging",
      },
      {
        type: "move",
        label: "Next move",
        title: pattern.move.title,
        description: pattern.move.description,
        confidence: "emerging",
      },
    ],
  };
}

export function saveStarterMap(map: StarterMap) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* ignore quota / private mode */
  }
}

export function loadStarterMap(): StarterMap | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StarterMap) : null;
  } catch {
    return null;
  }
}

export function clearStarterMap() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
