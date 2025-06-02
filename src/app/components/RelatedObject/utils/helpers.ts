export const formatNoteSeparatorDate = (date: Date): string => {
  const MS_PER_DAY = 1000 * 60 * 60 * 24;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const dateStart = new Date(date);
  dateStart.setHours(0, 0, 0, 0);

  const diffDays = Math.floor((todayStart.getTime() - dateStart.getTime()) / MS_PER_DAY);

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays <= 6) {
    const dayOfWeek = date.toLocaleDateString("en-US", { weekday: "short" });
    return `${dayOfWeek} (${diffDays} days ago)`;
  }
  if (diffDays <= 7) return "A week ago";

  return date.toLocaleDateString();
};
