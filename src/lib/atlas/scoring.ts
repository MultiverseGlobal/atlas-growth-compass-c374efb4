import { AtlasIcpProfile, AgencyFeedItem, FitScoreBreakdown } from "./types";

export interface ScoringResult {
  fitScore: number;
  scoreBreakdown: FitScoreBreakdown;
  isQualified: boolean;
}

/**
 * Deterministic Fit Scoring Engine
 * Strictly additive point system totaling maximum 100 points:
 * - Employee count fit (+25)
 * - Geographic fit (+15)
 * - Industry fit (+15)
 * - Operational pain signal (+20)
 * - Buying signal (+15)
 * - Decision-maker identified (+10)
 * 
 * Qualification Threshold: fitScore >= 60
 */
export function calculateFitScore(
  prospect: AgencyFeedItem,
  icp: AtlasIcpProfile
): ScoringResult {
  let fitScore = 0;

  const scoreBreakdown: FitScoreBreakdown = {
    employeeFit: { points: 0, observed: prospect.employee_count },
    geoFit: { points: 0, observed: prospect.country },
    industryFit: { points: 0, observed: prospect.industry },
    painSignal: { points: 0 },
    buyingSignal: { points: 0 },
    decisionMaker: { points: 0 },
  };

  // 1. Employee Count Fit (+25)
  if (
    prospect.employee_count >= icp.employee_range_min &&
    prospect.employee_count <= icp.employee_range_max
  ) {
    fitScore += 25;
    scoreBreakdown.employeeFit.points = 25;
  }

  // 2. Geographic Fit (+15)
  const normalizedCountry = prospect.country?.toUpperCase().trim();
  const matchedGeo = icp.target_geography.some(
    (g) => g.toUpperCase().trim() === normalizedCountry
  );
  if (matchedGeo) {
    fitScore += 15;
    scoreBreakdown.geoFit.points = 15;
  }

  // 3. Industry Fit (+15)
  const prospectIndustryLower = (prospect.industry || "").toLowerCase();
  const matchedIndustry = icp.industry_keywords.some((kw) =>
    prospectIndustryLower.includes(kw.toLowerCase()) ||
    kw.toLowerCase().includes(prospectIndustryLower)
  );
  if (matchedIndustry) {
    fitScore += 15;
    scoreBreakdown.industryFit.points = 15;
  }

  // 4. Observed Operational Pain Signal (+20)
  if (prospect.pain_signal && prospect.pain_signal.trim().length > 0) {
    fitScore += 20;
    scoreBreakdown.painSignal = {
      points: 20,
      snippet: prospect.pain_signal,
      sourceUrl: prospect.pain_source_url || prospect.source_url,
    };
  }

  // 5. Observed Buying Signal (+15)
  if (prospect.buying_signal && prospect.buying_signal.trim().length > 0) {
    fitScore += 15;
    scoreBreakdown.buyingSignal = {
      points: 15,
      snippet: prospect.buying_signal,
      sourceUrl: prospect.buying_source_url || prospect.source_url,
    };
  }

  // 6. Decision-Maker Identified (+10)
  if (prospect.contact_name && prospect.contact_name.trim().length > 0) {
    fitScore += 10;
    scoreBreakdown.decisionMaker = {
      points: 10,
      name: prospect.contact_name,
      title: prospect.contact_title || undefined,
    };
  }

  return {
    fitScore,
    scoreBreakdown,
    isQualified: fitScore >= 60,
  };
}
