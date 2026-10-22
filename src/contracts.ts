import { decode, encode } from '@toon-format/toon';

export type Complaint = { id: string; text: string; source: 'hn' | 'reddit' | 'appstore' | 'forum' | 'github'; url: string; collected_at: string; kind: 'live' | 'fixture' };
export type Assessment = { id: string; pain: number; wtp: number | null; gap: number | null; hours: number | null; regulated: boolean | null; hardware: boolean | null; basis: string };
export type Problem = { id: string; text: string; source: string; mentions: number; pain: number | null; wtp: number | null; gap: number | null; hours: number | null; regulated: boolean | null; hardware: boolean | null; basis: string; evidence_ids: string; kind: 'live' | 'fixture' | 'mixed'; score: number; eligible: boolean };
export type Spec = { choice: string; why: string; features: { name: string; priority: 'must' | 'should'; acceptance_test: string }[]; stack: string[]; cuts: string[]; complete: true };

const MAX_INPUT_BYTES = 1_048_576;
const CONTROL = /[\u0000-\u001f\u007f-\u009f]/u;

function record(value: unknown, fields: readonly string[], label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  const found = Object.keys(value);
  if (found.length !== fields.length || fields.some((field) => !Object.hasOwn(value, field))) {
    throw new Error(`${label} must contain exactly: ${fields.join(', ')}`);
  }
  return value as Record<string, unknown>;
}

function string(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0 || CONTROL.test(value)) {
    throw new Error(`${label} must be a nonempty string without control characters`);
  }
}

function identifier(value: unknown, label: string): asserts value is string {
  string(value, label);
  if (!/^[A-Za-z0-9_.:-]{1,128}$/u.test(value)) {
    throw new Error(`${label} must use 1–128 letters, digits, underscores, periods, colons or hyphens`);
  }
}

function number(value: unknown, minimum: number, maximum: number, label: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error(`${label} must be a finite number from ${minimum} to ${maximum}`);
  }
}

function parse(text: string): unknown {
  if (typeof text !== 'string' || Buffer.byteLength(text, 'utf8') > MAX_INPUT_BYTES) {
    throw new Error('TOON input must be a string no larger than 1 MiB');
  }
  const normalized = text.replace(/\r\n/gu, '\n');
  if (normalized.trim().length === 0 || /[\u0000-\u0009\u000b-\u001f\u007f-\u009f]/u.test(normalized)) {
    throw new Error('TOON input is empty or contains control characters');
  }
  if (normalized.includes('```')) throw new Error('TOON input must not contain code fences');
  return decode(normalized, { strict: true, indentSize: 2 });
}

function listRoot(text: string, name: string): unknown[] {
  const root = record(parse(text), [name], 'TOON root');
  if (!Array.isArray(root[name])) throw new Error(`${name} must be an array`);
  return root[name];
}

function evidenceUrl(value: unknown): void {
  string(value, 'url');
  let url: URL;
  try { url = new URL(value); } catch { throw new Error('url must be an absolute HTTPS URL'); }
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) {
    throw new Error('url must be an absolute HTTPS URL without credentials');
  }
}

function isoDate(value: unknown): void {
  string(value, 'collected_at');
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u.exec(value);
  if (!match || !Number.isFinite(Date.parse(value))) throw new Error('collected_at must be an ISO timestamp');
  const [, year, month, day, hour, minute, second] = match;
  const daysInMonth = new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate();
  if (Number(month) < 1 || Number(month) > 12 || Number(day) < 1 || Number(day) > daysInMonth
    || Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59) {
    throw new Error('collected_at must be a valid ISO timestamp');
  }
}

export function decodeComplaints(text: string): Complaint[] {
  return listRoot(text, 'complaints').map((value) => {
    const item = record(value, ['id', 'text', 'source', 'url', 'collected_at', 'kind'], 'Complaint');
    identifier(item.id, 'id');
    string(item.text, 'text');
    if (!['hn', 'reddit', 'appstore', 'forum', 'github'].includes(item.source as string)) throw new Error('Unknown complaint source');
    if (item.kind !== 'live' && item.kind !== 'fixture') throw new Error('Unknown complaint provenance');
    evidenceUrl(item.url);
    isoDate(item.collected_at);
    return item as Complaint;
  });
}

export function decodeAssessments(text: string): Assessment[] {
  const ids = new Set<string>();
  return listRoot(text, 'assessments').map((value) => {
    const item = record(value, ['id', 'pain', 'wtp', 'gap', 'hours', 'regulated', 'hardware', 'basis'], 'Assessment');
    identifier(item.id, 'id');
    if (ids.has(item.id)) throw new Error(`Duplicate assessment id: ${item.id}`);
    ids.add(item.id);
    string(item.basis, 'basis');
    number(item.pain, 1, 10, 'pain');
    for (const field of ['wtp', 'gap']) if (item[field] !== null) number(item[field], 0, 10, field);
    if (item.hours !== null) {
      if (typeof item.hours !== 'number' || !Number.isFinite(item.hours) || item.hours <= 0) {
        throw new Error('hours must be a positive finite number or null');
      }
    }
    for (const field of ['regulated', 'hardware']) {
      if (item[field] !== null && typeof item[field] !== 'boolean') throw new Error(`${field} must be boolean or null`);
    }
    return item as Assessment;
  });
}

export function decodeSpec(text: string, finishReason: string): Spec {
  // The model adapter must supply the provider's normal successful text finish reason.
  // Other providers must explicitly map their successful response to "stop" before this boundary.
  if (finishReason !== 'stop') throw new Error('Model response must finish with stop');
  const item = record(parse(text), ['choice', 'why', 'features', 'stack', 'cuts', 'complete'], 'Spec');
  const lastLine = text.replace(/\r\n/gu, '\n').split('\n').filter((line) => line.trim().length > 0).at(-1);
  if (lastLine !== 'complete: true' || item.complete !== true) throw new Error('Spec must end with complete: true');
  identifier(item.choice, 'choice');
  string(item.why, 'why');
  if (!Array.isArray(item.features) || item.features.length < 5 || item.features.length > 8) {
    throw new Error('Spec must contain five to eight features');
  }
  const names = new Set<string>();
  for (const value of item.features) {
    const feature = record(value, ['name', 'priority', 'acceptance_test'], 'Feature');
    string(feature.name, 'feature name');
    string(feature.acceptance_test, 'acceptance_test');
    if (feature.priority !== 'must' && feature.priority !== 'should') throw new Error('Feature priority must be must or should');
    const name = feature.name.normalize('NFKC').toLowerCase().replace(/\s+/gu, ' ').trim();
    if (names.has(name)) throw new Error('Feature names must be distinct');
    names.add(name);
  }
  for (const field of ['stack', 'cuts']) {
    if (!Array.isArray(item[field]) || item[field].length === 0) throw new Error(`${field} must be a nonempty array`);
    for (const value of item[field]) string(value, field);
  }
  return item as Spec;
}

export function encodeStage(value: unknown): string {
  return encode(value, { indentSize: 2 });
}
