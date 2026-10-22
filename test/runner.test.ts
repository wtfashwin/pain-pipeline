import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runAcceptance, fingerprintTree } from '../src/runner.ts';

test('runner observes real success and preserves argv without a shell', async () => {
  const result = await runAcceptance({argv:[process.execPath,'-e','console.log(process.argv[1])','$(touch MUST_NOT_EXIST)'],cwd:process.cwd()});
  assert.equal(result.passed,true);
  assert.match(result.stdout,/\$\(touch MUST_NOT_EXIST\)/);
});
test('nonzero exit cannot pass', async () => {
  const result = await runAcceptance({argv:[process.execPath,'-e','console.error("broken");process.exit(3)'],cwd:process.cwd()});
  assert.equal(result.passed,false);
  assert.equal(result.exit_code,3);
  assert.match(result.stderr,/broken/);
});
test('timeout kills a child and records failure', async () => {
  const result = await runAcceptance({argv:[process.execPath,'-e','setInterval(()=>{},1000)'],cwd:process.cwd(),timeoutMs:100});
  assert.equal(result.passed,false);
  assert.equal(result.timed_out,true);
});
test('output overflow is bounded and fails the check', async () => {
  const result = await runAcceptance({argv:[process.execPath,'-e','console.log("x".repeat(100000))'],cwd:process.cwd(),maxOutputBytes:100});
  assert.equal(result.passed,false);
  assert.equal(result.output_limited,true);
  assert.ok(Buffer.byteLength(result.stdout+result.stderr)<=100);
});
test('missing executable returns recorded failure', async () => {
  const result = await runAcceptance({argv:['/no/such/pipeline-test-runner'],cwd:process.cwd()});
  assert.equal(result.passed,false);
  assert.equal(result.exit_code,null);
});
test('fingerprint changes with app contents', async () => {
  const {writeFileSync}=await import('node:fs');
  const root=mkdtempSync(join(tmpdir(),'pipeline-tree-'));
  try {
    writeFileSync(join(root,'app.txt'),'one');
    const before=fingerprintTree(root);
    writeFileSync(join(root,'app.txt'),'two');
    assert.notEqual(fingerprintTree(root),before);
  } finally {rmSync(root,{recursive:true,force:true});}
});

test('changing installed runtime dependency bytes invalidates the app fingerprint',async()=>{
  const {writeFileSync,mkdirSync}=await import('node:fs');
  const root=mkdtempSync(join(tmpdir(),'pipeline-dependency-'));
  try{
    writeFileSync(join(root,'app.js'),'import "package";');
    const dependency=join(root,'node_modules','package');mkdirSync(dependency,{recursive:true});writeFileSync(join(dependency,'index.js'),'export default 1');
    const before=fingerprintTree(root);writeFileSync(join(dependency,'index.js'),'export default 2');
    assert.notEqual(fingerprintTree(root),before);
  }finally{rmSync(root,{recursive:true,force:true});}
});

test('timeout returns even when detached descendants retain output pipes',async()=>{
  let descendant:number|undefined;
  try{
    const code=`const {spawn}=require('node:child_process');const c=spawn(process.execPath,['-e','setTimeout(()=>{},1000)'],{detached:true,stdio:['ignore',1,2]});console.log(c.pid);c.unref();`;
    const started=Date.now(),result=await runAcceptance({argv:[process.execPath,'-e',code],cwd:process.cwd(),timeoutMs:100});
    descendant=Number(result.stdout.trim());
    assert.equal(result.timed_out,true);assert.ok(Date.now()-started<500,'timeout must bound inherited pipe wait');
  }finally{if(descendant)try{process.kill(descendant,'SIGKILL');}catch{}}
});

test('contained npm bin links work while links outside the app are refused',async()=>{
  const {writeFileSync,mkdirSync,symlinkSync,unlinkSync}=await import('node:fs');
  const root=mkdtempSync(join(tmpdir(),'pipeline-links-'));
  try{
    mkdirSync(join(root,'node_modules','.bin'),{recursive:true});mkdirSync(join(root,'node_modules','tool'));
    writeFileSync(join(root,'node_modules','tool','index.js'),'console.log(1)');
    symlinkSync('../tool/index.js',join(root,'node_modules','.bin','tool'));
    assert.doesNotThrow(()=>fingerprintTree(root));
    symlinkSync('/etc/hosts',join(root,'outside'));
    assert.throws(()=>fingerprintTree(root),/outside|external/i);unlinkSync(join(root,'outside'));
  }finally{rmSync(root,{recursive:true,force:true});}
});
