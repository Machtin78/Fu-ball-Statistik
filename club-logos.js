(function(){
  'use strict';
  // Local copies of the club crests shown in the public BFV tables of both teams.
  const logos=[
    ['tsv 1874 kottern','tsv-kottern'],
    ['tsv kottern','tsv-kottern'],
    ['sg altusried','sg-altusried-krugzell'],
    ['vfb durach','vfb-durach'],
    ['sv lenzfried','sv-lenzfried'],
    ['ssv wertach','ssv-wertach'],
    ['fc kempten','fc-kempten'],
    ['sg waltenhofen','sg-waltenhofen'],
    ['sg untrasried','sg-untrasried-haldenwang'],
    ['sv heiligkreuz','sv-heiligkreuz'],
    ['fc wiggensbach','fc-wiggensbach'],
    ['sg dietmannsried','sg-dietmannsried-heising']
  ];
  const fallback='assets/club-logos/unknown.svg';
  function normalize(name){return String(name||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();}
  function isOwnTeam(name){
    const key=normalize(name);
    if(!key)return false;
    if(/\bbuchenberg\b/.test(key))return true;
    const configured=normalize(document.getElementById('myTeamName')?.value);
    if(configured&&key===configured)return true;
    const current=typeof matchContext!=='undefined'?matchContext:null;
    return !!current?.team&&key===normalize(current.team);
  }
  function clubLogoForTeam(name,own=false){
    if(own||isOwnTeam(name))return document.getElementById('appClubLogo')?.src||'tsv-buchenberg-logo.png';
    const key=normalize(name);
    const match=logos.find(([part])=>key.includes(part));
    return match?`assets/club-logos/${match[1]}.png`:fallback;
  }
  function renderMatchLogos(){
    for(const [inputId,imageId] of [['tH','matchHomeLogo'],['tAName','matchAwayLogo']]){
      const input=document.getElementById(inputId),image=document.getElementById(imageId);
      if(!input||!image)continue;
      const name=input.value.trim(),src=clubLogoForTeam(name);
      if(image.getAttribute('src')!==src)image.src=src;
      image.alt=name&&src!==fallback?'Vereinslogo von '+name:'';
    }
  }
  for(const id of ['tH','tAName','myTeamName'])document.getElementById(id)?.addEventListener('input',renderMatchLogos);
  for(const id of ['matchHomeLogo','matchAwayLogo'])document.getElementById(id)?.addEventListener('error',event=>{if(!event.target.src.endsWith('/unknown.svg'))event.target.src=fallback;});
  window.clubLogoForTeam=clubLogoForTeam;
  window.renderMatchLogos=renderMatchLogos;
  renderMatchLogos();
  if(typeof renderSeason==='function') renderSeason();
})();

