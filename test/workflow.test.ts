import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Pipeline } from '../src/workflow.ts';
import { encodeStage } from '../src/contracts.ts';

function setup(kind:'live'|'fixture'='live') {
  const root=mkdtempSync(join(tmpdir(),'pipeline-flow-')),p=new Pipeline(join(root,'run'));
  p.importComplaints(encodeStage({complaints:[{id:'hn_1',text:'CSV export fails with commas',source:'hn',url:'https://news.ycombinator.com/item?id=1',collected_at:'2026-10-22T15:00:00.000Z',kind}]}),'test-only authorized input');
  const id=p.rank()[0].id;
  p.assess(encodeStage({assessments:[{id,pain:8,wtp:null,gap:null,hours:4,regulated:false,hardware:false,basis:'Test fixture for workflow behavior only'}]}));
  p.rank();
  return {root,p,id,cleanup:()=>rmSync(root,{recursive:true,force:true})};
}
function users(p:Pipeline,count=5){for(let i=0;i<count;i++)p.addUser({id:`person-${i}`,reference:`test-note:${i}`,kind:'live',observed_at:'2026-10-22T15:00:00Z',observation:'committed_trial'});}
function spec(choice:string){return encodeStage({choice,why:'Test CSV utility',features:Array.from({length:5},(_,i)=>({name:`Feature ${i+1}`,priority:'must',acceptance_test:`Given input ${i+1}, returns output ${i+1}`})),stack:['Node24'],cuts:['No cloud storage'],complete:true});}

test('four people, duplicate records and fixture people cannot open spec gate',()=>{
  const x=setup();try{
    x.p.select(x.id,'human-reviewer','Scope reviewed');users(x.p,4);
    x.p.addUser({id:'person-0',reference:'test-note:0',kind:'live',observed_at:'2026-10-22T15:00:00Z',observation:'committed_trial'});
    x.p.addUser({id:'fixture-5',reference:'fixture:5',kind:'fixture',observed_at:'2026-10-22T15:00:00Z',observation:'committed_trial'});
    assert.equal(x.p.status().real_users,4);
    assert.throws(()=>x.p.acceptSpec(spec(x.id),'stop'),/five|5/i);
    assert.equal(x.p.ledger.read().filter(e=>e.type==='spec.accepted').length,0);
    assert.ok(x.p.ledger.read().some(e=>e.type==='operation.failed'));
  }finally{x.cleanup();}
});
test('fixture complaints cannot be selected as live demand',()=>{
  const x=setup('fixture');try{assert.throws(()=>x.p.select(x.id,'human','test'),/eligible|fixture/i);}finally{x.cleanup();}
});
test('new ranking and changed selection invalidate old users and spec',()=>{
  const x=setup();try{
    x.p.select(x.id,'human','reviewed');users(x.p);x.p.acceptSpec(spec(x.id),'stop');
    assert.equal(x.p.status().next_gate,'register_app');
    x.p.rank();assert.equal(x.p.status().next_gate,'human_selection');
    x.p.select(x.id,'human','selected again');assert.equal(x.p.status().real_users,0);
  }finally{x.cleanup();}
});
test('a green check requires a reviewed genuine failing acceptance run; failed recheck blocks deployment',async()=>{
  const x=setup();try{
    x.p.select(x.id,'human','reviewed');users(x.p);x.p.acceptSpec(spec(x.id),'stop');
    const app=join(x.root,'app');mkdirSync(app);writeFileSync(join(app,'acceptance.test.js'),'process.exit(1)');
    const mapping=Array.from({length:5},(_,i)=>({feature:`Feature ${i+1}`,test:'acceptance.test.js'}));
    x.p.registerApp(app,mapping,'human');
    const argv=[process.execPath,'acceptance.test.js'];
    await assert.rejects(x.p.check('green',argv),/red|fail/i);
    const red=await x.p.check('red',argv);
    x.p.reviewRed(red.id,'human','Reviewed output: intended assertions fail, not infrastructure');
    writeFileSync(join(app,'acceptance.test.js'),'process.exit(0)');
    await x.p.check('green',argv);
    assert.equal(x.p.status().next_gate,'deployment_authority');
    writeFileSync(join(app,'acceptance.test.js'),'process.exit(1)');
    await x.p.check('green',argv);
    assert.throws(()=>x.p.recordDeployment('https://test.invalid','human authority','test receipt'),/passing|check/i);
    assert.equal(x.p.ledger.read().filter(e=>e.type==='check.completed').length,3);
  }finally{x.cleanup();}
});
test('source changes after a pass invalidate deployment and spec changes invalidate app',async()=>{
  const x=setup();try{
    x.p.select(x.id,'human','reviewed');users(x.p);x.p.acceptSpec(spec(x.id),'stop');
    const app=join(x.root,'app');mkdirSync(app);writeFileSync(join(app,'test.js'),'process.exit(1)');
    x.p.registerApp(app,Array.from({length:5},(_,i)=>({feature:`Feature ${i+1}`,test:'test.js'})),'human');
    const argv=[process.execPath,'test.js'],red=await x.p.check('red',argv);x.p.reviewRed(red.id,'human','Expected assertion failed');
    writeFileSync(join(app,'test.js'),'process.exit(0)');await x.p.check('green',argv);
    writeFileSync(join(app,'extra.js'),'new feature');
    assert.throws(()=>x.p.recordDeployment('https://test.invalid','authority','receipt'),/changed|revision/i);
    x.p.acceptSpec(spec(x.id),'stop');assert.equal(x.p.status().next_gate,'register_app');
  }finally{x.cleanup();}
});

