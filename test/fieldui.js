const http=require('http'),fs=require('fs'),path=require('path'),puppeteer=require('puppeteer-core');
const ROOT=require('path').resolve(__dirname,'..'),PORT=8055;
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.fbx':'application/octet-stream'};
const server=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';const f=path.join(ROOT,p);if(!fs.existsSync(f)){r.writeHead(404);return r.end('nf');}r.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(r);});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 await new Promise(r=>server.listen(PORT,r));
 const b=await puppeteer.launch({executablePath:'/usr/local/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=swiftshader','--enable-unsafe-swiftshader'],headless:'new'});
 const p=await b.newPage();await p.setViewport({width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:2});
 const errs=[];p.on('pageerror',e=>errs.push(String(e).slice(0,150)));
 await p.goto('http://localhost:'+PORT+'/',{waitUntil:'networkidle2'});
 await p.evaluate(()=>{localStorage.clear();sessionStorage.clear();localStorage.setItem('crsek09_seen_tutorial','1');});
 await p.reload({waitUntil:'networkidle2'});
 await p.waitForSelector('#nameInput',{visible:true});await p.type('#nameInput','Selva');await p.click('#nameGo');
 await p.waitForSelector('#practiceBtn',{visible:true});await p.click('#practiceBtn');
 for(let i=0;i<60;i++){const ph=await p.evaluate(()=>{const a=window.__crsek,s=a.state;if(!s)return null;
   const t=document.getElementById('tossOverlay');if(!t.classList.contains('hidden')){document.getElementById('tossBat').click();}
   return s.phase;}); if(ph)break; await wait(200);}
 await wait(1200);
 // open the field sheet
 await p.evaluate(()=>{const b=document.getElementById('fieldBtn');const r=b.getBoundingClientRect();
   const o={bubbles:true,clientX:r.x+r.width/2,clientY:r.y+r.height/2,pointerId:5,pointerType:'touch',isPrimary:true};
   b.click();});
 await wait(400);
 const out={};
 const sheet=await p.evaluate(()=>{
   const s=document.getElementById('fieldSheet');
   return {visible:!s.classList.contains('hidden'),
     who:document.getElementById('fieldWho').textContent,
     presets:document.querySelectorAll('#fieldPresets [data-preset]').length,
     dots:document.querySelectorAll('#fieldMap circle').length,
     disabled:document.querySelectorAll('#fieldPresets [disabled]').length,
     captainId:window.__crsek.state.captainId, me:window.__crsek.pid, preset:window.__crsek.state.fieldPreset};
 });
 // now pretend we are fielding, so the captain controls unlock
 await p.evaluate(()=>{window.__crsek.runner.batTeam = 1; window.__crsek.runner.broadcast();});
 await wait(400);
 await p.evaluate(()=>{document.getElementById('fieldBtn').click();});
 await wait(300);
 const asCaptain=await p.evaluate(()=>({
   who:document.getElementById('fieldWho').textContent,
   disabled:document.querySelectorAll('#fieldPresets [disabled]').length,
   presets:document.querySelectorAll('#fieldPresets [data-preset]').length}));
 // pick defensive and confirm the engine took it
 await p.evaluate(()=>{const b=document.querySelector('[data-preset="defensive"]');
   const r=b.getBoundingClientRect();
   const o={bubbles:true,clientX:r.x+r.width/2,clientY:r.y+r.height/2,pointerId:6,pointerType:'touch',isPrimary:true};
   b.dispatchEvent(new PointerEvent('pointerdown',o)); b.dispatchEvent(new PointerEvent('pointerup',o));});
 await wait(500);
 const applied=await p.evaluate(()=>({preset:window.__crsek.state.fieldPreset,
   deep:window.__crsek.state.fielders.filter(f=>!f.keeper&&Math.hypot(f.x,f.y-10)>40).length}));
 out.asCaptain=asCaptain; out.applied=applied;
 await p.screenshot({path:require('path').resolve(__dirname,'field.png')});
 console.log(JSON.stringify({sheet, asCaptain:out.asCaptain, applied:out.applied, errors:errs.slice(0,3)},null,1));
 await b.close();server.close();setTimeout(()=>process.exit(0),200);
})();
