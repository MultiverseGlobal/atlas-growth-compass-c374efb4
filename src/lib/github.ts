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

// Evaluate deterministic constraint rules based on GitHub statistics
export function runGitHubRules(stats: GitHubStats, goal: string) {
  const { commitsThisWeek, commitsLastWeek, daysSinceLastCommit, lastCommitMessage } = stats;

  let constraintTitle = "";
  let constraintTone: "destructive" | "warning" | "success" = "success";
  let evidenceBody = "";
  let nextMove = "";
  let confidence: "starter" | "emerging" | "established" = "established";

  if (daysSinceLastCommit > 7) {
    constraintTitle = "No development activity in over a week.";
    constraintTone = "destructive";
    evidenceBody = `Last commit was ${daysSinceLastCommit} days ago: "${lastCommitMessage || "No message"}"`;
    nextMove = "Push code or merge a branch to restore pipeline activity.";
    confidence = "emerging";
  } else if (commitsThisWeek === 0) {
    constraintTitle = "Zero commits shipped this week.";
    constraintTone = "warning";
    evidenceBody = `Velocity dropped from ${commitsLastWeek} commits last week to 0 this week.`;
    nextMove = "Ship a small fix or document code to kickstart momentum.";
  } else if (commitsLastWeek > 0 && commitsThisWeek < commitsLastWeek * 0.5) {
    constraintTitle = "Development velocity is dropping.";
    constraintTone = "warning";
    evidenceBody = `Shipped ${commitsThisWeek} commits this week vs ${commitsLastWeek} last week.`;
    nextMove = "Focus the team on resolving outstanding blockers.";
  } else {
    constraintTitle = "Development velocity is healthy.";
    constraintTone = "success";
    evidenceBody = `Active commits: ${commitsThisWeek} shipped this week, last activity ${daysSinceLastCommit} days ago.`;
    nextMove = "Keep executing on the current map path.";
  }

  return {
    waypoints: [
      {
        kind: "goal" as const,
        title: goal,
        confidence: "established" as const,
      },
      {
        kind: "constraint" as const,
        title: constraintTitle,
        confidence,
        tone: constraintTone,
      },
      {
        kind: "evidence" as const,
        title: evidenceBody,
        confidence,
      },
      {
        kind: "move" as const,
        title: nextMove,
        confidence: "established" as const,
      },
    ],
  };
}
