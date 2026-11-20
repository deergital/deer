import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readApiResponse} from '../src/lib/api-response.mjs';
test('expired Netlify protection is identified without parsing HTML as application data',async()=>{const response=new Response('<h1>This site is private</h1>',{status:401,headers:{'content-type':'text/html'}});await assert.rejects(readApiResponse(response),e=>e.code==='NETLIFY_ACCESS_REQUIRED'&&e.message.includes('borrador se conserva'));});
test('expired app session remains distinct from Netlify gate',async()=>{await assert.rejects(readApiResponse(Response.json({error:'UNAUTHORIZED'},{status:401})),e=>e.code==='DEER_SESSION_REQUIRED');});
test('conflict and disabled-account responses preserve their error messages',async()=>{await assert.rejects(readApiResponse(Response.json({error:'DEER_VERSION_CONFLICT'},{status:409})),/DEER_VERSION_CONFLICT/);await assert.rejects(readApiResponse(Response.json({error:'FORBIDDEN'},{status:403})),/FORBIDDEN/);});
test('valid application data remains unchanged',async()=>{assert.deepEqual(await readApiResponse(Response.json({rows:[],count:0})),{rows:[],count:0});});
test('unexpected HTML is never accepted as confirmed application data',async()=>{await assert.rejects(readApiResponse(new Response('<h1>Service unavailable</h1>',{status:503,headers:{'content-type':'text/html'}})),/borrador se conserva/);});
