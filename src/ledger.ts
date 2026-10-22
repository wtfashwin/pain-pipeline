import { createHash, randomUUID } from 'node:crypto';
import { chmodSync, closeSync, fchmodSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export interface Event {
  seq: number;
  id: string;
  at: string;
  type: string;
  payload: any;
  previous: string;
  hash: string;
}

/** A JSON encoding with recursively sorted object keys and no lossy conversions. */
function canonical(value: unknown, ancestors = new Set<object>()): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (typeof value !== 'object' || ancestors.has(value)) throw new Error('Invalid ledger payload: expected finite JSON values');
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      if (Reflect.ownKeys(value).length !== value.length + 1) throw new Error('Invalid ledger payload: expected a JSON array');
      const items: string[] = [];
      for (let index = 0; index < value.length; index++) {
        const field = Object.getOwnPropertyDescriptor(value, String(index));
        if (!field || !('value' in field)) throw new Error('Invalid ledger payload: expected a JSON array');
        items.push(canonical(field.value, ancestors));
      }
      return `[${items.join(',')}]`;
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) throw new Error('Invalid ledger payload: expected a plain JSON object');
    const fields = Object.getOwnPropertyDescriptors(value);
    if (Reflect.ownKeys(fields).some((key) => typeof key !== 'string')) throw new Error('Invalid ledger payload: expected string keys');
    return `{${Object.keys(fields).sort().map((key) => {
      const field = fields[key]!;
      if (!field.enumerable || !('value' in field)) throw new Error('Invalid ledger payload: expected JSON properties');
      return `${JSON.stringify(key)}:${canonical(field.value, ancestors)}`;
    }).join(',')}}`;
  } finally {
    ancestors.delete(value);
  }
}

function hash(event: Omit<Event, 'hash'>): string {
  return createHash('sha256').update(canonical(event)).digest('hex');
}

function code(error: unknown): string | undefined {
  return (error as NodeJS.ErrnoException | undefined)?.code;
}

const fields = ['at', 'hash', 'id', 'payload', 'previous', 'seq', 'type'];
const digest = /^[a-f0-9]{64}$/;

/** Detects accidental edits and suffix loss; rewriting both the ledger and head can defeat it. */
export class Ledger {
  private readonly root: string;
  private readonly path: string;
  private readonly lock: string;
  private readonly head: string;

  constructor(root: string) {
    this.root = root;
    this.path = join(root, 'events.jsonl');
    this.lock = join(root, '.ledger.lock');
    this.head = join(root, 'head.json');
  }

  read(): Event[] {
    let content = '';
    try {
      content = readFileSync(this.path, 'utf8');
    } catch (error) {
      if (code(error) !== 'ENOENT') throw new Error('Unable to read ledger');
    }
    if (content === '') {
      this.verifyHead([]);
      return [];
    }
    if (!content.endsWith('\n')) throw new Error('Ledger is incomplete: final record must end with a newline');
    const lines = content.slice(0, -1).split('\n');
    const events: Event[] = [];
    for (const [index, line] of lines.entries()) {
      const problem = (reason: string) => new Error(`Ledger is corrupt at record ${index + 1}: ${reason}`);
      if (!line.trim()) throw problem('empty line');
      let event: Event;
      try { event = JSON.parse(line) as Event; } catch { throw problem('invalid JSON'); }
      if (!event || typeof event !== 'object' || Array.isArray(event) ||
          Object.keys(event).sort().join(',') !== fields.join(',') ||
          !Number.isSafeInteger(event.seq) || event.seq !== index + 1 ||
          typeof event.id !== 'string' || !event.id.trim() ||
          typeof event.at !== 'string' || !Number.isFinite(Date.parse(event.at)) ||
          new Date(event.at).toISOString() !== event.at ||
          typeof event.type !== 'string' || !event.type.trim() ||
          typeof event.previous !== 'string' || event.previous !== (events.at(-1)?.hash ?? '') ||
          typeof event.hash !== 'string' || !digest.test(event.hash)) {
        throw problem('invalid fields or sequence');
      }
      let expected: string;
      try {
        const { hash: _hash, ...body } = event;
        expected = hash(body);
      } catch { throw problem('invalid JSON payload'); }
      if (event.hash !== expected) throw problem('hash mismatch');
      events.push(event);
    }
    this.verifyHead(events);
    return events;
  }

