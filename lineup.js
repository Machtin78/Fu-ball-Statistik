/* Separate storage keeps the plan independent from match resets. Player indices
   remain stable when names or shirt numbers are edited in the existing roster. */
const LINEUP_KEY='footballTrackerLineupV1';
const LINEUP_SIZES={seven:7,nine:9,eleven:11};
const LINEUP_FAVORITES={
  seven:['2-3-1','3-2-1','2-2-2','3-1-2'],
  nine:['3-3-2','4-2-2','3-4-1','3-2-3','2-4-2','4-3-1'],
  eleven:['4-4-2','4-3-3','3-4-3','3-5-2','5-3-2']
};
function formationOptions(outfield,favorites){
  const generated=[];
  function distribute(remaining,rows,parts=[]){
    if(rows===1){if(remaining>0)generated.push([...parts,remaining].join('-'));return;}
    for(let count=1;count<=remaining-rows+1;count++)distribute(remaining-count,rows-1,[...parts,count]);
  }
  for(let rows=2;rows<=4;rows++)distribute(outfield,rows);
  const favoriteSet=new Set(favorites);
  generated.sort((a,b)=>{const aa=a.split('-').map(Number),bb=b.split('-').map(Number),score=values=>values.reduce((sum,value)=>sum+value*value,0);return aa.length-bb.length||score(aa)-score(bb)||bb[0]-aa[0]||a.localeCompare(b);});
  return [...favorites,...generated.filter(value=>!favoriteSet.has(value))];
}
const LINEUP_FORMATIONS=Object.fromEntries(Object.entries(LINEUP_SIZES).map(([mode,size])=>[mode,formationOptions(size-1,LINEUP_FAVORITES[mode])]));
const INVITATION_DEFAULT={opponent:'',date:'',meetingTime:'',kickoffTime:'',location:'',jerseyLaundry:'',homeMatch:true,kiosk1:'',kiosk2:''};
function newLineup(teamName=''){return {teamName,mode:'nine',formation:'3-3-2',field:Array(8).fill(null),keeper:null,bench:Array(2).fill(null),matchNumbers:{},playerRefs:{},invitation:{...INVITATION_DEFAULT}};}
function lineupPlayerRef(player){return player?{name:String(player.name||'').trim(),birthday:String(player.birthday||'').trim()}:null;}
function lineupRefMatches(ref,player){return !!ref&&!!player&&ref.name===String(player.name||'').trim()&&ref.birthday===String(player.birthday||'').trim();}
function resolveSavedLineupPlayers(plan){
  const roster=globalThis.teamSync?.roster||players,refs=plan.playerRefs||{},assigned=[plan.keeper,...plan.field,...plan.bench].filter(Number.isInteger);
  const indices=[...new Set([...assigned,...Object.keys(plan.matchNumbers||{}).map(Number).filter(Number.isInteger)])],mapping={};
  indices.forEach(oldIndex=>{
    const ref=refs[oldIndex]||lineupPlayerRef(roster[oldIndex]);
    if(!ref)return;
    const matches=roster.map((player,index)=>lineupRefMatches(ref,player)?index:-1).filter(index=>index>=0);
    const current=matches.length===1?matches[0]:oldIndex;
    mapping[oldIndex]=current;
    if(!refs[oldIndex])refs[oldIndex]=ref;
  });
  const remap=value=>Number.isInteger(value)?mapping[value]??value:null;
  plan.field=plan.field.map(remap);plan.keeper=remap(plan.keeper);plan.bench=plan.bench.map(remap);
  plan.matchNumbers=Object.fromEntries(Object.entries(plan.matchNumbers||{}).map(([index,number])=>[mapping[index]??index,number]));
  plan.playerRefs=Object.fromEntries(Object.entries(refs).map(([index,ref])=>[mapping[index]??index,ref]));
  return plan;
}
function normalizeLineup(saved,teamName=''){
  const normalized={...newLineup(teamName),...saved,teamName:saved?.teamName||teamName,invitation:{...INVITATION_DEFAULT,...saved?.invitation}};
  if(!LINEUP_FORMATIONS[normalized.mode]?.includes(normalized.formation)||!Array.isArray(saved?.field)||!Array.isArray(saved?.bench))return newLineup(teamName);
  const seen=new Set(),valid=value=>{if(!Number.isInteger(value)||value<0||seen.has(value))return null;seen.add(value);return value;};
  normalized.field=Array.from({length:LINEUP_SIZES[normalized.mode]-1},(_,index)=>valid(saved.field[index]));
  normalized.keeper=valid(saved.keeper);
  normalized.bench=saved.bench.map(valid);
  normalized.matchNumbers=Object.fromEntries(Object.entries(saved.matchNumbers||{}).filter(([index,value])=>Number.isInteger(Number(index))&&Number(index)>=0&&/^\d{1,3}$/.test(String(value))));
  normalized.playerRefs=Object.fromEntries(Object.entries(saved.playerRefs||{}).filter(([index,ref])=>Number.isInteger(Number(index))&&Number(index)>=0&&ref&&typeof ref.name==='string').map(([index,ref])=>[index,{name:ref.name,birthday:String(ref.birthday||'')}]));
  return resolveSavedLineupPlayers(normalized);
}
let lineups=[newLineup('TSV Buchenberg 1')],activeLineupIndex=0,lineup=lineups[0];
let freeLineups=lineups.slice(),lineupPlans={},activeFixtureIds=[null,null];
try{
  const saved=JSON.parse(localStorage.getItem(LINEUP_KEY));
  if(saved?.version===3&&Array.isArray(saved.freeLineups)&&saved.freeLineups.length){
    freeLineups=saved.freeLineups.slice(0,2).map((item,index)=>normalizeLineup(item,`TSV Buchenberg ${index+1}`));
    lineupPlans=Object.fromEntries(Object.entries(saved.plans||{}).filter(([id,item])=>id&&item&&typeof item==='object'&&(Number(item.teamIndex)===0||Number(item.teamIndex)===1)).map(([id,item])=>[id,normalizeLineup(item,freeLineups[Number(item.teamIndex)]?.teamName||`TSV Buchenberg ${Number(item.teamIndex)+1}`)]));
    activeFixtureIds=Array.isArray(saved.activeFixtureIds)?saved.activeFixtureIds.slice(0,2):[null,null];
    lineups=freeLineups.map((plan,index)=>lineupPlans[activeFixtureIds[index]]||plan);
    activeLineupIndex=Math.min(Number(saved.activeLineupIndex)||0,lineups.length-1);
  }
  else if(saved?.version===2&&Array.isArray(saved.lineups)&&saved.lineups.length){lineups=saved.lineups.slice(0,2).map((item,index)=>normalizeLineup(item,`TSV Buchenberg ${index+1}`));freeLineups=lineups.slice();activeLineupIndex=Math.min(Number(saved.activeLineupIndex)||0,lineups.length-1);}
  else if(saved)lineups=[normalizeLineup(saved,'TSV Buchenberg 1')];
  if(saved&&!saved.version)freeLineups=lineups.slice();
  lineup=lineups[activeLineupIndex];
}catch(e){console.warn('Aufstellung konnte nicht geladen werden.',e);}
const lineupPage=document.createElement('section');
lineupPage.id='page_aufstellung';lineupPage.className='page';
lineupPage.innerHTML=`<div class="sec lineup-panel">
  <h2 id="lineupPageHeading">Aufstellung planen</h2>
  <p class="subtle">Position antippen, um einen Spieler auszuwählen, oder einen eingesetzten Spieler auf eine andere Position bzw. einen Bankplatz ziehen, um zu tauschen. Spielnummern bleiben beim Spieler.</p>
  <label class="lineup-fixture-picker">Spieltag auswählen<select id="lineupFixtureSelect" aria-label="Aufstellung für Spieltag auswählen"></select></label>
  <p class="subtle lineup-fixture-help">Jeder Spieltermin hat eine eigene Aufstellung und Einladung. Für eine noch leere Aufstellung werden Spieler und Formation vom vorherigen Spiel derselben Mannschaft übernommen. Änderungen werden automatisch gespeichert.</p>
  <div class="lineup-invite-editor">
    <h3>Einladung zu diesem Spieltag</h3>
    <div class="invite-form-grid">
      <label class="invite-opponent">Gegner<input id="inviteOpponent" type="text" list="inviteOpponentOptions" autocomplete="off"><datalist id="inviteOpponentOptions"></datalist></label>
      <label class="invite-date">Datum<input id="inviteDate" type="date"></label>
      <label class="invite-meeting">Treffpunkt um<input id="inviteMeetingTime" type="time"></label>
      <label class="invite-kickoff">Spielbeginn<input id="inviteKickoffTime" type="time"></label>
      <label class="invite-wide">Spielort<input id="inviteLocation" type="text" autocomplete="street-address"></label>
      <label class="invite-laundry">Trikots wäscht<select id="inviteLaundry"><option value="">Spieler auswählen</option></select></label>
      <label class="invite-home-toggle"><input id="inviteHomeMatch" type="checkbox"> Heimspiel mit Kioskdienst</label>
      <div id="inviteKioskFields" class="invite-kiosk invite-wide">
        <label>Kiosk – Spieler 1<select id="inviteKiosk1"><option value="">Spieler auswählen</option></select></label>
        <label>Kiosk – Spieler 2<select id="inviteKiosk2"><option value="">Spieler auswählen</option></select></label>
      </div>
      <p id="inviteServiceWarning" class="service-warning invite-wide" role="alert" hidden></p>
    </div>
  </div>
  <div class="lineup-invite-summary">
    <div class="invite-title"><img src="tsv-buchenberg-logo.png" alt="TSV Buchenberg"><div><strong id="inviteTitleText">TSV Buchenberg</strong><span>Einladung und Aufstellung zum nächsten Spiel</span></div></div>
    <p>Liebe Eltern und Spieler, für das Spiel haben wir folgende Spieler nominiert.</p>
    <dl class="invite-facts">
      <div><dt>Termin</dt><dd id="inviteSummaryDate">–</dd></div>
      <div><dt>Treffen</dt><dd id="inviteSummaryMeeting">–</dd></div>
      <div><dt>Spiel</dt><dd id="inviteSummaryKickoff">–</dd></div>
      <div><dt>Ort</dt><dd id="inviteSummaryLocation">–</dd></div>
    </dl>
  </div>
  <details class="availability-editor">
    <summary>Abwesenheiten verwalten</summary>
    <p>Abwesenheiten gelten für beide Mannschaften. Du kannst mehrere Tage pro Spieler eintragen.</p>
    <div class="availability-fields">
      <label>Spieler<select id="absencePlayer"></select></label>
      <label>Datum<input id="absenceDate" type="date"></label>
    </div>
    <button id="absenceAdd" class="actionBtn blue" type="button">Abwesenheit eintragen</button>
    <p id="absenceStatus" role="status"></p>
    <div id="absenceList"></div>
  </details>
  <p id="availabilityWarning" class="subtle" role="status" hidden></p>
  <div class="lineup-absence-panel">
    <h3>Absagen für diesen Spieltag</h3>
    <p id="lineupAbsenceDate"></p>
    <p>Kann ein Spieler doch teilnehmen, tippe bei seinem Namen auf „Absage zurücknehmen“.</p>
    <div class="lineup-absence-entry"><select id="lineupAbsencePlayer" aria-label="Spieler für Absage auswählen"></select><button id="lineupAbsenceAdd" type="button">Absage eintragen</button></div>
    <p id="lineupAbsenceStatus" role="status"></p>
    <div id="lineupAbsenceList"></div>
  </div>
  <div class="lineup-controls">
    <label>Mannschaftsgröße<select id="lineupMode"><option value="seven">7 Spieler (inkl. Torwart)</option><option value="nine">9 Spieler (inkl. Torwart)</option><option value="eleven">11 Spieler (inkl. Torwart)</option></select></label>
    <label>Formation<select id="lineupFormation"></select></label>
  </div>
  <button id="lineupToMatch" class="actionBtn blue" type="button">Zum Spieltag</button>
  <p id="lineupCount" class="subtle"></p>
  <div class="lineup-pitch" aria-label="Fußballfeld zur Aufstellungsplanung">
    <div class="pitch-lines" aria-hidden="true"><div class="pitch-half"></div><div class="pitch-circle"></div><div class="pitch-area top"></div><div class="pitch-area bottom"></div></div>
    <div class="attack-direction">↑ Spielrichtung</div><div id="lineupPositions"></div>
  </div>
  <h3 class="bench-heading">Auswechselbank</h3><div id="lineupBench" class="lineup-bench"></div>
  <div class="invite-tasks">
    <div><strong>Trikots wäscht</strong><span id="inviteSummaryLaundry">–</span></div>
    <div id="inviteSummaryKioskRow"><strong>Kiosk</strong><span id="inviteSummaryKiosk">–</span></div>
  </div>
  <p class="invite-footer">Bitte gebt uns rechtzeitig Bescheid, wenn ein nominiertes Kind nicht spielen kann.<br>Wir freuen uns auf ein spannendes Spiel mit sportlichen Grüßen – Eure Trainer</p>
  <button id="lineupAddBench" class="actionBtn blue" type="button">+ Bankplatz hinzufügen</button>
  <button id="lineupCopyFormationImage" class="actionBtn transparent" type="button">Aufstellung als Bild kopieren</button>
  <button id="lineupCopyImage" class="actionBtn transparent" type="button">Einladung als Bild kopieren</button>
  <button id="lineupCreateSecond" class="actionBtn transparent" type="button">Weitere Aufstellung erstellen</button>
  <button id="lineupRemoveSecond" class="actionBtn transparent" type="button" hidden>2. Aufstellung entfernen</button>
  <p id="lineupSaveStatus" class="subtle" role="status">Änderungen werden automatisch gespeichert.</p>
  </div>
  <dialog id="lineupPicker" aria-labelledby="lineupPickerTitle"><form method="dialog"><button class="picker-close" aria-label="Auswahl schließen">✕</button></form><h3 id="lineupPickerTitle">Spieler auswählen</h3><div id="lineupPickerOptions"></div></dialog>`;
