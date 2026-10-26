export interface ResearchTopic { id: string; label: string; color: string; patterns: string[] }
export function normalizedTopicText(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}
export function publicationTitle(citation: string) {
  return (citation.match(/\*\*(.*?)\*\*/s)?.[1] || citation).replace(/\.$/, '').trim();
}
export function publicationTopics(publication: {citation: string; topics?: string[]}, topics: ResearchTopic[]) {
  if (publication.topics) {
    if (!publication.topics.length || publication.topics.some(id => !topics.some(topic => topic.id === id))) throw new Error(`Invalid topics for ${publicationTitle(publication.citation)}`);
    return [...new Set(publication.topics)];
  }
  const title = normalizedTopicText(publicationTitle(publication.citation));
  const matches = topics.filter(topic => topic.patterns.some(pattern => title.includes(normalizedTopicText(pattern)))).map(topic => topic.id);
  return matches.length ? matches : ['other'];
}
export function publicationAnchor(citation: string) {
  let hash = 2166136261;
  for (const char of citation) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return `paper-${(hash >>> 0).toString(16)}`;
}

export interface ResearchClassification {
  area: string;
  tasks: string[];
  methods: string[];
  basis: 'abstract' | 'title' | 'needs-source';
  source?: string;
  note?: string;
}
export function publicationResearch(publication: { citation: string; research?: ResearchClassification }, topics: ResearchTopic[]) {
  const research = publication.research;
  if (!research) return null;
  const validStrings = (values: unknown): values is string[] => Array.isArray(values) && values.every(value => typeof value === 'string' && value.trim().length > 0);
  if (!topics.some(topic => topic.id === research.area) || !validStrings(research.tasks) || !validStrings(research.methods) || !['abstract','title','needs-source'].includes(research.basis)) {
    throw new Error(`Invalid research classification for ${publicationTitle(publication.citation)}`);
  }
  return research;
}
