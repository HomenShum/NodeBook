import { formatNoteSeparatorDate } from "@/app/components/RelatedObject/utils/helpers";

describe("formatNoteSeparatorDate", () => {
  const MS_PER_DAY = 1000 * 60 * 60 * 24;

  const getDateNDaysAgo = (n: number): Date => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setTime(d.getTime() - n * MS_PER_DAY);
    return d;
  };

  it("should return 'Today' for today's date", () => {
    expect(formatNoteSeparatorDate(new Date())).toBe("Today");
  });

  it("should return 'Yesterday' for yesterday's date", () => {
    expect(formatNoteSeparatorDate(getDateNDaysAgo(1))).toBe("Yesterday");
  });

  it("should return day name and days ago for a date within the last 7 days", () => {
    const date = getDateNDaysAgo(3);
    const dayOfWeek = date.toLocaleDateString("en-US", { weekday: "short" });
    expect(formatNoteSeparatorDate(date)).toBe(`${dayOfWeek} (3 days ago)`);
  });

  it("should return locale date string for a date older than 7 days", () => {
    const date = getDateNDaysAgo(10);
    expect(formatNoteSeparatorDate(date)).toBe(date.toLocaleDateString());
  });

  it("should return the locale-formatted string for May 6, 2024 07:30", () => {
    const date = new Date("2024-05-06T07:30:00Z");
    const expected = date.toLocaleDateString();
    expect(formatNoteSeparatorDate(date)).toBe(expected);
  });
});
