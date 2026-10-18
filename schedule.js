const SCHEDULE_KEY='footballTrackerScheduleV1';
const SCHEDULE_IMPORT_KEY='footballTrackerScheduleImport20260901';
const IMPORTED_SCHEDULE=[
  ['310694003','2026-09-18','16:15',1,true,'FC Wiggensbach U12'],
  ['311615003','2026-09-19','11:30',0,false,'SV Lenzfried'],
  ['310694005','2026-09-25','18:00',1,false,'SG Untrasried/Haldenwang'],
  ['311615006','2026-09-26','10:30',0,true,'FC Kempten U13 II'],
  ['311615009','2026-10-03','11:00',0,false,'TSV Kottern U12'],
  ['310694009','2026-10-03','10:30',1,true,'VfB Durach 2'],
  ['310694010','2026-10-09','19:00',1,false,'SG Dietmannsried/Heising 1'],
  ['311615015','2026-10-10','11:30',0,false,'SG Altusried/Krugzell'],
  ['311615018','2026-10-14','18:00',0,true,'VfB Durach'],
  ['310694015','2026-10-16','16:00',1,true,'SV Heiligkreuz 2'],
  ['311615021','2026-10-17','11:00',0,false,'SSV Wertach'],
  ['311615026','2026-10-23','17:00',0,true,'SG Waltenhofen u. v. a.']
];
const SCHEDULE_AWAY_VENUES=[
  {matches:/sv\s+lenzfried/i,location:'Sportplatz SV Lenzfried | Gerhardingerweg 2 | 87437 Kempten (Allgäu)'},
  {matches:/untrasried\s*\/\s*haldenwang/i,location:match=>match.date<'2027-03-01'?'SC Untrasried Hauptfeld | Östliche Dorfeinfahrt | 87496 Untrasried':'MAHA Waldstadion | Am Schwimmbad 3 | 87490 Haldenwang'},
  {matches:/kottern/i,location:'TSV Kottern Kunstrasenplatz | Kieswerkstr. 10 | 87471 Durach'}
];
let scheduleMatches=[],scheduleFilter='all',scheduleEditingId=null;
try{const saved=JSON.parse(localStorage.getItem(SCHEDULE_KEY)||'[]');scheduleMatches=Array.isArray(saved)?saved:[];}catch(e){console.warn('Spieltermine konnten nicht geladen werden.',e);}
try{if(!localStorage.getItem(SCHEDULE_IMPORT_KEY)){IMPORTED_SCHEDULE.forEach(([code,date,time,team,home,opponent])=>{if(!scheduleMatches.some(match=>match.date===date&&(Number(match.team)||0)===team&&String(match.opponent||'').trim().toLocaleLowerCase('de')===opponent.toLocaleLowerCase('de')))scheduleMatches.push({id:'fixture-'+code,code,date,time,team,home,opponent,location:home?(typeof homeMatchAddress==='function'?homeMatchAddress():'87474 Buchenberg, Kürnach Str. 11'):''});});localStorage.setItem(SCHEDULE_KEY,JSON.stringify(scheduleMatches));localStorage.setItem(SCHEDULE_IMPORT_KEY,'1');}}catch(e){console.warn('Spielplan konnte nicht importiert werden.',e);}
function scheduleLocationFallback(match){
  if(match.home)return typeof homeMatchAddress==='function'?homeMatchAddress():'87474 Buchenberg, Kürnach Str. 11';
  const venue=SCHEDULE_AWAY_VENUES.find(entry=>entry.matches.test(String(match.opponent||'')));
  return venue?(typeof venue.location==='function'?venue.location(match):venue.location):'';
}
try{
  let updated=false;
  scheduleMatches.forEach(match=>{
    if(String(match.location||'').trim())return;
    const location=scheduleLocationFallback(match);
    if(location){match.location=location;updated=true;}
  });
  if(updated)localStorage.setItem(SCHEDULE_KEY,JSON.stringify(scheduleMatches));
}catch(e){console.warn('Fehlende Spielorte konnten nicht ergänzt werden.',e);}

