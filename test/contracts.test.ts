import assert from 'node:assert/strict';
import test from 'node:test';
import { encode } from '@toon-format/toon';
import { decodeAssessments, decodeComplaints, decodeSpec, encodeStage } from '../src/contracts.ts';

const complaint = {
  id: 'hn_1', text: 'Invoice exports fail every Friday', source: 'hn',
  url: 'https://news.ycombinator.com/item?id=1', collected_at: '2026-10-22T00:00:00.000Z', kind: 'live',
};
const assessment = {
  id: 'p_example', pain: 8, wtp: null, gap: 4, hours: 8,
  regulated: false, hardware: false, basis: 'The linked complaints describe weekly manual repair.',
};
const spec = {
  choice: 'p_example', why: 'Five users reported recurring export failures.',
  features: [
    { name: 'Import', priority: 'must', acceptance_test: 'A valid file loads.' },
    { name: 'Validate', priority: 'must', acceptance_test: 'A missing column fails clearly.' },
    { name: 'Preview', priority: 'must', acceptance_test: 'The first rows are shown.' },
    { name: 'Export', priority: 'must', acceptance_test: 'A corrected file downloads.' },
    { name: 'History', priority: 'should', acceptance_test: 'A prior result reopens.' },
  ],
  stack: ['Node', 'SQLite'], cuts: ['Billing'], complete: true,
};

test('decodes complaint evidence and preserves its live provenance', () => {
  const text = 'complaints[1]{id,text,source,url,collected_at,kind}:\n  hn_1,Invoice exports fail every Friday,hn,https://news.ycombinator.com/item?id=1,2026-10-22T00:00:00.000Z,live';
  assert.deepEqual(decodeComplaints(text), [complaint]);
  assert.deepEqual(decodeComplaints('complaints[0]:'), []);
});

test('imports GitHub issue evidence with its original URL and live provenance', () => {
  const issue = {
    id: 'github:example:widget:42', text: 'Invoice exports fail every Friday', source: 'github',
    url: 'https://github.com/example/widget/issues/42', collected_at: '2026-10-22T00:00:00.000Z', kind: 'live',
  };
  const text = 'complaints[1]{id,text,source,url,collected_at,kind}:\n  "github:example:widget:42",Invoice exports fail every Friday,github,https://github.com/example/widget/issues/42,2026-10-22T00:00:00.000Z,live';
  assert.deepEqual(decodeComplaints(text), [issue]);
});

test('rejects malformed counts, indentation, extra keys and fenced responses', () => {
  const valid = encode({ complaints: [complaint] });
  for (const text of [
    valid.replace('[1]', '[2]'),
    valid.replace('\n  ', '\n   '),
    valid.replace('\n  ', '\n    '),
    `${valid}\nextra: true`,
    `${valid}\ncomplaints[0]:`,
    `\`\`\`toon\n${valid}\n\`\`\``,
    encode({ complaints: [{ ...complaint, author: 'unrequested' }] }),
    encode({ complaints: [{ ...complaint, kind: undefined }] }),
    'complaints: not-an-array',
  ]) assert.throws(() => decodeComplaints(text));
});

test('validates complaint string fields, source, evidence URL and ISO collection time', () => {
  for (const patch of [
    { id: '' }, { text: '  ' }, { text: 'bad\ntext' }, { text: 'bad\u0000text' },
    { source: 'twitter' }, { source: null }, { kind: 'proposed' },
    { url: '/relative' }, { url: 'http://example.com/a' }, { url: 'https://user:secret@example.com/a' },
    { collected_at: 'yesterday' }, { collected_at: '2026-02-30T00:00:00Z' }, { collected_at: 123 },
  ]) assert.throws(() => decodeComplaints(encode({ complaints: [{ ...complaint, ...patch }] })));
});

test('bounds TOON input by UTF-8 bytes and rejects raw control characters', () => {
  assert.throws(() => decodeComplaints(`complaints[0]:\n${' '.repeat(1_048_577)}`));
  assert.throws(() => decodeComplaints(`complaints[0]:\n${'é'.repeat(524_289)}`));
  assert.throws(() => decodeComplaints('complaints[0]:\u0000'));
  assert.throws(() => decodeComplaints(encode({ complaints: [{ ...complaint, text: 'bad\u007ftext' }] })));
});

