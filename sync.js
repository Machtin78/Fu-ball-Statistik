(()=>{
  if(!/^https?:$/.test(location.protocol))return;
  const KEYS=['footballTrackerV18','footballTrackerSeasonV18','footballTrackerTeamNamesV18','footballTrackerClubLogoV1','footballTrackerLineupV1','footballTrackerScheduleV1','footballTrackerTrainingV1','footballTrackerHistoryImport20260930'];
  const APPLIED_REVISION_KEY='footballSyncAppliedRevision';
  let revision=0,ready=false,dirty=false,timer=null,poll=null,currentUser=null,applying=false,changeSerial=0,pushing=null;
  const nativeSet=Storage.prototype.setItem,nativeRemove=Storage.prototype.removeItem;
  function watched(storage,key){return storage===localStorage&&KEYS.includes(String(key));}
  Storage.prototype.setItem=function(key,value){const track=watched(this,key)&&ready&&!applying,before=track?this.getItem(key):null;nativeSet.call(this,key,value);if(track&&before!==String(value))changed();};
  Storage.prototype.removeItem=function(key){const track=watched(this,key)&&ready&&!applying,before=track?this.getItem(key):null;nativeRemove.call(this,key);if(track&&before!==null)changed();};
  function capture(){return Object.fromEntries(KEYS.map(key=>[key,localStorage.getItem(key)]));}
  function apply(data){
    // The page's unload handlers must not save the old in-memory state over
    // this freshly downloaded server state during the following reload.
    globalThis.footballSyncApplyingRemoteState=true;
    applying=true;
    try{KEYS.forEach(key=>data[key]==null?nativeRemove.call(localStorage,key):nativeSet.call(localStorage,key,data[key]));}
    finally{applying=false;}
  }
  async function api(path,method='GET',data){
    const response=await fetch('/api'+path,{method,credentials:'same-origin',cache:'no-store',headers:{'content-type':'application/json','x-football-request':'1'},body:data===undefined?undefined:JSON.stringify(data)});
    let value={};try{value=await response.json();}catch{}
    if(!response.ok){const error=new Error(value.error||'Server nicht erreichbar.');error.status=response.status;error.value=value;throw error;}return value;
  }
  const style=document.createElement('style');style.textContent=`
    .authOverlay{position:fixed;inset:0;z-index:20000;background:linear-gradient(#10251fd9,#10251ff2),var(--app-grass-image) center/cover;display:grid;place-items:center;padding:18px}.authOverlay[hidden]{display:none!important}.authCard{width:min(390px,100%);background:#fff;color:#17251f;border-radius:16px;padding:22px;box-shadow:0 18px 50px #0008}.authCard h2{margin-bottom:8px}.authCard p{margin:7px 0 14px;line-height:1.4}.authCard label{display:grid;gap:5px;margin:10px 0;font-weight:700}.authCard input{width:100%;padding:12px;border:1px solid #8ca298;border-radius:8px;font:inherit}.authCard button{width:100%;padding:12px;border:0;border-radius:9px;background:#1565c0;color:#fff;font-weight:800;font-size:1rem}.authError{min-height:1.3em;color:#a30e18;margin-top:10px!important}.syncBar{display:flex;align-items:center;justify-content:space-between;gap:8px;background:#10251fdd;border:1px solid #ffffff35;border-radius:10px;padding:8px 10px;margin-bottom:8px;font-size:.82rem}.syncBarActions{display:flex;gap:6px}.syncBar button{border:0;border-radius:7px;padding:7px 9px;background:#eef6f1;color:#173027;font-weight:700}.syncStatus{overflow-wrap:anywhere}`;
  document.head.appendChild(style);
  const overlay=document.createElement('div');overlay.className='authOverlay';overlay.hidden=true;overlay.innerHTML=`<form class="authCard" id="authLogin"><h2>Trainer-Anmeldung</h2><p>Melde Dich an, um mit dem gemeinsamen Datenstand zu arbeiten.</p><label>Benutzername<input id="authUsername" autocomplete="username" required></label><label>Passwort<input id="authPassword" type="password" autocomplete="current-password" required></label><button>Anmelden</button><p id="authError" class="authError" role="alert"></p></form><form class="authCard" id="authChange" hidden><h2>Neues Passwort festlegen</h2><p>Das gemeinsame Startpasswort muss beim ersten Login ersetzt werden.</p><label>Neues Passwort<input id="authNewPassword" type="password" minlength="8" autocomplete="new-password" required></label><label>Passwort wiederholen<input id="authNewPassword2" type="password" minlength="8" autocomplete="new-password" required></label><button>Passwort speichern</button><p id="authChangeError" class="authError" role="alert"></p></form>`;document.body.appendChild(overlay);
  const bar=document.createElement('div');bar.className='syncBar';bar.hidden=true;bar.innerHTML='<span class="syncStatus">Verbindung wird hergestellt …</span><div class="syncBarActions"><button id="syncNow" type="button">Jetzt speichern</button><button id="syncLogout" type="button">Abmelden</button></div>';
document.querySelector('.c')?.append(bar);
  const status=text=>{bar.querySelector('.syncStatus').textContent=text;};
  function showPassword(){overlay.hidden=false;document.getElementById('authLogin').hidden=true;document.getElementById('authChange').hidden=false;}
  async function initialize(user){
    currentUser=user;if(user.mustChange){showPassword();return;}
    const state=await api('/state');revision=state.revision;
    if(state.data===null){
      if(user.role!=='admin'){document.getElementById('authError').textContent='Steyer muss den gemeinsamen Datenstand zuerst am Hauptrechner einrichten.';return;}
      const result=await api('/state','PUT',{revision,data:capture()});revision=result.revision;
    }else if(JSON.stringify(capture())!==JSON.stringify(state.data)){
      if(sessionStorage.getItem(APPLIED_REVISION_KEY)===String(state.revision)){sessionStorage.removeItem(APPLIED_REVISION_KEY);dirty=true;}
      else{sessionStorage.setItem(APPLIED_REVISION_KEY,String(state.revision));apply(state.data);location.reload();return;}
    }else sessionStorage.removeItem(APPLIED_REVISION_KEY);
    const needsInitialPush=dirty;overlay.remove();bar.hidden=false;ready=true;dirty=needsInitialPush;status(`${user.username} · gemeinsamer Datenstand aktuell`);
    if(dirty){status('Erster Datenabgleich wird abgeschlossen …');setTimeout(push,100);}
    clearInterval(poll);poll=setInterval(checkRemote,15000);
  }
  function changed(){changeSerial++;dirty=true;status('Änderungen werden gespeichert …');clearTimeout(timer);timer=setTimeout(push,900);}
  async function push(){
    if(pushing)return pushing;
    if(!ready||!dirty)return true;
    const data=capture(),sentSerial=changeSerial;
    pushing=(async()=>{
      try{
        const result=await api('/state','PUT',{revision,data});revision=result.revision;
        dirty=sentSerial!==changeSerial;
        if(dirty){status('Weitere Änderungen werden gespeichert …');clearTimeout(timer);timer=setTimeout(push,100);}
        else status(`${currentUser.username} · gespeichert`);
        return true;
      }catch(error){
        if(error.status===409){status('Ein anderer Trainer hat inzwischen gespeichert. Deine Änderungen bleiben erhalten. Bitte „Jetzt speichern“ drücken.');return false;}
        status('Speichern fehlgeschlagen: '+error.message);return null;
      }finally{pushing=null;}
    })();
    return pushing;
  }
  async function checkRemote(manual=false){
    if(!ready)return;try{
      if(dirty){
        if(!manual)return;
        const saved=await push();
        if(saved!==false||!dirty)return;
        if(!confirm('Ein anderer Trainer hat inzwischen gespeichert. Soll dessen Serverstand geladen werden? Deine noch nicht gespeicherten Änderungen gehen dabei verloren.'))return;
        const latest=await api('/state');revision=latest.revision;apply(latest.data||{});dirty=false;location.reload();return;
      }
      const state=await api('/state');
      if(state.revision!==revision){
        if(!manual){status('Neuer gemeinsamer Datenstand verfügbar. Bitte „Jetzt speichern“ drücken.');return;}
        apply(state.data||{});location.reload();return;
      }
      if(manual)status(`${currentUser.username} · gemeinsamer Datenstand aktuell`);
    }catch(error){status('Verbindung unterbrochen: '+error.message);}
  }
  document.getElementById('authLogin').onsubmit=async event=>{event.preventDefault();const error=document.getElementById('authError');error.textContent='Anmeldung wird geprüft …';try{const result=await api('/login','POST',{username:document.getElementById('authUsername').value.trim(),password:document.getElementById('authPassword').value});error.textContent='';await initialize(result.user);}catch(e){error.textContent=e.message;}};
  document.getElementById('authChange').onsubmit=async event=>{event.preventDefault();const first=document.getElementById('authNewPassword').value,second=document.getElementById('authNewPassword2').value,error=document.getElementById('authChangeError');if(first!==second){error.textContent='Die Passwörter stimmen nicht überein.';return;}try{await api('/password','POST',{password:first});currentUser.mustChange=false;error.textContent='';await initialize(currentUser);}catch(e){error.textContent=e.message;}};
  bar.querySelector('#syncNow').onclick=()=>checkRemote(true);
  bar.querySelector('#syncLogout').onclick=async()=>{try{await push();await api('/logout','POST',{});}finally{location.reload();}};
  (async()=>{try{const result=await api('/session');await initialize(result.user);}catch(error){overlay.hidden=false;if(error.status!==401)document.getElementById('authError').textContent='Server nicht erreichbar: '+error.message;}})();
})();


