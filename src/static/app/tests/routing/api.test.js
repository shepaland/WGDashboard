import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoutingClient, moveGateway } from '../../src/utilities/routingApi.js';
test('order movement is immutable and bounded', () => {
 const input=['a','b','c'];assert.deepEqual(moveGateway(input,'b',-1),['b','a','c']);assert.deepEqual(input,['a','b','c']);assert.deepEqual(moveGateway(input,'a',-1),input);
});
test('mutations carry revision, csrf and idempotency, conflict is explicit', async () => {
 const requests=[];const fetcher=async (url,options)=>{requests.push({url,options});return new Response(JSON.stringify(url.endsWith('/session')?{csrf_token:'csrf'}:{error:'REVISION_CONFLICT'}),{status:url.endsWith('/session')?200:412})};
 const client=createRoutingClient('/vpn',fetcher);await assert.rejects(client.request('/policy',{method:'PUT',body:{},revision:7}),error=>error.status===412);
 assert.equal(requests[1].options.headers['If-Match'],'7');assert.equal(requests[1].options.headers['X-CSRF-Token'],'csrf');assert.ok(requests[1].options.headers['Idempotency-Key']);
});
test('snapshot refuses mixed revisions instead of promoting stale data', async () => {
 const {readRoutingSnapshot}=await import('../../src/utilities/routingApi.js');
 const api={request:async path=>path==='/status'?{desired_revision:2}:{revision:path==='/policy'?1:2,items:[],policy:{ordered_gateway_ids:['old']}}};
 await assert.rejects(readRoutingSnapshot(api),error=>error.status===409);
});
test('notification acceptance never claims Telegram delivery', async () => {
 const {notificationJobMessage}=await import('../../src/utilities/routingApi.js');
 assert.match(notificationJobMessage({kind:'test',phase:'accepted'}),/ожидается/);
 assert.match(notificationJobMessage({kind:'test',phase:'delivered'}),/подтвердил/);
 assert.doesNotMatch(notificationJobMessage({kind:'check',phase:'succeeded'}),/отправлено/i);
});