test('decodes bounded assessments with unknown annotations explicit as null', () => {
  assert.deepEqual(decodeAssessments(encode({ assessments: [assessment] })), [assessment]);
  const unknown = { ...assessment, wtp: null, gap: null, hours: null, regulated: null, hardware: null };
  assert.deepEqual(decodeAssessments(encode({ assessments: [unknown] })), [unknown]);
});

test('rejects invalid assessment envelopes, duplicate IDs and invented types', () => {
  for (const text of [
    encode({ assessments: [assessment, assessment] }),
    encode({ assessment: [assessment] }),
    encode({ assessments: [{ ...assessment, extra: true }] }),
    encode({ assessments: [{ ...assessment, basis: undefined }] }),
  ]) assert.throws(() => decodeAssessments(text));
  for (const patch of [
    { id: '' }, { pain: 0 }, { pain: 11 }, { pain: null }, { pain: '8' },
    { wtp: -1 }, { wtp: 11 }, { gap: -1 }, { gap: 11 },
    { hours: 0 }, { hours: -2 }, { regulated: 'false' }, { hardware: 0 },
    { basis: '' }, { basis: '   ' }, { basis: 'line\nbreak' },
  ]) assert.throws(() => decodeAssessments(encode({ assessments: [{ ...assessment, ...patch }] })));
});

test('requires a successful model envelope and final completion marker for specs', () => {
  const valid = encode(spec);
  assert.deepEqual(decodeSpec(valid, 'stop'), spec);
  assert.deepEqual(decodeSpec(`${valid}\n\n`, 'stop'), spec);
  for (const reason of ['', 'length', 'content_filter', 'tool_calls', 'completed']) {
    assert.throws(() => decodeSpec(valid, reason));
  }
  for (const text of [
    valid.replace('\ncomplete: true', ''),
    valid.replace('complete: true', 'complete: false'),
    `complete: true\n${valid.replace('\ncomplete: true', '')}`,
    `${valid}\nextra: 1`,
    `\`\`\`toon\n${valid}\n\`\`\``,
    valid.replace('features[5]', 'features[6]'),
  ]) assert.throws(() => decodeSpec(text, 'stop'));
});

test('requires exact spec fields and five to eight distinct tested features', () => {
  for (const patch of [
    { choice: '' }, { why: ' ' }, { extra: 1 }, { complete: 'true' },
    { features: spec.features.slice(0, 4) },
    { features: [...spec.features, ...spec.features] },
    { features: spec.features.map((feature) => ({ ...feature, name: 'Repeated' })) },
    { features: [{ ...spec.features[0], priority: 'optional' }, ...spec.features.slice(1)] },
    { features: [{ ...spec.features[0], acceptance_test: '' }, ...spec.features.slice(1)] },
    { features: [{ ...spec.features[0], extra: true }, ...spec.features.slice(1)] },
    { stack: [] }, { stack: [''] }, { cuts: [] }, { cuts: [null] },
  ]) assert.throws(() => decodeSpec(encode({ ...spec, ...patch }), 'stop'));
  const eight = { ...spec, features: [...spec.features,
    { name: 'Undo', priority: 'should', acceptance_test: 'A change can be reverted.' },
    { name: 'Search', priority: 'should', acceptance_test: 'A row can be found.' },
    { name: 'Help', priority: 'should', acceptance_test: 'The import format is explained.' },
  ] };
  assert.equal(decodeSpec(encode(eight), 'stop').features.length, 8);
});

test('encodes stage data as strict two-space TOON', () => {
  const text = encodeStage({ complaints: [complaint] });
  assert.equal(text.split('\n')[1]?.startsWith('  hn_1,'), true);
  assert.deepEqual(decodeComplaints(text), [complaint]);
});

test('rejects ambiguous or unbounded identifiers before they reach CSV evidence lists', () => {
  for (const id of ['a,b', 'a b', 'a/b', 'a'.repeat(129)]) {
    assert.throws(() => decodeComplaints(encode({ complaints: [{ ...complaint, id }] })));
    assert.throws(() => decodeAssessments(encode({ assessments: [{ ...assessment, id }] })));
    assert.throws(() => decodeSpec(encode({ ...spec, choice: id }), 'stop'));
  }
});
