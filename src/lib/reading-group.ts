export interface ReadingSession {
  date: string;
  speaker: string;
  image?: string;
  title?: string;
  affiliation?: string;
  presentation_url?: string;
  topic?: string;
  abstract?: string;
  about?: string;
  description?: string;
}

export function academicYear(date: string): number {
  const parsed = new Date(`${date}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new Error(`Invalid reading group date: ${date}. Use YYYY-MM-DD.`);
  }
  return parsed.getUTCFullYear() - (parsed.getUTCMonth() < 8 ? 1 : 0);
}

export function readingSeasons(sessions: ReadingSession[]) {
  const seasons = new Map<number, ReadingSession[]>();
  for (const session of sessions) {
    const year = academicYear(session.date);
    const items = seasons.get(year) || [];
    items.push(session);
    seasons.set(year, items);
  }
  return [...seasons.entries()].sort(([a], [b]) => b - a).map(([year, items]) => ({
    year,
    label: `${year}–${year + 1}`,
    sessions: [...items].sort((a, b) => b.date.localeCompare(a.date)),
  }));
}
