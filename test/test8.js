const http=require('http'),fs=require('fs'),path=require('path'),puppeteer=require('puppeteer-core');
const ROOT=require('path').resolve(__dirname,'..'),PORT=8092;
const FAKE=fs.readFileSync(require('path').resolve(__dirname,'fakepeer.js'),'utf8');
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css'};
const server=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';const f=path.join(ROOT,p);if(!fs.existsSync(f)){r.writeHead(404);return r.end('nf');}r.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(r);});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const errors=[],out={};
async function mk(b,label,name){
  const p=await b.newPage();
  await p.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
  p.on('pageerror',e=>errors.push(label+' pageerror: '+String(e).slice(0,160)));
  p.on('console',m=>{if(m.type()==='error')errors.push(label+': '+m.text().slice(0,160));});
  await p.goto('http://localhost:'+PORT+'/',{waitUntil:'networkidle2'});
  await p.evaluate(()=>{localStorage.clear();sessionStorage.clear();});
  await p.reload({waitUntil:'networkidle2'});
  await p.evaluate('window.CRSEK_FAKE_PEER=true;'+FAKE);
  await p.waitForSelector('#nameInput',{visible:true});
  await p.type('#nameInput',name);await p.click('#nameGo');
  await p.waitForSelector('#createBtn',{visible:true});
  return p;
}
async function pilot(p,sec){
  const end=Date.now()+sec*1000;
  while(Date.now()<end){
    await p.evaluate(()=>{const a=window.__crsek,st=a.state;if(!st)return;
      const t=document.getElementById('tossOverlay');if(!t.classList.contains('hidden')){document.getElementById('tossBat').click();return;}
      if(a.role==='bat'&&st.phase==='flight'){const x=document.querySelector('[data-shot="drive"]');if(x)x.click();}
      else if(a.role==='bowl'&&st.phase==='delivery'){const x=document.querySelector('[data-act="release"]');if(x)x.click();}
      else if(a.role==='field'&&st.ball&&st.ball.stopped&&st.ball.heldBy===a.pid){const x=document.querySelector('[data-end="striker"]');if(x)x.click();}});
    await wait(300);
  }
}
(async()=>{
 await new Promise(r=>server.listen(PORT,r));
 const b=await puppeteer.launch({executablePath:'/usr/local/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=swiftshader','--enable-unsafe-swiftshader'],headless:'new'});
 try{
  const H=await mk(b,'H','Hosty');
  await H.evaluate(()=>document.querySelector('[data-f="2"]').click());
  await H.evaluate(()=>document.querySelector('[data-o="2"]').click());
  await H.click('#createBtn');
  await H.waitForFunction(()=>/^[A-Z2-9]{4}$/.test(document.getElementById('roomCode').textContent.trim()),{timeout:8000});
  const code=await H.evaluate(()=>document.getElementById('roomCode').textContent.trim());
  const G=await mk(b,'G','Guesty');
  await G.evaluate(c=>window.__crsek.joinRoom(c),code);
  await wait(2000);
  out.lobby=await H.evaluate(()=>window.__crsek.lobby.map(p=>p.name));
  await H.evaluate(()=>window.__crsek.hostStart());
  await wait(1200);
  await Promise.all([pilot(H,14),pilot(G,14)]);
  out.sync=await Promise.all([H,G].map(p=>p.evaluate(()=>{const s=window.__crsek.state;return s?[s.teams[s.batTeam].score.r,s.balls,s.strikerId]:null;})));
  out.guestPid=await G.evaluate(()=>window.__crsek.pid);
  out.kits=await H.evaluate(()=>{const s=window.__crsek.state;return s.teams.map(t=>t.players.map(p=>p.kit)).flat().slice(0,4);});

  // ---- forced disconnect ----
  await G.evaluate(()=>{window.__crsek.net.conns.forEach(c=>c.close());});
  await wait(1800);
  out.afterDrop=await H.evaluate(()=>{
    const s=window.__crsek.state;
    const p=s.teams.flatMap(t=>t.players).find(p=>p.name==='Guesty');
    return {hostBanner:document.getElementById('netBanner').textContent.slice(0,40), guestBot:p?p.bot:'not-found'};
  });
  out.guestScreenAfterDrop=await G.evaluate(()=>document.querySelector('.screen.active').id);
  out.guestBanner=await G.evaluate(()=>document.getElementById('netBanner').textContent.slice(0,60));

  // ---- reconnect ----
  await G.evaluate(()=>window.__crsek.reconnect());
  await wait(2500);
  out.afterRejoin=await Promise.all([H,G].map(p=>p.evaluate(()=>({
    screen:document.querySelector('.screen.active').id,
    phase:window.__crsek.state?window.__crsek.state.phase:null,
    score:window.__crsek.state?window.__crsek.state.teams[window.__crsek.state.batTeam].score.r:null
  }))));
  out.guestBotAfter=await H.evaluate(()=>{
    const s=window.__crsek.state;
    const p=s.teams.flatMap(t=>t.players).find(p=>p.name==='Guesty');
    return p?p.bot:'missing';
  });
  out.errors=errors.slice(0,8);
 }catch(e){out.fatal=String(e).slice(0,300);out.errors=errors.slice(0,8);}
 finally{
  fs.writeFileSync('/scratch/work/test/out8.json',JSON.stringify(out,null,1));
  console.log(JSON.stringify(out,null,1));
  await b.close();server.close();setTimeout(()=>process.exit(0),200);
 }
})();
