const workouts={
 A:[
  ["Panca inclinata con manubri",null,3,8,12,[]],
  ["Croci con manubri su panca",6,3,10,15,[15,15,12]],
  ["Rematore con manubri",14,3,8,12,[8,8,8]],
  ["Shoulder Press con manubri",10,3,8,12,[]],
  ["Tricipiti al cavo",17.5,3,10,15,[]],
  ["Addominali",0,3,10,15,[]]
 ],
 B:[
  ["Lat Machine",50,3,8,12,[8,8,8]],
  ["Chest Press",35,3,8,12,[9,9,9]],
  ["Leg Curl",35,3,10,15,[12,12,12]],
  ["Back Extension / Iperestensioni",0,3,8,12,[]],
  ["Bicipiti con manubri",10,3,8,12,[8,8,6]],
  ["Leg Press",null,2,10,15,[]]
 ],
 C:[
  ["Lat Machine presa stretta",null,3,8,12,[]],
  ["Chest Press",30,3,8,12,[]],
  ["Shoulder Press con manubri",8,3,8,12,[]],
  ["Leg Extension",0,2,10,15,[]],
  ["Rematore alla macchina",null,3,8,12,[]],
  ["Tricipiti al cavo",15,2,10,15,[]],
  ["Bicipiti con manubri",10,2,8,12,[]],
  ["Addominali",0,2,10,15,[]]
 ]
};
const legacyWorkoutNames={"A":["Chest Press","Croci con manubri su panca","Rematore con manubri","Shoulder Press con manubri","Tricipiti al cavo","Addominali"],"B":["Lat Machine","Chest Press","Leg Curl","Back Extension / Iperestensioni","Bicipiti con manubri","Squat a corpo libero"],"C":["Lat Machine","Chest Press","Shoulder Press con manubri","Leg Extension","Rematore con manubri","Tricipiti al cavo","Bicipiti con manubri","Addominali"]};
const key='gymTrackerV1',draftKey='gymDraftsV3',cloudKey='gymCloudKeyV1';
let day='A',data={history:[]},drafts={},workoutStart=null,timerId=null,lastDuration=null,cloudSecret=null,syncBusy=false,syncAgain=false,historyBroken=false;
const $=id=>document.getElementById(id),esc=GymCore.escapeHtml;
let restAudio=null;
let acknowledgedIds=new Set(),lastSync=null,syncTask=null,archiveBusy=false;
const safetyKey='gymSafetyBackupsV1';
function restState(i){const d=drafts[day]??=( {exercises:[],notes:''} );return d.exercises[i]??=( {} );}
function restRemaining(state){return state.restEndsAt?Math.max(0,state.restEndsAt-Date.now()):state.restRemainingMs??(state.restSeconds||90)*1000;}
function persistDrafts(){return write(draftKey,{day,drafts,workoutStart,lastDuration});}
function prepareRestSound(){try{const Audio=window.AudioContext||window.webkitAudioContext;if(Audio){restAudio??=new Audio();restAudio.resume().catch(()=>{});}}catch{}}
function restSound(){try{if(!restAudio||restAudio.state!=='running')return;const oscillator=restAudio.createOscillator(),gain=restAudio.createGain();oscillator.connect(gain);gain.connect(restAudio.destination);oscillator.frequency.value=880;gain.gain.setValueAtTime(.15,restAudio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,restAudio.currentTime+.4);oscillator.start();oscillator.stop(restAudio.currentTime+.4);}catch{}}
function updateExerciseStatus(){
 let finished=false;
 Object.values(drafts).forEach(d=>d.exercises?.forEach(state=>{if(state?.restEndsAt&&state.restEndsAt<=Date.now()){state.restEndsAt=null;state.restRemainingMs=0;state.restFinished=true;finished=true;}}));
 document.querySelectorAll('#exercises .card').forEach((card,i)=>{const state=restState(i);if(state.restEndsAt&&state.restEndsAt<=Date.now()){state.restEndsAt=null;state.restRemainingMs=0;state.restFinished=true;finished=true;}
 const seconds=Math.ceil(restRemaining(state)/1000);card.querySelector('.rest-countdown').textContent=state.restFinished?'Recupero terminato ✓':String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');
 card.querySelector('.rest-setting').textContent=(state.restSeconds||90)+' s';card.querySelector('[data-rest="toggle"]').textContent=state.restEndsAt?'Pausa':'Avvia';card.classList.toggle('completed',!!state.completed);
 });
 $('dayProgress').textContent=workouts[day].filter((e,i)=>drafts[day]?.exercises?.[i]?.completed).length+' / '+workouts[day].length+' esercizi completati';
 if(finished){persistDrafts();restSound();status('Recupero terminato');}
}
function handleRestClick(event){const button=event.target.closest('[data-rest]');if(!button)return;const i=Number(button.closest('.card').dataset.exercise);saveDraft();const state=restState(i),action=button.dataset.rest;
 if(action==='toggle'){prepareRestSound();if(state.restEndsAt){state.restRemainingMs=restRemaining(state);state.restEndsAt=null;}else{state.restEndsAt=Date.now()+(restRemaining(state)|| (state.restSeconds||90)*1000);state.restFinished=false;}}
 if(action==='reset'){state.restEndsAt=null;state.restRemainingMs=(state.restSeconds||90)*1000;state.restFinished=false;}
 if(action==='minus'||action==='plus'){const old=state.restSeconds||90,next=Math.max(30,Math.min(900,old+(action==='plus'?30:-30)));state.restSeconds=next;if(state.restEndsAt){state.restEndsAt+= (next-old)*1000;}else{state.restRemainingMs=next*1000;state.restFinished=false;}}
 persistDrafts();updateExerciseStatus();
}
function status(text){$('saveStatus').textContent=text;}
function pendingCount(){return data.history.filter(h=>!acknowledgedIds.has(h.id)).length;}
function savingFeedback(){
 const pending=pendingCount();
 const text=archiveBusy?'Collegamento degli archivi in corso…':pending?('Salvato sul dispositivo · '+pending+' allenament'+(pending===1?'o':'i')+(syncBusy?' in sincronizzazione…':' in attesa di sincronizzazione. Riprovo automaticamente.')):data.history.length?'Salvato e sincronizzato ✓':'Salva allenamento salva e sincronizza automaticamente.';
 $('saveFeedback').textContent=text;$('saveFeedback').classList.toggle('pending',pending>0);
 $('save').disabled=archiveBusy;$('restoreCloud').disabled=archiveBusy;$('import').disabled=archiveBusy;$('undoArchive').disabled=archiveBusy;
 $('archiveSummary').textContent=data.history.length+' allenamenti totali · '+GymCore.DAYS.map(d=>d+': '+data.history.filter(h=>h.day===d).length).join(' · ');
}
function persistHistory(history,{secret=cloudSecret,ack=acknowledgedIds,syncedAt=lastSync,switchArchive=false}={}){
 const stored=JSON.parse(localStorage.getItem(key)||'{"history":[]}');
 if(!switchArchive&&stored.recoveryKey&&stored.recoveryKey!==secret)throw Error('Archivio cambiato in un’altra finestra. Riapri il tracker.');
 const current=(stored.history||[]).map(GymCore.validateWorkout);
 const next={history:GymCore.mergeHistory(history,current),recoveryKey:secret,acknowledgedIds:[...ack],lastSync:syncedAt};
 if(!write(key,next))throw Error('Salvataggio sul dispositivo non riuscito: i dati inseriti restano nella bozza.');
 data={history:next.history};cloudSecret=secret;acknowledgedIds=new Set(next.acknowledgedIds);lastSync=syncedAt;
 // The history and its archive identity are committed together. This mirror is for older releases only.
 try{localStorage.setItem(cloudKey,secret);}catch{}
 savingFeedback();return next;
}
function safetyBackup(reason,history=data.history){
 const backups=JSON.parse(localStorage.getItem(safetyKey)||'[]');
 const snapshot={id:crypto.randomUUID(),createdAt:new Date().toISOString(),reason,history,recoveryKey:cloudSecret,draft:localStorage.getItem(draftKey),original:localStorage.getItem(key)};
 if(!write(safetyKey,[...backups,snapshot].slice(-5)))throw Error('Copia di sicurezza non riuscita. Operazione annullata; archivio attuale conservato.');
 return snapshot;
}
function readRecoveryCode(value){
 const text=value.trim();if(/^[a-f0-9]{64}$/.test(text))return text;
 try{const url=new URL(text);if(url.origin===location.origin&&url.pathname===location.pathname){const code=new URLSearchParams(url.hash.slice(1)).get('connect');if(/^[a-f0-9]{64}$/.test(code||''))return code;}}catch{}
 throw Error('Incolla il link personale o il codice di recupero del tracker.');
}
function write(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{status('Salvataggio sul dispositivo non riuscito. Esporta i dati prima di chiudere.');return false;}}
function formatDuration(ms){const s=Math.max(0,Math.floor(ms/1000));return [Math.floor(s/3600),Math.floor(s%3600/60),s%60].map(v=>String(v).padStart(2,'0')).join(':');}
function updateTimer(){$('timer').textContent=formatDuration(workoutStart?Date.now()-workoutStart:lastDuration||0);}
function setWorkoutButton(){$('startWorkout').textContent=workoutStart?'■ Termina allenamento':'▶ Inizia allenamento';}
function saveDraft(){
 drafts[day]={exercises:[...document.querySelectorAll('#exercises .card')].map((c,i)=>({...drafts[day]?.exercises?.[i],name:workouts[day][i][0],completed:c.querySelector('.exercise-complete').checked,weight:c.querySelector('.weight').value,reps:[...c.querySelectorAll('.rep')].filter(x=>!x.disabled).map(x=>x.value)})),notes:$('notes').value};
 if(write(draftKey,{day,drafts,workoutStart,lastDuration}))status('Bozza salvata sul dispositivo');
}
function startWorkout(){workoutStart=Date.now();lastDuration=null;saveDraft();clearInterval(timerId);timerId=setInterval(updateTimer,1000);updateTimer();setWorkoutButton();}
function endWorkout(){if(!workoutStart)return;lastDuration=Date.now()-workoutStart;workoutStart=null;clearInterval(timerId);saveDraft();updateTimer();setWorkoutButton();}
function lastFor(name){for(const h of data.history){if(h.day!==day)continue;const e=h.exercises.find(x=>x.name===name);if(e)return e;}return null;}
function render(){
 document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.day===day));$('dayTitle').textContent='Allenamento '+day;
 $('lastDate').textContent=data.history.find(h=>h.day===day)?.date||'—';$('exercises').innerHTML='';
 workouts[day].forEach((e,i)=>{const [name,initial,sets,min,max,startReps]=e,last=lastFor(name),draft=drafts[day]?.exercises?.[i],weight=draft?.weight??last?.weight??initial??'';const c=document.createElement('div');c.className='card';
 c.innerHTML=`<div class="name">${esc(name)}</div><div class="meta">Target: ${sets} × ${min}–${max}${initial?' · peso iniziale '+initial+' kg':''}</div><div class="weight-row"><label for="weight-${i}">Peso usato</label><input id="weight-${i}" aria-label="Peso ${esc(name)}" class="weight" inputmode="decimal" type="number" min="0" max="2000" step="0.5" value="${esc(weight)}"> kg</div><div class="inputs"><span class="lbl">Reps</span>${[0,1,2,3].map(j=>`<input aria-label="${esc(name)} serie ${j+1}" inputmode="numeric" type="number" min="0" max="1000" step="1" class="rep" value="${esc(draft?.reps?.[j]??'')}" placeholder="${j<sets?'reps':'—'}" ${j>=sets?'disabled':''}>`).join('')}</div><div class="startpoint">Partenza: ${initial==null?'carico da impostare':initial?initial+' kg':'corpo libero'}${startReps.length?' — '+startReps.join(' / '):''}</div><div class="last">Ultimo allenamento: ${last?esc(last.weight+' kg — '+last.reps.map(r=>r??'—').join(' / ')):'nessun dato'}</div>${(()=>{const s=!last&&initial==null?{text:'Inserisci il carico usato per questo esercizio.',neutral:true}:GymCore.suggestion(last,sets,min,max,last?.weight??initial);return `<div class="suggestion ${s.neutral?'neutral':''}">💡 ${esc(s.text)}</div>`;})()}`;
 c.dataset.exercise=i;
 c.insertAdjacentHTML('beforeend',`<div class="rest-controls" role="group" aria-label="Recupero ${esc(name)}"><div class="rest-title">Recupero · <span class="rest-setting"></span></div><div class="rest-buttons"><button type="button" data-rest="minus" aria-label="Riduci recupero ${esc(name)} di 30 secondi">−30 s</button><output class="rest-countdown" aria-label="Timer ${esc(name)}"></output><button type="button" data-rest="plus" aria-label="Aumenta recupero ${esc(name)} di 30 secondi">+30 s</button><button type="button" data-rest="toggle">Avvia</button><button type="button" data-rest="reset">Reset</button></div></div><label class="complete-label"><input type="checkbox" class="exercise-complete" aria-label="${esc(name)} completato" ${draft?.completed?'checked':''}> Esercizio completato</label>`);
 $('exercises').appendChild(c);
 });$('notes').value=drafts[day]?.notes||'';renderHistory();updateTimer();setWorkoutButton();updateExerciseStatus();
}
function renderHistory(){const hs=data.history.filter(h=>h.day===day).slice(0,20);$('history').innerHTML=hs.length?hs.map(h=>`<div class="history"><b>${esc(h.date)}</b> · ${h.exercises.filter(e=>e.reps.some(r=>r!==null)).length} esercizi${h.duration?' · '+formatDuration(h.duration):''}<br><span class="small">${acknowledgedIds.has(h.id)?'Sincronizzato ✓':'Salvato sul dispositivo · in attesa di sincronizzazione'}</span><br><span class="small">${esc(h.notes)}</span></div>`).join(''):'<div class="small">Nessun allenamento salvato.</div>';}
function saveWorkout(){
 if(archiveBusy){status('Attendi il completamento del collegamento. La bozza resta salvata.');return;}
 if(historyBroken){status('Prima recupera o esporta lo storico non leggibile.');return;}
 let exercises;try{for(const c of document.querySelectorAll('#exercises .card')){if([...c.querySelectorAll('.rep')].some(r=>!r.disabled&&r.value.trim()!=='')&&c.querySelector('.weight').value.trim()==='')throw Error('Inserisci il peso usato per '+workouts[day][Number(c.dataset.exercise)][0]);}exercises=[...document.querySelectorAll('#exercises .card')].map((c,i)=>({name:workouts[day][i][0],weight:Number(c.querySelector('.weight').value),reps:[...c.querySelectorAll('.rep')].filter(x=>!x.disabled).map(x=>x.value.trim()===''?null:Number(x.value))}));
 exercises=exercises.filter(e=>e.reps.some(r=>r!==null));if(!exercises.length)throw Error('Inserisci almeno una serie prima di salvare.');
 const h=GymCore.validateWorkout({id:crypto.randomUUID(),createdAt:new Date().toISOString(),day,date:new Date().toLocaleDateString('it-IT'),duration:workoutStart?Date.now()-workoutStart:lastDuration,exercises,notes:$('notes').value});
 persistHistory([h,...data.history]);
 }catch(err){status(err.message);return;}
 workoutStart=null;lastDuration=null;clearInterval(timerId);localStorage.removeItem('gymWorkoutStart');delete drafts[day];write(draftKey,{day,drafts,workoutStart,lastDuration});render();status('Allenamento salvato sul dispositivo');savingFeedback();syncCloud();
}
function downloadBackup(){const raw=localStorage.getItem(key);const payload=historyBroken?raw:JSON.stringify({version:2,exportedAt:new Date().toISOString(),history:data.history,drafts,recoveryKey:cloudSecret},null,2);const url=URL.createObjectURL(new Blob([payload],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='gym-tracker-backup-'+new Date().toISOString().slice(0,10)+'.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function importBackup(event){
 const file=event.target.files[0];if(!file)return;
 try{
  const imported=JSON.parse(await file.text());
  const importedHistory=await GymCore.normalizeHistory(Array.isArray(imported)?imported:imported.history);
  if(!confirm('Aggiungere '+importedHistory.length+' allenamenti all’archivio attuale? Conservo una copia precedente e sincronizzo automaticamente.'))return;
  if(archiveBusy)throw Error('Attendi il completamento del collegamento.');
  if(syncTask)await syncTask;
  if(archiveBusy)throw Error('Attendi il completamento del collegamento.');
  if(historyBroken)throw Error('Prima recupera o esporta lo storico non leggibile.');
  saveDraft();safetyBackup('Importazione');
  persistHistory(GymCore.mergeHistory(data.history,importedHistory));
  render();status('Allenamenti aggiunti. Copia precedente conservata.');await syncCloud();
 }catch(err){status('Importazione non riuscita: '+err.message);}finally{event.target.value='';}
}
async function cloudRequest(body,secret=cloudSecret){
 if(!/^[a-f0-9]{64}$/.test(secret||''))throw Error('Archivio non collegato');
 const response=await fetch(GYM_CONFIG.endpoint,{method:'POST',headers:{'Content-Type':'application/json','X-Gym-Key':secret},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw Error('Cloud non disponibile');return response.json();
}
async function readCloud(secret){
 let offset=0,remote=[];
 while(true){
  const page=await cloudRequest({offset},secret);
  if(page.exists!==true){if(offset===0)return {exists:false,history:[]};throw Error('Archivio non disponibile');}
  const rows=await GymCore.normalizeHistory(page.workouts);remote.push(...rows);
  if(!page.hasMore)break;
  if(!rows.length||offset+rows.length>20000)throw Error('Storico cloud non valido');offset+=rows.length;
 }
 return {exists:true,history:GymCore.mergeHistory(remote,[])};
}
async function uploadHistory(history,secret){
 await cloudRequest({register:true},secret);
 for(let i=0;i<history.length;i+=100){const saved=await cloudRequest({workouts:history.slice(i,i+100)},secret);if(saved.saved!==true)throw Error('Salvataggio cloud non confermato');}
}
function verifyCloud(expected,remote){
 const records=new Map(remote.map(h=>[h.id,h]));
 for(const h of expected){const actual=records.get(h.id);if(!actual||JSON.stringify(GymCore.validateWorkout(actual))!==JSON.stringify(GymCore.validateWorkout(h)))throw Error('Allenamento non ancora verificato nel cloud');}
}
function syncCloud(){
 if(historyBroken||!cloudSecret||archiveBusy)return Promise.resolve(false);
 if(syncTask){syncAgain=true;return syncTask;}
 if(!GYM_CONFIG.endpoint||!navigator.onLine){$('cloudStatus').textContent='Offline · dati salvati sul dispositivo. Sincronizzazione automatica appena torna la connessione.';savingFeedback();return Promise.resolve(false);}
 syncBusy=true;savingFeedback();$('cloudStatus').textContent='Sincronizzazione automatica in corso…';
 const secret=cloudSecret;
 syncTask=Promise.resolve().then(async()=>{
  try{
   persistHistory(data.history);
   const snapshot=[...data.history],pending=snapshot.filter(h=>!acknowledgedIds.has(h.id));
   await uploadHistory(pending,secret);
   const remote=await readCloud(secret);if(!remote.exists)throw Error('Archivio non trovato');
   verifyCloud(snapshot,remote.history);
   if(secret!==cloudSecret)throw Error('Archivio cambiato durante la sincronizzazione');
   persistHistory(GymCore.mergeHistory(data.history,remote.history),{ack:new Set(remote.history.map(h=>h.id)),syncedAt:new Date().toISOString()});
   renderHistory();$('lastDate').textContent=data.history.find(h=>h.day===day)?.date||'—';
   [...document.querySelectorAll('#exercises .card')].forEach((c,i)=>{const e=workouts[day][i],last=lastFor(e[0]),s=!last&&e[1]==null?{text:'Inserisci il carico usato per questo esercizio.',neutral:true}:GymCore.suggestion(last,e[2],e[3],e[4],last?.weight??e[1]);c.querySelector('.last').textContent='Ultimo allenamento: '+(last?last.weight+' kg — '+last.reps.map(r=>r??'—').join(' / '):'nessun dato');c.querySelector('.suggestion').textContent='💡 '+s.text;c.querySelector('.suggestion').classList.toggle('neutral',s.neutral);});
   $('cloudStatus').textContent=pendingCount()?'Nuovi allenamenti in attesa di sincronizzazione…':'Storico sincronizzato ✓ · '+new Date(lastSync).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'});
   if(pendingCount())syncAgain=true;return !pendingCount();
  }catch{$('cloudStatus').textContent='Cloud non raggiungibile o salvataggio non confermato · gli allenamenti restano sul dispositivo. Riprovo automaticamente.';return false;}
  finally{syncBusy=false;syncTask=null;savingFeedback();if(syncAgain){syncAgain=false;queueMicrotask(syncCloud);}}
 });return syncTask;
}
async function connectArchive(value){
 if(archiveBusy)return false;
 if(historyBroken){status('Prima recupera o esporta lo storico non leggibile.');return false;}
 let target;try{target=readRecoveryCode(value);}catch(err){status(err.message);return false;}
 if(target===cloudSecret){const synced=await syncCloud();status(synced?'Questa apertura è già collegata al tuo archivio.':'Archivio già collegato; sincronizzazione ancora in attesa.');return synced;}
 archiveBusy=true;savingFeedback();
 try{
  if(syncTask)await syncTask;
  const source=cloudSecret,local=[...data.history];
  // Read both complete archives before changing identity: the source may hold cloud-only sessions.
  const [previous,destination]=await Promise.all([readCloud(source),readCloud(target)]);
  if(!destination.exists)throw Error('Archivio non trovato. Copia il link dall’altra apertura dopo la sincronizzazione.');
  const original=GymCore.mergeHistory(local,previous.history),combined=GymCore.mergeHistory(original,destination.history);
  if(!confirm('Collegare questa apertura? Qui: '+original.length+' allenamenti; nell’altro archivio: '+destination.history.length+'. Verranno uniti in '+combined.length+' allenamenti. Conservo una copia precedente.'))return false;
  saveDraft();safetyBackup('Collegamento',original);
  await uploadHistory(combined,target);const verified=await readCloud(target);verifyCloud(combined,verified.history);
  if(source!==cloudSecret)throw Error('Archivio cambiato in un’altra finestra. Riprova.');
  // Reject another tab switching archives while this preview or request was open.
  const stored=JSON.parse(localStorage.getItem(key)||'{}');if(stored.recoveryKey&&stored.recoveryKey!==source)throw Error('Archivio cambiato in un’altra finestra. Riprova.');
  persistHistory(GymCore.mergeHistory(combined,verified.history),{secret:target,ack:new Set(verified.history.map(h=>h.id)),syncedAt:new Date().toISOString(),switchArchive:true});
  render();status('Aperture collegate. Allenamenti uniti e copia precedente conservata.');$('cloudStatus').textContent='Storico sincronizzato ✓ · '+data.history.length+' allenamenti';return true;
 }catch(err){status('Collegamento non completato: '+err.message+' L’archivio precedente è conservato.');return false;}
 finally{archiveBusy=false;savingFeedback();}
}
async function recoverPreviousArchive(){
 if(archiveBusy||historyBroken)return;
 try{
  const backups=JSON.parse(localStorage.getItem(safetyKey)||'[]'),snapshot=[...backups].reverse().find(b=>b.reason==='Collegamento'||b.reason==='Importazione');
  if(!snapshot){status('Nessuna copia precedente disponibile su questo dispositivo.');return;}
  if(!confirm('Recuperare la copia del '+new Date(snapshot.createdAt).toLocaleString('it-IT')+'? Tornerai al collegamento precedente, mantenendo anche tutti gli allenamenti attuali.'))return;
  archiveBusy=true;savingFeedback();if(syncTask)await syncTask;
  const recovered=await GymCore.normalizeHistory(snapshot.history);saveDraft();safetyBackup('Recupero');
  persistHistory(GymCore.mergeHistory(data.history,recovered),{secret:readRecoveryCode(snapshot.recoveryKey),ack:new Set(),syncedAt:null,switchArchive:true});
  render();status('Archivio precedente recuperato. Tutti gli allenamenti conservati.');
 }catch(err){status('Recupero non completato: '+err.message);}finally{archiveBusy=false;savingFeedback();}
 await syncCloud();
}

async function initialize(){
 try{const raw=localStorage.getItem(key),stored=raw?JSON.parse(raw):{};data={history:await GymCore.normalizeHistory(stored.history||[])};acknowledgedIds=new Set(stored.acknowledgedIds||[]);lastSync=stored.lastSync||null;cloudSecret=stored.recoveryKey||null;if(raw&&!localStorage.getItem('gymTrackerOriginalBackupV2'))localStorage.setItem('gymTrackerOriginalBackupV2',raw);}
 catch{historyBroken=true;status('Storico non leggibile. Usa Esporta dati per conservarlo; non è stato cancellato.');}
 try{const currentDraft=localStorage.getItem(draftKey);const d=JSON.parse(currentDraft||localStorage.getItem('gymDraftsV2')||'{}');drafts=d.drafts||{};
 if(!currentDraft){drafts=Object.fromEntries(Object.entries(drafts).filter(([day])=>GymCore.DAYS.includes(day)).map(([day,draft])=>[day,{...draft,exercises:workouts[day].map(([name])=>{const index=legacyWorkoutNames[day].indexOf(name);return index<0?{name}:{...draft.exercises?.[index],name};})}]));}
 day=GymCore.DAYS.includes(d.day)?d.day:'A';workoutStart=d.workoutStart||Number(localStorage.getItem('gymWorkoutStart'))||null;lastDuration=d.lastDuration||null;}catch{status('Bozza non leggibile: lo storico è conservato.');}
 try{cloudSecret=cloudSecret||localStorage.getItem(cloudKey);if(!/^[a-f0-9]{64}$/.test(cloudSecret||'')){cloudSecret=Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');localStorage.setItem(cloudKey,cloudSecret);}}
 catch{cloudSecret=null;$('cloudStatus').textContent='Salvataggio cloud non disponibile: memoria del browser bloccata.';}
 if(!historyBroken&&cloudSecret){try{persistHistory(data.history);}catch{historyBroken=true;}}

 document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{saveDraft();day=b.dataset.day;render();write(draftKey,{day,drafts,workoutStart,lastDuration});});
 $('exercises').addEventListener('input',()=>{saveDraft();updateExerciseStatus();});$('notes').addEventListener('input',saveDraft);$('exercises').addEventListener('click',handleRestClick);
 $('startWorkout').onclick=()=>workoutStart?endWorkout():startWorkout();$('save').onclick=saveWorkout;$('export').onclick=downloadBackup;$('import').onclick=()=>$('fileImport').click();$('fileImport').onchange=importBackup;
 $('reset').onclick=()=>{if(!confirm('Svuotare solo la bozza di questo giorno? Gli allenamenti salvati restano nello storico.'))return;delete drafts[day];write(draftKey,{day,drafts,workoutStart,lastDuration});render();status('Bozza svuotata');};
 $('sync').onclick=syncCloud;
 $('recovery').onclick=()=>prompt('Codice privato: chi lo possiede può leggere i tuoi allenamenti.',cloudSecret);
 $('copyLink').onclick=async()=>{if(historyBroken||!cloudSecret){status('Prima recupera lo storico sul dispositivo.');return;}if(!await syncCloud()){status('Collegamento in attesa: torna online e riprova. Gli allenamenti restano qui.');return;}const link=new URL(location.pathname,location.origin);link.hash='connect='+cloudSecret;try{await navigator.clipboard.writeText(link.href);status('Link personale copiato. Nell’altra apertura usa Collega app o browser. Conservalo in privato.');}catch{prompt('Copia questo link privato e incollalo in Collega app o browser nell’altra apertura.',link.href);}};
 $('restoreCloud').onclick=()=>{const value=prompt('Incolla il link personale copiato dall’altra apertura (oppure il codice di recupero).');if(value)connectArchive(value);};
 $('undoArchive').onclick=recoverPreviousArchive;
 window.addEventListener('online',syncCloud);window.addEventListener('offline',()=>{$('cloudStatus').textContent='Offline · dati salvati sul dispositivo. Sincronizzazione automatica appena torna la connessione.';savingFeedback();});
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')syncCloud();});
 window.addEventListener('pageshow',()=>syncCloud());
 window.addEventListener('storage',event=>{if(event.key===key){try{const stored=JSON.parse(event.newValue||'{}');if(!stored.history)return;const same=!stored.recoveryKey||stored.recoveryKey===cloudSecret;data={history:same?GymCore.mergeHistory(data.history,stored.history):stored.history.map(GymCore.validateWorkout)};if(stored.recoveryKey)cloudSecret=stored.recoveryKey;acknowledgedIds=new Set(stored.acknowledgedIds||[]);lastSync=stored.lastSync||null;renderHistory();savingFeedback();if(syncBusy)syncAgain=true;}catch{}}});
 render();savingFeedback();const incoming=new URLSearchParams(location.hash.slice(1)).get('connect');if(incoming){history.replaceState(null,'',location.pathname+location.search);await connectArchive(incoming);}
 setInterval(updateExerciseStatus,500);if(workoutStart)timerId=setInterval(updateTimer,1000);if(cloudSecret)syncCloud();setInterval(syncCloud,15000);
 if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
}
initialize().catch(()=>status('Avvio non riuscito. Esporta i dati e ricarica la pagina.'));

