import test from 'node:test';
import assert from 'node:assert/strict';
import { collectHN, probeHN } from '../src/sources.ts';

const policy={reviewed_by:'operator',purpose:'approved local research',terms_url:'https://www.ycombinator.com/legal/',permission_ref:'local permission receipt',retention_days:7};
test('live collector rejects absent policy before any request',async()=>{
  let calls=0;
  await assert.rejects(collectHN({limit:1,fetcher:async()=>{calls++;return new Response('[]');}}),/policy/i);
  assert.equal(calls,0);
});
test('live collector retains provenance and excludes authors and dead content',async()=>{
  const fetcher=async(input:string|URL|Request)=>{
    const url=String(input);
    if(url.includes('askstories'))return new Response('[1,2]');
    if(url.includes('/1.'))return Response.json({id:1,type:'story',by:'private-author',title:'Ask HN: CSV export is broken',text:'<p>I cannot export &amp; share</p>',time:1792681200});
    return Response.json({id:2,deleted:true,type:'story'});
  };
  const result=await collectHN({limit:2,policy,fetcher,intervalMs:0});
  assert.equal(result.complaints.length,1);
  assert.equal(result.complaints[0].kind,'live');
  assert.match(result.complaints[0].url,/item\?id=1$/);
  assert.doesNotMatch(JSON.stringify(result),/private-author|<p>/);
});
test('collector fails closed on HTTP error and invalid list',async()=>{
  await assert.rejects(collectHN({limit:1,policy,fetcher:async()=>new Response('no',{status:403}),intervalMs:0}),/403/);
  await assert.rejects(collectHN({limit:1,policy,fetcher:async()=>Response.json({not:'ids'}),intervalMs:0}),/list/i);
});
test('probe records only connectivity and item metadata',async()=>{
  const fetcher=async(input:string|URL|Request)=>String(input).includes('askstories')?Response.json([1]):Response.json({id:1,type:'story',title:'private-content',by:'author',text:'do not retain'});
  const result=await probeHN(fetcher);
  assert.equal(result.item_id,1);
  assert.equal(result.item_type,'story');
  assert.doesNotMatch(JSON.stringify(result),/private-content|author|do not retain/);
});
