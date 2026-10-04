import {createClient} from 'npm:@supabase/supabase-js@2.57.4';
import '../core.js';
const allowedOrigin='https://cryptclaw.github.io';
const headers={'Access-Control-Allow-Origin':allowedOrigin,'Access-Control-Allow-Headers':'content-type,x-gym-key','Access-Control-Allow-Methods':'POST,OPTIONS','Cache-Control':'no-store','Content-Type':'application/json','Vary':'Origin'};
const respond=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
Deno.serve(async(req:Request)=>{
 const origin=req.headers.get('Origin');if(origin&&origin!==allowedOrigin)return respond({error:'Origin forbidden'},403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return respond({error:'Method not allowed'},405);
 const key=req.headers.get('X-Gym-Key')||'';if(!/^[a-f0-9]{64}$/.test(key))return respond({error:'Missing recovery key'},401);
 try{
  if(Number(req.headers.get('Content-Length')||0)>2_000_000)return respond({error:'Request too large'},413);
  const raw=await req.text();if(raw.length>2_000_000)return respond({error:'Request too large'},413);
  const body=JSON.parse(raw);if(!body||typeof body!=='object')return respond({error:'Invalid request'},400);
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(key))),v=>v.toString(16).padStart(2,'0')).join('');
  const secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}').default;
  const db=createClient(Deno.env.get('SUPABASE_URL')!,secret,{auth:{persistSession:false,autoRefreshToken:false}});
  if(body.register===true){const {error}=await db.from('gym_vaults').upsert({key_hash:hash},{onConflict:'key_hash',ignoreDuplicates:true});if(error)throw error;}
  const {data:vault,error:vaultError}=await db.from('gym_vaults').select('key_hash').eq('key_hash',hash).maybeSingle();if(vaultError)throw vaultError;
  if(!vault)return respond({exists:false,workouts:[],hasMore:false});
  if(body.workouts!==undefined){
   if(!Array.isArray(body.workouts)||body.workouts.length>100)return respond({error:'Invalid batch'},400);
   let rows;try{rows=body.workouts.map((h:unknown)=>{const payload=(globalThis as any).GymCore.validateWorkout(h);if(!payload.id)throw Error('ID required');return {key_hash:hash,workout_id:payload.id,payload};});}catch{return respond({error:'Invalid workout'},400);}
   if(rows.length){const {error}=await db.from('gym_workouts').upsert(rows,{onConflict:'key_hash,workout_id',ignoreDuplicates:true});if(error)throw error;}
   return respond({exists:true,saved:true});
  }
  const offset=body.offset??0;if(!Number.isInteger(offset)||offset<0||offset>20000)return respond({error:'Invalid offset'},400);
  const {data,error}=await db.from('gym_workouts').select('payload').eq('key_hash',hash).order('workout_id').range(offset,offset+199);if(error)throw error;
  return respond({exists:true,workouts:data.map(row=>row.payload),hasMore:data.length===200});
 }catch{return respond({error:'Sync unavailable'},503);}
});
