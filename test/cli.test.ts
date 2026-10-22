import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync, writeFileSync, openSync, closeSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Ledger } from '../src/ledger.ts';

const cli=(args:string[])=>spawnSync(process.execPath,['src/cli.ts',...args],{cwd:process.cwd(),encoding:'utf8',timeout:10_000});
test('offline CLI demo is reproducible and stops at honest human selection gate',()=>{
  const root=mkdtempSync(join(tmpdir(),'pipeline-cli-'));
  try{
    const result=cli(['demo','--run',join(root,'run')]);
    assert.equal(result.status,0,result.stderr);
    const status=JSON.parse(result.stdout);
    assert.equal(status.next_gate,'human_selection');assert.equal(status.real_users,0);assert.equal(status.live_records,0);
    assert.ok(status.problems.length>=2);assert.equal(status.problems[0].eligible,false);
    const selected=cli(['select','--run',join(root,'run'),'--id',status.problems[0].id,'--by','human','--reason','test']);
    assert.equal(selected.status,1);assert.match(selected.stderr,/eligible/i);
    const reread=cli(['status','--run',join(root,'run')]);assert.equal(JSON.parse(reread.stdout).failures,1);
    assert.equal(cli(['demo','--run',join(root,'run')]).status,1,'demo must never overwrite an existing run');
  }finally{rmSync(root,{recursive:true,force:true});}
});
test('help and invalid commands do not create run state',()=>{
  const root=mkdtempSync(join(tmpdir(),'pipeline-help-')),run=join(root,'not-created');
  try{
    assert.equal(cli(['help','--run',run]).status,0);assert.equal(existsSync(run),false);
    assert.equal(cli(['does-not-exist','--run',run]).status,1);assert.equal(existsSync(run),false);
  }finally{rmSync(root,{recursive:true,force:true});}
});

test('malformed command input leaves a failure receipt',()=>{
  const root=mkdtempSync(join(tmpdir(),'pipeline-cli-error-')),run=join(root,'run'),bad=join(root,'bad.json');
  try{
    writeFileSync(bad,'{truncated');
    assert.equal(cli(['user','--run',run,'--file',bad]).status,1);
    const status=cli(['status','--run',run]);assert.equal(status.status,0,status.stderr);
    assert.equal(JSON.parse(status.stdout).failures,1);
  }finally{rmSync(root,{recursive:true,force:true});}
});

test('another writer cannot hide a CLI file parsing failure',async()=>{
  const root=mkdtempSync(join(tmpdir(),'pipeline-cli-race-')),run=join(root,'run'),pipe=join(root,'input');
  try{
    assert.equal(spawnSync('mkfifo',[pipe]).status,0);
    const child=spawn(process.execPath,['src/cli.ts','user','--run',run,'--file',pipe],{cwd:process.cwd(),stdio:'ignore'});
    const done=new Promise<number|null>(resolve=>child.once('close',resolve));
    const fd=openSync(pipe,'w'); // open rendezvous proves the child is blocked reading the FIFO
    new Ledger(run).append('unrelated.event',{});
    writeFileSync(fd,'{truncated');closeSync(fd);
    assert.equal(await done,1);
    assert.equal(new Ledger(run).read().filter(e=>e.type==='operation.failed').length,1);
  }finally{rmSync(root,{recursive:true,force:true});}
});
