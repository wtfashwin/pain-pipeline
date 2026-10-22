import type { Assessment, Complaint, Problem } from './contracts.ts';
import { createHash } from 'node:crypto';

type Evidence = { representative: Complaint; normalized: string; tokens: Set<string>; records: Complaint[] };

function normalize(text: string): string {
  return text.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function complaintOrder(left: Complaint, right: Complaint): number {
  return compare(normalize(left.text), normalize(right.text)) || compare(left.text, right.text)
    || compare(left.id, right.id) || compare(left.url, right.url) || compare(left.kind, right.kind)
    || compare(left.source, right.source) || compare(left.collected_at, right.collected_at);
}

function canonicalUrl(value: string): string {
  const url = new URL(value);
  url.hash = '';
  return url.href;
}

function deduplicate(complaints: Complaint[]): Evidence[] {
  const parents = complaints.map((_, index) => index);
  function root(index: number): number {
    while (parents[index] !== index) {
      parents[index] = parents[parents[index]!]!;
      index = parents[index]!;
    }
    return index;
  }
  const keys = new Map<string, number>();
  complaints.forEach((complaint, index) => {
    for (const key of [`id:${complaint.id}`, `url:${canonicalUrl(complaint.url)}`, `text:${normalize(complaint.text)}`]) {
      const seen = keys.get(key);
      if (seen !== undefined) parents[root(index)] = root(seen);
      else keys.set(key, index);
    }
  });
  const groups = new Map<number, Complaint[]>();
  complaints.forEach((complaint, index) => {
    const key = root(index);
    const group = groups.get(key) ?? [];
    group.push(complaint);
    groups.set(key, group);
  });
  return [...groups.values()].map((records) => {
    // A repeated import cannot vote for a conflicting text variant more than once.
    // Prefer the variant corroborated by the most distinct ID/URL aliases, then break ties deterministically.
    const variants = new Map<string, Set<string>>();
    for (const record of records) {
      const normalized = normalize(record.text);
      const aliases = variants.get(normalized) ?? new Set<string>();
      aliases.add(JSON.stringify([record.id, canonicalUrl(record.url)]));
      variants.set(normalized, aliases);
    }
    records.sort((left, right) => variants.get(normalize(right.text))!.size - variants.get(normalize(left.text))!.size
      || complaintOrder(left, right));
    const representative = records[0]!;
    const normalized = normalize(representative.text);
    return { representative, normalized, tokens: new Set(normalized.split(' ').filter(Boolean)), records };
  }).sort((left, right) => complaintOrder(left.representative, right.representative));
}

function jaccard(left: Set<string>, right: Set<string>): number {
  let overlap = 0;
  for (const token of left) if (right.has(token)) overlap++;
  const union = left.size + right.size - overlap;
  return union === 0 ? 0 : overlap / union;
}

export function rankProblems(complaints: Complaint[], assessments: Assessment[]): Problem[] {
  const clusters: Evidence[][] = [];
  for (const evidence of deduplicate(complaints)) {
    // Complete-link grouping prevents a chain of similar records from joining dissimilar endpoints.
    const cluster = clusters.find((group) => group.every((member) => jaccard(member.tokens, evidence.tokens) >= 0.65));
    if (cluster) cluster.push(evidence);
    else clusters.push([evidence]);
  }
  const annotations = new Map(assessments.map((assessment) => [assessment.id, assessment]));
  const problems: Problem[] = clusters.map((cluster) => {
    const representative = cluster[0]!;
    const id = `p_${createHash('sha256').update(representative.normalized).digest('hex').slice(0, 16)}`;
    const annotation = annotations.get(id);
    const records = cluster.flatMap((evidence) => evidence.records);
    const kinds = new Set(records.map((record) => record.kind));
    const kind = kinds.size === 1 ? records[0]!.kind : 'mixed';
    const pain = annotation?.pain ?? null;
    const hours = annotation?.hours ?? null;
    const regulated = annotation?.regulated ?? null;
    const hardware = annotation?.hardware ?? null;
    return {
      id, text: representative.representative.text,
      source: [...new Set(records.map((record) => record.source))].sort().join(','),
      mentions: cluster.length, pain, wtp: annotation?.wtp ?? null, gap: annotation?.gap ?? null,
      hours, regulated, hardware, basis: annotation?.basis ?? '',
      evidence_ids: cluster.map((evidence) => evidence.representative.id).sort().join(','),
      kind, score: cluster.length * (pain ?? 0),
      eligible: pain !== null && hours !== null && hours <= 8 && regulated === false && hardware === false && kind === 'live',
    };
  });
  return problems.sort((left, right) => right.score - left.score
    || (right.wtp ?? -1) - (left.wtp ?? -1)
    || (right.gap ?? -1) - (left.gap ?? -1)
    || compare(left.id, right.id));
}
