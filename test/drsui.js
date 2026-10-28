const http=require('http'),fs=require('fs'),path=require('path'),puppeteer=require('puppeteer-core');
const ROOT=require('path').resolve(__dirname,'..'),PORT=8082;
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css'};
const server=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';const f=path.join(ROOT,p);if(!fs.existsSync(f)){r.writeHead(404);return r.end('nf');}r.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(r);});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 await new Promise(r=>server.listen(PORT,r));
 const b=await puppeteer.launch({executablePath:'/usr/local/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=swiftshader','--enable-unsafe-swiftshader'],headless:'new'});
 const p=await b.newPage();await p.setViewport({width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:2});
 const errs=[];p.on('pageerror',e=>errs.push(String(e).slice(0,160)));p.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,160));});
 await p.goto('http://localhost:'+PORT+'/',{waitUntil:'networkidle2'});
 await p.evaluate(()=>{localStorage.clear();sessionStorage.clear();});await p.reload({waitUntil:'networkidle2'});
 await p.waitForSelector('#nameInput',{visible:true});await p.type('#nameInput','Selva');await p.click('#nameGo');
 await p.waitForSelector('#practiceBtn',{visible:true});await p.click('#practiceBtn');
 // get to a live ball, then force an LBW
 for(let i=0;i<200;i++){
   const ready=await p.evaluate(()=>{const a=window.__crsek,s=a.state;if(!s)return false;
     const t=document.getElementById('tossOverlay');if(!t.classList.contains('hidden')){document.getElementById('tossBat').click();}
     if(a.role==='bowl'&&s.phase==='delivery'){const x=document.querySelector('[data-act="release"]');if(x)x.click();}
     return a.role==='bat'&&!!s.delivery;});
   if(ready)break;
   await wait(120);
 }
 await p.evaluate(()=>{
   const r=window.__crsek.runner;
   r.clearTimers(); r.phase='inplay';
   r.ball={x:0.95,y:10,z:0.42};
   r.finishBall({kind:'lbw'});
 });
 await wait(500);
 const out={};
 out.runner=await p.evaluate(()=>{const r=window.__crsek.runner;
   return {phase:r.phase, reviews:r.reviews, pending:!!r.pendingReview,
           last:r.lastResult&&{kind:r.lastResult.kind,text:r.lastResult.text},
           appPhase:window.__crsek.state&&window.__crsek.state.phase,
           appPending:!!(window.__crsek.state&&window.__crsek.state.pendingReview)};});
 out.overlay=await p.evaluate(()=>({
   visible:!document.getElementById('reviewOverlay').classList.contains('hidden'),
   title:document.getElementById('revTitle').textContent,
   sub:document.getElementById('revSub').textContent,
   btn:document.getElementById('revBtn').style.display!=='none',
   pill:document.getElementById('drsPill').textContent
 }));
 await p.screenshot({path:'/scratch/work/test/drs_prompt.png'});
 await p.evaluate(()=>document.getElementById('revBtn').click());
 await wait(900);
 out.verdict=await p.evaluate(()=>({
   overlayHidden:document.getElementById('reviewOverlay').classList.contains('hidden'),
   flash:document.getElementById('flash').textContent,
   toast:document.getElementById('toast').textContent,
   reviewLineVisible:!!(window.__crsek.view3d&&window.__crsek.view3d.scene.children.some(c=>c.type==='Line'&&c.visible)),
   phase:window.__crsek.state.phase,
   wickets:window.__crsek.state.teams[window.__crsek.state.batTeam].score.w,
   reviews:window.__crsek.state.reviews
 }));
 await p.screenshot({path:'/scratch/work/test/drs_verdict.png'});
 out.errors=errs.slice(0,6);
 console.log(JSON.stringify(out,null,1));
 await b.close();server.close();setTimeout(()=>process.exit(0),200);
})();
