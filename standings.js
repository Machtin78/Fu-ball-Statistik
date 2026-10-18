(function(){
  'use strict';
  let selectedTeam='first';
  let payload=null;
  let pending=null;

  function element(tag,className,text){
    const node=document.createElement(tag);
    if(className)node.className=className;
    if(text!==undefined)node.textContent=String(text);
    return node;
  }
  function fact(value,label){
    const box=element('div','standingsFact');
    box.append(element('strong','',value),element('span','',label));
    return box;
  }
  function render(){
    const target=document.getElementById('standingsContent');
    if(!target||!payload)return;
    target.replaceChildren();
    const group=payload.standings.find(item=>item.key===selectedTeam);
    if(!group){target.append(element('p','standingsStatus','Für diese Mannschaft ist keine Tabelle verfügbar.'));return;}
    const own=group.rows.find(row=>row.own);
    if(!own){target.append(element('p','standingsStatus','Der TSV Buchenberg wurde in dieser Tabelle nicht gefunden.'));return;}

    const league=element('p','standingsLeague');
    league.append(element('strong','',group.name));
    if(group.league)league.append(document.createTextNode(' · '+group.league));
    if(group.season)league.append(document.createTextNode(' · '+group.season));
    target.append(league);
    const summary=element('div','standingsSummary');
    summary.append(fact(own.position+'. / '+group.rows.length,'Tabellenplatz'),fact(own.points,'Punkte'),fact(own.played,'Spiele'));
    target.append(summary);

    const scroll=element('div','standingsScroll');
    const table=element('table','standingsTable');
    table.setAttribute('aria-label','BFV-Tabelle '+group.name);
    const head=element('thead');
    const heading=element('tr');
    const columns=[['Pl.',''],['Mannschaft',''],['Sp.',''],['S','standingsDetail'],['U','standingsDetail'],['N','standingsDetail'],['Tore',''],['Diff.','standingsDetail'],['Pkt.','']];
    columns.forEach(([label,style])=>{const th=element('th',style,label);th.scope='col';heading.append(th);});
    head.append(heading);table.append(head);
    const body=element('tbody');
    group.rows.forEach(row=>{
      const tr=element('tr',row.own?'standingsOwn':'');
      [row.position,row.team,row.played,row.wins,row.draws,row.losses,row.goals,row.difference,row.points].forEach((value,index)=>{
        const td=element('td',columns[index][1],value);
        if(index===1){
          td.replaceChildren();
          const cell=element('span','standingsTeamCell'),logo=element('img','standingsTeamLogo');
          logo.src=window.clubLogoForTeam?.(row.team,row.own)||'assets/club-logos/unknown.svg';
          logo.alt='';
          cell.append(logo,document.createTextNode(row.team));td.append(cell);
          if(row.own)td.setAttribute('aria-label',row.team+' – eigene Mannschaft');
        }
        tr.append(td);
      });
      body.append(tr);
    });
    table.append(body);scroll.append(table);target.append(scroll);
    const source=element('p','standingsSource');
    const link=element('a','','Tabelle beim BFV öffnen');
    link.href=group.source;link.target='_blank';link.rel='noopener noreferrer';
    source.append(link);target.append(source);
  }
  function showStatus(message){document.getElementById('standingsStatus').textContent=message;}
  function selectStandingsTeam(team){
    selectedTeam=team==='second'?'second':'first';
    document.getElementById('standingsFirst').setAttribute('aria-pressed',String(selectedTeam==='first'));
    document.getElementById('standingsSecond').setAttribute('aria-pressed',String(selectedTeam==='second'));
    render();
  }
  async function loadStandings(force=false){
    if(pending)return pending;
    const button=document.getElementById('standingsRefresh');
    button.disabled=true;
    showStatus('Tabelle wird geladen …');
    pending=(async()=>{
      try{
        const response=await fetch('/api/standings'+(force?'?refresh=1':''),{cache:'no-store'});
        if(!response.ok)throw new Error('HTTP '+response.status);
        const next=await response.json();
        if(!Array.isArray(next.standings))throw new Error('Ungültige Tabellenantwort');
        payload=next;render();
        const date=new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',dateStyle:'medium',timeStyle:'short'}).format(new Date(next.updatedAt));
        showStatus((next.stale?'BFV derzeit nicht erreichbar · Letzter Stand: ':'BFV-Stand: ')+date+' Uhr');
      }catch(error){
        console.error('BFV-Tabelle konnte nicht geladen werden:',error);
        showStatus(payload?'Aktualisierung nicht möglich. Der zuletzt geladene Stand bleibt sichtbar.':'Die Tabelle ist gerade nicht erreichbar. Bitte später erneut versuchen.');
      }finally{button.disabled=false;pending=null;}
    })();
    return pending;
  }
  function renderStandings(){if(payload)render();loadStandings();}
  window.selectStandingsTeam=selectStandingsTeam;
  window.loadStandings=loadStandings;
  window.renderStandings=renderStandings;
})();

