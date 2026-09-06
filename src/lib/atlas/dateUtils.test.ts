import { describe, it, expect } from "vitest";
import { addBusinessDays } from "./dateUtils";

describe("addBusinessDays", () => {
  it("rolls Friday + 3 business days forward to Wednesday", () => {
    // 2026-09-11 is a Friday
    const friday = new Date("2026-09-11T10:00:00Z");
    const result = addBusinessDays(friday, 3);
    expect(result.getDay()).toBe(3); // 3 = Wednesday
    expect(result.getDate()).toBe(16);
  });

  it("rolls Saturday + 3 business days forward to Wednesday", () => {
    // 2026-09-12 is a Saturday
    const saturday = new Date("2026-09-12T10:00:00Z");
    const result = addBusinessDays(saturday, 3);
    expect(result.getDay()).toBe(3); // 3 = Wednesday
    expect(result.getDate()).toBe(16);
  });

  it("rolls Sunday + 3 business days forward to Wednesday", () => {
    // 2026-09-13 is a Sunday
    const sunday = new Date("2026-09-13T10:00:00Z");
    const result = addBusinessDays(sunday, 3);
    expect(result.getDay()).toBe(3); // 3 = Wednesday
    expect(result.getDate()).toBe(16);
  });

  it("rolls Monday + 3 business days forward to Thursday", () => {
    // 2026-09-07 is a Monday
    const monday = new Date("2026-09-07T10:00:00Z");
    const result = addBusinessDays(monday, 3);
    expect(result.getDay()).toBe(4); // 4 = Thursday
    expect(result.getDate()).toBe(10);
  });

  it("rolls Tuesday + 3 business days forward to Friday", () => {
    // 2026-09-08 is a Tuesday
    const tuesday = new Date("2026-09-08T10:00:00Z");
    const result = addBusinessDays(tuesday, 3);
    expect(result.getDay()).toBe(5); // 5 = Friday
    expect(result.getDate()).toBe(11);
  });

  it("rolls Wednesday + 3 business days forward to Monday", () => {
    // 2026-09-09 is a Wednesday
    const wednesday = new Date("2026-09-09T10:00:00Z");
    const result = addBusinessDays(wednesday, 3);
    expect(result.getDay()).toBe(1); // 1 = Monday
    expect(result.getDate()).toBe(14);
  });

  it("rolls Thursday + 3 business days forward to Tuesday", () => {
    // 2026-09-10 is a Thursday
    const thursday = new Date("2026-09-10T10:00:00Z");
    const result = addBusinessDays(thursday, 3);
    expect(result.getDay()).toBe(2); // 2 = Tuesday
    expect(result.getDate()).toBe(15);
  });
});
