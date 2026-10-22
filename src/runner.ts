import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, realpathSync, lstatSync, readlinkSync } from 'node:fs';
import { join, resolve, relative as relativePath, isAbsolute } from 'node:path';

export interface RunResult {
  argv:string[]; cwd:string; exit_code:number|null; signal:string|null;
  timed_out:boolean; output_limited:boolean; stdout:string; stderr:string;
  started_at:string; finished_at:string; passed:boolean;
}
export async function runAcceptance(options:{argv:string[];cwd:string;timeoutMs?:number;maxOutputBytes?:number}):Promise<RunResult> {
  const {argv,cwd,timeoutMs=60_000,maxOutputBytes=65_536}=options;
  if(!Array.isArray(argv)||!argv.length||argv.some(x=>typeof x!=='string'||x.includes('\0'))||!argv[0].trim())throw new Error('Acceptance argv is required');
  if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>300_000)throw new Error('timeoutMs must be 1..300000');
  if(!Number.isInteger(maxOutputBytes)||maxOutputBytes<1||maxOutputBytes>1_048_576)throw new Error('Invalid output bound');
  const root=realpathSync(resolve(cwd));
  const started_at=new Date().toISOString();
  return new Promise(resolveResult=>{
    let stdout=Buffer.alloc(0),stderr=Buffer.alloc(0),timed_out=false,output_limited=false,spawnFailed=false;
    const child=spawn(argv[0],argv.slice(1),{cwd:root,shell:false,detached:process.platform!=='win32',stdio:['ignore','pipe','pipe'],env:{PATH:process.env.PATH,LANG:'C.UTF-8',TMPDIR:process.env.TMPDIR}});
    const kill=()=>{try{if(child.pid&&process.platform!=='win32')process.kill(-child.pid,'SIGKILL');else child.kill('SIGKILL');}catch{/* child already exited */}};
    let settled=false;
    const finish=(code:number|null,signal:string|null)=>{
      if(settled)return;settled=true;clearTimeout(timer);
      resolveResult({argv:[...argv],cwd:root,exit_code:spawnFailed?null:code,signal,timed_out,output_limited,stdout:stdout.toString('utf8'),stderr:stderr.toString('utf8'),started_at,finished_at:new Date().toISOString(),passed:!spawnFailed&&code===0&&!timed_out&&!output_limited});
    };
    const terminate=()=>{kill();child.stdout.destroy();child.stderr.destroy();finish(null,'SIGKILL');};
    const timer=setTimeout(()=>{timed_out=true;terminate();},timeoutMs);
    const receive=(which:'stdout'|'stderr',chunk:Buffer)=>{
      const remaining=maxOutputBytes-stdout.length-stderr.length;
      const kept=chunk.subarray(0,Math.max(remaining,0));
      if(which==='stdout')stdout=Buffer.concat([stdout,kept]);else stderr=Buffer.concat([stderr,kept]);
      if(chunk.length>remaining){output_limited=true;terminate();}
    };
    child.stdout.on('data',(b:Buffer)=>receive('stdout',b));
    child.stderr.on('data',(b:Buffer)=>receive('stderr',b));
    child.on('error',()=>{spawnFailed=true;});
    child.on('close',finish);
  });
}

/** Bind checks to actual application, test, lockfile and installed dependency bytes. */
export function fingerprintTree(root:string):string {
  const base=realpathSync(resolve(root)),hash=createHash('sha256');
  let files=0,bytes=0;
  const walk=(dir:string,relative:string)=>{
    for(const name of readdirSync(dir).sort()){
      if(['.git','.DS_Store'].includes(name))continue;
      const path=join(dir,name),rel=relative?`${relative}/${name}`:name,stat=lstatSync(path);
      if(stat.isSymbolicLink()){
        let target:string;try{target=relativePath(base,realpathSync(path));}catch{throw new Error('App fingerprint refuses broken symbolic links');}
        if(target.startsWith('..')||isAbsolute(target)||target.split(/[\\/]/).includes('.git')||target.endsWith('.DS_Store'))throw new Error('App fingerprint refuses links outside the included app tree');
        hash.update(JSON.stringify([rel,'symlink',readlinkSync(path),target]));continue;
      }
      if(stat.isDirectory()){walk(path,rel);continue;}
      if(!stat.isFile())throw new Error('App fingerprint requires regular files');
      files++;bytes+=stat.size;
      if(files>2000||bytes>64*1024*1024||stat.size>5*1024*1024)throw new Error('App exceeds fingerprint size limits');
      hash.update(JSON.stringify([rel,stat.mode&0o777,stat.size]));hash.update(readFileSync(path));
    }
  };
  walk(base,'');
  if(!files)throw new Error('App directory has no files');
  return hash.digest('hex');
}
