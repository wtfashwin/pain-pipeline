import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { Ledger } from '../src/ledger.ts';

test('conditional append refuses a snapshot changed by another writer',()=>{
  const root=mkdtempSync(join(tmpdir(),'pipeline-cas-'));
  try{
    const ledger=new Ledger(root),first=ledger.append('first',{});ledger.append('second',{});
    assert.throws(()=>ledger.append('stale',{},first.hash),/changed|stale/i);
    assert.equal(ledger.read().length,2);
  }finally{rmSync(root,{recursive:true,force:true});}
});

test('conditional append accepts only the current head including an empty initial snapshot', (t) => {
  const root = temporaryRoot(t);
  const ledger = new Ledger(root);
  const first = ledger.append('one', {}, '');
  assert.throws(() => ledger.append('stale-empty', {}, ''), /changed|stale/i);
  const second = ledger.append('two', {}, first.hash);
  assert.equal(second.seq, 2);
  assert.deepEqual(ledger.read(), [first, second]);
  assert.equal(existsSync(join(root, '.ledger.lock')), false);
});

test('deleting a complete final event cannot silently reuse its sequence', (t) => {
  const root = temporaryRoot(t);
  const ledger = new Ledger(root);
  const first = ledger.append('one', {});
  ledger.append('two', {});
  const file = join(root, 'events.jsonl');
  const prefix = `${JSON.stringify(first)}\n`;
  writeFileSync(file, prefix);
  assert.throws(() => ledger.read(), /head|checkpoint/i);
  assert.throws(() => ledger.append('replacement', {}), /head|checkpoint/i);
  assert.equal(readFileSync(file, 'utf8'), prefix);
  assert.equal(existsSync(join(root, '.ledger.lock')), false);
});

test('a private head checkpoint binds the whole ledger and fails closed if missing, stale or corrupt', (t) => {
  const root = temporaryRoot(t);
  const ledger = new Ledger(root);
  const first = ledger.append('one', {});
  const checkpoint = join(root, 'head.json');
  const firstHead = readFileSync(checkpoint, 'utf8');
  assert.deepEqual(JSON.parse(firstHead), { seq: first.seq, hash: first.hash });
  assert.equal(statSync(checkpoint).mode & 0o777, 0o600);
  const second = ledger.append('two', {});
  const currentHead = readFileSync(checkpoint, 'utf8');
  assert.deepEqual(JSON.parse(currentHead), { seq: second.seq, hash: second.hash });
  for (const damaged of [firstHead, 'not-json-secret', '{"seq":2}',
    JSON.stringify({ seq: 2, hash: second.hash, extra: true }),
    JSON.stringify({ seq: 2, hash: 'x'.repeat(64) })]) {
    writeFileSync(checkpoint, damaged);
    assert.throws(() => ledger.read(), (error: Error) => /head|checkpoint/i.test(error.message) && !error.message.includes('not-json-secret'));
  }
  unlinkSync(checkpoint);
  assert.throws(() => ledger.read(), /head|checkpoint/i);
  assert.throws(() => ledger.append('three', {}), /head|checkpoint/i);
  writeFileSync(checkpoint, currentHead, { mode: 0o600 });
  assert.deepEqual(ledger.read(), [first, second]);
});

test('deleting or emptying every event is rejected while its checkpoint remains', (t) => {
  const root = temporaryRoot(t);
  const ledger = new Ledger(root);
  ledger.append('one', {});
  const file = join(root, 'events.jsonl');
  writeFileSync(file, '');
  assert.throws(() => ledger.read(), /head|checkpoint/i);
  unlinkSync(file);
  assert.throws(() => ledger.read(), /head|checkpoint/i);
  assert.throws(() => ledger.append('replacement', {}), /head|checkpoint/i);
  assert.equal(existsSync(file), false);
});

function temporaryRoot(t: { after(fn: () => void): void }): string {
  const parent = mkdtempSync(join(tmpdir(), 'pain-ledger-'));
  t.after(() => rmSync(parent, { recursive: true, force: true }));
  return join(parent, 'state');
}

test('a missing ledger reads as empty and append persists a linked sequence privately', (t) => {
  const root = temporaryRoot(t);
  const ledger = new Ledger(root);
  assert.deepEqual(ledger.read(), []);
  assert.equal(existsSync(root), false);
  const first = ledger.append('imported', { source: 'fixture', count: 2 });
  const second = new Ledger(root).append('ranked', ['problem-1']);
  assert.equal(first.seq, 1);
  assert.equal(first.previous, '');
  assert.equal(second.seq, 2);
  assert.equal(second.previous, first.hash);
  assert.notEqual(first.id, second.id);
  assert.equal(new Date(first.at).toISOString(), first.at);
  assert.deepEqual(new Ledger(root).read(), [first, second]);
  assert.equal(readFileSync(join(root, 'events.jsonl'), 'utf8').split('\n').length, 3);
  assert.equal(statSync(root).mode & 0o777, 0o700);
  assert.equal(statSync(join(root, 'events.jsonl')).mode & 0o777, 0o600);
  assert.equal(existsSync(join(root, '.ledger.lock')), false);
});

