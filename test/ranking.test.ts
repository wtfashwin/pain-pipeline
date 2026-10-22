import assert from 'node:assert/strict';
import test from 'node:test';
import type { Assessment, Complaint, Problem } from '../src/contracts.ts';
import { rankProblems } from '../src/ranking.ts';

function complaint(id: string, text: string, patch: Partial<Complaint> = {}): Complaint {
  return { id, text, source: 'hn', url: `https://example.com/${id}`, collected_at: '2026-10-22T00:00:00Z', kind: 'live', ...patch };
}

function assessment(problem: Problem, patch: Partial<Assessment> = {}): Assessment {
  return { id: problem.id, pain: 8, wtp: null, gap: null, hours: 8, regulated: false, hardware: false,
    basis: 'The linked complaints document recurring manual repair.', ...patch };
}

test('deduplicates IDs, URLs, normalized exact copies and reimports before counting mentions', () => {
  const original = complaint('a', 'Invoice exports fail every Friday');
  const similar = complaint('b', 'Invoice exports fail every single Friday', { source: 'forum' });
  const evidence = [original, similar,
    { ...original, text: 'Changed text from an already imported record' },
    complaint('url-copy', 'A syndicated record', { url: original.url }),
    complaint('exact-copy', '  INVOICE exports FAIL every Friday!!!  '),
  ];
  const once = rankProblems(evidence, []);
  assert.equal(once.length, 1);
  assert.equal(once[0]?.mentions, 2);
  assert.equal(once[0]?.source, 'forum,hn');
  assert.equal(once[0]?.evidence_ids.split(',').length, 2);
  assert.deepEqual(rankProblems([...evidence, ...evidence], []), once);
  assert.deepEqual(rankProblems([...evidence, ...Array.from({ length: 10 }, () => evidence[2]!)], []), once);
  assert.deepEqual(rankProblems([...evidence].reverse(), []), once);
});

test('clusters only token-similar complaints and uses stable representative IDs', () => {
  const evidence = [
    complaint('a', 'Invoice exports fail every Friday'),
    complaint('b', 'Invoice exports fail every single Friday'),
    complaint('c', 'Calendar reminders arrive late on Mondays'),
  ];
  const problems = rankProblems(evidence, []);
  assert.deepEqual(problems.map((problem) => problem.mentions).sort(), [1, 2]);
  assert.equal(problems.every((problem) => /^p_[a-f0-9]+$/.test(problem.id)), true);
  assert.deepEqual(rankProblems([...evidence].reverse(), []), problems);
  const normalized = rankProblems([complaint('z', '  INVOICE exports FAIL every Friday!!! ')], [])[0];
  const original = rankProblems([evidence[0]!], [])[0];
  assert.equal(normalized?.id, original?.id);
});

test('does not bridge dissimilar complaints through a similarity chain', () => {
  // A/B and B/C each have Jaccard 2/3; A/C has only 1/3.
  const evidence = [complaint('a', 'alpha bravo'), complaint('b', 'alpha bravo charlie'), complaint('c', 'bravo charlie')];
  assert.deepEqual(rankProblems(evidence, []).map((problem) => problem.mentions).sort(), [1, 2]);
});

test('keeps missing annotations visible and unknown pain at score zero', () => {
  const problem = rankProblems([complaint('a', 'Invoice exports fail every Friday')], [])[0]!;
  assert.equal(problem.pain, null);
  assert.equal(problem.wtp, null);
  assert.equal(problem.gap, null);
  assert.equal(problem.hours, null);
  assert.equal(problem.regulated, null);
  assert.equal(problem.hardware, null);
  assert.equal(problem.basis, '');
  assert.equal(problem.score, 0);
  assert.equal(problem.eligible, false);
});

test('uses annotations only for their matching problem ID', () => {
  const evidence = [complaint('a', 'Invoice exports fail every Friday')];
  const problem = rankProblems(evidence, [])[0]!;
  const annotated = rankProblems(evidence, [assessment(problem), { ...assessment(problem), id: 'p_other', pain: 1 }])[0]!;
  assert.equal(annotated.score, 8);
  assert.equal(annotated.eligible, true);
  assert.equal(annotated.basis, 'The linked complaints document recurring manual repair.');
});

test('blocks regulated, hardware, over-eight-hour and unknown scope work', () => {
  const evidence = [complaint('a', 'Invoice exports fail every Friday')];
  const problem = rankProblems(evidence, [])[0]!;
  for (const patch of [
    { regulated: true }, { hardware: true }, { hours: 8.01 },
    { regulated: null }, { hardware: null }, { hours: null },
  ]) assert.equal(rankProblems(evidence, [assessment(problem, patch)])[0]?.eligible, false);
  assert.equal(rankProblems(evidence, [assessment(problem, { hours: 8 })])[0]?.eligible, true);
});

test('fixture and mixed clusters stay blocked, including duplicate-copy provenance collisions', () => {
  for (const evidence of [
    [complaint('a', 'Invoice exports fail every Friday', { kind: 'fixture' })],
    [complaint('a', 'Invoice exports fail every Friday'), complaint('b', 'Invoice exports fail every single Friday', { kind: 'fixture' })],
    [complaint('a', 'Invoice exports fail every Friday'), complaint('copy', 'Invoice exports fail every Friday', { kind: 'fixture' })],
  ]) {
    const problem = rankProblems(evidence, [])[0]!;
    const ranked = rankProblems(evidence, [assessment(problem)])[0]!;
    assert.equal(ranked.eligible, false);
    assert.equal(ranked.kind, evidence.length === 1 ? 'fixture' : 'mixed');
  }
});

test('ranks by mentions times pain, then willingness to pay, then gap', () => {
  const evidence = [
    complaint('a', 'Invoice exports fail every Friday'),
    complaint('a2', 'Invoice exports fail every single Friday'),
    complaint('b', 'Calendar reminders arrive late every Monday'),
    complaint('c', 'Photo imports lose metadata after upload'),
    complaint('d', 'Tax calculations need expensive licensed hardware'),
  ];
  const problems = rankProblems(evidence, []);
  const find = (id: string) => problems.find((problem) => problem.evidence_ids.split(',').includes(id))!;
  const ranked = rankProblems(evidence, [
    assessment(find('a'), { pain: 5, wtp: 2, gap: 10 }),
    assessment(find('b'), { pain: 10, wtp: 3, gap: 1 }),
    assessment(find('c'), { pain: 10, wtp: 3, gap: 9 }),
    assessment(find('d'), { pain: 9, wtp: 10, gap: 10 }),
  ]);
  assert.deepEqual(ranked.map((problem) => problem.evidence_ids), ['c', 'b', 'a,a2', 'd']);
  assert.deepEqual(ranked.map((problem) => problem.score), [10, 10, 10, 9]);
});
