// Runs against a dedicated random test vault; no real user history is read.
const crypto=require('node:crypto'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{const endpoint=process.env.GYM_TEST_ENDPOINT;if(!endpoint)throw Error('GYM_TEST_ENDPOINT required');const key=crypto.randomBytes(32).toString('hex'),other=crypto.randomBytes(32).toString('hex');
const call=async(body,token=key,origin='https://cryptclaw.github.io')=>{const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json','X-Gym-Key':token,'Origin':origin},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});return {status:response.status,body:await response.json()};};
assert.equal((await call({},'invalid')).status,401);assert.equal((await call({},key,'https://example.com')).status,403);
assert.equal((await call({register:true})).status,200);
const h={id:crypto.randomUUID(),createdAt:new Date().toISOString(),day:'A',date:'04/10/2026',duration:null,exercises:[{name:'Verification only',weight:35,reps:[12,12,12]}],notes:'Isolated infrastructure test'};
const saved=await call({workouts:[h]});assert.equal(saved.status,200);assert.equal(saved.body.saved,true);
await call({workouts:[h]});const read=await call({offset:0});assert.equal(read.status,200);assert.deepEqual(read.body.workouts,[h]);
const foreign=await call({offset:0},other);assert.equal(foreign.body.exists,false);assert.equal(foreign.body.workouts.length,0);
const invalid=await call({workouts:[{...h,id:crypto.randomUUID(),day:'Z'}]});assert.equal(invalid.status,400);assert.equal((await call({offset:0})).body.workouts.length,1);
const keyHash=crypto.createHash('sha256').update(key).digest('hex');fs.mkdirSync('test-results',{recursive:true});fs.writeFileSync('test-results/live-cloud.json',JSON.stringify({testVaultHash:keyHash,workoutId:h.id,success:true}));
console.log('PASS live cloud: write/read, idempotent retry, isolation, invalid input and origin checks');
})().catch(err=>{console.error(err);process.exitCode=1;});
