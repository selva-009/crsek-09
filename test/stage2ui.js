const http=require('http'),fs=require('fs'),path=require('path'),puppeteer=require('puppeteer-core');
const ROOT=require('path').resolve(__dirname,'..'),PORT=8081;
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css'};
const server=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';const f=path.join(ROOT,p);if(!fs.existsSync(f)){r.writeHead(404);return r.end('nf');}r.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(r);});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 await new Promise(r=>server.listen(PORT,r));
 const b=await puppeteer.launch({executablePath:'/usr/local/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=swiftshader','--enable-unsafe-swiftshader'],headless:'new'});
 const p=await b.newPage();await p.setViewport({width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:2});
 const errs=[];p.on('pageerror',e=>errs.push(String(e).slice(0,160)));p.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,160));});
 const out={};
 await p.goto('http://localhost:'+PORT+'/',{waitUntil:'networkidle2'});
 await p.evaluate(()=>{localStorage.clear();sessionStorage.clear();});await p.reload({waitUntil:'networkidle2'});
 await p.waitForSelector('#nameInput',{visible:true});await p.type('#nameInput','Selva');await p.click('#nameGo');
 await wait(700);
 out.tutorialAutoOpens=await p.evaluate(()=>!document.getElementById('tutorial').classList.contains('hidden'));
 // step through all 5
 const steps=[];
 for(let i=0;i<5;i++){
   steps.push(await p.evaluate(()=>document.getElementById('tutStep').textContent+' | '+document.getElementById('tutTitle').textContent));
   await p.evaluate(()=>document.getElementById('tutNext').click());
   await wait(120);
 }
 out.tutorialSteps=steps;
 out.tutorialClosed=await p.evaluate(()=>({
   hidden:document.getElementById('tutorial').classList.contains('hidden'),
   flag:localStorage.getItem('crsek09_seen_tutorial')}));
 // settings
 await p.evaluate(()=>document.getElementById('settingsBtn').click());
 await wait(150);
 await p.evaluate(()=>{
   const s=document.getElementById('setSens'); s.value='140'; s.dispatchEvent(new Event('input'));
   const snd=document.getElementById('setSound'); snd.checked=false; snd.dispatchEvent(new Event('change'));
   const g=document.getElementById('setGfx'); g.value='low'; g.dispatchEvent(new Event('change'));
   const c=document.getElementById('setCam'); c.value='broadcast'; c.dispatchEvent(new Event('change'));
 });
 await wait(200);
 out.settings=await p.evaluate(()=>({saved:JSON.parse(localStorage.getItem('crsek09_settings')||'{}')}));
 await p.evaluate(()=>document.getElementById('settingsClose').click());
 // practice match: partnership + pause
 await p.click('#practiceBtn');
 for(let i=0;i<60;i++){
   const st=await p.evaluate(()=>{const a=window.__crsek,s=a.state;if(!s)return null;
     const t=document.getElementById('tossOverlay');if(!t.classList.contains('hidden')){document.getElementById('tossBat').click();}
     return {phase:s.phase,paused:s.paused};});
   if(st&&st.phase!=='toss')break;
   await wait(150);
 }
 await wait(1200);
 out.partnershipLine=await p.evaluate(()=>document.getElementById('partnershipLine').textContent);
 await p.evaluate(()=>document.getElementById('pauseBtn').click());
 await wait(300);
 out.paused=await p.evaluate(()=>({
   overlay:!document.getElementById('pauseOverlay').classList.contains('hidden'),
   enginePaused:window.__crsek.state&&window.__crsek.state.paused,
   phase:window.__crsek.runner.phase}));
 await p.evaluate(()=>document.getElementById('resumeBtn').click());
 await wait(600);
 out.resumed=await p.evaluate(()=>({
   overlayHidden:document.getElementById('pauseOverlay').classList.contains('hidden'),
   enginePaused:window.__crsek.state&&window.__crsek.state.paused,
   phase:window.__crsek.runner.phase}));
 out.camera=await p.evaluate(()=>window.__crsek.view3d&&window.__crsek.view3d.cameraMode());
 out.errors=errs.slice(0,6);
 console.log(JSON.stringify(out,null,1));
 await b.close();server.close();setTimeout(()=>process.exit(0),200);
})();
