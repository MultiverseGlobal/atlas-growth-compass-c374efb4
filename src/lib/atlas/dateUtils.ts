/**
 * PSEUDONYMS ATLAS V1 — BUSINESS DAY DATE UTILITY
 * Strictly adheres to Monday-Friday business days rule:
 * Friday   -> Wednesday (+3 business days)
 * Saturday -> Wednesday (+3 business days)
 * Sunday   -> Wednesday (+3 business days)
 * Monday   -> Thursday (+3 business days)
 * Tuesday  -> Friday (+3 business days)
 * Wednesday-> Monday (+3 business days)
 * Thursday -> Tuesday (+3 business days)
 */

export function addBusinessDays(startDate: Date | string, daysToAdd: number = 3): Date {
  const result = new Date(startDate);
  
  // If initiated on a weekend, anchor to Friday to ensure follow-up lands on Wednesday
  const initialDay = result.getDay();
  if (initialDay === 6) {
    // Saturday -> anchor to Friday
    result.setDate(result.getDate() - 1);
  } else if (initialDay === 0) {
    // Sunday -> anchor to Friday
    result.setDate(result.getDate() - 2);
  }

  let added = 0;
  while (added < daysToAdd) {
    result.setDate(result.getDate() + 1);
    const dayOfWeek = result.getDay();
    // 0 = Sunday, 6 = Saturday
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      added++;
    }
  }

  return result;
}

export function formatBusinessDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}