const schedulePage=document.createElement('section');
schedulePage.id='page_termine';schedulePage.className='page';
schedulePage.innerHTML=`<div class="sec">
  <h2>Spieltermine</h2>
  <p class="subtle">Hier kannst Du alle Spiele der Saison für beide Mannschaften verwalten.</p>
  <div class="schedule-form">
    <label id="scheduleTeamLabel">Mannschaft<select id="scheduleTeam"><option value="0">1. Mannschaft</option><option value="1">2. Mannschaft</option></select></label>
    <label class="schedule-date">Datum<input id="scheduleDate" type="date"></label>
    <label class="schedule-time">Uhrzeit<input id="scheduleTime" type="time"></label>
    <label class="schedule-opponent">Gegner<input id="scheduleOpponent" type="text" autocomplete="off"></label>
    <label class="schedule-wide schedule-home"><input id="scheduleHome" type="checkbox"> Heimspiel</label>
    <label class="schedule-wide">Spielort<input id="scheduleLocation" type="text" autocomplete="street-address"></label>
  </div>
  <button id="scheduleSave" class="actionBtn blue" type="button">Termin hinzufügen</button>
  <button id="scheduleCancel" class="actionBtn transparent" type="button" hidden>Bearbeitung abbrechen</button>
  <div id="scheduleFilters" class="schedule-filter"></div>
  <div id="scheduleList" class="schedule-list"></div>
</div>`;
document.querySelector('.c').appendChild(schedulePage);

