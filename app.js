const workouts={
 A:[
  ['Chest Press',35,3,8,12,[]],
  ['Croci con manubri su panca',6,3,10,15,[15,15,12]],
  ['Rematore con manubri',14,3,8,12,[8,8,8]],
  ['Shoulder Press con manubri',10,3,8,12,[]],
  ['Tricipiti al cavo',17.5,3,10,15,[]],
  ['Addominali',0,3,10,15,[]]
 ],
 B:[
  ['Lat Machine',50,3,8,12,[8,8,8]],
  ['Chest Press',35,3,8,12,[9,9,9]],
  ['Leg Curl',35,3,10,15,[12,12,12]],
  ['Back Extension / Iperestensioni',0,3,8,12,[]],
  ['Bicipiti con manubri',10,3,8,12,[8,8,6]],
  ['Squat a corpo libero',0,2,10,15,[]]
 ],
 C:[
  ['Lat Machine',50,3,8,12,[8,8,8]],
  ['Chest Press',30,3,8,12,[]],
  ['Shoulder Press con manubri',8,3,8,12,[]],
  ['Leg Extension',0,2,10,15,[]],
  ['Rematore con manubri',12,3,8,12,[]],
  ['Tricipiti al cavo',15,2,10,15,[]],
  ['Bicipiti con manubri',10,2,8,12,[]],
  ['Addominali',0,2,10,15,[]]
 ]
};
const key='gymTrackerV1',draftKey='gymDraftsV2',cloudKey='gymCloudKeyV1';
let day='A',data={history:[]},drafts={},workoutStart=null,timerId=null,lastDuration=null,cloudSecret=null,syncBusy=false,syncAgain=false,historyBroken=false;
const $=id=>document.getElementById(id),esc=GymCore.escapeHtml;
function status(text){$('saveStatus').textContent=text;}
function write(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{status('Salvataggio sul dispositivo non riuscito. Esporta i dati prima di chiudere.');return false;}}
function formatDuration(ms){const s=Math.max(0,Math.floor(ms/1000));return [Math.floor(s/3600),Math.floor(s%3600/60),s%60].map(v=>String(v).padStart(2,'0')).join(':');}
function updateTimer(){$('timer').textContent=formatDuration(workoutStart?Date.now()-workoutStart:lastDuration||0);}
function setWorkoutButton(){$('startWorkout').textContent=workoutStart?'■ Termina allenamento':'▶ Inizia allenamento';}
function saveDraft(){
 drafts[day]={exercises:[...document.querySelectorAll('#exercises .card')].map(c=>({weight:c.querySelector('.weight').value,reps:[...c.querySelectorAll('.rep')].filter(x=>!x.disabled).map(x=>x.value)})),notes:$('notes').value};
 if(write(draftKey,{day,drafts,workoutStart,lastDuration}))status('Bozza salvata sul dispositivo');
}
function startWorkout(){workoutStart=Date.now();lastDuration=null;saveDraft();clearInterval(timerId);timerId=setInterval(updateTimer,1000);updateTimer();setWorkoutButton();}
function endWorkout(){if(!workoutStart)return;lastDuration=Date.now()-workoutStart;workoutStart=null;clearInterval(timerId);saveDraft();updateTimer();setWorkoutButton();}
function lastFor(name){for(const h of data.history){if(h.day!==day)continue;const e=h.exercises.find(x=>x.name===name);if(e)return e;}return null;}
function render(){
 document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.day===day));$('dayTitle').textContent='Allenamento '+day;
 $('lastDate').textContent=data.history.find(h=>h.day===day)?.date||'—';$('exercises').innerHTML='';
 workouts[day].forEach((e,i)=>{const [name,initial,sets,min,max,startReps]=e,last=lastFor(name),draft=drafts[day]?.exercises?.[i],weight=draft?.weight??last?.weight??initial;const c=document.createElement('div');c.className='card';
 c.innerHTML=`<div class="name">${esc(name)}</div><div class="meta">Target: ${sets} × ${min}–${max}${initial?' · peso iniziale '+initial+' kg':''}</div><div class="weight-row"><label for="weight-${i}">Peso usato</label><input id="weight-${i}" aria-label="Peso ${esc(name)}" class="weight" inputmode="decimal" type="number" min="0" max="2000" step="0.5" value="${esc(weight)}"> kg</div><div class="inputs"><span class="lbl">Reps</span>${[0,1,2,3].map(j=>`<input aria-label="${esc(name)} serie ${j+1}" inputmode="numeric" type="number" min="0" max="1000" step="1" class="rep" value="${esc(draft?.reps?.[j]??'')}" placeholder="${j<sets?'reps':'—'}" ${j>=sets?'disabled':''}>`).join('')}</div><div class="startpoint">Partenza: ${initial?initial+' kg':'corpo libero'}${startReps.length?' — '+startReps.join(' / '):''}</div><div class="last">Ultimo allenamento: ${last?esc(last.weight+' kg — '+last.reps.map(r=>r??'—').join(' / ')):'nessun dato'}</div>${(()=>{const s=GymCore.suggestion(last,sets,min,max,last?.weight??initial);return `<div class="suggestion ${s.neutral?'neutral':''}">💡 ${esc(s.text)}</div>`;})()}`;
 $('exercises').appendChild(c);
 });$('notes').value=drafts[day]?.notes||'';renderHistory();updateTimer();setWorkoutButton();
}
function renderHistory(){const hs=data.history.filter(h=>h.day===day).slice(0,20);$('history').innerHTML=hs.length?hs.map(h=>`<div class="history"><b>${esc(h.date)}</b> · ${h.exercises.filter(e=>e.reps.some(r=>r!==null)).length} esercizi${h.duration?' · '+formatDuration(h.duration):''}<br><span class="small">${esc(h.notes)}</span></div>`).join(''):'<div class="small">Nessun allenamento salvato.</div>';}
function saveWorkout(){
 if(historyBroken){status('Prima recupera o esporta lo storico non leggibile.');return;}
 let exercises;try{exercises=[...document.querySelectorAll('#exercises .card')].map((c,i)=>({name:workouts[day][i][0],weight:Number(c.querySelector('.weight').value),reps:[...c.querySelectorAll('.rep')].filter(x=>!x.disabled).map(x=>x.value.trim()===''?null:Number(x.value))}));
 if(!exercises.some(e=>e.reps.some(r=>r!==null)))throw Error('Inserisci almeno una serie prima di salvare.');
 const h=GymCore.validateWorkout({id:crypto.randomUUID(),createdAt:new Date().toISOString(),day,date:new Date().toLocaleDateString('it-IT'),duration:workoutStart?Date.now()-workoutStart:lastDuration,exercises,notes:$('notes').value});
 const current=JSON.parse(localStorage.getItem(key)||'{"history":[]}').history.map(GymCore.validateWorkout);const next={history:GymCore.mergeHistory([h,...data.history],current)};if(!write(key,next))return;data=next;
 }catch(err){status(err.message);return;}
 workoutStart=null;lastDuration=null;clearInterval(timerId);localStorage.removeItem('gymWorkoutStart');delete drafts[day];write(draftKey,{day,drafts,workoutStart,lastDuration});render();status('Allenamento salvato sul dispositivo');syncCloud();
}
function downloadBackup(){const raw=localStorage.getItem(key);const payload=historyBroken?raw:JSON.stringify({version:2,exportedAt:new Date().toISOString(),history:data.history,drafts,recoveryKey:cloudSecret},null,2);const url=URL.createObjectURL(new Blob([payload],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='gym-tracker-backup-'+new Date().toISOString().slice(0,10)+'.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function importBackup(event){const file=event.target.files[0];if(!file)return;if(syncBusy){status('Attendi la sincronizzazione prima di importare');event.target.value='';return;}try{
 const imported=JSON.parse(await file.text()),history=await GymCore.normalizeHistory(Array.isArray(imported)?imported:imported.history);
 if(imported.recoveryKey&&!/^[a-f0-9]{64}$/.test(imported.recoveryKey))throw Error('Codice di recupero non valido');
 if(!confirm('Aggiungere gli allenamenti del backup senza cancellare lo storico?'+(imported.recoveryKey?' Questo dispositivo verrà collegato al salvataggio cloud del backup.':'')))return;
 const next={history:GymCore.mergeHistory(data.history,history)};if(!write(key,next))return;
 if(imported.recoveryKey){localStorage.setItem(cloudKey,imported.recoveryKey);cloudSecret=imported.recoveryKey;}
 data=next;historyBroken=false;render();status('Backup aggiunto sul dispositivo');syncCloud();
 }catch(err){status('Importazione non riuscita: '+err.message);}finally{event.target.value='';}}
async function cloudRequest(body){
 const response=await fetch(GYM_CONFIG.endpoint,{method:'POST',headers:{'Content-Type':'application/json','X-Gym-Key':cloudSecret},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw Error('Cloud non disponibile');return response.json();
}
async function syncCloud(){
 if(historyBroken)return;if(!GYM_CONFIG.endpoint){$('cloudStatus').textContent='Cloud in configurazione · dati salvati sul dispositivo';return;}
 if(syncBusy){syncAgain=true;return;}if(!navigator.onLine){$('cloudStatus').textContent='Offline · sincronizzazione appena torna la connessione';return;}
 syncBusy=true;$('cloudStatus').textContent='Sincronizzazione in corso…';
 try{
 await cloudRequest({register:true});const snapshot=[...data.history];for(let i=0;i<snapshot.length;i+=100)await cloudRequest({workouts:snapshot.slice(i,i+100)});
 let offset=0,remote=[];while(true){const page=await cloudRequest({offset});remote.push(...await GymCore.normalizeHistory(page.workouts));if(!page.hasMore)break;offset+=page.workouts.length;if(offset>20000)throw Error('Storico troppo grande');}
 const next={history:GymCore.mergeHistory(data.history,remote)};if(!write(key,next))throw Error('Spazio sul dispositivo esaurito');data=next;renderHistory();$('lastDate').textContent=data.history.find(h=>h.day===day)?.date||'—';
 // Update suggestions without disturbing the draft or focus.
 [...document.querySelectorAll('#exercises .card')].forEach((c,i)=>{const e=workouts[day][i],last=lastFor(e[0]),s=GymCore.suggestion(last,e[2],e[3],e[4],last?.weight??e[1]);c.querySelector('.last').textContent='Ultimo allenamento: '+(last?last.weight+' kg — '+last.reps.map(r=>r??'—').join(' / '):'nessun dato');c.querySelector('.suggestion').textContent='💡 '+s.text;c.querySelector('.suggestion').classList.toggle('neutral',s.neutral);});
 $('cloudStatus').textContent='Storico sincronizzato ✓ · '+new Date().toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'});
 }catch{$('cloudStatus').textContent='Cloud non raggiungibile · i dati restano sul dispositivo. Riprovo automaticamente.';}
 finally{syncBusy=false;if(syncAgain){syncAgain=false;syncCloud();}}
}
async function initialize(){
 try{const raw=localStorage.getItem(key);data={history:await GymCore.normalizeHistory(raw?JSON.parse(raw).history:[])};if(raw&&!localStorage.getItem('gymTrackerOriginalBackupV2'))localStorage.setItem('gymTrackerOriginalBackupV2',raw);if(!write(key,data))historyBroken=true;}
 catch{historyBroken=true;status('Storico non leggibile. Usa Esporta dati per conservarlo; non è stato cancellato.');}
 try{const d=JSON.parse(localStorage.getItem(draftKey)||'{}');drafts=d.drafts||{};day=GymCore.DAYS.includes(d.day)?d.day:'A';workoutStart=d.workoutStart||Number(localStorage.getItem('gymWorkoutStart'))||null;lastDuration=d.lastDuration||null;}catch{status('Bozza non leggibile: lo storico è conservato.');}
 try{cloudSecret=localStorage.getItem(cloudKey);if(!/^[a-f0-9]{64}$/.test(cloudSecret||'')){cloudSecret=Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');localStorage.setItem(cloudKey,cloudSecret);}}
 catch{cloudSecret=null;$('cloudStatus').textContent='Salvataggio cloud non disponibile: memoria del browser bloccata.';}
 document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{saveDraft();day=b.dataset.day;render();write(draftKey,{day,drafts,workoutStart,lastDuration});});
 $('exercises').addEventListener('input',saveDraft);$('notes').addEventListener('input',saveDraft);
 $('startWorkout').onclick=()=>workoutStart?endWorkout():startWorkout();$('save').onclick=saveWorkout;$('export').onclick=downloadBackup;$('import').onclick=()=>$('fileImport').click();$('fileImport').onchange=importBackup;
 $('reset').onclick=()=>{if(!confirm('Svuotare solo la bozza di questo giorno? Gli allenamenti salvati restano nello storico.'))return;delete drafts[day];write(draftKey,{day,drafts,workoutStart,lastDuration});render();status('Bozza svuotata');};
 $('sync').onclick=syncCloud;$('recovery').onclick=()=>{const code=prompt('Conserva questo codice in un posto privato. Su un altro dispositivo usa “Ripristina cloud”. Chi lo possiede può leggere lo storico.',cloudSecret);};
 $('restoreCloud').onclick=async()=>{const code=prompt('Inserisci il codice di recupero del tuo tracker');if(!code)return;if(!/^[a-f0-9]{64}$/.test(code.trim())){status('Codice non valido');return;}if(!confirm('Collegare questo dispositivo al tracker del codice? Lo storico locale verrà aggiunto senza cancellazioni.'))return;if(syncBusy){status('Attendi il completamento della sincronizzazione');return;}const previous=cloudSecret;try{cloudSecret=code.trim();const check=await cloudRequest({offset:0});if(!check.exists){cloudSecret=previous;status('Codice non trovato: controlla il codice e la connessione');return;}localStorage.setItem(cloudKey,cloudSecret);await syncCloud();}catch{cloudSecret=previous;status('Recupero non riuscito: controlla la connessione');}};
 window.addEventListener('online',syncCloud);window.addEventListener('offline',()=>{$('cloudStatus').textContent='Offline · dati salvati sul dispositivo';});
 window.addEventListener('storage',event=>{if(event.key===key){try{data={history:GymCore.mergeHistory(data.history,JSON.parse(event.newValue||'{"history":[]}').history)};renderHistory();}catch{}}});
 render();if(workoutStart)timerId=setInterval(updateTimer,1000);if(cloudSecret)syncCloud();setInterval(syncCloud,60000);
 if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
}
initialize().catch(()=>status('Avvio non riuscito. Esporta i dati e ricarica la pagina.'));


