const http=require('http'),fs=require('fs'),path=require('path'),puppeteer=require('puppeteer-core');
const ROOT=require('path').resolve(__dirname,'..'),PORT=8095;
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css'};
const server=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';const f=path.join(ROOT,p);if(!fs.existsSync(f)){r.writeHead(404);return r.end('nf');}r.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(r);});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 await new Promise(r=>server.listen(PORT,r));
 const b=await puppeteer.launch({executablePath:'/usr/local/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=swiftshader','--enable-unsafe-swiftshader'],headless:'new'});
 const p=await b.newPage();await p.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
 const errs=[];p.on('pageerror',e=>errs.push(String(e).slice(0,160)));p.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,160));});
 await p.goto('http://localhost:'+PORT+'/',{waitUntil:'networkidle2'});
 await p.evaluate(()=>{localStorage.clear();sessionStorage.clear();});await p.reload({waitUntil:'networkidle2'});
 await p.waitForSelector('#nameInput',{visible:true});await p.type('#nameInput','Selva');await p.click('#nameGo');
 await p.waitForSelector('#practiceBtn',{visible:true});
 await p.evaluate(()=>document.querySelector('[data-f="1"]').click());
 await p.evaluate(()=>document.querySelector('[data-o="2"]').click());
 await p.click('#practiceBtn');
 const t0=Date.now(); const trace=[]; let scorecardOk=null;
 while(Date.now()-t0<205000){
   const info=await p.evaluate(()=>{
     const app=window.__crsek,st=app.state;
     if(!st) return {screen:document.querySelector('.screen.active').id};
     return {screen:document.querySelector('.screen.active').id,phase:st.phase,role:app.role,inn:st.innings,
       score:st.teams[st.batTeam].score.r+'/'+st.teams[st.batTeam].score.w,balls:st.balls,
       striker:st.teams[st.batTeam].players.find(x=>x.id===st.strikerId)?.name};
   });
   trace.push(info.screen+' '+info.phase+' '+info.role+' '+info.score+' b'+info.balls);
   if(info.screen==='screen-result') break;
   await p.evaluate(()=>{
     const app=window.__crsek,st=app.state;if(!st)return;
     const toss=document.getElementById('tossOverlay');
     if(!toss.classList.contains('hidden')){document.getElementById('tossBat').click();return;}
     if(app.role==='bat'&&st.phase==='flight'){const btn=document.querySelector('[data-shot="drive"]');if(btn)btn.click();}
     else if(app.role==='bowl'&&st.phase==='delivery'){const btn=document.querySelector('[data-act="release"]');if(btn)btn.click();}
     else if(app.role==='nonstriker'&&st.phase==='inplay'&&Math.random()<0.15){const btn=document.querySelector('[data-act="run"]');if(btn)btn.click();}
   });
   if(!scorecardOk && info.phase==='inplay'){
     scorecardOk=await p.evaluate(()=>{document.getElementById('scorecardBtn').click();const t=document.getElementById('scorecardInner');const ok=t.innerHTML.includes('<table')&&t.innerHTML.includes('Batter');document.getElementById('scClose')?.click();return ok;});
   }
   await wait(300);
 }
 const res=await p.evaluate(()=>({
   screen:document.querySelector('.screen.active').id,
   title:document.getElementById('resultTitle').textContent,
   grid:document.getElementById('resultGrid').textContent,
   state:window.__crsek.state?{phase:window.__crsek.state.phase,inn:window.__crsek.state.innings}:null
 }));
 console.log(JSON.stringify({result:res,scorecardOk,elapsed:Math.round((Date.now()-t0)/1000),errors:errs.slice(0,6),tail:trace.slice(-10),uniqueScreens:[...new Set(trace.map(t=>t.split(' ')[0]))]},null,1));
 await b.close();server.close();setTimeout(()=>process.exit(0),200);
})();