function scheduleTeams(){
  if(typeof lineups!=='undefined'&&lineups.length>1)return [lineups[0]?.teamName||'1. Mannschaft',lineups[1]?.teamName||'2. Mannschaft'];
  return [typeof ownTeamName==='function'?ownTeamName():'1. Mannschaft'];
}
function persistSchedule(){localStorage.setItem(SCHEDULE_KEY,JSON.stringify(scheduleMatches));}
function scheduleDateLabel(value){if(!value)return 'Datum offen';const [y,m,d]=value.split('-');return `${d}.${m}.${y}`;}
function scheduleEsc(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));}
function scheduleResetForm(){
  scheduleEditingId=null;document.getElementById('scheduleDate').value='';document.getElementById('scheduleTime').value='';document.getElementById('scheduleOpponent').value='';document.getElementById('scheduleHome').checked=false;document.getElementById('scheduleLocation').value='';
  document.getElementById('scheduleSave').textContent='Termin hinzufügen';document.getElementById('scheduleCancel').hidden=true;
}
function renderSchedule(){
  const teams=scheduleTeams(),teamSelect=document.getElementById('scheduleTeam'),teamLabel=document.getElementById('scheduleTeamLabel');
  teamLabel.hidden=teams.length<2;teamSelect.innerHTML=teams.map((name,index)=>`<option value="${index}">${scheduleEsc(name)}</option>`).join('');
  const filters=document.getElementById('scheduleFilters');filters.innerHTML=[['all','Alle'],...teams.map((name,index)=>[String(index),name])].map(([value,label])=>`<button type="button" data-filter="${value}" class="${scheduleFilter===value?'active':''}">${scheduleEsc(label)}</button>`).join('');
  filters.querySelectorAll('button').forEach(button=>button.onclick=()=>{scheduleFilter=button.dataset.filter;renderSchedule();});
  const matches=scheduleMatches.slice().sort((a,b)=>(a.date+'T'+(a.time||'00:00')).localeCompare(b.date+'T'+(b.time||'00:00'))).filter(match=>scheduleFilter==='all'||String(match.team)===scheduleFilter);
  const today=new Date().toISOString().slice(0,10),host=document.getElementById('scheduleList');
  if(!matches.length){host.innerHTML='<div class="schedule-empty">Noch keine Spieltermine eingetragen.</div>';return;}
  host.innerHTML=matches.map(match=>{const own=teams[match.team]||teams[0],opponent=match.opponent||'Gegner offen',homeTeam=match.home?own:opponent,awayTeam=match.home?opponent:own,homeLogo=typeof clubLogoForTeam==='function'?clubLogoForTeam(homeTeam):'assets/club-logos/unknown.svg',awayLogo=typeof clubLogoForTeam==='function'?clubLogoForTeam(awayTeam):'assets/club-logos/unknown.svg';return `<article class="schedule-card ${Number(match.team)===1?'team-two':''} ${match.date&&match.date<today?'past':''}" role="button" tabindex="0" title="Aufstellung für dieses Spiel vorbereiten" onclick="openScheduleLineup('${match.id}')" onkeydown="if(event.target===this&&(event.key==='Enter'||event.key===' ')){event.preventDefault();openScheduleLineup('${match.id}');}">
    <div class="schedule-card-head"><strong>${scheduleEsc(scheduleDateLabel(match.date))}${match.time?' · '+scheduleEsc(match.time)+' Uhr':''}</strong><div class="schedule-card-actions"><button class="schedule-iconButton" type="button" aria-label="Aufstellung planen" title="Aufstellung planen" onclick="event.stopPropagation();openScheduleLineup('${match.id}')"><img src="assets/match-action-lineup.png" alt=""><span class="sr-only">Aufstellung planen</span></button><button class="schedule-iconButton" type="button" aria-label="Bearbeiten" title="Bearbeiten" onclick="event.stopPropagation();editScheduleMatch('${match.id}')"><img src="assets/match-action-edit.png" alt=""><span class="sr-only">Bearbeiten</span></button><button class="schedule-iconButton schedule-deleteButton" type="button" aria-label="Löschen" title="Löschen" onclick="event.stopPropagation();deleteScheduleMatch('${match.id}')"><img src="assets/match-action-delete.png" alt=""><span class="sr-only">Löschen</span></button></div></div>
    <div class="schedule-card-body"><div class="schedule-matchup"><div class="schedule-team-line"><img src="${homeLogo}" alt=""><strong>${scheduleEsc(homeTeam)}</strong></div><div class="schedule-team-line"><img src="${awayLogo}" alt=""><strong>${scheduleEsc(awayTeam)}</strong></div></div>${match.location?`<span>${scheduleEsc(match.location)}</span>`:''}</div>
  </article>`;}).join('');
}
function openScheduleLineup(id){
  const match=scheduleMatches.find(item=>item.id===id);if(!match)return;
  if(selectLineupFixture(id,Number(match.team)||0))window.scrollTo({top:0,behavior:'smooth'});
}
function saveScheduleMatch(){
  const entry={id:scheduleEditingId||String(Date.now())+Math.random().toString(16).slice(2),team:Number(document.getElementById('scheduleTeam').value)||0,date:document.getElementById('scheduleDate').value,time:document.getElementById('scheduleTime').value,opponent:document.getElementById('scheduleOpponent').value.trim(),home:document.getElementById('scheduleHome').checked,location:document.getElementById('scheduleLocation').value.trim()};
  if(!entry.date){alert('Bitte ein Spieldatum eintragen.');return;}if(!entry.opponent){alert('Bitte den Gegner eintragen.');return;}
  const index=scheduleMatches.findIndex(match=>match.id===entry.id),previous=index>=0?{...scheduleMatches[index]}:null;if(index>=0)scheduleMatches[index]=entry;else scheduleMatches.push(entry);
  persistSchedule();if(typeof updateLineupForScheduleChange==='function')updateLineupForScheduleChange(previous,entry);scheduleResetForm();renderSchedule();
}
function editScheduleMatch(id){
  const match=scheduleMatches.find(item=>item.id===id);if(!match)return;scheduleEditingId=id;
  document.getElementById('scheduleTeam').value=String(match.team||0);document.getElementById('scheduleDate').value=match.date||'';document.getElementById('scheduleTime').value=match.time||'';document.getElementById('scheduleOpponent').value=match.opponent||'';document.getElementById('scheduleHome').checked=!!match.home;document.getElementById('scheduleLocation').value=match.location||'';
  document.getElementById('scheduleSave').textContent='Änderungen speichern';document.getElementById('scheduleCancel').hidden=false;window.scrollTo({top:0,behavior:'smooth'});
}
function deleteScheduleMatch(id){const match=scheduleMatches.find(item=>item.id===id);if(!match||!confirm(`Termin gegen ${match.opponent||'den Gegner'} wirklich löschen?`))return;scheduleMatches=scheduleMatches.filter(item=>item.id!==id);persistSchedule();if(scheduleEditingId===id)scheduleResetForm();renderSchedule();}
document.getElementById('scheduleHome').onchange=event=>{if(event.target.checked&&!document.getElementById('scheduleLocation').value)document.getElementById('scheduleLocation').value=typeof homeMatchAddress==='function'?homeMatchAddress():'';};
document.getElementById('scheduleSave').onclick=saveScheduleMatch;
document.getElementById('scheduleCancel').onclick=()=>{scheduleResetForm();renderSchedule();};
renderSchedule();