test('transitive demand aliases cannot inflate distinct real people',()=>{
  const x=setup();try{
    x.p.select(x.id,'human','reviewed');
    for(const [id,reference] of [['a','r1'],['a','r2'],['b','r2'],['c','r3'],['d','r4'],['e','r5']])x.p.addUser({id,reference,kind:'live',observed_at:'2026-10-22T15:00:00Z',observation:'committed_trial'});
    assert.equal(x.p.status().real_users,4);
    assert.throws(()=>x.p.acceptSpec(spec(x.id),'stop'),/five|5/i);
  }finally{x.cleanup();}
});

test('overlapping acceptance runs cannot pass out of order or bypass three attempts',async()=>{
  const x=setup();try{
    x.p.select(x.id,'human','reviewed');users(x.p);x.p.acceptSpec(spec(x.id),'stop');
    const app=join(x.root,'app');mkdirSync(app);writeFileSync(join(app,'test.js'),'process.exit(1)');
    x.p.registerApp(app,Array.from({length:5},(_,i)=>({feature:`Feature ${i+1}`,test:'test.js'})),'human');
    const argv=[process.execPath,'test.js'],red=await x.p.check('red',argv);x.p.reviewRed(red.id,'human','Expected assertion failed');
    writeFileSync(join(app,'test.js'),'setTimeout(()=>process.exit(0),100)');
    const results=await Promise.allSettled(Array.from({length:5},()=>x.p.check('green',argv)));
    assert.equal(results.filter(r=>r.status==='fulfilled').length,1,'concurrent check must be refused, not race');
    await x.p.check('green',argv);await x.p.check('green',argv);
    await assert.rejects(x.p.check('green',argv),/three|3/i);
    assert.equal(x.p.ledger.read().filter(e=>e.type==='check.completed'&&e.payload.phase==='green').length,3);
  }finally{x.cleanup();}
});

test('post-check fingerprint failure is recorded and invalidates the prior pass',async()=>{
  const {unlinkSync}=await import('node:fs'),x=setup();try{
    x.p.select(x.id,'human','reviewed');users(x.p);x.p.acceptSpec(spec(x.id),'stop');
    const app=join(x.root,'app');mkdirSync(app);writeFileSync(join(app,'test.js'),'if(require("node:fs").existsSync("/tmp/unused-pipeline-flag")){};process.exit(1)');
    x.p.registerApp(app,Array.from({length:5},(_,i)=>({feature:`Feature ${i+1}`,test:'test.js'})),'human');
    const argv=[process.execPath,'test.js'],red=await x.p.check('red',argv);x.p.reviewRed(red.id,'human','Expected failure');
    writeFileSync(join(app,'test.js'),'if(require("node:fs").existsSync("trigger")){require("node:fs").symlinkSync("../outside.js","bad-link");process.exit(1)}');
    await x.p.check('green',argv);
    writeFileSync(join(app,'trigger'),'go');
    const failed=await x.p.check('green',argv);
    assert.equal(failed.payload.result.passed,false);assert.ok(failed.payload.fingerprint_error);
    unlinkSync(join(app,'bad-link'));unlinkSync(join(app,'trigger'));
    assert.throws(()=>x.p.recordDeployment('https://test.invalid','authority','receipt'),/passing|check/i);
  }finally{x.cleanup();}
});
