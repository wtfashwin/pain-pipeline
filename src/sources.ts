import type { Complaint } from './contracts.ts';

export type Fetcher=(input:string|URL|Request,init?:RequestInit)=>Promise<Response>;
export interface SourcePolicy {reviewed_by:string;purpose:string;terms_url:string;permission_ref:string;retention_days:number}
const base='https://hacker-news.firebaseio.com/v0';
const pause=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));

async function readJson(response:Response):Promise<any> {
  if(!response.ok)throw new Error(`HN HTTP ${response.status}`);
  if(!response.body)throw new Error('HN response body missing');
  const reader=response.body.getReader(),parts:Uint8Array[]=[];let bytes=0;
  try{while(true){const {value,done}=await reader.read();if(done)break;bytes+=value.length;if(bytes>1_048_576)throw new Error('HN response exceeds size limit');parts.push(value);}}
  finally{await reader.cancel();}
  return JSON.parse(Buffer.concat(parts).toString('utf8'));
}
function validateList(value:any):number[] {
  if(!Array.isArray(value)||value.some(x=>!Number.isSafeInteger(x)||x<=0))throw new Error('Invalid HN ID list');
  return [...new Set(value as number[])];
}
function plainText(value:string):string {
  return value.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,' ').replace(/<[^>]*>/g,' ').replace(/&(?:amp|lt|gt|quot|apos|#39|#x27);/gi,x=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&#39;':"'",'&#x27;':"'"}[x.toLowerCase()]??' ')).replace(/[\x00-\x1f\x7f-\x9f]/g,' ').replace(/\s+/g,' ').trim();
}
export async function collectHN(options:{limit:number;policy?:SourcePolicy;fetcher?:Fetcher;intervalMs?:number}):Promise<{complaints:Complaint[];policy:SourcePolicy;requests:number;skipped:number;extraction_version:string}> {
  const {limit,policy,fetcher=fetch,intervalMs=500}=options;
  if(!policy||!['reviewed_by','purpose','terms_url','permission_ref'].every(k=>typeof policy[k as keyof SourcePolicy]==='string'&&String(policy[k as keyof SourcePolicy]).trim())||!Number.isInteger(policy.retention_days)||policy.retention_days<1||policy.retention_days>30)throw new Error('Source policy review, permission reference, purpose and 1..30 retention_days required');
  if(policy.terms_url!=='https://www.ycombinator.com/legal/')throw new Error('HN policy must reference current YC terms');
  if(!Number.isInteger(limit)||limit<1||limit>20)throw new Error('HN limit must be 1..20');
  let requests=0,last=0,skipped=0;
  const request=async(path:string):Promise<any>=>{
    for(let attempt=0;attempt<3;attempt++){
      if(requests>=25)throw new Error('HN request budget exhausted');
      await pause(Math.max(0,intervalMs-(Date.now()-last)));last=Date.now();requests++;
      try{return await readJson(await fetcher(`${base}/${path}.json`,{signal:AbortSignal.timeout(10_000),redirect:'error',headers:{Accept:'application/json','User-Agent':'pain-pipeline/0.1 local research'}}));}
      catch(error){if(attempt===2||!/HTTP (429|5\d\d)|timeout|fetch failed/i.test(String(error)))throw error;await pause(500*2**attempt);}
    }
  };
  const ids=validateList(await request('askstories')).slice(0,limit),complaints:Complaint[]=[];
  for(const id of ids){
    const item=await request(`item/${id}`);
    if(!item||item.dead||item.deleted){skipped++;continue;}
    if(item.id!==id||item.type!=='story'||typeof item.title!=='string')throw new Error(`Invalid HN item ${id}`);
    const text=plainText(`${item.title} ${typeof item.text==='string'?item.text:''}`).slice(0,8000);
    if(!text){skipped++;continue;}
    complaints.push({id:`hn_${id}`,text,source:'hn',url:`https://news.ycombinator.com/item?id=${id}`,collected_at:new Date().toISOString(),kind:'live'});
  }
  return {complaints,policy,requests,skipped,extraction_version:'hn-candidate-v1'};
}

/** Connectivity only: user text and author fields never leave this function. */
export async function probeHN(fetcher:Fetcher=fetch):Promise<{endpoint:string;at:string;item_id:number;item_type:string;ok:true}> {
  const ids=validateList(await readJson(await fetcher(`${base}/askstories.json`,{signal:AbortSignal.timeout(10_000),redirect:'error'})));
  if(!ids.length)throw new Error('HN probe found empty list');
  const item=await readJson(await fetcher(`${base}/item/${ids[0]}.json`,{signal:AbortSignal.timeout(10_000),redirect:'error'}));
  if(!item||item.id!==ids[0]||typeof item.type!=='string')throw new Error('HN probe item schema invalid');
  return {endpoint:base,at:new Date().toISOString(),item_id:item.id,item_type:item.type,ok:true};
}