test('hashes use stable recursive JSON ordering rather than object insertion order', (t) => {
  const root = temporaryRoot(t);
  const event = new Ledger(root).append('recorded', { z: [{ y: 2, a: 1 }], a: { z: false, a: null } });
  const canonical = JSON.stringify({
    at: event.at,
    id: event.id,
    payload: { a: { a: null, z: false }, z: [{ a: 1, y: 2 }] },
    previous: '',
    seq: 1,
    type: 'recorded',
  });
  assert.equal(event.hash, createHash('sha256').update(canonical).digest('hex'));
  const reordered = { hash: event.hash, type: event.type, seq: event.seq, previous: event.previous,
    payload: { a: { a: null, z: false }, z: [{ a: 1, y: 2 }] }, id: event.id, at: event.at };
  writeFileSync(join(root, 'events.jsonl'), `${JSON.stringify(reordered)}\n`);
  assert.deepEqual(new Ledger(root).read(), [event]);
});

test('payload edits are rejected before reading or appending without changing the damaged ledger', (t) => {
  const root = temporaryRoot(t);
  const ledger = new Ledger(root);
  ledger.append('imported', { secret: 'not-for-errors', count: 2 });
  const file = join(root, 'events.jsonl');
  const damaged = readFileSync(file, 'utf8').replace('"count":2', '"count":3');
  writeFileSync(file, damaged);
  for (const action of [() => ledger.read(), () => ledger.append('ranked', {})]) {
    assert.throws(action, (error: Error) => /ledger|hash/i.test(error.message) && !error.message.includes('not-for-errors'));
  }
  assert.equal(readFileSync(file, 'utf8'), damaged);
  assert.equal(existsSync(join(root, '.ledger.lock')), false);
});

test('missing middle events and changed sequence numbers are rejected', (t) => {
  const root = temporaryRoot(t);
  const ledger = new Ledger(root);
  const events = [ledger.append('one', {}), ledger.append('two', {}), ledger.append('three', {})];
  const file = join(root, 'events.jsonl');
  writeFileSync(file, `${JSON.stringify(events[0])}\n${JSON.stringify(events[2])}\n`);
  assert.throws(() => ledger.read(), /sequence|ledger/i);
  writeFileSync(file, `${JSON.stringify({ ...events[0], seq: 0 })}\n`);
  assert.throws(() => ledger.read(), /sequence|ledger/i);
});

test('incomplete records, blank lines, malformed JSON and invalid event fields fail closed', (t) => {
  const root = temporaryRoot(t);
  const ledger = new Ledger(root);
  const event = ledger.append('valid', {});
  const file = join(root, 'events.jsonl');
  const invalid = [
    JSON.stringify(event),
    `${JSON.stringify(event).slice(0, -3)}\n`,
    `${JSON.stringify(event)}\n\n`,
    '\n',
    'not-json-secret\n',
    'null\n',
    `${JSON.stringify({ ...event, id: '' })}\n`,
    `${JSON.stringify({ ...event, at: 'yesterday' })}\n`,
    `${JSON.stringify({ ...event, type: '' })}\n`,
    `${JSON.stringify({ ...event, previous: 'wrong' })}\n`,
    `${JSON.stringify({ ...event, hash: 'x'.repeat(64) })}\n`,
    `${JSON.stringify({ ...event, extra: true })}\n`,
  ];
  for (const content of invalid) {
    writeFileSync(file, content);
    assert.throws(() => ledger.read(), (error: Error) => /ledger/i.test(error.message) && !error.message.includes('not-json-secret'));
  }
});

test('invalid payloads and event types leave no partial record or retained lock', (t) => {
  const root = temporaryRoot(t);
  const ledger = new Ledger(root);
  const first = ledger.append('one', {});
  const cycle: Record<string, unknown> = {};
  cycle.self = cycle;
  const invalid = [undefined, NaN, Infinity, -Infinity, { bad: undefined }, [undefined], [,],
    { bad: () => 1 }, { bad: Symbol('secret') }, 1n, cycle, new Date()];
  for (const payload of invalid) {
    assert.throws(() => ledger.append('invalid', payload), /payload|JSON/i);
    assert.deepEqual(ledger.read(), [first]);
    assert.equal(existsSync(join(root, '.ledger.lock')), false);
  }
  for (const type of ['', '  ', undefined, 4]) {
    assert.throws(() => ledger.append(type as string, {}), /type/i);
  }
  const second = ledger.append('recovered', { okay: true });
  assert.equal(second.seq, 2);
  assert.deepEqual(ledger.read(), [first, second]);
});

test('a live competing writer cannot have its lock removed or its ledger silently overwritten', async (t) => {
  const root = temporaryRoot(t);
  const ledger = new Ledger(root);
  const first = ledger.append('one', {});
  const worker = fork('-e', [
    `const fs = require('node:fs'); const path = require('node:path');
     const file = path.join(process.argv[1], '.ledger.lock');
     const fd = fs.openSync(file, 'wx', 0o600);
     process.send('locked');
     process.on('message', () => { fs.closeSync(fd); fs.unlinkSync(file); process.exit(0); });`, root,
  ], { execArgv: [], stdio: ['ignore', 'ignore', 'pipe', 'ipc'] });
  t.after(() => { if (!worker.killed) worker.kill(); });
  await once(worker, 'message');
  assert.throws(() => ledger.append('blocked', {}), /lock.*writer|writer.*lock/i);
  assert.equal(existsSync(join(root, '.ledger.lock')), true);
  assert.deepEqual(ledger.read(), [first]);
  worker.send('release');
  await once(worker, 'exit');
  assert.equal(ledger.append('two', {}).seq, 2);
});
