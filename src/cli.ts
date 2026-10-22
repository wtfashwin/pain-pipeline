import { parseArgs } from 'node:util';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, resolve, dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Pipeline, hasFailureReceipt } from './workflow.ts';
import { encodeStage } from './contracts.ts';
import { collectHN, probeHN } from './sources.ts';
import type { SourcePolicy } from './sources.ts';

const help=`Complaint to MVP pipeline (Node 24)\n\nUsage: npm start -- <command> [--run runs/name] [options]\n\n  demo                         Offline fixture demo; creates a fresh run\n  import --file raw.toon [--permission-ref receipt]  Import authorized records\n  hn-probe                     Connectivity only; stores no user text\n  hn-collect --policy policy.json [--limit 10]       Policy-gated official API\n  rank                         Cluster, rank, print problems TOON\n  assess --file assessments.toon                    Evidence-backed annotations\n  select --id problem --by human --reason text       Human choice gate\n  user --file person.json        Record actual demand evidence\n  prompt                       Export stage 2-to-3 prompt after demand gate\n  spec --file spec.toon --finish-reason stop         Validate spec; write PRD/handoff\n  app --cwd app-dir --mapping mapping.json --by human\n  check --phase red|green --argv '["node","--test","acceptance.test.js"]'\n        [--timeout-ms 60000]     Run local trusted app checks (not a sandbox)\n  review-red --id check-id --by human --reason assertion-failure-review\n  deployment-record --url https://... --authority receipt --receipt provider-id\n                               Records operator-reported release; does not deploy\n  outcome --result text --evidence receipt\n  status                       Show gates, provenance and failures\n  help\n\nFixture evidence cannot unlock live selection/build. No paid model calls or automatic publishing.\n`;
const names=['run','file','permission-ref','policy','limit','id','by','reason','finish-reason','cwd','mapping','phase','argv','timeout-ms','url','authority','receipt','result','evidence'];
const options=Object.fromEntries(names.map(n=>[n,{type:'string' as const}]));
function file(path:string){const absolute=resolve(path);if(statSync(absolute).size>1_048_576)throw new Error('Input file exceeds 1 MiB');return readFileSync(absolute,'utf8');}
function json(path:string){return JSON.parse(file(path));}
function print(value:unknown){console.log(JSON.stringify(value,null,2));}

async function main(){
  const {values,positionals}=parseArgs({options,allowPositionals:true,strict:true});
  const command=positionals[0]??'help';
  if(positionals.length>1)throw new Error('Unexpected positional argument; use named options');
  const get=(key:string)=>{const value=values[key];if(!value)throw new Error(`--${key} is required`);return value;};
  const root=resolve(values.run??(command==='demo'?`runs/demo-${new Date().toISOString().replace(/[:.]/g,'-')}-${randomUUID().slice(0,6)}`:'runs/current'));
  if(command==='help'){console.log(help);return;}
  const commands=['demo','import','hn-probe','hn-collect','rank','assess','select','user','prompt','spec','app','check','review-red','deployment-record','outcome','status'];
  if(!commands.includes(command))throw new Error(`Unknown command: ${command}. Use help.`);
  if(command==='demo'&&existsSync(root))throw new Error('Demo requires a new run directory; existing runs are never overwritten');
  const pipeline=new Pipeline(root);
  pipeline.ledger.read();
  try{
    switch(command){
      case 'demo':{
        const project=resolve(dirname(fileURLToPath(import.meta.url)),'..');
        pipeline.importComplaints(file(join(project,'examples/complaints.toon')));
        const problems=pipeline.rank();
        const assessments=problems.map(p=>({id:p.id,pain:p.text.toLowerCase().includes('csv')?8:6,wtp:null,gap:null,hours:4,regulated:false,hardware:false,basis:'Synthetic demonstration annotation. No real demand or willingness to pay.'}));
        pipeline.assess(encodeStage({assessments}));pipeline.rank();
        pipeline.outcome('fixture demonstration reached human-selection gate','Synthetic records only; no real users, sends, app build or deployment');
        print(pipeline.status());break;
      }
      case 'import':print(pipeline.importComplaints(file(get('file')),values['permission-ref']));break;
      case 'hn-probe':print(pipeline.ledger.append('source.probed',await probeHN()));break;
      case 'hn-collect':{
        const result=await collectHN({limit:Number(values.limit??'10'),policy:json(get('policy')) as SourcePolicy});
        pipeline.ledger.append('source.collected',{...result,complaints:result.complaints.map(c=>({id:c.id,url:c.url})),note:'Ask HN candidates require complaint relevance review; retention is operator-owned'});
        if(result.complaints.length)pipeline.importComplaints(encodeStage({complaints:result.complaints}),result.policy.permission_ref);
        print({collected:result.complaints.length,requests:result.requests,skipped:result.skipped,run:root});break;
      }
      case 'rank':console.log(encodeStage({problems:pipeline.rank()}));break;
      case 'assess':print(pipeline.assess(file(get('file'))));break;
      case 'select':print(pipeline.select(get('id'),get('by'),get('reason')));break;
      case 'user':print(pipeline.addUser(json(get('file'))));break;
      case 'prompt':console.log(pipeline.prompt());break;
      case 'spec':print(pipeline.acceptSpec(file(get('file')),get('finish-reason')));break;
      case 'app':print(pipeline.registerApp(get('cwd'),json(get('mapping')),get('by')));break;
      case 'check':{
        const event=await pipeline.check(get('phase') as 'red'|'green',JSON.parse(get('argv')),Number(values['timeout-ms']??'60000'));
        print(event);if(!event.payload.result.passed)process.exitCode=1;break;
      }
      case 'review-red':print(pipeline.reviewRed(get('id'),get('by'),get('reason')));break;
      case 'deployment-record':print(pipeline.recordDeployment(get('url'),get('authority'),get('receipt')));break;
      case 'outcome':print(pipeline.outcome(get('result'),get('evidence')));break;
      case 'status':print(pipeline.status());break;
    }
  }catch(error){
    try{if(!hasFailureReceipt(error))pipeline.ledger.append(command.startsWith('hn-')?'source.failed':'operation.failed',{operation:command,error:String(error).slice(0,1000)});}catch{}
    throw error;
  }
}
main().catch(error=>{console.error(String(error));process.exitCode=1;});
