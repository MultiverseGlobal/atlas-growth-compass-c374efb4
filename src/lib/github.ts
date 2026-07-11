import { supabase } from "@/integrations/supabase/client";

export type GitHubRepo = {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  updated_at: string;
};

export type GitHubStats = {
  commitsThisWeek: number;
  commitsLastWeek: number;
  daysSinceLastCommit: number;
  lastCommitMessage: string;
  hasActivity: boolean;
};

// Check if we have a valid provider token in the session
export async function getGitHubToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.provider_token ?? null;
}

// Fetch user's recent repositories
export async function fetchUserRepos(token: string): Promise<GitHubRepo[]> {
  const res = await fetch("https://api.github.com/user/repos?sort=updated&per_page=20", {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
    },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch repositories: ${res.statusText}`);
  }
  return res.json();
}

// Fetch commits for a repository in the last 14 days
export async function fetchRepoCommitStats(token: string, owner: string, repo: string): Promise<GitHubStats> {
  const twoWeeksAgo = new Date();
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
  const sinceISO = twoWeeksAgo.toISOString();

  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits?since=${sinceISO}&per_page=100`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch commits: ${res.statusText}`);
  }

  const commits = await res.json();
  const now = new Date();
  let commitsThisWeek = 0;
  let commitsLastWeek = 0;
  let latestCommitDate: Date | null = null;
  let lastCommitMessage = "";

  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  commits.forEach((item: any) => {
    const commitDate = new Date(item.commit.committer.date);
    if (!latestCommitDate || commitDate > latestCommitDate) {
      latestCommitDate = commitDate;
      lastCommitMessage = item.commit.message;
    }

    if (commitDate >= oneWeekAgo) {
      commitsThisWeek++;
    } else {
      commitsLastWeek++;
    }
  });

  const daysSinceLastCommit = latestCommitDate
    ? Math.floor((now.getTime() - latestCommitDate.getTime()) / (1000 * 60 * 60 * 24))
    : 14; // default to 14 if no commits

  return {
    commitsThisWeek,
    commitsLastWeek,
    daysSinceLastCommit,
    lastCommitMessage,
    hasActivity: commits.length > 0,
  };
}

// ─── Diagnostic Flags (deterministic pre-filter, feeds the LLM) ───────────────

export type DiagnosticFlag = {
  flag: string;
  reason: string;
  severity: "low" | "medium" | "high";
};

/** Converts raw GitHub stats into structured flags for the LLM layer.
 *  Pure math, no copy-writing. The LLM decides what these flags mean for the goal. */
export function buildDiagnosticFlags(stats: GitHubStats): DiagnosticFlag[] {
  const { commitsThisWeek, commitsLastWeek, daysSinceLastCommit, lastCommitMessage } = stats;
  const flags: DiagnosticFlag[] = [];

  if (daysSinceLastCommit > 7) {
    flags.push({
      flag: "No GitHub activity in over a week",
      reason: `Last commit was ${daysSinceLastCommit} days ago: "${lastCommitMessage || "no message"}"`,
      severity: "high",
    });
  }

  if (commitsThisWeek === 0 && daysSinceLastCommit <= 7) {
    flags.push({
      flag: "Zero commits this week",
      reason: `${commitsLastWeek} commits last week, 0 this week.`,
      severity: "medium",
    });
  }

  if (commitsLastWeek > 0 && commitsThisWeek < commitsLastWeek * 0.5 && commitsThisWeek > 0) {
    const drop = Math.round(((commitsLastWeek - commitsThisWeek) / commitsLastWeek) * 100);
    flags.push({
      flag: "Commit velocity dropping",
      reason: `${commitsThisWeek} commits this week vs ${commitsLastWeek} last week — ${drop}% drop.`,
      severity: "medium",
    });
  }

  if (commitsThisWeek >= commitsLastWeek && commitsThisWeek > 0) {
    flags.push({
      flag: "Development velocity is stable or increasing",
      reason: `${commitsThisWeek} commits this week vs ${commitsLastWeek} last week.`,
      severity: "low",
    });
  }

  return flags;
}

/** Fallback: builds waypoints locally without LLM, used when no API key is configured. */
export function runGitHubRulesFallback(stats: GitHubStats, goal: string) {
  const flags = buildDiagnosticFlags(stats);
  const topFlag = flags.find(f => f.severity === "high") ?? flags.find(f => f.severity === "medium") ?? flags[0];

  const isHealthy = !topFlag || topFlag.severity === "low";
  const confidence = stats.daysSinceLastCommit > 7 ? "emerging" as const : "established" as const;

  const evidenceSources = flags.map(f => ({
    source: "GitHub",
    detail: `${f.flag}: ${f.reason}`
  }));

  return {
    waypoints: [
      { kind: "goal" as const, title: goal, confidence: "established" as const },
      {
        kind: "constraint" as const,
        title: isHealthy ? "No blocking constraints detected from GitHub signals." : topFlag.flag,
        confidence,
      },
      {
        kind: "evidence" as const,
        title: topFlag?.reason ?? `${stats.commitsThisWeek} commits this week, last activity ${stats.daysSinceLastCommit} days ago.`,
        confidence,
      },
      {
        kind: "move" as const,
        title: isHealthy
          ? "Keep executing on the current map path."
          : "Connect an LLM API key in Supabase Edge Function secrets to get goal-aware advice.",
        confidence: "established" as const,
        metadata: { evidence: evidenceSources },
      },
    ],
  };
}

/** @deprecated Use buildDiagnosticFlags + Edge Function instead. Kept for backward compat. */
export function runGitHubRules(stats: GitHubStats, goal: string) {
  return runGitHubRulesFallback(stats, goal);
}