document.querySelector('.c').appendChild(lineupPage);
function persistLineup(){
  if(globalThis.teamSync?.roster){globalThis.teamSync.changed();return;}
  lineups.forEach((plan,index)=>{if(activeFixtureIds[index])lineupPlans[activeFixtureIds[index]]=plan;else freeLineups[index]=plan;});
  allLineupPlans().forEach(({plan})=>{
    plan.playerRefs??={};
    [plan.keeper,...plan.field,...plan.bench].filter(Number.isInteger).forEach(index=>{
      if(!plan.playerRefs[index]&&lineupRoster()[index])plan.playerRefs[index]=lineupPlayerRef(lineupRoster()[index]);
    });
  });
  try{localStorage.setItem(LINEUP_KEY,JSON.stringify({version:3,activeLineupIndex,activeFixtureIds,freeLineups,plans:lineupPlans}));document.getElementById('lineupSaveStatus').textContent=globalThis.location?.protocol==='file:'?'Aufstellung auf diesem Gerät gespeichert.':'Aufstellung gespeichert · zentraler Abgleich läuft.';}
  catch(e){document.getElementById('lineupSaveStatus').textContent='Speichern nicht möglich. Bitte Browserspeicher prüfen; Änderungen sind momentan nur in dieser Sitzung verfügbar.';}
}
function openMatchFromLineup(){
  const roster=lineupRoster(),indices=[...new Set([lineup.keeper,...lineup.field,...lineup.bench].filter(index=>Number.isInteger(index)&&roster[index]&&!playerUnavailable(index)))];
  const selectedPlayers=indices.map(index=>({...roster[index],number:String(lineup.matchNumbers?.[index]||'')}));
  prepareLineupMatch({fixtureId:activeFixtureIds[activeLineupIndex]||null,team:lineup.teamName||ownTeamName(),opponent:lineup.invitation.opponent||'',date:lineup.invitation.date||'',location:lineup.invitation.location||'',ownSide:lineup.invitation.homeMatch?'home':'away',players:selectedPlayers,services:globalThis.getCurrentLineupServices()});
}
document.getElementById('lineupToMatch').onclick=openMatchFromLineup;
function openLineupForCurrentMatch(){
  const current=typeof matchContext!=='undefined'?matchContext:null;
  const scheduled=typeof scheduledMatchForCurrentDetails==='function'?scheduledMatchForCurrentDetails():null;
  const fixtureId=current?.fixtureId||scheduled?.id||null;
  if(current&&!current.fixtureId&&scheduled){current.fixtureId=String(scheduled.id);if(typeof saveState==='function')saveState();}
  const ownName=current?.team||(current?.ownSide==='home'?current?.home:current?.away);
  const teamIndex=Number(scheduled?.team??( /\s2(?:\.?\s*Mannschaft)?$/i.test(String(ownName||''))?1:0));
  if(fixtureId&&typeof selectLineupFixture==='function'&&selectLineupFixture(String(fixtureId),teamIndex))return;
  if(scheduled&&typeof selectLineupFixture==='function'&&selectLineupFixture(String(scheduled.id),Number(scheduled.team)||0))return;
  alert('Für diesen Spieltag ist noch keine passende Aufstellung hinterlegt.');
}
globalThis.openLineupForCurrentMatch=openLineupForCurrentMatch;
function validAbsenceDate(value){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const date=new Date(value+'T12:00:00Z');return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;
}
function playerUnavailable(index,date=lineup.invitation?.date){
  const player=lineupRoster()[index];
  return validAbsenceDate(date)&&Array.isArray(player?.absences)&&player.absences.includes(date);
}
function clearAbsentAssignments(index,date){
  let changed=false;
  allLineupPlans().forEach(({plan})=>{
    if(plan.invitation?.date!==date)return;
    plan.field=plan.field.map(value=>{if(value!==index)return value;changed=true;plan.lineupInitialized=true;return null;});
    if(plan.keeper===index){plan.keeper=null;changed=true;plan.lineupInitialized=true;}
    plan.bench=plan.bench.map(value=>{if(value!==index)return value;changed=true;plan.lineupInitialized=true;return null;});
  });
  return changed;
}
function reconcileLineupAbsences(date){
  if(!validAbsenceDate(date))return;
  const unavailable=new Set(allLineupPlans().map(({plan})=>plan).filter(plan=>plan.invitation?.date===date).flatMap(plan=>[plan.keeper,...plan.field,...plan.bench]).filter(index=>Number.isInteger(index)&&playerUnavailable(index,date)));
  let cleared=false;unavailable.forEach(index=>{cleared=clearAbsentAssignments(index,date)||cleared;});
  if(cleared)persistLineup();
}
function changePlayerAbsence(index,date,remove=false){
  const player=lineupRoster()[index];
  if(!player||!validAbsenceDate(date)){document.getElementById('absenceStatus').textContent='Bitte einen Spieler und ein gültiges Datum auswählen.';return;}
  const dates=new Set(Array.isArray(player.absences)?player.absences.filter(validAbsenceDate):[]);
  if(remove)dates.delete(date);else dates.add(date);
  player.absences=[...dates].sort();
  const cleared=!remove&&clearAbsentAssignments(index,date);
  let message='';
  try{
    if(globalThis.teamSync?.roster)globalThis.teamSync.changed();else{saveState();if(cleared)persistLineup();}
    message=remove?'Absage von '+(player.name||'Spieler')+' zurückgenommen. Der Spieler ist wieder auswählbar.':cleared?'Absage gespeichert. Der Spieler wurde aus der Aufstellung entfernt.':'Absage gespeichert.';
  }catch(e){message='Speichern fehlgeschlagen. Bitte Browserspeicher prüfen.';}
  document.getElementById('absenceStatus').textContent=message;
  const quickStatus=document.getElementById('lineupAbsenceStatus');quickStatus.dataset.date=date;quickStatus.textContent=date===lineup.invitation?.date?message:'';
  renderLineup();
}
function renderAvailability(){
  const select=document.getElementById('absencePlayer'),selected=select.value,roster=lineupRoster();select.replaceChildren();
  roster.map((player,index)=>({player,index})).sort((a,b)=>String(a.player.name||'').localeCompare(String(b.player.name||''),'de')).forEach(({player,index})=>select.add(new Option(player.name||'Ohne Namen',String(index))));
  if(selected!==undefined&&roster[Number(selected)])select.value=selected;
  const date=document.getElementById('absenceDate');if(!date.value)date.value=lineup.invitation?.date||'';
  const list=document.getElementById('absenceList');list.replaceChildren();
  const entries=roster.flatMap((player,index)=>(Array.isArray(player.absences)?player.absences:[]).filter(validAbsenceDate).map(date=>({player,index,date}))).sort((a,b)=>a.date.localeCompare(b.date)||String(a.player.name||'').localeCompare(String(b.player.name||''),'de'));
  entries.forEach(({player,index,date})=>{
    const row=document.createElement('div');row.className='absence-entry';const text=document.createElement('span');text.textContent=(player.name||'Ohne Namen')+' · '+formatInviteDate(date);
    const remove=document.createElement('button');remove.type='button';remove.textContent='Entfernen';remove.setAttribute('aria-label','Abwesenheit von '+(player.name||'Spieler')+' am '+formatInviteDate(date)+' entfernen');remove.onclick=()=>changePlayerAbsence(index,date,true);row.append(text,remove);list.appendChild(row);
  });
  if(!entries.length)list.textContent='Noch keine Abwesenheiten eingetragen.';
  const unavailable=lineupSlots().filter(slot=>slot.value!==null&&playerUnavailable(slot.value)).map(slot=>roster[slot.value]?.name||'Ohne Namen');
  const warning=document.getElementById('availabilityWarning');warning.hidden=!unavailable.length;warning.textContent=unavailable.length?'Am '+formatInviteDate(lineup.invitation.date)+' nicht verfügbar, aber noch aufgestellt: '+[...new Set(unavailable)].join(', '):'';
  const matchDate=lineup.invitation?.date,hasDate=validAbsenceDate(matchDate),quickSelect=document.getElementById('lineupAbsencePlayer'),quickSelected=quickSelect.value;
  const quickStatus=document.getElementById('lineupAbsenceStatus');if(quickStatus.dataset.date!==matchDate)quickStatus.textContent='';
  document.getElementById('lineupAbsenceDate').textContent=hasDate?'Termin: '+formatInviteDate(matchDate):'Bitte zuerst das Datum der Einladung eintragen.';
  const available=roster.map((player,index)=>({player,index})).filter(({index})=>!hasDate||!playerUnavailable(index,matchDate)).sort((a,b)=>String(a.player.name||'').localeCompare(String(b.player.name||''),'de'));
  quickSelect.replaceChildren(new Option('Spieler auswählen',''),...available.map(({player,index})=>new Option(player.name||'Ohne Namen',String(index))));
  quickSelect.value=available.some(({index})=>String(index)===quickSelected)?quickSelected:'';
  document.getElementById('lineupAbsenceAdd').disabled=!hasDate;
  const quickList=document.getElementById('lineupAbsenceList');quickList.replaceChildren();
  if(hasDate)roster.forEach((player,index)=>{if(!playerUnavailable(index,matchDate))return;const row=document.createElement('div');row.className='absence-entry';const name=document.createElement('span');name.textContent=player.name||'Ohne Namen';const undo=document.createElement('button');undo.type='button';undo.textContent='Absage zurücknehmen';undo.onclick=()=>changePlayerAbsence(index,matchDate,true);row.append(name,undo);quickList.appendChild(row);});
  if(!quickList.children.length)quickList.textContent=hasDate?'Für diesen Termin liegen keine Absagen vor.':'';
}
document.getElementById('absenceAdd').onclick=()=>{const value=document.getElementById('absencePlayer').value;changePlayerAbsence(value===''?-1:Number(value),document.getElementById('absenceDate').value);};
document.getElementById('lineupAbsenceAdd').onclick=()=>{const value=document.getElementById('lineupAbsencePlayer').value;changePlayerAbsence(value===''?-1:Number(value),lineup.invitation?.date);};
function lineupRoster(){return globalThis.teamSync?.roster || players;}
function lineupPlayerLabel(index){
  if(index===null)return 'Spieler wählen';
  const current=lineupRoster()[index],ref=lineup.playerRefs?.[index];
  const name=current?.name||ref?.name;
  const number=lineup.matchNumbers?.[index];
  return name?[number?'#'+number:'',name].filter(Boolean).join(' '):'Spieler wählen';
}
function ownTeamName(){return document.getElementById('myTeamName')?.value?.trim()||document.getElementById('tH')?.value?.trim()||'TSV Buchenberg';}
function homeMatchAddress(){return document.getElementById('homeMatchAddress')?.value?.trim()||'87474 Buchenberg, Kürnach Str. 11';}
function formatInviteDate(value){
  if(!value)return '–';
  const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
  if(!match)return value;
  const date=new Date(Date.UTC(Number(match[1]),Number(match[2])-1,Number(match[3]),12));
  return Number.isFinite(date.getTime())?new Intl.DateTimeFormat('de-DE',{weekday:'long',day:'2-digit',month:'2-digit',year:'numeric',timeZone:'UTC'}).format(date):value;
}
function serviceFamilyNames(){
  const roster=typeof lineupRoster==='function'?lineupRoster():(globalThis.teamSync?.roster||players);
  const selected=(typeof lineupSlots==='function'?lineupSlots():[]).map(slot=>slot.value).filter((value,index,values)=>Number.isInteger(value)&&values.indexOf(value)===index).map(index=>roster[index]).filter(Boolean);
  const names=selected.map(player=>String(player.name||'').trim().split(/\s+/).pop()).filter(Boolean);
  return [...new Set(names)].sort((a,b)=>a.localeCompare(b,'de'));
}
function serviceNameKey(value){return String(value||'').trim().split(/\s+/).pop().toLocaleLowerCase('de');}
function serviceCounts(kind){
  const names=serviceFamilyNames(),counts={};names.forEach(name=>counts[name]=0);
  const byKey=Object.fromEntries(names.map(name=>[serviceNameKey(name),name]));
  if(typeof seasonMatches==='function')seasonMatches().forEach(match=>{const values=kind==='laundry'?[match.services?.laundry]:(match.services?.kiosk||[]);values.filter(Boolean).forEach(value=>{const name=byKey[serviceNameKey(value)];if(name)counts[name]++;});});
  return counts;
}
function serviceOptionLabel(name,counts={laundry:serviceCounts('laundry'),kiosk:serviceCounts('kiosk')}){
  const laundry=counts.laundry?.[name]||0,kiosk=counts.kiosk?.[name]||0,total=laundry+kiosk;
  const parts=[];if(laundry)parts.push(`${laundry}× Trikotwäsche`);if(kiosk)parts.push(`${kiosk}× Kiosk`);
  return `${name} – ${total===1?'1 Dienst':total+' Dienste'}${parts.length?' ('+parts.join(', ')+')':' (bisher keine)'}`;
}
function serviceDutyIssues(data={}){
  const allowed=new Set(serviceFamilyNames().map(serviceNameKey));
  const values=[['Trikotwäsche',data.laundry??data.jerseyLaundry],['Kiosk 1',Array.isArray(data.kiosk)?data.kiosk[0]:data.kiosk1],['Kiosk 2',Array.isArray(data.kiosk)?data.kiosk[1]:data.kiosk2]];
  return values.filter(([,value])=>String(value||'').trim()&&!allowed.has(serviceNameKey(value))).map(([label,value])=>({label,value:String(value).trim()}));
}
function serviceDutyWarningText(issues){
  return issues.length?`Bitte neu vergeben: ${issues.map(issue=>issue.label+' – '+issue.value).join(', ')}. Diese Personen stehen nicht in der aktuellen Aufstellung.`:'';
}
globalThis.getServiceDutyIssues=serviceDutyIssues;
globalThis.getServiceOptionLabel=serviceOptionLabel;
globalThis.serviceDutyWarningText=serviceDutyWarningText;
function suggestServiceNames(){
  const families=serviceFamilyNames(),laundryCounts=serviceCounts('laundry'),kioskCounts=serviceCounts('kiosk');
  const byFewest=counts=>(a,b)=>(counts[a]||0)-(counts[b]||0)||a.localeCompare(b,'de');
  const laundry=families.slice().sort(byFewest(laundryCounts))[0]||'';
  const kiosk=families.filter(name=>name!==laundry).sort(byFewest(kioskCounts));
  return {laundry,kiosk1:kiosk[0]||'',kiosk2:kiosk[1]||''};
}
function scheduledMatchesForActiveTeam(){
  if(typeof scheduleMatches==='undefined'||!Array.isArray(scheduleMatches))return [];
  return scheduleMatches.filter(match=>(Number(match.team)||0)===activeLineupIndex).slice().sort((a,b)=>(a.date+'T'+(a.time||'00:00')).localeCompare(b.date+'T'+(b.time||'00:00')));
}
function allLineupPlans(){
  const seen=new Set(),results=[];
  const add=(plan,teamIndex)=>{if(plan&&!seen.has(plan)){seen.add(plan);results.push({plan,teamIndex});}};
  freeLineups.forEach(add);lineups.forEach(add);
  Object.values(lineupPlans).forEach(plan=>add(plan,Number(plan.teamIndex)||0));
  return results;
}
function lineupHasPlayers(plan){return Number.isInteger(plan?.keeper)||[...(plan?.field||[]),...(plan?.bench||[])].some(Number.isInteger);}
function priorLineupMoment(plan){
  const date=plan.invitation?.date,time=plan.invitation?.kickoffTime;
  return validAbsenceDate(date)?date+'T'+(/^\d{2}:\d{2}$/.test(time||'')?time:'00:00'):'';
}
function inheritPreviousLineup(plan,teamIndex,match){
  if(plan.lineupInitialized||lineupHasPlayers(plan)||!validAbsenceDate(match?.date))return null;
  const previous=allLineupPlans().filter(entry=>{
    if(entry.plan===plan||entry.teamIndex!==teamIndex||!lineupHasPlayers(entry.plan))return false;
    const date=entry.plan.invitation?.date;
    return validAbsenceDate(date)&&(date<match.date||(date===match.date&&/^\d{2}:\d{2}$/.test(entry.plan.invitation?.kickoffTime||'')&&/^\d{2}:\d{2}$/.test(match.time||'')&&entry.plan.invitation.kickoffTime<match.time));
  }).sort((a,b)=>priorLineupMoment(b.plan).localeCompare(priorLineupMoment(a.plan)))[0]?.plan;
  if(!previous)return null;
  const roster=lineupRoster(),seen=new Set();
  const copy=value=>{
    if(!Number.isInteger(value)||!roster[value]||seen.has(value)||playerUnavailable(value,match.date))return null;
    seen.add(value);return value;
  };
  const keeper=copy(previous.keeper),field=previous.field.map(copy),bench=previous.bench.map(copy);
  if(!lineupHasPlayers({keeper,field,bench}))return null;
  plan.mode=previous.mode;plan.formation=previous.formation;
  plan.keeper=keeper;plan.field=field;plan.bench=bench;
  plan.matchNumbers=Object.fromEntries([...seen].filter(index=>previous.matchNumbers?.[index]).map(index=>[index,previous.matchNumbers[index]]));
  plan.playerRefs=Object.fromEntries([...seen].map(index=>[index,lineupPlayerRef(roster[index])]));
  plan.lineupInitialized=true;
  return previous;
}
function refreshLineupPlayerRefs(){
  allLineupPlans().forEach(({plan})=>{
    plan.playerRefs??={};
    [plan.keeper,...plan.field,...plan.bench].filter(Number.isInteger).forEach(index=>{
      if(lineupRoster()[index])plan.playerRefs[index]=lineupPlayerRef(lineupRoster()[index]);
    });
  });
  persistLineup();
}
function lineupFixtureLabel(match){return [formatInviteDate(match.date),match.opponent||'Gegner offen',match.time?match.time+' Uhr':''].filter(Boolean).join(' · ');}
function renderLineupFixtureSelect(){
  const select=document.getElementById('lineupFixtureSelect');if(!select)return;
  const selected=activeFixtureIds[activeLineupIndex]||'';
  select.replaceChildren(new Option('Freier Entwurf (ohne Spieltermin)',''),...scheduledMatchesForActiveTeam().map(match=>new Option(lineupFixtureLabel(match),String(match.id))));
  Object.entries(lineupPlans).filter(([id,plan])=>Number(plan.teamIndex)===activeLineupIndex&&!scheduledMatchesForActiveTeam().some(match=>String(match.id)===id)).forEach(([id,plan])=>select.add(new Option('Gespeicherter Plan · '+[formatInviteDate(plan.invitation?.date),plan.invitation?.opponent].filter(Boolean).join(' · '),id)));
  select.value=selected;
}
function ensureLineupTeam(teamIndex){
  if(lineups[teamIndex])return true;
  if(teamIndex!==1)return false;
  const base=ownTeamName().replace(/\s+[12]\.?(?:\s*Mannschaft)?$/i,'').trim()||'TSV Buchenberg';
  lineups[0].teamName=base+' 1';freeLineups[0].teamName=base+' 1';
  const second=newLineup(base+' 2');lineups.push(second);freeLineups.push(second);
  return true;
}
function selectLineupFixture(id,teamIndex=activeLineupIndex){
  if(!ensureLineupTeam(teamIndex))return false;
  const match=id&&typeof scheduleMatches!=='undefined'?scheduleMatches.find(item=>String(item.id)===String(id)):null;
  if(id&&!match&&!lineupPlans[String(id)])return false;
  if(match&&(Number(match.team)||0)!==teamIndex)return false;
  if(!match&&id&&Number(lineupPlans[String(id)]?.teamIndex)!==teamIndex)return false;
  // Keep the currently edited object before changing the active pointer.
  if(activeFixtureIds[teamIndex])lineupPlans[activeFixtureIds[teamIndex]]=lineups[teamIndex];
  else freeLineups[teamIndex]=lineups[teamIndex];
  let inheritedFrom=null;
  if(id){
    let plan=lineupPlans[String(id)];
    if(!plan){
      const legacy=freeLineups[teamIndex];
      const sameLegacy=legacy?.invitation?.date===match.date&&String(legacy.invitation?.opponent||'').trim().toLocaleLowerCase('de')===String(match.opponent||'').trim().toLocaleLowerCase('de');
      plan=sameLegacy?legacy:newLineup(lineups[teamIndex].teamName);
      if(sameLegacy)freeLineups[teamIndex]=newLineup(plan.teamName);
      plan.teamIndex=teamIndex;
      plan.invitation={...INVITATION_DEFAULT,...plan.invitation,opponent:match.opponent||'',date:match.date||'',kickoffTime:match.time||'',location:match.location||'',homeMatch:!!match.home};
      lineupPlans[String(id)]=plan;
    }
    if(match)inheritedFrom=inheritPreviousLineup(plan,teamIndex,match);
    lineups[teamIndex]=plan;
  }else lineups[teamIndex]=freeLineups[teamIndex]||newLineup(lineups[teamIndex].teamName);
  activeFixtureIds[teamIndex]=id?String(id):null;
  activeLineupIndex=teamIndex;lineup=lineups[teamIndex];
  persistLineup();showPage('aufstellung');renderLineup();updateLineupNav();
  if(inheritedFrom)document.getElementById('lineupSaveStatus').textContent='Aufstellung vom '+formatInviteDate(inheritedFrom.invitation.date)+' derselben Mannschaft übernommen. Die Einladung bleibt für diesen Spieltag getrennt.';
  return true;
}
function updateLineupForScheduleChange(before,after){
  const plan=lineupPlans[String(after.id)];if(!plan)return;
  if(before&&Number(before.team)!==Number(after.team)){
    const oldTeam=Number(before.team)||0;
    if(activeFixtureIds[oldTeam]===String(after.id)){activeFixtureIds[oldTeam]=null;lineups[oldTeam]=freeLineups[oldTeam]||newLineup(lineups[oldTeam].teamName);if(activeLineupIndex===oldTeam)lineup=lineups[oldTeam];}
    plan.teamIndex=Number(after.team)||0;
    if(ensureLineupTeam(plan.teamIndex))plan.teamName=lineups[plan.teamIndex].teamName;
  }
  const fields={date:'date',opponent:'opponent',time:'kickoffTime',location:'location',home:'homeMatch'};
  Object.entries(fields).forEach(([scheduleKey,inviteKey])=>{
    if(!before||String(plan.invitation?.[inviteKey]??'')===String(before[scheduleKey]??''))plan.invitation[inviteKey]=scheduleKey==='home'?!!after.home:String(after[scheduleKey]||'');
  });
  persistLineup();if(lineup===plan)renderLineup();
}
document.getElementById('lineupFixtureSelect').onchange=event=>selectLineupFixture(event.target.value);
function applyScheduledMatch(trigger,value){
  if(activeFixtureIds[activeLineupIndex])return false;
  const matches=scheduledMatchesForActiveTeam();if(!matches.length)return false;
  const normalized=String(value||'').trim().toLocaleLowerCase('de');
  let match;if(trigger==='date')match=matches.find(item=>item.date===value);else match=matches.find(item=>String(item.opponent||'').trim().toLocaleLowerCase('de')===normalized&&(!lineup.invitation.date||item.date===lineup.invitation.date))||matches.find(item=>String(item.opponent||'').trim().toLocaleLowerCase('de')===normalized);
  if(!match)return false;
  Object.assign(lineup.invitation,{opponent:match.opponent||'',date:match.date||'',kickoffTime:match.time||'',location:match.location||'',homeMatch:!!match.home});
  return true;
}
function renderInvitation(){
  const data=lineup.invitation={...INVITATION_DEFAULT,...lineup.invitation};
  if(data.homeMatch&&!data.location)data.location=homeMatchAddress();
  const suggestions=suggestServiceNames();let addedSuggestion=false;
  if(!data.jerseyLaundry&&suggestions.laundry){data.jerseyLaundry=suggestions.laundry;addedSuggestion=true;}
  if(data.homeMatch&&!data.kiosk1&&suggestions.kiosk1){data.kiosk1=suggestions.kiosk1;addedSuggestion=true;}
  if(data.homeMatch&&!data.kiosk2&&suggestions.kiosk2){data.kiosk2=suggestions.kiosk2;addedSuggestion=true;}
  const families=serviceFamilyNames(),counts={laundry:serviceCounts('laundry'),kiosk:serviceCounts('kiosk')};[['inviteLaundry',data.jerseyLaundry],['inviteKiosk1',data.kiosk1],['inviteKiosk2',data.kiosk2]].forEach(([id,current])=>{const select=document.getElementById(id),selected=String(select.value||current||'').trim(),canonical=families.find(name=>serviceNameKey(name)===serviceNameKey(selected)),options=families.map(name=>new Option(serviceOptionLabel(name,counts),name));if(selected&&!canonical)options.push(new Option(selected+' (bisher gespeichert)',selected));select.replaceChildren(new Option('Spieler auswählen',''),...options);select.value=canonical||selected;});
  const opponentOptions=document.getElementById('inviteOpponentOptions');opponentOptions.replaceChildren(...scheduledMatchesForActiveTeam().map(match=>{const option=document.createElement('option');option.value=match.opponent||'';option.label=[formatInviteDate(match.date),match.time?match.time+' Uhr':''].filter(Boolean).join(' · ');return option;}));
  const inviteLogo=document.querySelector('.invite-title img');if(inviteLogo)inviteLogo.src=document.getElementById('appClubLogo')?.src||'tsv-buchenberg-logo.png';
  const fields={inviteOpponent:'opponent',inviteDate:'date',inviteMeetingTime:'meetingTime',inviteKickoffTime:'kickoffTime',inviteLocation:'location',inviteLaundry:'jerseyLaundry',inviteKiosk1:'kiosk1',inviteKiosk2:'kiosk2'};
  Object.entries(fields).forEach(([id,key])=>{const input=document.getElementById(id);if(document.activeElement!==input)input.value=data[key]||'';});
  document.getElementById('inviteHomeMatch').checked=!!data.homeMatch;
  document.getElementById('inviteKioskFields').hidden=!data.homeMatch;
  const ownName=lineup.teamName||ownTeamName();
  document.getElementById('inviteTitleText').textContent=data.opponent?(data.homeMatch?`${ownName} – ${data.opponent}`:`${data.opponent} – ${ownName}`):ownName;
  document.getElementById('inviteSummaryDate').textContent=formatInviteDate(data.date);
  document.getElementById('inviteSummaryMeeting').textContent=data.meetingTime?data.meetingTime+' Uhr':'–';
  document.getElementById('inviteSummaryKickoff').textContent=data.kickoffTime?data.kickoffTime+' Uhr':'–';
  document.getElementById('inviteSummaryLocation').textContent=data.location||'–';
  document.getElementById('inviteSummaryLaundry').textContent=data.jerseyLaundry||'–';
  const kioskRow=document.getElementById('inviteSummaryKioskRow');kioskRow.hidden=!data.homeMatch;
  document.getElementById('inviteSummaryKiosk').textContent=[data.kiosk1,data.kiosk2].filter(Boolean).join(' / ')||'–';
  const warning=document.getElementById('inviteServiceWarning'),issues=serviceDutyIssues({jerseyLaundry:data.jerseyLaundry,kiosk1:data.homeMatch?data.kiosk1:'',kiosk2:data.homeMatch?data.kiosk2:''});if(warning){warning.hidden=!issues.length;warning.textContent=serviceDutyWarningText(issues);}
  if(addedSuggestion)persistLineup();
}
globalThis.getCurrentLineupServices=()=>({laundry:String(lineup.invitation?.jerseyLaundry||'').trim(),kiosk:lineup.invitation?.homeMatch?[lineup.invitation?.kiosk1,lineup.invitation?.kiosk2].map(value=>String(value||'').trim()).filter(Boolean):[],team:lineup.teamName||''});
function lineupSlots(){return [...lineup.field.map((value,index)=>({group:'field',index,value})),{group:'keeper',index:0,value:lineup.keeper},...lineup.bench.map((value,index)=>({group:'bench',index,value}))];}
function setLineupSlot(group,index,value){if(group==='keeper')lineup.keeper=value;else lineup[group][index]=value;}
function lineupSlotValue(group,index){return group==='keeper'?lineup.keeper:lineup[group]?.[index];}
function swapLineupSlots(fromGroup,fromIndex,toGroup,toIndex){
  const from=lineupSlotValue(fromGroup,fromIndex),to=lineupSlotValue(toGroup,toIndex);
  if(!Number.isInteger(from)||(fromGroup===toGroup&&fromIndex===toIndex)||to===undefined)return false;
  setLineupSlot(fromGroup,fromIndex,to);setLineupSlot(toGroup,toIndex,from);lineup.lineupInitialized=true;
  persistLineup();renderLineup();return true;
}
let lineupDrag=null,lineupSuppressClickUntil=0;
function lineupDropElement(x,y){return document.elementFromPoint(x,y)?.closest('.lineup-position,.bench-slot')||null;}
function clearLineupDrag(){
  if(!lineupDrag)return;
  lineupDrag.target?.classList.remove('lineup-drop-target');
  lineupDrag.source?.classList.remove('lineup-drag-source');
  lineupDrag.ghost?.remove();
  if(lineupDrag.scrollFrame)cancelAnimationFrame(lineupDrag.scrollFrame);
  lineupDrag=null;
}
function moveLineupGhost(drag){
  if(!drag.ghost)return;
  drag.ghost.style.left=drag.x+'px';drag.ghost.style.top=drag.y+'px';
}
function scrollLineupWhileDragging(){
  const drag=lineupDrag;if(!drag||!drag.started)return;
  const edge=72,speed=drag.y<edge?-Math.min(14,(edge-drag.y)/4):drag.y>window.innerHeight-edge?Math.min(14,(drag.y-(window.innerHeight-edge))/4):0;
  if(speed)window.scrollBy(0,speed);
  const target=lineupDropElement(drag.x,drag.y);
  if(target!==drag.target){drag.target?.classList.remove('lineup-drop-target');drag.target=target;if(target&&target!==drag.source)target.classList.add('lineup-drop-target');}
  drag.scrollFrame=requestAnimationFrame(scrollLineupWhileDragging);
}
function enableLineupDrag(element,group,index,value){
  element.dataset.lineupGroup=group;element.dataset.lineupIndex=String(index);
  if(!Number.isInteger(value))return;
  element.classList.add('lineup-draggable');
  element.onpointerdown=event=>{
    if(event.button!==0||event.isPrimary===false)return;
    clearLineupDrag();
    lineupDrag={source:element,group,index,pointerId:event.pointerId,x:event.clientX,y:event.clientY,startX:event.clientX,startY:event.clientY,started:false,target:null,ghost:null,scrollFrame:0};
    element.setPointerCapture?.(event.pointerId);
  };
  element.onpointermove=event=>{
    const drag=lineupDrag;if(!drag||drag.source!==element||drag.pointerId!==event.pointerId)return;
    drag.x=event.clientX;drag.y=event.clientY;
    if(!drag.started&&Math.hypot(drag.x-drag.startX,drag.y-drag.startY)>=8){
      drag.started=true;element.classList.add('lineup-drag-source');
      const ghost=document.createElement('div');ghost.className='lineup-drag-ghost';ghost.textContent=lineupPlayerLabel(value);document.body.appendChild(ghost);drag.ghost=ghost;
      drag.scrollFrame=requestAnimationFrame(scrollLineupWhileDragging);
    }
    if(drag.started){event.preventDefault();moveLineupGhost(drag);}
  };
  element.onpointerup=event=>{
    const drag=lineupDrag;if(!drag||drag.source!==element||drag.pointerId!==event.pointerId)return;
    const moved=drag.started,target=moved?lineupDropElement(event.clientX,event.clientY):null;
    if(moved){lineupSuppressClickUntil=Date.now()+450;event.preventDefault();}
    clearLineupDrag();
    if(target&&target!==element)swapLineupSlots(group,index,target.dataset.lineupGroup,Number(target.dataset.lineupIndex));
  };
  element.onpointercancel=()=>clearLineupDrag();
};
function remapLineupAfterRosterSort(previousOrder){
  const newIndex=previousOrder.map(player=>players.indexOf(player));
  const remap=value=>Number.isInteger(value)&&newIndex[value]>=0?newIndex[value]:null;
  allLineupPlans().forEach(({plan})=>{plan.field=plan.field.map(remap);plan.keeper=remap(plan.keeper);plan.bench=plan.bench.map(remap);plan.matchNumbers=Object.fromEntries(Object.entries(plan.matchNumbers||{}).map(([index,number])=>[newIndex[Number(index)],number]).filter(([index])=>index>=0));plan.playerRefs=Object.fromEntries(Object.entries(plan.playerRefs||{}).map(([index,ref])=>[newIndex[Number(index)],ref]).filter(([index])=>index>=0));});
  persistLineup();renderLineup();
}
function remapLineupsAfterPlayerDeletion(deletedIndex){
  const remap=value=>!Number.isInteger(value)?null:value===deletedIndex?null:value>deletedIndex?value-1:value;
  allLineupPlans().forEach(({plan})=>{plan.field=plan.field.map(remap);plan.keeper=remap(plan.keeper);plan.bench=plan.bench.map(remap);plan.matchNumbers=Object.fromEntries(Object.entries(plan.matchNumbers||{}).filter(([index])=>Number(index)!==deletedIndex).map(([index,number])=>[Number(index)>deletedIndex?Number(index)-1:Number(index),number]));plan.playerRefs=Object.fromEntries(Object.entries(plan.playerRefs||{}).filter(([index])=>Number(index)!==deletedIndex).map(([index,ref])=>[Number(index)>deletedIndex?Number(index)-1:Number(index),ref]));});
  persistLineup();renderLineup();
}
function assignLineupPlayer(group,index,value,matchNumber){
  if(value!==null&&playerUnavailable(value))return;
  lineup.lineupInitialized=true;
  if(value!==null)lineupSlots().filter(s=>s.value===value).forEach(s=>setLineupSlot(s.group,s.index,null));
  setLineupSlot(group,index,value);lineup.matchNumbers??={};lineup.playerRefs??={};if(value!==null)lineup.playerRefs[value]=lineupPlayerRef(lineupRoster()[value]);if(value!==null&&matchNumber!==undefined){if(matchNumber){Object.keys(lineup.matchNumbers).forEach(playerIndex=>{if(Number(playerIndex)!==value&&String(lineup.matchNumbers[playerIndex])===String(matchNumber))delete lineup.matchNumbers[playerIndex];});lineup.matchNumbers[value]=matchNumber;}else delete lineup.matchNumbers[value];}persistLineup();renderLineup();
}
function removeLineupBench(index){
  if(!Number.isInteger(index)||index<0||index>=lineup.bench.length)return;
  lineup.bench.splice(index,1);lineup.lineupInitialized=true;persistLineup();renderLineup();
}
// Friday, Saturday and Sunday belong to the same football weekend.
// Other match days only match that exact date; missing dates never match.
function lineupWeekendKey(value){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;
  const date=new Date(value+'T12:00:00Z');
  if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==value)return null;
  const day=date.getUTCDay();
  if(day===6)date.setUTCDate(date.getUTCDate()-1);
  else if(day===0)date.setUTCDate(date.getUTCDate()-2);
  return date.toISOString().slice(0,10);
}
function lineupSelectionLabel(playerIndex){
  const label=lineupPlayerLabel(playerIndex)+(playerUnavailable(playerIndex)?' (nicht verfügbar)':''),weekend=lineupWeekendKey(lineup.invitation?.date);
  if(!weekend)return label;
  const teams=allLineupPlans().flatMap(({plan,teamIndex})=>{
    if(lineupWeekendKey(plan.invitation?.date)!==weekend)return [];
    return [plan.keeper,...plan.field,...plan.bench].includes(playerIndex)?['('+ (teamIndex+1)+'. Mannschaft)']:[];
  });
  return [label,...new Set(teams)].join(' ');
}
function openLineupPicker(group,index,title){
  const dialog=document.getElementById('lineupPicker'),host=document.getElementById('lineupPickerOptions');
  document.getElementById('lineupPickerTitle').textContent=title;host.replaceChildren();
  const currentValue=group==='keeper'?lineup.keeper:lineup[group][index];
  const assignedPlayers=new Set(lineupSlots().filter(slot=>!(slot.group===group&&slot.index===index)&&slot.value!==null).map(slot=>slot.value));
  function openNumberEntry(playerIndex){
    const player=lineupRoster()[playerIndex],name=player?.name||'diesen Spieler',current=String(lineup.matchNumbers?.[playerIndex]||''),entry=document.createElement('div');
    entry.className='picker-number-entry';
    const label=document.createElement('label');label.htmlFor='lineupNumberInput';label.textContent=`Spielnummer für ${name}`;
    const input=document.createElement('input');input.id='lineupNumberInput';input.type='text';input.inputMode='numeric';input.maxLength=3;input.autocomplete='off';input.value=current;input.setAttribute('aria-label',`Spielnummer für ${name}`);
    const error=document.createElement('p');error.className='picker-number-error';error.hidden=true;
    const actions=document.createElement('div');actions.className='picker-number-actions';
    const save=document.createElement('button');save.type='button';save.textContent='Spieler übernehmen';
    save.onclick=()=>{const number=String(input.value||'').trim();if(number&&!/^\d{1,3}$/.test(number)){error.textContent='Bitte eine Spielnummer mit höchstens drei Ziffern eingeben.';error.hidden=false;input.focus();return;}assignLineupPlayer(group,index,playerIndex,number);dialog.close();};
    const cancel=document.createElement('button');cancel.type='button';cancel.textContent='Zurück';cancel.onclick=()=>openLineupPicker(group,index,title);
    actions.append(save,cancel);entry.append(label,input,error,actions);host.replaceChildren(entry);
    document.getElementById('lineupPickerTitle').textContent=`Spielnummer · ${name}`;input.focus();input.select?.();
  }
  function choice(label,value){const b=document.createElement('button');b.type='button';b.textContent=label;b.disabled=value!==null&&playerUnavailable(value);b.onclick=()=>{if(b.disabled)return;if(value===null){assignLineupPlayer(group,index,null);dialog.close();return;}openNumberEntry(value);};host.appendChild(b);}
  choice('Position freimachen',null);
  if(currentValue!==null&&validAbsenceDate(lineup.invitation?.date)){
    const absent=playerUnavailable(currentValue),button=document.createElement('button');button.type='button';button.className='picker-absence-action';
    button.textContent=absent?'Absage für '+formatInviteDate(lineup.invitation.date)+' zurücknehmen':'Spieler für '+formatInviteDate(lineup.invitation.date)+' absagen';
    button.onclick=()=>{changePlayerAbsence(currentValue,lineup.invitation.date,absent);dialog.close();};host.appendChild(button);
  }
  lineupRoster().map((player,index)=>({player,index})).filter(({index})=>!assignedPlayers.has(index)||index===currentValue).sort((a,b)=>String(a.player.name||'').localeCompare(String(b.player.name||''),'de',{sensitivity:'base'})).forEach(({player,index:i})=>{
    if(playerUnavailable(i)){
      const undo=document.createElement('button');undo.type='button';undo.className='picker-undo-absence';
      undo.textContent=(player.name||'Spieler')+' – Absage zurücknehmen';
      undo.onclick=()=>{dialog.close();changePlayerAbsence(i,lineup.invitation.date,true);};
      host.appendChild(undo);
    }else choice(lineupSelectionLabel(i),i);
  });
  dialog.showModal();
}
function renderLineup(){
  reconcileLineupAbsences(lineup.invitation?.date);
  renderLineupFixtureSelect();
  renderInvitation();
  renderAvailability();
  document.querySelector('.lineup-panel').classList.toggle('second-team',activeLineupIndex===1);
  document.getElementById('lineupPageHeading').textContent=lineups.length>1?`Aufstellung – ${lineup.teamName}`:'Aufstellung planen';
  document.getElementById('lineupMode').value=lineup.mode;
  const formation=document.getElementById('lineupFormation');formation.replaceChildren();
  [3,4,2].forEach(rowCount=>{const group=document.createElement('optgroup');group.label=rowCount+' Reihen';LINEUP_FORMATIONS[lineup.mode].filter(value=>value.split('-').length===rowCount).forEach(value=>group.appendChild(new Option(value,value)));formation.appendChild(group);});formation.value=lineup.formation;
  const host=document.getElementById('lineupPositions');host.replaceChildren();
  const rows=lineup.formation.split('-').map(Number);let index=0;
  function position(group,i,title,x,y,value,width=23){
    const b=document.createElement('button');b.type='button';b.className='lineup-position';b.style.left=x+'%';b.style.top=y+'%';
    b.style.width=width+'%';
    b.setAttribute('aria-label',title+': '+lineupPlayerLabel(value));
    const role=document.createElement('small');role.textContent=title;
    const shirt=document.createElement('span');shirt.className='lineup-shirt';shirt.textContent=lineup.matchNumbers?.[value]||'+';
    const name=document.createElement('span');name.className='lineup-player-name';name.textContent=value===null?'Wählen':lineupRoster()[value]?.name||lineup.playerRefs?.[value]?.name||'Spieler wählen';
    if(playerUnavailable(value)){const warning=document.createElement('span');warning.className='unavailable-badge';warning.textContent='Nicht verfügbar';b.append(warning);}
    b.append(role,shirt,name);b.onclick=()=>{if(Date.now()>=lineupSuppressClickUntil)openLineupPicker(group,i,title);};enableLineupDrag(b,group,i,value);host.appendChild(b);
  }
  const rowNames=rows.length===4?['Abwehr','Mittelfeld','Offensive','Angriff']:rows.length===3?['Abwehr','Mittelfeld','Angriff']:['Abwehr','Angriff'];
  const rowHeights=rows.length===4?[70,53,36,18]:rows.length===3?[66,42,18]:[66,18];
  rows.forEach((count,row)=>{for(let col=0;col<count;col++){const i=index++;position('field',i,rowNames[row]+' '+(col+1),100*(col+.5)/count,rowHeights[row],lineup.field[i],Math.min(23,96/count));}});
  position('keeper',0,'Torwart',50,88,lineup.keeper);
  const bench=document.getElementById('lineupBench');bench.replaceChildren();
  lineup.bench.forEach((value,i)=>{
    const slot=document.createElement('div');slot.className='bench-place';
    const b=document.createElement('button');b.className='bench-slot';b.type='button';
    const label=document.createElement('small');label.textContent='Bankplatz '+(i+1);
    const player=document.createElement('span');player.className='bench-player';
    if(value!==null){
      const shirt=document.createElement('span');shirt.className='lineup-shirt';shirt.textContent=lineup.matchNumbers?.[value]||'+';player.appendChild(shirt);
    }
    const name=document.createElement('span');name.className='bench-player-name';
    name.textContent=value===null?'Spieler wählen':(lineupRoster()[value]?.name||lineup.playerRefs?.[value]?.name||'Spieler wählen')+(playerUnavailable(value)?' · Nicht verfügbar':'');
    player.appendChild(name);b.append(label,player);
    b.setAttribute('aria-label','Bankplatz '+(i+1)+': '+lineupPlayerLabel(value)+(playerUnavailable(value)?' · Nicht verfügbar':''));
    b.onclick=()=>{if(Date.now()>=lineupSuppressClickUntil)openLineupPicker('bench',i,'Bankplatz '+(i+1));};enableLineupDrag(b,'bench',i,value);
    const remove=document.createElement('button');remove.className='bench-remove';remove.type='button';remove.textContent='×';
    remove.title='Bankplatz entfernen';remove.setAttribute('aria-label','Bankplatz '+(i+1)+' entfernen');
    remove.onclick=()=>removeLineupBench(i);slot.append(b,remove);bench.appendChild(slot);
  });
  const assigned=lineup.field.filter(v=>v!==null).length+(lineup.keeper!==null?1:0);
  document.getElementById('lineupCount').textContent=assigned+' / '+LINEUP_SIZES[lineup.mode]+' Positionen besetzt · '+lineup.bench.filter(v=>v!==null).length+' auf der Bank';
}
document.getElementById('lineupMode').onchange=e=>{
  const mode=e.target.value;
  if(!Object.hasOwn(LINEUP_SIZES,mode))return;
  const fieldCount=LINEUP_SIZES[mode]-1;
  const displaced=lineup.field.splice(fieldCount).filter(v=>v!==null);
  displaced.forEach(value=>{const free=lineup.bench.indexOf(null);if(free<0)lineup.bench.push(value);else lineup.bench[free]=value;});
  while(lineup.field.length<fieldCount)lineup.field.push(null);
  lineup.mode=mode;lineup.formation=LINEUP_FORMATIONS[mode][0];lineup.lineupInitialized=true;
  persistLineup();renderLineup();
};
document.getElementById('lineupFormation').onchange=e=>{if(!LINEUP_FORMATIONS[lineup.mode].includes(e.target.value))return;lineup.formation=e.target.value;lineup.lineupInitialized=true;persistLineup();renderLineup();};
document.getElementById('lineupAddBench').onclick=()=>{lineup.bench.push(null);lineup.lineupInitialized=true;persistLineup();renderLineup();};
const inviteFieldMap={inviteOpponent:'opponent',inviteDate:'date',inviteMeetingTime:'meetingTime',inviteKickoffTime:'kickoffTime',inviteLocation:'location',inviteLaundry:'jerseyLaundry',inviteKiosk1:'kiosk1',inviteKiosk2:'kiosk2'};
Object.entries(inviteFieldMap).forEach(([id,key])=>document.getElementById(id).onchange=e=>{lineup.invitation[key]=e.target.value.trim();if(key==='date'||key==='opponent')applyScheduledMatch(key,e.target.value);persistLineup();renderLineup();});
document.getElementById('inviteHomeMatch').onchange=e=>{lineup.invitation.homeMatch=e.target.checked;if(e.target.checked)lineup.invitation.location=homeMatchAddress();persistLineup();renderInvitation();};
function canvasRoundRect(ctx,x,y,w,h,r,fill,stroke){
  ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke();}
}
function canvasText(ctx,text,x,y,maxWidth,lineHeight,maxLines=3){
  const words=String(text||'–').split(/\s+/);let line='',lines=[];
  words.forEach(word=>{const test=line?line+' '+word:word;if(ctx.measureText(test).width>maxWidth&&line){lines.push(line);line=word;}else line=test;});if(line)lines.push(line);
  lines.slice(0,maxLines).forEach((value,index)=>ctx.fillText(value,x,y+index*lineHeight));return Math.min(lines.length,maxLines)*lineHeight;
}
function loadInvitationLogo(){return new Promise(resolve=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>resolve(null);image.src=document.getElementById('appClubLogo')?.src||'tsv-buchenberg-logo.png';});}
function loadGrassBackground(){
  const raw=getComputedStyle(document.body).getPropertyValue('--app-grass-image').trim();
  const match=/^url\((['"]?)(.*?)\1\)$/.exec(raw),src=match?.[2];
  if(!src)return Promise.resolve(null);
  return new Promise(resolve=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>resolve(null);image.src=src;});
}
async function createInvitationImage(){
  const scale=2,width=900,pad=40,listTop=480,rowHeight=58;
  const accent=activeLineupIndex===1?'#0646bd':'#c40000';
  const roster=typeof lineupRoster==='function'?lineupRoster():players;
  const nominated=[lineup.keeper,...lineup.field,...lineup.bench].filter((value,index,values)=>Number.isInteger(value)&&roster[value]&&values.indexOf(value)===index).map((value,order)=>({value,order,number:String(lineup.matchNumbers?.[value]||'').trim()})).sort((a,b)=>{const aNumber=Number(a.number),bNumber=Number(b.number),aHas=/^\d+$/.test(a.number),bHas=/^\d+$/.test(b.number);if(aHas!==bHas)return aHas?-1:1;if(aHas&&aNumber!==bNumber)return aNumber-bNumber;return a.order-b.order;});
  const listRows=Math.max(1,nominated.length),listHeight=58+listRows*rowHeight;
  const taskCount=lineup.invitation.homeMatch?2:1,height=listTop+listHeight+24+taskCount*56+190;
  const canvas=document.createElement('canvas');canvas.width=width*scale;canvas.height=height*scale;const ctx=canvas.getContext('2d');ctx.scale(scale,scale);
  ctx.fillStyle='#f7f8f7';ctx.fillRect(0,0,width,height);ctx.textBaseline='top';ctx.fillStyle='#17251f';
  const logo=await loadInvitationLogo();if(logo)ctx.drawImage(logo,pad,28,72,72);
  ctx.font='700 42px Arial, sans-serif';canvasText(ctx,document.getElementById('inviteTitleText').textContent,130,25,710,46,2);
  ctx.font='28px Arial, sans-serif';ctx.fillText('Einladung zum nächsten Spiel',130,122);ctx.fillStyle=accent;ctx.fillRect(pad,160,width-pad*2,8);
  ctx.fillStyle='#17251f';ctx.font='27px Arial, sans-serif';canvasText(ctx,'Liebe Eltern und Spieler, für das Spiel haben wir folgende Spieler nominiert.',pad,188,width-pad*2,34,2);
  const facts=[['Termin',document.getElementById('inviteSummaryDate').textContent],['Treffen',document.getElementById('inviteSummaryMeeting').textContent],['Spiel',document.getElementById('inviteSummaryKickoff').textContent],['Ort',document.getElementById('inviteSummaryLocation').textContent]];
  facts.forEach(([label,value],index)=>{const y=250+index*52;ctx.fillStyle=accent;ctx.fillRect(pad,y,210,52);ctx.fillStyle='#fff';ctx.font='700 27px Arial, sans-serif';ctx.fillText(label,pad+10,y+10);ctx.fillStyle='#fff';ctx.fillRect(pad+210,y,width-pad*2-210,52);ctx.strokeStyle='#829188';ctx.strokeRect(pad+210,y,width-pad*2-210,52);ctx.fillStyle='#17251f';ctx.font='27px Arial, sans-serif';ctx.fillText(value,pad+222,y+10);});
  ctx.fillStyle=accent;ctx.fillRect(pad,listTop,width-pad*2,58);ctx.fillStyle='#fff';ctx.font='700 30px Arial, sans-serif';ctx.fillText('Nominierte Spieler',pad+16,listTop+12);
  if(nominated.length)nominated.forEach(({value,number},index)=>{const y=listTop+58+index*rowHeight;ctx.fillStyle=index%2?'#eef3f0':'#fff';ctx.fillRect(pad,y,width-pad*2,rowHeight);ctx.strokeStyle='#a4b1aa';ctx.strokeRect(pad,y,width-pad*2,rowHeight);ctx.fillStyle=accent;ctx.fillRect(pad,y,105,rowHeight);ctx.fillStyle='#fff';ctx.font='700 30px Arial, sans-serif';ctx.textAlign='center';ctx.fillText(number||'–',pad+52,y+12);ctx.textAlign='left';ctx.fillStyle='#17251f';ctx.font='700 29px Arial, sans-serif';ctx.fillText(roster[value].name||'Spieler',pad+125,y+12);});
  else{const y=listTop+58;ctx.fillStyle='#fff';ctx.fillRect(pad,y,width-pad*2,rowHeight);ctx.strokeStyle='#a4b1aa';ctx.strokeRect(pad,y,width-pad*2,rowHeight);ctx.fillStyle='#17251f';ctx.font='27px Arial, sans-serif';ctx.fillText('Noch keine Spieler nominiert',pad+16,y+13);}
  let y=listTop+listHeight+24;const tasks=[['Trikots wäscht',document.getElementById('inviteSummaryLaundry').textContent]];if(lineup.invitation.homeMatch)tasks.push(['Kiosk',document.getElementById('inviteSummaryKiosk').textContent]);tasks.forEach(([label,value])=>{ctx.fillStyle=accent;ctx.fillRect(pad,y,230,56);ctx.fillStyle='#fff';ctx.font='700 27px Arial, sans-serif';ctx.fillText(label,pad+10,y+12);ctx.fillStyle='#fff';ctx.fillRect(pad+230,y,width-pad*2-230,56);ctx.strokeStyle='#829188';ctx.strokeRect(pad+230,y,width-pad*2-230,56);ctx.fillStyle='#17251f';ctx.font='27px Arial, sans-serif';ctx.fillText(value,pad+242,y+12);y+=56;});
  y+=24;ctx.fillStyle='#17251f';ctx.font='26px Arial, sans-serif';canvasText(ctx,'Bitte gebt uns rechtzeitig Bescheid, wenn ein nominiertes Kind nicht spielen kann.',pad,y,width-pad*2,34,2);y+=74;canvasText(ctx,'Wir freuen uns auf ein spannendes Spiel mit sportlichen Grüßen – Eure Trainer',pad,y,width-pad*2,34,2);
  return canvas;
}
async function createFormationImage(){
  const width=Math.min(390,Math.max(280,window.innerWidth-12)),scale=2;
  const source=document.querySelector('.lineup-pitch'),benchSource=document.getElementById('lineupBench');
  const root=document.createElement('div');root.className='lineup-panel'+(activeLineupIndex===1?' second-team':'');
  root.style.cssText=`position:fixed;left:-10000px;top:0;width:${width}px;max-width:none;box-sizing:border-box;padding:14px;visibility:hidden;pointer-events:none;`;
  const pitch=source.cloneNode(true),heading=document.querySelector('.bench-heading').cloneNode(true),bench=benchSource.cloneNode(true);
  pitch.style.marginTop='0';root.append(pitch,heading,bench);document.body.appendChild(root);
  try{
    const origin=root.getBoundingClientRect(),height=Math.ceil(origin.height);
    const canvas=document.createElement('canvas');canvas.width=width*scale;canvas.height=height*scale;
    const ctx=canvas.getContext('2d');ctx.scale(scale,scale);ctx.textBaseline='top';
    const offset=element=>{const rect=element.getBoundingClientRect();return {x:rect.left-origin.left,y:rect.top-origin.top,w:rect.width,h:rect.height};};
    const grassImage=await loadGrassBackground();
    const cover=(x,y,w,h)=>{if(!grassImage)return;const ratio=Math.max(w/grassImage.width,h/grassImage.height),drawW=grassImage.width*ratio,drawH=grassImage.height*ratio;ctx.drawImage(grassImage,x+(w-drawW)/2,y+(h-drawH)/2,drawW,drawH);};
    ctx.fillStyle='#183f16';ctx.fillRect(0,0,width,height);cover(0,0,width,height);ctx.fillStyle='#0a1915db';ctx.fillRect(0,0,width,height);
    const field=offset(pitch);ctx.save();canvasRoundRect(ctx,field.x,field.y,field.w,field.h,10,false);ctx.clip();ctx.fillStyle='#183f16';ctx.fillRect(field.x,field.y,field.w,field.h);cover(field.x,field.y,field.w,field.h);ctx.fillStyle='#0000001a';ctx.fillRect(field.x,field.y,field.w,field.h);ctx.restore();
    const lines=offset(pitch.querySelector('.pitch-lines'));ctx.strokeStyle='#ffffff8c';ctx.lineWidth=2;ctx.strokeRect(lines.x+1,lines.y+1,lines.w-2,lines.h-2);
    pitch.querySelectorAll('.pitch-area').forEach(element=>{const box=offset(element);ctx.strokeRect(box.x+1,box.y+1,box.w-2,box.h-2);});
    const direction=offset(pitch.querySelector('.attack-direction'));ctx.fillStyle='#fff';ctx.font='11px Arial, sans-serif';ctx.textAlign='center';ctx.fillText('↑ Spielrichtung',direction.x+direction.w/2,direction.y);
    const accent=getComputedStyle(root).getPropertyValue('--invite-accent').trim()||'#c40000';
    const fit=(value,maxWidth)=>{let text=String(value||'');while(text.length>4&&ctx.measureText(text).width>maxWidth)text=text.slice(0,-2)+'…';return text;};
    pitch.querySelectorAll('.lineup-position').forEach(element=>{
      const card=offset(element),role=offset(element.querySelector('small')),shirt=offset(element.querySelector('.lineup-shirt')),name=offset(element.querySelector('.lineup-player-name'));
      ctx.fillStyle='#102e24dd';canvasRoundRect(ctx,card.x,card.y,card.w,card.h,9,true);
      ctx.textAlign='center';ctx.fillStyle='#d4e9de';ctx.font='10px Arial, sans-serif';ctx.fillText(element.querySelector('small').textContent,card.x+card.w/2,role.y);
      ctx.fillStyle=accent;canvasRoundRect(ctx,shirt.x,shirt.y,shirt.w,shirt.h,7,true);
      ctx.fillStyle='#fff';ctx.font='800 14px Arial, sans-serif';ctx.fillText(element.querySelector('.lineup-shirt').textContent,shirt.x+shirt.w/2,shirt.y+7);
      ctx.font='12px Arial, sans-serif';ctx.fillText(fit(element.querySelector('.lineup-player-name').textContent,name.w),card.x+card.w/2,name.y);
    });
    const benchHeading=offset(heading);ctx.textAlign='left';ctx.fillStyle='#fff';ctx.font='700 16px Arial, sans-serif';ctx.fillText(heading.textContent,benchHeading.x,benchHeading.y);
    bench.querySelectorAll('.bench-place').forEach(place=>{
      const slot=place.querySelector('.bench-slot'),label=slot.querySelector('small'),card=offset(slot),labelBox=offset(label);
      ctx.fillStyle='#263c34';canvasRoundRect(ctx,card.x,card.y,card.w,card.h,8,true);ctx.strokeStyle='#718b7e';ctx.lineWidth=1;ctx.stroke();
      ctx.fillStyle='#bbd1c5';ctx.font='11px Arial, sans-serif';ctx.fillText(label.textContent,card.x+8,labelBox.y);
      const shirt=slot.querySelector('.bench-player .lineup-shirt'),name=slot.querySelector('.bench-player-name');
      if(shirt){const box=offset(shirt);ctx.fillStyle=accent;canvasRoundRect(ctx,box.x,box.y,box.w,box.h,6,true);ctx.fillStyle='#fff';ctx.textAlign='center';ctx.font='800 14px Arial, sans-serif';ctx.fillText(shirt.textContent,box.x+box.w/2,box.y+7);ctx.textAlign='left';}
      if(name){const box=offset(name);ctx.fillStyle='#fff';ctx.font='13px Arial, sans-serif';canvasText(ctx,name.textContent,box.x,box.y,box.w,16,2);}
      ctx.textAlign='center';ctx.font='22px Arial, sans-serif';ctx.fillText('×',card.x+card.w-22,card.y+7);ctx.textAlign='left';
    });
    return canvas;
  }finally{root.remove();}
}
async function copyCanvasImage(canvas,button,fileName){const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw new Error('PNG konnte nicht erzeugt werden.');if(navigator.clipboard?.write&&window.ClipboardItem){await navigator.clipboard.write([new ClipboardItem({'image/png':blob})]);button.textContent='Bild kopiert ✓';return;}const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download=fileName;link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);button.textContent='Bild heruntergeladen ✓';}
document.getElementById('lineupCopyFormationImage').onclick=async()=>{const button=document.getElementById('lineupCopyFormationImage'),oldText=button.textContent;button.disabled=true;button.textContent='Bild wird erstellt …';try{await copyCanvasImage(await createFormationImage(),button,'aufstellung-'+(lineup.teamName||'mannschaft').toLowerCase().replace(/[^a-z0-9]+/g,'-')+'.png');}catch(error){console.warn('Aufstellungsbild konnte nicht kopiert werden.',error);button.textContent='Bild konnte nicht erstellt werden';}finally{setTimeout(()=>{button.disabled=false;button.textContent=oldText;},2500);}};
document.getElementById('lineupCopyImage').onclick=async()=>{
  const button=document.getElementById('lineupCopyImage'),oldText=button.textContent;button.disabled=true;button.textContent='Bild wird erstellt …';
  let blob=null;try{const canvas=await createInvitationImage();blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
    if(!blob)throw new Error('PNG konnte nicht erzeugt werden.');
    if(navigator.clipboard?.write&&window.ClipboardItem){await navigator.clipboard.write([new ClipboardItem({'image/png':blob})]);button.textContent='Bild kopiert ✓';}
    else{const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download='einladung-'+(lineup.teamName||'mannschaft').toLowerCase().replace(/[^a-z0-9]+/g,'-')+'.png';link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);button.textContent='Bild heruntergeladen ✓';}
  }catch(error){console.warn('Bild konnte nicht kopiert werden.',error);if(blob){const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download='einladung-'+(lineup.teamName||'mannschaft').toLowerCase().replace(/[^a-z0-9]+/g,'-')+'.png';link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);button.textContent='Bild heruntergeladen ✓';}else button.textContent='Bild konnte nicht erstellt werden';}
  finally{setTimeout(()=>{button.disabled=false;button.textContent=oldText;},2500);}
};
function updateLineupNav(){
  const first=document.getElementById('tabBtn_aufstellung'),second=document.getElementById('tabBtn_aufstellung2'),hasSecond=lineups.length>1;
  if(first){
    const firstLabel=typeof first.querySelector==='function'?first.querySelector('.navLabel'):null;
    if(firstLabel)firstLabel.textContent='Aufstellung';else first.textContent='Aufstellung';
    first.classList.toggle('active',document.getElementById('page_aufstellung').classList.contains('active'));
  }
  if(second){
    const secondLabel=typeof second.querySelector==='function'?second.querySelector('.navLabel'):null;
    if(secondLabel)secondLabel.textContent='Aufstellung 2. Mannschaft';else second.textContent='Aufstellung 2. Mannschaft';
    second.hidden=!hasSecond;
    second.classList.toggle('active',document.getElementById('page_aufstellung').classList.contains('active')&&activeLineupIndex===1);
  }
  const createButton=document.getElementById('lineupCreateSecond');if(createButton){createButton.hidden=hasSecond;createButton.style.display=hasSecond?'none':'';}
  const removeButton=document.getElementById('lineupRemoveSecond');if(removeButton){removeButton.hidden=!(hasSecond&&activeLineupIndex===1);removeButton.style.display=hasSecond&&activeLineupIndex===1?'':'none';}
}
function showLineupTeam(index){
  if(!lineups[index])return;activeLineupIndex=index;lineup=lineups[index];showPage('aufstellung');renderLineup();persistLineup();updateLineupNav();
}
document.getElementById('lineupCreateSecond').onclick=()=>{
  if(lineups.length>1)return;
  ensureLineupTeam(1);showLineupTeam(1);
};
document.getElementById('lineupRemoveSecond').onclick=()=>{
  if(lineups.length<2||activeLineupIndex!==1)return;
  if(!confirm('Alle gespeicherten Aufstellungen der 2. Mannschaft einschließlich Einladungen wirklich entfernen?'))return;
  Object.entries(lineupPlans).filter(([,plan])=>Number(plan.teamIndex)===1).forEach(([id])=>delete lineupPlans[id]);
  lineups.splice(1,1);freeLineups.splice(1,1);activeFixtureIds[1]=null;activeLineupIndex=0;lineup=lineups[0];persistLineup();renderLineup();updateLineupNav();
};
renderLineup();
updateLineupNav();

