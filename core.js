(function(root){
'use strict';
const DAYS=['A','B','C'];
function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function validateWorkout(h){
 if(!h||!DAYS.includes(h.day)||typeof h.date!=='string'||h.date.length>40||!Array.isArray(h.exercises)||h.exercises.length>30)throw Error('Allenamento non valido');
 if(h.duration!=null&&(!Number.isFinite(h.duration)||h.duration<0))throw Error('Durata non valida');
 if(h.notes!=null&&(typeof h.notes!=='string'||h.notes.length>10000))throw Error('Note non valide');
 const exercises=h.exercises.map(e=>{
  if(!e||typeof e.name!=='string'||!e.name||e.name.length>150||!Number.isFinite(e.weight)||e.weight<0||e.weight>2000||!Array.isArray(e.reps)||e.reps.length>10||!e.reps.every(r=>r===null||(Number.isInteger(r)&&r>=0&&r<=1000)))throw Error('Serie non valide');
  return {name:e.name,weight:e.weight,reps:e.reps};
 });
 if(h.id!=null&&(typeof h.id!=='string'||!/^[-a-zA-Z0-9_]{10,100}$/.test(h.id)))throw Error('Identificatore non valido');
 if(h.createdAt!=null&&!Number.isFinite(Date.parse(h.createdAt)))throw Error('Data non valida');
 return {day:h.day,date:h.date,duration:h.duration??null,exercises,notes:h.notes??'',...(h.id?{id:h.id}:{}),...(h.createdAt?{createdAt:h.createdAt}:{})};
}
async function normalizeHistory(history){
 if(!Array.isArray(history)||history.length>20000)throw Error('Storico non valido');
 const result=[];const occurrences=new Map();
 for(const item of history){const h=validateWorkout(item);if(!h.id){const raw=JSON.stringify(h);const count=occurrences.get(raw)||0;occurrences.set(raw,count+1);const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw+'#'+count));h.id='legacy-'+Array.from(new Uint8Array(hash),v=>v.toString(16).padStart(2,'0')).join('');}result.push(h);}
 return result;
}
function mergeHistory(local,remote){const map=new Map(remote.map(h=>[h.id,h]));for(const h of local)map.set(h.id,h);return [...map.values()].sort((a,b)=>(Date.parse(b.createdAt||b.date.split('/').reverse().join('-'))||0)-(Date.parse(a.createdAt||a.date.split('/').reverse().join('-'))||0));}
function suggestion(last,sets,min,max,weight){
 if(!last||!last.reps.length)return {text:'Prima volta: usa il peso di partenza e resta nel range indicato.',neutral:true};
 if(last.reps.length!==sets||!last.reps.every(r=>Number.isInteger(r)&&r>0))return {text:'Completa tutte le serie prima di valutare un aumento.',neutral:true};
 if(last.reps.every(r=>r>=max)){if(weight<=0)return {text:'Limite alto raggiunto: mantieni il corpo libero e valuta un piccolo sovraccarico.',neutral:false};return {text:'Prossima volta: prova '+Math.round((weight+(weight>=15?2.5:2))*10)/10+' kg, usando il salto disponibile più piccolo.',neutral:false};}
 return {text:'Mantieni '+weight+' kg e prova ad aggiungere 1–2 ripetizioni totali.',neutral:true};
}
const api={DAYS,escapeHtml,validateWorkout,normalizeHistory,mergeHistory,suggestion};root.GymCore=api;if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