  private verifyHead(events: Event[]): void {
    let content: string;
    try { content = readFileSync(this.head, 'utf8'); } catch (error) {
      if (code(error) === 'ENOENT' && events.length === 0) return;
      throw new Error('Ledger head checkpoint is missing or unreadable; manual recovery required');
    }
    let head: unknown;
    try { head = JSON.parse(content); } catch { throw new Error('Ledger head checkpoint is invalid; manual recovery required'); }
    if (!head || typeof head !== 'object' || Array.isArray(head) ||
        Object.keys(head).sort().join(',') !== 'hash,seq') {
      throw new Error('Ledger head checkpoint is invalid; manual recovery required');
    }
    const checkpoint = head as { seq: unknown; hash: unknown };
    const last = events.at(-1);
    if (!Number.isSafeInteger(checkpoint.seq) || checkpoint.seq !== events.length ||
        typeof checkpoint.hash !== 'string' || checkpoint.hash !== (last?.hash ?? '')) {
      throw new Error('Ledger head checkpoint does not match the ledger; manual recovery required');
    }
  }

  private writeHead(event: Event): void {
    const temporary = join(this.root, `.ledger-head-${randomUUID()}.tmp`);
    let file: number | undefined;
    let directory: number | undefined;
    let created = false;
    try {
      file = openSync(temporary, 'wx', 0o600);
      created = true;
      writeFileSync(file, `${JSON.stringify({ seq: event.seq, hash: event.hash })}\n`, 'utf8');
      fsyncSync(file);
      closeSync(file);
      file = undefined;
      renameSync(temporary, this.head);
      created = false;
      directory = openSync(this.root, 'r');
      fsyncSync(directory);
    } finally {
      try {
        if (file !== undefined) closeSync(file);
      } finally {
        try { if (directory !== undefined) closeSync(directory); }
        finally { if (created) unlinkSync(temporary); }
      }
    }
  }

  append(type: string, payload: unknown, expectedPrevious?: string): Event {
    try {
      mkdirSync(this.root, { recursive: true, mode: 0o700 });
      chmodSync(this.root, 0o700);
    } catch { throw new Error('Unable to prepare ledger directory'); }
    let lock: number;
    try { lock = openSync(this.lock, 'wx', 0o600); } catch (error) {
      if (code(error) === 'EEXIST') throw new Error('Ledger is locked by another writer; inspect .ledger.lock before retrying');
      throw new Error('Unable to acquire ledger writer lock');
    }
    try {
      const existing = this.read();
      if (expectedPrevious !== undefined && expectedPrevious !== (existing.at(-1)?.hash ?? '')) {
        throw new Error('Ledger changed since the snapshot was read; stale conditional append rejected');
      }
      if (typeof type !== 'string' || !type.trim()) throw new Error('Invalid ledger event type: expected a nonempty string');
      let serialized: string;
      try { serialized = canonical(payload); } catch { throw new Error('Invalid ledger payload: expected finite JSON values'); }
      const body = {
        seq: existing.length + 1,
        id: randomUUID(),
        at: new Date().toISOString(),
        type,
        payload: JSON.parse(serialized),
        previous: existing.at(-1)?.hash ?? '',
      };
      const event: Event = { ...body, hash: hash(body) };
      let file: number | undefined;
      try {
        file = openSync(this.path, 'a', 0o600);
        fchmodSync(file, 0o600);
        writeFileSync(file, `${canonical(event)}\n`, 'utf8');
        fsyncSync(file);
        this.writeHead(event);
      } catch { throw new Error('Unable to append ledger event; verify the ledger before retrying'); }
      finally { if (file !== undefined) closeSync(file); }
      return event;
    } finally {
      try { closeSync(lock); } finally { unlinkSync(this.lock); }
    }
  }
}
